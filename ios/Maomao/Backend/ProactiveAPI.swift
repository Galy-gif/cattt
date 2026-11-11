import Foundation

struct ProactivePermission: Decodable {
    let allowProactive: Bool
    let revision: Int
}

extension APIClient {
    func proactivePermission() async throws -> ProactivePermission {
        try await json(ProactivePermission.self, request("GET", "v1/me/proactive"))
    }
    func setProactivePermission(_ allowed: Bool) async throws -> ProactivePermission {
        try await json(ProactivePermission.self, request("PATCH", "v1/me/proactive", body: ["allow_proactive": allowed]))
    }
}
