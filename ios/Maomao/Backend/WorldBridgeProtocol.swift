import Foundation

extension APIClient {
    func registerWorld() async throws -> WorldSession {
        try await json(WorldSession.self, request("POST", "v1/world/sessions", body: ["protocolVersion": 1]))
    }
    func reportWorld(_ snapshot: WorldSnapshot, session: WorldSession) async throws -> WorldStateResponse {
        try await json(WorldStateResponse.self, request("PUT", "v1/world/state", body: [
            "sessionId": session.sessionId, "generation": session.generation, "snapshot": snapshot.json,
        ]))
    }
    func acknowledgeWorld(_ ack: WorldAcknowledgement) async throws -> WorldActionResponse {
        var body: [String: Any] = ["sessionId": ack.command.sessionId, "generation": ack.command.generation,
                                  "status": ack.status, "snapshot": ack.snapshot.json, "occurredAt": ack.occurredAt]
        if let reason = ack.reason { body["reason"] = reason }
        return try await json(WorldActionResponse.self, request("POST", "v1/world/actions/\(ack.command.id)/ack", body: body))
    }
    func worldEvents(session: WorldSession) -> AsyncThrowingStream<SSEEvent, Error> {
        var request = request("GET", "v1/world/events")
        request.url?.append(queryItems: [URLQueryItem(name: "sessionId", value: session.sessionId),
                                         URLQueryItem(name: "generation", value: session.generation)])
        return sse(request)
    }
}
