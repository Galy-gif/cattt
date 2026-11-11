import Foundation

struct APITicket: Decodable, Identifiable {
    let id: String
    let kind: String
    let goal: String
    let sourceMessageId: String?
    let status: String
    let stage: String
    let dueAt: String?
    let timeZone: String?

    var stageText: String {
        switch stage {
        case "queued": return "在等前面的事"
        case "thinking": return "我在想"
        case "waiting", "quiet_waiting": return "在等你"
        case "ready": return "好了"
        case "failed", "blocked": return "没办成"
        case "cancelled": return "已取消"
        case "dropped": return "先放下了"
        default: return "约好了"
        }
    }
    var date: Date? { dueAt.flatMap(Self.parseDate) }
    static func parseDate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }
}

struct APIMailboxLetter: Decodable, Identifiable {
    let id: String
    let seq: Int
    let ticketId: String?
    let text: String
    let createdAt: String
    var readAt: String?
}

extension APIClient {
    func tickets(includeEndedFollowups: Bool = false) async throws -> [APITicket] {
        struct Page: Decodable { let tickets: [APITicket] }
        var req = request("GET", "v1/tickets")
        req.url?.append(queryItems: [URLQueryItem(name: "status", value: "all")])
        return try await json(Page.self, req).tickets.filter { includeEndedFollowups || $0.kind == "errand" || $0.status == "open" }
    }
    func changeTicket(_ id: String, to date: Date) async throws {
        struct OK: Decodable {}
        _ = try await json(OK.self, request("PATCH", "v1/tickets/\(id)", body: ["when": ISO8601DateFormatter().string(from: date)]))
    }
    func addTicketInput(_ id: String, text: String) async throws {
        struct OK: Decodable {}
        _ = try await json(OK.self, request("PATCH", "v1/tickets/\(id)", body: ["text": text]))
    }
    func cancelTicket(_ id: String) async throws {
        struct OK: Decodable {}
        _ = try await json(OK.self, request("POST", "v1/tickets/\(id)/cancel"))
    }
    struct MailboxPage: Decodable { let letters: [APIMailboxLetter]; let hasMore: Bool }
    func mailbox(after: Int) async throws -> MailboxPage {
        var req = request("GET", "v1/mailbox")
        req.url?.append(queryItems: [URLQueryItem(name: "after", value: String(after))])
        return try await json(MailboxPage.self, req)
    }
    func readLetter(_ id: String) async throws {
        struct OK: Decodable {}
        _ = try await json(OK.self, request("POST", "v1/mailbox/\(id)/read"))
    }
}
