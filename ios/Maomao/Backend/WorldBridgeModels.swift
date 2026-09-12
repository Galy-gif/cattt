import Foundation

struct WorldSnapshot: Codable, Equatable {
    var stateVersion: Int
    let sceneVersion: Int
    let destinationIds: [String]
    let currentDestinationId: String
    let targetDestinationId: String
    let phase: String
    let action: String
    let paused: Bool
    let runnable: Bool

    var json: [String: Any] {
        guard let data = try? JSONEncoder().encode(self),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return [:] }
        return object
    }
}
struct WorldSession: Decodable {
    let sessionId: String
    let generation: String
    let serverTime: String
}
struct WorldCommand: Decodable {
    let id: String
    let sessionId: String
    let generation: String
    let destinationId: String
    let stateVersion: Int
    let acceptBefore: String
    let finishBefore: String
}
struct WorldAcknowledgement {
    let command: WorldCommand
    let status: String
    let reason: String?
    /// 执行事件发生时的值快照；重连不能拿猫后来的位置替代。
    let snapshot: WorldSnapshot
    let occurredAt: String
}
struct WorldActionResponse: Decodable { let id: String; let status: String }
struct WorldStateResponse: Decodable { let serverTime: String }
