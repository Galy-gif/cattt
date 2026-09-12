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
    // 院子里的事实，聊天只读（性格系统优化方案第 2.3 节）。都是已经存下来的，不是猜的。
    var mood: String = "calm"
    var moodReason: String = ""
    var dayPhase: String = "day"
    var weather: String = "clear"
    var bowlFilledToday: Bool = false
    /// 上次喝水的时刻，ISO8601；没喝过就没有。
    var lastDrinkAt: String?
    /// 今天去过的地点名，按顺序。
    var placesToday: [String] = []

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

/// 院子里的事实：世界层自己不算，由 AppStore 每秒喂一次，随快照上报给聊天。
struct WorldYardFacts: Equatable {
    var mood = "calm"
    var moodReason = ""
    var dayPhase = "day"
    var weather = "clear"
    var bowlFilledToday = false
    var lastDrinkAt: String?
    var placesToday: [String] = []
}
