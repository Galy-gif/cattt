import SwiftUI

struct DiaryEntry: Identifiable, Equatable {
    enum Kind { case voice, photo, text }

    /// 团子来过 · 三态。互斥：有留言时不画脚印。
    enum Visit: Int, Comparable {
        case unread = 0          // 碎片下无任何附加
        case readNoComment = 1   // 只留脚印：它看过，但没话说
        case commented = 2       // 有留言：另起一行留言纸

        static func < (a: Visit, b: Visit) -> Bool { a.rawValue < b.rawValue }
    }

    let id: String
    let time: String
    let kind: Kind
    var visit: Visit
    let text: String
    /// 团子的留言。`visit == .commented` 时才显示。
    let note: String
    /// 私密碎片，团子永不访问。
    let isPrivate: Bool
    /// 语音的「原始转写，未整理」标注
    let isRawTranscript: Bool
    /// 语音的「语音 · 0:14」眉标
    let meta: String?
    /// 照片占位块的说明
    let photoCaption: String?

    init(
        id: String,
        time: String,
        kind: Kind,
        visit: Visit,
        text: String,
        note: String = "",
        isPrivate: Bool = false,
        isRawTranscript: Bool = false,
        meta: String? = nil,
        photoCaption: String? = nil
    ) {
        self.id = id
        self.time = time
        self.kind = kind
        self.visit = visit
        self.text = text
        self.note = note
        self.isPrivate = isPrivate
        self.isRawTranscript = isRawTranscript
        self.meta = meta
        self.photoCaption = photoCaption
    }
}

/// 「这个月」分区的紧凑列表项。
struct DiaryMonthRow: Identifiable {
    let id = UUID()
    let date: String
    let firstLine: String
    let count: Int
}

enum SeedData {
    static let messages: [ChatMessage] = [
        ChatMessage(id: "m1", role: .cat, text: "你回来了。", state: .done),
        ChatMessage(id: "m2", role: .user, text: "今天有点累", state: .sent),
        ChatMessage(id: "m3", role: .cat, text: "嗯。\n那就先不用讲道理。", state: .done),
        ChatMessage(id: "m4", role: .user, text: "路上看到有人在卖桂花", state: .sent),
        ChatMessage(id: "m5", role: .cat, text: "桂花是真的开了吗，我没出去过。", state: .done),
    ]

    /// 四条，专门用来演示团子来过三态。
    static let entries: [DiaryEntry] = [
        DiaryEntry(
            id: "e1", time: "08:40", kind: .voice, visit: .commented,
            text: "早班地铁太挤了，站了一路。不过出站的时候看到有人在卖桂花。",
            note: "桂花开了就是要下雨了。你回来那天，我在窗台等。",
            isRawTranscript: true, meta: "语音 · 0:14"
        ),
        DiaryEntry(
            id: "e2", time: "13:12", kind: .photo, visit: .readNoComment,
            text: "午休的时候楼下那只三花又来了。",
            note: "这只三花是不是每天都来。",
            photoCaption: "photo · 楼下的三花"
        ),
        DiaryEntry(
            id: "e3", time: "17:30", kind: .text, visit: .unread,
            text: "开完会脑子还是嗡嗡的，想早点睡。",
            note: "那就早点睡，别硬撑。"
        ),
        DiaryEntry(
            id: "e4", time: "21:05", kind: .text, visit: .unread,
            text: "还是没想好要不要跟她说。",
            isPrivate: true
        ),
    ]

    static let monthRows: [DiaryMonthRow] = [
        DiaryMonthRow(date: "9/07", firstLine: "早班地铁太挤了，站了一路", count: 3),
        DiaryMonthRow(date: "9/05", firstLine: "开完会已经八点了", count: 2),
    ]

    /// 命名屏的名字池，三批轮换。
    static let namePool: [[String]] = [
        ["团子", "橘子", "阿黄", "豆沙"],
        ["南瓜", "年糕", "奶油", "小满"],
        ["芝麻", "杏子", "布丁", "蒲公英"],
    ]

    static let defaultCatName = "团子"
    static let diaryDateKicker = "九月八日 · 星期二"
    static let togetherDays = 16
    static let topicText = "桂花开了，是不是要下雨"
}
