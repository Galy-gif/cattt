import Foundation

enum DiaryDay {
    static func key(for date: Date, timeZone: TimeZone = .current) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = timeZone
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    static func label(_ key: String) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "zh_CN")
        f.dateFormat = "yyyy-MM-dd"
        guard let date = f.date(from: key) else { return key }
        f.dateFormat = "yyyy年M月d日 · EEEE"
        return f.string(from: date)
    }
}

struct DiaryArchive: Codable, Equatable {
    var version = 1
    var entries: [DiaryEntry] = []

    var days: [String] { Array(Set(entries.map(\.dayKey))).sorted(by: >) }

    func entries(on day: String) -> [DiaryEntry] {
        entries.filter { $0.dayKey == day }.sorted { $0.createdAt < $1.createdAt }
    }

    /// 同一天的模板与模型改写复用一条猫日记，历史日期保留。
    mutating func upsertCatDiary(text: String, time: String, now: Date, timeZone: TimeZone = .current) {
        let day = DiaryDay.key(for: now, timeZone: timeZone)
        if let index = entries.firstIndex(where: { $0.kind == .cat && $0.dayKey == day }) {
            guard entries[index].text != text else { return }
            entries[index].text = text
            entries[index].pendingMutationID = UUID().uuidString
            return
        }
        entries.removeAll { $0.kind == .cat && $0.dayKey == day }
        entries.append(DiaryEntry(id: "cat-" + day, time: time, kind: .cat, visit: .unread,
                                  text: text, createdAt: now, timeZone: timeZone))
    }

    /// 回执到达期间又有本地操作，保留新操作，只推进已知云端版本。
    @discardableResult
    mutating func merge(_ remote: DiaryEntry, sentMutation: String? = nil) -> Bool {
        guard let i = entries.firstIndex(where: { $0.id == remote.id }) else { entries.append(remote); return false }
        let local = entries[i]
        if (remote.cloudRevision ?? 0) < (local.cloudRevision ?? 0) { return false }
        // 拉取时撞上另一设备的新版本，未发送的旧分享不得借刷新版本重新授权。
        if sentMutation == nil, local.pendingMutationID != nil, local.kind == .text, !local.isPrivate,
           (remote.cloudRevision ?? 0) > (local.cloudRevision ?? 0) {
            entries[i] = remote
            return true
        }
        if let pending = local.pendingMutationID, pending != sentMutation, pending != remote.pendingMutationID {
            var next = remote
            next.text = local.text
            next.isPrivate = local.isPrivate
            next.pendingMutationID = pending
            entries[i] = next
        } else { entries[i] = remote }
        return false
    }
}

/// 一份账号一份文件。写入先完成原子替换，界面才显示保存成功。
/// 读取失败向上传递，调用方不能拿空列表覆盖原件。
struct DiaryStorage {
    let url: URL

    enum Failure: Error { case unsupportedVersion, duplicateIDs }

    func load() throws -> DiaryArchive? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let archive = try JSONDecoder().decode(DiaryArchive.self, from: Data(contentsOf: url))
        try validate(archive)
        return archive
    }

    func save(_ archive: DiaryArchive) throws {
        try validate(archive)
        let data = try JSONEncoder().encode(archive)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: url, options: .atomic)
    }

    private func validate(_ archive: DiaryArchive) throws {
        guard archive.version == 1 else { throw Failure.unsupportedVersion }
        guard Set(archive.entries.map(\.id)).count == archive.entries.count else { throw Failure.duplicateIDs }
    }
}
