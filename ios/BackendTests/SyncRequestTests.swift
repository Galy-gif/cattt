import Foundation

// 通过 URLSession 捕获真正发出的请求，第一次提交回执丢失。
final class TicketTransport: URLProtocol {
    static var requests: [URLRequest] = []
    static var loseReceipt = true
    override class func canInit(with request: URLRequest) -> Bool { request.url?.host == "ticket-test.invalid" }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        Self.requests.append(request)
        if Self.loseReceipt {
            client?.urlProtocol(self, didFailWithError: URLError(.networkConnectionLost))
        } else {
            let response = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: Data("{}".utf8))
            client?.urlProtocolDidFinishLoading(self)
        }
    }
    override func stopLoading() {}
}

@main
struct SyncRequestTests {
    static func main() async throws {
        let old = APIDiaryEntry(id: "remote", seq: 1, clientId: "local", kind: "text", text: "旧日记",
                                recordedAt: "2026-11-16T12:00:00Z", timeZone: "UTC", day: "2026-11-16",
                                time: "12:00", catAllowed: true, revision: 1, mutationId: UUID().uuidString,
                                visit: 2, note: "旧留言")
        let archived = try old.local()
        precondition(archived.timeZoneID == "UTC", "撤回须回传服务端记录的时区原值")
        let transport = URLSessionConfiguration.ephemeral
        transport.protocolClasses = [TicketTransport.self]
        let session = URLSession(configuration: transport)
        let config = BackendConfig(mode: .local, baseURL: URL(string: "https://ticket-test.invalid")!, token: UUID().uuidString)
        let ticket = UUID().uuidString
        let client = APIClient(config: config, session: session)
        func key() -> String {
            guard let key = TicketTransport.requests.last?.value(forHTTPHeaderField: "Idempotency-Key"), UUID(uuidString: key) != nil else {
                fatalError("请求缺少幂等键")
            }
            return key
        }
        func lose(_ send: () async throws -> Void) async {
            TicketTransport.loseReceipt = true
            do { try await send(); fatalError("应模拟回执丢失") } catch {}
        }
        await lose { try await client.addTicketInput(ticket, text: "补一句") }
        let first = key()
        TicketTransport.loseReceipt = false
        try await APIClient(config: config, session: session).addTicketInput(ticket, text: "补一句")
        precondition(key() == first)
        try await client.addTicketInput(ticket, text: "补一句")
        precondition(key() != first)
        await lose { try await client.addTicketInput(ticket, text: "原内容") }
        let abandoned = key()
        TicketTransport.loseReceipt = false
        try await client.addTicketInput(ticket, text: "新内容")
        precondition(key() != abandoned)
        let date = Date()
        for send: () async throws -> Void in [{ try await client.changeTicket(ticket, to: date) }, { try await client.cancelTicket(ticket) }] {
            await lose(send)
            let lost = key()
            TicketTransport.loseReceipt = false
            try await send()
            precondition(key() == lost)
        }
        print("事项请求通过：补充、改期、取消、改正文及成功后的新操作")
    }
}
