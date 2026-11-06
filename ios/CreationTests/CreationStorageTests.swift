import Foundation

@main struct CreationStorageTests {
    static func check(_ value: Bool) { assert(value) }

    static func main() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: root) }
        let storage = CreationStorage(url: root.appendingPathComponent("a.json"))
        let other = CreationStorage(url: root.appendingPathComponent("b.json"))
        check(try storage.load() == nil)
        var draft = CreationDraft()
        draft.name = "  云朵🐈  "
        draft.temperament = "curious"
        draft.traits["energy"] = 2
        draft.input = "没发出去的称呼"
        for step in CreationDraft.Step.allCases {
            draft.step = step
            let archive = CreationArchive(draft: draft)
            try storage.save(archive)
            check(try storage.load() == archive)
        }
        check(try other.load() == nil)
        assert(CreationDraft.validName("一二三四五六七八"))
        assert(!CreationDraft.validName(" \n"))
        assert(!CreationDraft.validName("一二三四五六七八九"))
        draft.lines = [CreationLine(text: "你来了。", isCat: true)]
        draft.completeMeeting()
        assert(draft.meeting == .question && draft.lines.count == 2)
        draft.firstReply = "叫我小林"
        draft.input = ""
        draft.lines.append(CreationLine(text: "叫我小林", isCat: false))
        draft.meeting = .replyPending
        try storage.save(CreationArchive(draft: draft))
        draft = try storage.load()!.draft!
        draft.completeMeeting()
        draft.completeMeeting()
        assert(draft.lines.count == 4 && draft.meeting == .done)
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        let profile = draft.profile(createdAt: date)!
        assert(profile.name == "云朵🐈" && profile.firstReply == "叫我小林")
        let completed = CreationArchive(profile: profile)
        try storage.save(completed)
        check(try storage.load() == completed)
        // 重走流程独立存草稿，未确认前旧身份及领养日期仍完整。
        let restarting = CreationArchive(profile: profile, draft: CreationDraft())
        try storage.save(restarting)
        check(try storage.load()!.profile == profile)
        let bytes = try Data(contentsOf: storage.url)
        var future = restarting
        future.version = 2
        try JSONEncoder().encode(future).write(to: other.url)
        do { _ = try other.load(); fatalError("未来版本不应当作空档案") } catch {}
        try Data("损坏资料".utf8).write(to: other.url)
        do { _ = try other.load(); fatalError("损坏资料不应当作空档案") } catch {}
        check(try String(contentsOf: other.url, encoding: .utf8) == "损坏资料")
        var invalid = restarting
        invalid.draft!.traits["energy"] = 10
        do { try storage.save(invalid); fatalError("非法特征不应覆盖旧档案") } catch {}
        check(try Data(contentsOf: storage.url) == bytes)
        let impossible = CreationStorage(url: storage.url.appendingPathComponent("child.json"))
        do { try impossible.save(completed); fatalError("写入文件下级路径应失败") } catch {}
        check(try Data(contentsOf: storage.url) == bytes)
        print("创建恢复：四步草稿、未发输入、中文校验、延迟回复去重、档案身份/日期、重走隔离、坏文件/未来版本、写失败保护通过")
    }
}
