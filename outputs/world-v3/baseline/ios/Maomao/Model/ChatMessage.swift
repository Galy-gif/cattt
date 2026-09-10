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
    var avatarImage: String { state == .timeout ? "tuanzi-aloof" : "tuanzi-content" }
}

/// 猫的气质预设。决定它主不主动、话多不多、多久才跟你熟。
enum Temperament: String, CaseIterable, Identifiable {
    case slow, close, quiet, curious

    var id: String { rawValue }

    var name: String {
        switch self {
        case .slow: return "慢热"
        case .close: return "黏人"
        case .quiet: return "安静"
        case .curious: return "好奇"
        }
    }

    /// 写的是可观察行为，不是形容词堆砌 —— 用户要能预判猫会怎么表现。
    var behavior: String {
        switch self {
        case .slow: return "头几天话很少，也不怎么问你。熟了之后会主动提起你说过的事。"
        case .close: return "每天会来找你一两次。你不回也不会追问，第二天照常来。"
        case .quiet: return "几乎不主动。你说话它就在，你不说它也不打扰。"
        case .curious: return "爱追问细节。你提一句，它可能隔天还会想起来接着问。"
        }
    }

    /// 回复语料池
    var replies: [String] {
        switch self {
        case .slow: return ["嗯，我在。", "你说过这个的，我记着。", "慢慢说，不着急。"]
        case .close: return ["我一直在等你说话。", "这个我想问细一点。", "那你现在还好吗？"]
        case .quiet: return ["嗯。", "我听着。", "好。"]
        case .curious: return ["然后呢？", "这个我昨天还在想。", "你为什么会这么觉得？"]
        }
    }
}

/// 四条三档细调特征。默认全中档。
enum Trait: String, CaseIterable, Identifiable {
    case energy, initiative, directness, closeness

    var id: String { rawValue }

    var name: String {
        switch self {
        case .energy: return "活力节奏"
        case .initiative: return "主动性"
        case .directness: return "表达直接度"
        case .closeness: return "亲近表达"
        }
    }

    /// 每档配一句行为解释，档位随选变化。
    var explanations: [String] {
        switch self {
        case .energy:
            return ["多半在睡，偶尔醒着说两句", "白天活动，晚上安静下来", "一天里随时都可能来找你"]
        case .initiative:
            return ["你不说它就不开口", "每天会来一次", "会主动接着昨天的话题"]
        case .directness:
            return ["话说一半，留给你猜", "想说什么就说什么", "有话直说，不绕"]
        case .closeness:
            return ["不太表现出在意", "偶尔会说想你", "会直接说喜欢你"]
        }
    }

    static let levelNames = ["低", "中", "高"]
}

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
