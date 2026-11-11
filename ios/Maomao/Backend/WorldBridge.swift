import Foundation

/// 一条独立世界连接。网络重连复用 session 和本进程去重记录；进程重启才换代。
@MainActor
final class WorldBridge {
    private weak var engine: WorldEngine?
    private let api: APIClient
    private let onInbox: () -> Void
    private var task: Task<Void, Never>?
    private var session: WorldSession?
    private var pending: [WorldCommand] = []
    private var accepting: [String: WorldAcknowledgement] = [:]
    private var handled: [String: WorldAcknowledgement] = [:]
    private var acknowledgements: [WorldAcknowledgement] = []
    private var lastReport: Double = 0
    private var serverInstant: Date?
    private var syncUptime: Double = 0

    init(engine: WorldEngine, api: APIClient, onInbox: @escaping () -> Void = {}) {
        self.engine = engine
        self.api = api
        self.onInbox = onInbox
        engine.agentActionChanged = { [weak self] command, status, reason in
            guard let self, let engine = self.engine else { return }
            let ack = WorldAcknowledgement(command: command, status: status, reason: reason, snapshot: engine.worldSnapshot(), occurredAt: self.eventTimestamp())
            self.handled[command.id] = ack
            self.acknowledgements.append(ack)
        }
    }
    func start() {
        task = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                do {
                    if session == nil {
                        session = try await api.registerWorld()
                        syncClock(session!.serverTime)
                        pending = []; accepting = [:]; handled = [:]; acknowledgements = []
                    }
                    try await synchronize(force: true)
                    guard let session else { continue }
                    for try await event in api.worldEvents(session: session) {
                        try Task.checkCancellation()
                        if event.event == "action" {
                            let command = try APIClient.decode(WorldCommand.self, from: event.data)
                            guard command.sessionId == session.sessionId, command.generation == session.generation else { continue }
                            if let prior = handled[command.id] {
                                if !acknowledgements.contains(where: { $0.command.id == command.id && $0.status == prior.status }) { acknowledgements.append(prior) }
                            } else if !pending.contains(where: { $0.id == command.id }) { pending.append(command) }
                        } else if event.event == "inbox" {
                            onInbox()
                        } else if event.event == "runtime_state" {
                            struct Runtime: Decodable {
                                struct State: Decodable { let energy: String; let willingness: String }
                                let state: State
                            }
                            let runtime = try APIClient.decode(Runtime.self, from: event.data)
                            engine?.applyRuntimeState(energy: runtime.state.energy, willingness: runtime.state.willingness)
                        } else if event.event == "world_error" {
                            struct Failure: Decodable { let code: String }
                            let failure = try APIClient.decode(Failure.self, from: event.data)
                            if failure.code == "session_replaced" { stop(); return }
                            break
                        }
                        try await synchronize(force: false)
                    }
                } catch {
                    if Task.isCancelled { return }
                    if case APIError.http(_, let code) = error, code == "session_replaced" { stop(); return }
                    // 已开始动作继续按引擎执行；未收到回复的 ack 保留，下一次按原 ID 重发。
                }
                try? await Task.sleep(nanoseconds: 1_000_000_000)
            }
        }
    }
    func stop() {
        task?.cancel(); task = nil
        engine?.interruptAgentMove(reason: "connection_closed")
        engine?.agentActionChanged = nil
        engine?.applyRuntimeState(energy: "baseline", willingness: "baseline")
    }
    private func synchronize(force: Bool) async throws {
        guard let engine, let session else { return }
        while let ack = acknowledgements.first {
            do {
                _ = try await api.acknowledgeWorld(ack)
                acknowledgements.removeFirst()
            } catch {
                if case APIError.http(409, let code) = error, code != "session_replaced" {
                    acknowledgements.removeFirst() // 服务端已终止或新状态抢占，不能倒退重放。
                } else { throw error }
            }
        }
        while let command = pending.first {
            let snapshot = engine.worldSnapshot()
            if accepting[command.id] == nil && (!snapshot.runnable || snapshot.paused || snapshot.stateVersion != command.stateVersion) {
                let ack = WorldAcknowledgement(command: command, status: "rejected", reason: "world_changed", snapshot: snapshot, occurredAt: eventTimestamp())
                handled[command.id] = ack; acknowledgements.append(ack); pending.removeFirst()
                continue
            }
            // 发送前保存原始请求。响应丢失时先重试同一 accepted，恢复服务端事实，
            // 再由引擎复查当前世界；不能因世界已变就把已接收动作误报 rejected。
            let ack = accepting[command.id] ?? WorldAcknowledgement(command: command, status: "accepted", reason: nil, snapshot: snapshot, occurredAt: eventTimestamp())
            accepting[command.id] = ack
            do {
                let result = try await api.acknowledgeWorld(ack)
                try Task.checkCancellation()
                pending.removeFirst()
                accepting.removeValue(forKey: command.id)
                guard result.status == "accepted" else { handled[command.id] = WorldAcknowledgement(command: command, status: result.status, reason: nil, snapshot: engine.worldSnapshot(), occurredAt: eventTimestamp()); continue }
                handled[command.id] = ack // 执行前即去重；异步响应不能造成第二次 request。
                let finishAfter = parseDate(command.finishBefore)?.timeIntervalSince(estimatedServerNow()) ?? 0
                if !engine.beginAgentMove(command, finishAfter: finishAfter) {
                    let interrupted = WorldAcknowledgement(command: command, status: "interrupted", reason: "world_changed", snapshot: engine.worldSnapshot(), occurredAt: eventTimestamp())
                    handled[command.id] = interrupted; acknowledgements.append(interrupted)
                }
            } catch {
                if case APIError.http(409, let code) = error, code != "session_replaced" {
                    pending.removeFirst()
                    accepting.removeValue(forKey: command.id)
                    handled[command.id] = WorldAcknowledgement(command: command, status: "interrupted", reason: code, snapshot: engine.worldSnapshot(), occurredAt: eventTimestamp())
                } else { throw error }
            }
        }
        if force || ProcessInfo.processInfo.systemUptime - lastReport >= 2 {
            let response = try await api.reportWorld(engine.worldSnapshot(), session: session)
            syncClock(response.serverTime)
            lastReport = ProcessInfo.processInfo.systemUptime
        }
    }
    private func eventTimestamp() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: estimatedServerNow())
    }
    private func syncClock(_ value: String) {
        serverInstant = parseDate(value); syncUptime = ProcessInfo.processInfo.systemUptime
    }
    private func estimatedServerNow() -> Date {
        (serverInstant ?? Date()).addingTimeInterval(ProcessInfo.processInfo.systemUptime - syncUptime)
    }
    private func parseDate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}
