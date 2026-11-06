import Foundation

struct DiaryEntry: Identifiable, Equatable, Codable {
    /// `cat` 是团子自己写的那一条（每天一条，暖纸色，用户不能改）。
    enum Kind: String, Codable { case voice, photo, text, cat }

    /// 团子来过 · 三态。互斥：有留言时不画脚印。
    enum Visit: Int, Comparable, Codable {
        case unread = 0          // 碎片下无任何附加
        case readNoComment = 1   // 只留脚印：它看过，但没话说
        case commented = 2       // 有留言：另起一行留言纸

        static func < (a: Visit, b: Visit) -> Bool { a.rawValue < b.rawValue }
    }

    let id: String
    let time: String
    let createdAt: Date
    let timeZoneID: String
    /// 写下时的当地日期，旅行或系统时区变化不移动归档日期。
    let dayKey: String
    let kind: Kind
    var visit: Visit
    var text: String
    /// 团子的留言。`visit == .commented` 时才显示。
    let note: String
    /// 私密碎片，团子永不访问。
    var isPrivate: Bool
    var cloudID: String?
    var cloudRevision: Int?
    var cloudIsPrivate: Bool?
    var pendingMutationID: String?
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
        photoCaption: String? = nil,
        createdAt: Date = Date(),
        timeZone: TimeZone = .current
    ) {
        self.id = id
        self.time = time
        self.createdAt = createdAt
        self.timeZoneID = timeZone.identifier
        self.dayKey = DiaryDay.key(for: createdAt, timeZone: timeZone)
        self.kind = kind
        self.visit = visit
        self.text = text
        self.note = note
        self.isPrivate = isPrivate
        self.isRawTranscript = isRawTranscript
        self.meta = meta
        self.photoCaption = photoCaption
    }

    var needsSync: Bool { cloudID == nil || pendingMutationID != nil }
    var permissionLabel: String {
        if isPrivate && cloudIsPrivate == false && pendingMutationID != nil { return "撤回待同步" }
        if !isPrivate && needsSync { return "分享待同步" }
        return isPrivate ? "只留给自己" : "团子可读"
    }
}

/// 日记页首那排筛选片。状态放在 `AppStore.diaryFilter`，因为信息片（条数）在纸的页首段、列表在内容段。
enum DiaryFilter: CaseIterable {
    case all, voice, photo, privateOnly

    var label: String {
        switch self {
        case .all: "全部"
        case .voice: "语音"
        case .photo: "照片"
        case .privateOnly: "只留给自己"
        }
    }

    func matches(_ entry: DiaryEntry) -> Bool {
        switch self {
        case .all: true
        case .voice: entry.kind == .voice
        case .photo: entry.kind == .photo
        case .privateOnly: entry.isPrivate
        }
    }
}

/// 「这个月」分区的紧凑列表项。
struct DiaryMonthRow: Identifiable {
    let id = UUID()
    let date: String
    let firstLine: String
    let count: Int
}
