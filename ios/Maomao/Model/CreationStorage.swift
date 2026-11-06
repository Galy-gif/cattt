import Foundation

/// 创建草稿和已确认档案共用一次原子写入；草稿不能提前覆盖正式身份。
struct CreationArchive: Codable, Equatable {
    var version = 1
    var profile: CatProfile?
    var draft: CreationDraft?
}

struct CatProfile: Codable, Equatable {
    var id: UUID
    var name: String
    var appearance: String
    var temperament: String
    var traits: [String: Int]
    var createdAt: Date
    /// 用户回答“我要怎么叫你”的原文，不推断真实姓名。
    var firstReply: String?
    var meeting: [CreationLine]
}

struct CreationLine: Codable, Equatable, Identifiable {
    var id = UUID()
    var text: String
    var isCat: Bool
}

struct CreationDraft: Codable, Equatable {
    enum Step: Int, Codable, CaseIterable { case welcome, temperament, naming, firstMeeting }
    enum Meeting: String, Codable { case greeting, question, replyPending, done, skipped }
    var id = UUID()
    var step: Step = .welcome
    var appearance = "orange"
    var temperament = "slow"
    var traits = ["energy": 1, "initiative": 1, "directness": 1, "closeness": 1]
    var traitsOpen = false
    var name = ""
    var input = ""
    var firstReply: String?
    var meeting: Meeting = .greeting
    var lines: [CreationLine] = []

    var validName: Bool { Self.validName(name) }
    static func validName(_ name: String) -> Bool {
        (1...8).contains(name.trimmingCharacters(in: .whitespacesAndNewlines).count)
    }

    mutating func completeMeeting() {
        switch meeting {
        case .greeting:
            lines.append(CreationLine(text: "我要怎么叫你？", isCat: true))
            meeting = .question
        case .replyPending:
            guard let firstReply else { return }
            let catName = name.trimmingCharacters(in: .whitespacesAndNewlines)
            lines.append(CreationLine(text: "\(firstReply)。\n那我是\(catName)。记住了。", isCat: true))
            meeting = .done
        default: break
        }
    }

    func profile(createdAt: Date) -> CatProfile? {
        guard step == .firstMeeting, validName, meeting == .done || meeting == .skipped else { return nil }
        return CatProfile(id: id, name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                          appearance: appearance, temperament: temperament, traits: traits,
                          createdAt: createdAt, firstReply: firstReply, meeting: lines)
    }
}

struct CreationStorage {
    let url: URL
    enum Failure: Error { case unsupportedVersion, invalidData }

    func load() throws -> CreationArchive? {
        guard FileManager.default.fileExists(atPath: url.path) else { return nil }
        let archive = try JSONDecoder().decode(CreationArchive.self, from: Data(contentsOf: url))
        try validate(archive)
        return archive
    }

    func save(_ archive: CreationArchive) throws {
        try validate(archive)
        let data = try JSONEncoder().encode(archive)
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: url, options: .atomic)
    }

    private func validate(_ archive: CreationArchive) throws {
        guard archive.version == 1 else { throw Failure.unsupportedVersion }
        func valid(_ temperament: String, _ traits: [String: Int]) -> Bool {
            ["slow", "close", "quiet", "curious"].contains(temperament)
            && Set(traits.keys) == Set(["energy", "initiative", "directness", "closeness"])
            && traits.values.allSatisfy { (0...2).contains($0) }
        }
        if let profile = archive.profile {
            // 旧版 / 服务端已有的名字允许超过创建页的 8 字上限，不截断已有身份。
            guard !profile.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                  valid(profile.temperament, profile.traits) else { throw Failure.invalidData }
        }
        if let draft = archive.draft {
            guard valid(draft.temperament, draft.traits),
                  draft.step != .firstMeeting || draft.validName,
                  Set(draft.lines.map(\.id)).count == draft.lines.count else { throw Failure.invalidData }
            if draft.meeting == .replyPending || draft.meeting == .done {
                guard let reply = draft.firstReply, !reply.isEmpty else { throw Failure.invalidData }
            }
        }
    }
}
