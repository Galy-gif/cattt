import Foundation

// 用真实 WorldBridge 与值协议，替换网络和 UIKit 引擎；覆盖响应丢失时的调度行为。
struct SSEEvent { let event: String; let data: String }
enum APIError: Error { case http(Int, String) }

@MainActor final class WorldEngine {
    var agentActionChanged: ((WorldCommand, String, String?) -> Void)?
    var snapshot = WorldSnapshot(stateVersion: 1, sceneVersion: 4, destinationIds: ["tree", "pond"], currentDestinationId: "tree", targetDestinationId: "tree", phase: "idle", action: "idle", paused: false, runnable: true)
    var moves = 0
    func worldSnapshot() -> WorldSnapshot { snapshot }
    func applyRuntimeState(energy: String, willingness: String) {}
    func interruptAgentMove(reason: String) {}
    func beginAgentMove(_ command: WorldCommand, finishAfter: Double) -> Bool {
        guard snapshot.stateVersion == command.stateVersion else { return false }
        moves += 1
        snapshot = WorldSnapshot(stateVersion: 2, sceneVersion: 4, destinationIds: ["tree", "pond"], currentDestinationId: "pond", targetDestinationId: "pond", phase: "idle", action: "idle", paused: false, runnable: true)
        agentActionChanged?(command, "arrived", nil)
        snapshot = WorldSnapshot(stateVersion: 3, sceneVersion: 4, destinationIds: ["tree", "pond"], currentDestinationId: "tree", targetDestinationId: "tree", phase: "idle", action: "idle", paused: false, runnable: true)
        return true
    }
}

@MainActor final class APIClient {
    enum Scenario { case acceptanceLost, arrivalLost }
    let scenario: Scenario
    let engine: WorldEngine
    var acknowledgements: [WorldAcknowledgement] = []
    var delivered = false
    var done = false
    init(_ scenario: Scenario, engine: WorldEngine) { self.scenario = scenario; self.engine = engine }
    static func decode<T: Decodable>(_ type: T.Type, from text: String) throws -> T { try JSONDecoder().decode(type, from: Data(text.utf8)) }
    func registerWorld() async throws -> WorldSession { WorldSession(sessionId: "session", generation: "generation", serverTime: ISO8601DateFormatter().string(from: Date())) }
    func reportWorld(_ snapshot: WorldSnapshot, session: WorldSession) async throws -> WorldStateResponse { WorldStateResponse(serverTime: ISO8601DateFormatter().string(from: Date())) }
    func acknowledgeWorld(_ ack: WorldAcknowledgement) async throws -> WorldActionResponse {
        acknowledgements.append(ack)
        let count = acknowledgements.filter { $0.status == ack.status }.count
        if scenario == .acceptanceLost && ack.status == "accepted" && count == 1 {
            engine.snapshot.stateVersion = 2
            throw URLError(.networkConnectionLost)
        }
        if scenario == .arrivalLost && ack.status == "arrived" && count == 1 { throw URLError(.networkConnectionLost) }
        if ack.status == "interrupted" || ack.status == "arrived" { done = true }
        return WorldActionResponse(id: ack.command.id, status: ack.status)
    }
    func worldEvents(session: WorldSession) -> AsyncThrowingStream<SSEEvent, Error> {
        AsyncThrowingStream { continuation in
            if !delivered {
                delivered = true
                let finish = ISO8601DateFormatter().string(from: Date().addingTimeInterval(60))
                let object: [String: Any] = ["id": "command", "sessionId": "session", "generation": "generation", "destinationId": "pond", "stateVersion": 1, "acceptBefore": finish, "finishBefore": finish]
                let data = String(data: try! JSONSerialization.data(withJSONObject: object), encoding: .utf8)!
                continuation.yield(SSEEvent(event: "action", data: data))
            }
            continuation.yield(SSEEvent(event: "heartbeat", data: "{}"))
            continuation.finish()
        }
    }
}

@main struct WorldBridgeTests {
    @MainActor static func main() async throws {
        for scenario in [APIClient.Scenario.acceptanceLost, .arrivalLost] {
            let engine = WorldEngine()
            let api = APIClient(scenario, engine: engine)
            let bridge = WorldBridge(engine: engine, api: api)
            bridge.start()
            let deadline = Date().addingTimeInterval(8)
            while !api.done && Date() < deadline { try await Task.sleep(nanoseconds: 20_000_000) }
            bridge.stop()
            precondition(api.done, "bridge did not recover")
            if scenario == .acceptanceLost {
                let accepted = api.acknowledgements.filter { $0.status == "accepted" }
                precondition(accepted.count == 2 && accepted[0].snapshot == accepted[1].snapshot)
                precondition(!api.acknowledgements.contains { $0.status == "rejected" })
                precondition(api.acknowledgements.last?.status == "interrupted" && engine.moves == 0)
            } else {
                let arrived = api.acknowledgements.filter { $0.status == "arrived" }
                precondition(arrived.count == 2 && arrived.allSatisfy { $0.snapshot.currentDestinationId == "pond" && $0.snapshot.stateVersion == 2 })
                precondition(engine.snapshot.currentDestinationId == "tree" && engine.moves == 1)
            }
        }
        print("WorldBridgeTests: 2 recovery scenarios passed")
    }
}
