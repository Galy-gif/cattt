import SwiftUI

struct ChatMessage: Identifiable, Equatable {
    enum Role { case cat, user }

    /// 气泡下方 11px 状态注就是从这里派生的。
    enum State: Equatable {
        case sending    // 发送中…
        case sent
        case failed     // 未发送 · 点按重试
        case streaming  // 三点动画 / 逐字落地
        case stopped    // 用户按了停止，保留已生成文字
        case timeout    // 它走神了 · 再试一次
        case done
    }

    let id: String
    let role: Role
    var text: String
    var state: State
    /// 这条回复是「记住…」触发的，注文显示「记下了」
    var remembered = false
    /// 用户对这条猫消息选了「不要再提」
    var boundary = false
    /// 服务端的消息 id。本地模拟时为空；接了后端时，重新回复和「不要再提」要用它
    var serverID: String?

    var isCat: Bool { role == .cat }

    /// 11px 状态注。nil 表示不显示。
    var hint: String? {
        switch state {
        case .failed: return "未发送 · 点按重试"
        case .sending: return "发送中…"
        case .timeout: return "它走神了 · 再试一次"
        default: break
        }
        if remembered && state == .done { return "记下了" }
        if boundary { return "已经记下了" }
        return nil
    }

    /// 只有失败和超时的注文是可点的（accent 色）。
    var hintIsAction: Bool { state == .failed || state == .timeout }

    /// 超时的猫气泡里显示「……」，头像换 aloof。
    var displayText: String { state == .timeout ? "……" : text }
    var avatarImage: String { state == .timeout ? "tuanzi-aloof" : "tuanzi-canonical" }
}

// 气质 Temperament 与四条特征 Trait 搬到了 Model/Personality.swift（那里还编译出院子用的行为参数表）。

/// 猫的外观。本版只有橘猫有定稿资产。
struct CatAppearance: Identifiable, Equatable {
    let id: String
    let name: String
    let note: String
    /// 美术已定稿。false 时画占位灰圆、名称降级、不可点。
    let ready: Bool

    static let all: [CatAppearance] = [
        CatAppearance(id: "orange", name: "橘猫", note: "偏胖，毛厚，尾巴有环纹", ready: true),
        CatAppearance(id: "cow", name: "奶牛猫", note: "黑白，白鼻梁偏一侧 · 待定稿", ready: false),
        CatAppearance(id: "black", name: "黑猫", note: "高耳，腿略长 · 待定稿", ready: false),
        CatAppearance(id: "calico", name: "三花", note: "梨形身体，大块花纹 · 待定稿", ready: false),
    ]
}
