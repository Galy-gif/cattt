import Foundation

struct APICatProfile: Decodable {
    let id: String; let name: String; let appearance: String; let temperament: String
    let traits: [String: Int]; let createdAt: String
}
struct APIAccount: Decodable { let accountId: String; let cat: APICatProfile }
struct APIIdentity: Decodable { let token: String; let expiresAt: String; let accountId: String; let cat: APICatProfile }
struct APINotification: Decodable { let route: String; let message: APIMessage?; let letterId: String? }
extension APIClient {
    func account() async throws -> APIAccount { try await json(APIAccount.self, request("GET", "v1/me")) }
    func loginNonce() async throws -> String {
        struct Nonce: Decodable { let nonce: String }
        return try await json(Nonce.self, request("POST", "auth/nonce", body: [:])).nonce
    }
    func appleLogin(identityToken: String, nonce: String) async throws -> APIIdentity {
        try await json(APIIdentity.self, request("POST", "auth/apple", body: ["identity_token": identityToken, "nonce": nonce]))
    }
    func logout() async throws { struct OK: Decodable {}; _ = try await json(OK.self, request("POST", "v1/session/logout")) }
    func resolveNotification(_ id: String) async throws -> APINotification {
        try await json(APINotification.self, request("GET", "v1/notifications/" + id))
    }
    func registerDevice(token: String) async throws -> String {
        struct Device: Decodable { let id: String }
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif
        return try await json(Device.self, request("POST", "v1/devices", body: ["token": token, "environment": environment, "topic": Bundle.main.bundleIdentifier ?? ""])).id
    }
}
