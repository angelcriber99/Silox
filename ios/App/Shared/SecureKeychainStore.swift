import Foundation
import Security

protocol SecureStoring: Sendable {
    func data(for key: String) throws -> Data?
    func set(_ data: Data, for key: String) throws
    func remove(_ key: String) throws
}

enum SecureStoreError: LocalizedError {
    case unhandled(OSStatus)

    var errorDescription: String? {
        switch self {
        case .unhandled(let status): "Keychain error (\(status))"
        }
    }
}

struct SecureKeychainStore: SecureStoring {
    let service: String
    let accessGroup: String?

    init(service: String = "com.angelcriber.silox", accessGroup: String? = nil) {
        self.service = service
        self.accessGroup = accessGroup
    }

    func data(for key: String) throws -> Data? {
        var query = baseQuery(key: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else { throw SecureStoreError.unhandled(status) }
        return result as? Data
    }

    func set(_ data: Data, for key: String) throws {
        let query = baseQuery(key: key)
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var insert = query
            attributes.forEach { insert[$0.key] = $0.value }
            let insertStatus = SecItemAdd(insert as CFDictionary, nil)
            guard insertStatus == errSecSuccess else { throw SecureStoreError.unhandled(insertStatus) }
        } else if status != errSecSuccess {
            throw SecureStoreError.unhandled(status)
        }
    }

    func remove(_ key: String) throws {
        let status = SecItemDelete(baseQuery(key: key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw SecureStoreError.unhandled(status)
        }
    }

    private func baseQuery(key: String) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        if let accessGroup { query[kSecAttrAccessGroup as String] = accessGroup }
        return query
    }
}

enum WidgetCredentialStore {
    static let tokenKey = "widget.read-token"

    static func make() -> SecureKeychainStore {
        let group = Bundle.main.object(forInfoDictionaryKey: "SILOX_KEYCHAIN_GROUP") as? String
        return SecureKeychainStore(service: "com.angelcriber.silox.widget", accessGroup: group)
    }
}
