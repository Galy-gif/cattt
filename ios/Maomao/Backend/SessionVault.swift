import Foundation
import Security

/// 正式token只进Keychain，不落UserDefaults、日志或日记档案。
enum SessionVault {
    static func load(origin: String) -> AccountSession? {
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.maomao.session", kSecAttrAccount as String: origin,
            kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        var value: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &value) == errSecSuccess, let data = value as? Data else { return nil }
        return try? JSONDecoder().decode(AccountSession.self, from: data)
    }
    static func save(_ session: AccountSession?, origin: String) throws {
        let key: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "com.maomao.session", kSecAttrAccount as String: origin]
        guard let session else { SecItemDelete(key as CFDictionary); return }
        let data = try JSONEncoder().encode(session)
        let update: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        var status = SecItemUpdate(key as CFDictionary, update as CFDictionary)
        if status == errSecItemNotFound { status = SecItemAdd(key.merging(update) { _, b in b } as CFDictionary, nil) }
        guard status == errSecSuccess else { throw APIError.badResponse }
    }
}
