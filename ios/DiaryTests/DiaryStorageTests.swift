import Foundation

@main
struct DiaryStorageTests {
    static func check(_ value: Bool, _ message: String = "") { precondition(value, message) }

    static func main() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let a = DiaryStorage(url: root.appendingPathComponent("a/records.json"))
        let b = DiaryStorage(url: root.appendingPathComponent("b/records.json"))
        let tz = TimeZone(identifier: "Asia/Shanghai")!
        let day1 = ISO8601DateFormatter().date(from: "2026-10-18T15:59:00Z")!
        let day2 = day1.addingTimeInterval(120)
        check(try a.load() == nil)
        var archive = DiaryArchive()
        archive.entries.append(DiaryEntry(id: "user-1", time: "23:59", kind: .text, visit: .unread,
                                         text: "测试记录，保留换行\n和中文。", isPrivate: true, createdAt: day1, timeZone: tz))
        archive.upsertCatDiary(text: "第一天", time: "23:59", now: day1, timeZone: tz)
        archive.upsertCatDiary(text: "第二天模板", time: "00:01", now: day2, timeZone: tz)
        archive.upsertCatDiary(text: "第二天改写", time: "00:01", now: day2, timeZone: tz)
        try a.save(archive)
        let restored = try a.load()!
        check(restored == archive, "重开后完整恢复正文与私密标记")
        check(restored.entries.count == 3, "同日改写只保留一条，前一天不丢")
        check(restored.days == ["2026-10-19", "2026-10-18"])
        check(restored.entries(on: "2026-10-18").count == 2)
        check(restored.entries(on: "2026-10-19").map(\.text) == ["第二天改写"])
        check(restored.entries[0].timeZoneID == "Asia/Shanghai")
        check(restored.entries[0].dayKey == "2026-10-18", "归档日不随查看时区改变")
        check(try b.load() == nil, "另一账号不能读到记录")
        try b.save(DiaryArchive())
        check(try b.load()?.entries.isEmpty == true)
        check(try a.load() == archive, "空账号保存不能改动另一账号")

        let valid = try Data(contentsOf: a.url)
        var duplicate = archive
        duplicate.entries.append(archive.entries[0])
        do { try a.save(duplicate); fatalError("重复ID应拒绝") } catch DiaryStorage.Failure.duplicateIDs {}
        check(try Data(contentsOf: a.url) == valid, "失败不得覆盖旧文件")
        var future = archive
        future.version = 99
        try JSONEncoder().encode(future).write(to: a.url)
        do { _ = try a.load(); fatalError("未知版本应拒绝") } catch DiaryStorage.Failure.unsupportedVersion {}
        let corrupt = Data("损坏文件".utf8)
        try corrupt.write(to: a.url)
        do { _ = try a.load(); fatalError("损坏文件应报错") } catch is DecodingError {}
        check(try Data(contentsOf: a.url) == corrupt, "读取失败不得清空原文件")
        // 父路径是文件，模拟落盘失败；先前完整档案不受影响。
        let blocked = root.appendingPathComponent("blocked")
        try Data().write(to: blocked)
        do {
            try DiaryStorage(url: blocked.appendingPathComponent("records.json")).save(archive)
            fatalError("写入失败必须上抛")
        } catch {}
        try a.save(archive)
        check(try a.load() == archive, "故障修复后可以重试")
        // 旧文件没有云端字段也能读；离线操作必须和正文一起持久化。
        var queued = archive.entries[0]
        queued.pendingMutationID = "offline-grant"
        queued.isPrivate = false
        try a.save(DiaryArchive(entries: [queued]))
        check(try a.load()?.entries[0].pendingMutationID == "offline-grant")
        var reply = queued
        reply.cloudID = "server-1"; reply.cloudRevision = 1; reply.cloudIsPrivate = false; reply.pendingMutationID = nil
        var merged = DiaryArchive(entries: [queued])
        // 旧分享回执到来之前，用户已选择撤回；不得吞掉撤回。
        merged.entries[0].isPrivate = true
        merged.entries[0].pendingMutationID = "new-revoke"
        merged.merge(reply, sentMutation: "offline-grant")
        check(merged.entries[0].isPrivate && merged.entries[0].pendingMutationID == "new-revoke")
        check(merged.entries[0].cloudRevision == 1)
        check(merged.entries[0].permissionLabel == "撤回待同步")
        reply.isPrivate = true; reply.cloudIsPrivate = true; reply.cloudRevision = 2
        merged.merge(reply, sentMutation: "new-revoke")
        check(!merged.entries[0].needsSync && merged.entries[0].isPrivate)
        merged.merge(reply)
        check(merged.entries.count == 1, "拉取和回执不能制造重复")
        var staleGrant = reply
        staleGrant.isPrivate = false; staleGrant.pendingMutationID = "offline-old-grant"
        var crossDevice = DiaryArchive(entries: [staleGrant])
        var newerPrivate = reply; newerPrivate.cloudRevision = 3
        check(crossDevice.merge(newerPrivate), "拉取时的新版本不得替旧分享偷换版本")
        check(crossDevice.entries[0].isPrivate && crossDevice.entries[0].pendingMutationID == nil)
        var currentRevoke = newerPrivate
        currentRevoke.pendingMutationID = "private-wins"
        var conservative = DiaryArchive(entries: [currentRevoke])
        var newerShared = newerPrivate
        newerShared.cloudRevision = 4; newerShared.cloudIsPrivate = false; newerShared.isPrivate = false
        conservative.merge(newerShared)
        check(conservative.entries[0].isPrivate && conservative.entries[0].pendingMutationID == "private-wins")
        check(conservative.entries[0].cloudRevision == 4)
        // 猫日记改写只改正文，稳定保留来源日期、首次时间和云端版本。
        var cats = DiaryArchive()
        cats.upsertCatDiary(text: "模板", time: "23:59", now: day1, timeZone: tz)
        cats.entries[0].cloudID = "cat-server"
        cats.entries[0].cloudRevision = 1
        cats.upsertCatDiary(text: "模型改写", time: "23:59", now: day1.addingTimeInterval(20), timeZone: tz)
        check(cats.entries[0].createdAt == day1 && cats.entries[0].cloudRevision == 1)
        check(cats.entries[0].pendingMutationID != nil)
        print("日记存储：正文/换行/私密、日期边界、同日改写、历史保留、分区、损坏与写入失败检查通过")
    }
}
