import XCTest
@testable import Silox

private final class MemorySecureStore: SecureStoring, @unchecked Sendable {
    var values: [String: Data] = [:]
    func data(for key: String) throws -> Data? { values[key] }
    func set(_ data: Data, for key: String) throws { values[key] = data }
    func remove(_ key: String) throws { values[key] = nil }
}

@MainActor
final class SessionStoreTests: XCTestCase {
    func testRestoreReadsSessionFromSecureStore() async throws {
        let secure = MemorySecureStore()
        let user = UserProfile(id: "user-1", email: "test@example.com", displayName: "Test")
        let session = AuthSession(accessToken: "access", refreshToken: "refresh", expiresAt: Date().addingTimeInterval(3600), user: user)
        secure.values["auth.session"] = try JSONEncoder().encode(session)
        let store = SessionStore(secureStore: secure)

        await store.restore()

        XCTAssertEqual(store.state, .signedIn(user))
        XCTAssertEqual(store.accessToken, "access")
    }

    func testExpiredSessionIsRemoved() async throws {
        let secure = MemorySecureStore()
        let user = UserProfile(id: "user-1", email: "test@example.com", displayName: nil)
        secure.values["auth.session"] = try JSONEncoder().encode(AuthSession(accessToken: "expired", refreshToken: nil, expiresAt: .distantPast, user: user))
        let store = SessionStore(secureStore: secure)

        await store.restore()

        XCTAssertEqual(store.state, .signedOut)
        XCTAssertNil(secure.values["auth.session"])
    }

    func testSignOutRunsPrivacyCleanup() async throws {
        let secure = MemorySecureStore()
        var didCleanUp = false
        let store = SessionStore(secureStore: secure, onSignOut: { didCleanUp = true })
        let user = UserProfile(id: "user-1", email: "test@example.com", displayName: nil)
        try store.accept(AuthSession(accessToken: "access", refreshToken: nil, expiresAt: nil, user: user))

        store.signOut()

        XCTAssertTrue(didCleanUp)
        XCTAssertEqual(store.state, .signedOut)
        XCTAssertNil(secure.values["auth.session"])
    }

    func testGoogleOAuthUsesPKCEAndNativeCallback() throws {
        let verifier = try SessionStore.pkceVerifier()
        let url = try SessionStore.googleAuthorizeURL(
            baseURL: URL(string: "https://project.supabase.co")!,
            verifier: verifier
        )
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        let values = Dictionary(uniqueKeysWithValues: items.compactMap { item in
            item.value.map { (item.name, $0) }
        })

        XCTAssertGreaterThanOrEqual(verifier.count, 43)
        XCTAssertEqual(values["provider"], "google")
        XCTAssertEqual(values["redirect_to"], "com.angelcriber.silox://auth/callback")
        XCTAssertEqual(values["code_challenge_method"], "s256")
        XCTAssertFalse(values["code_challenge", default: ""].isEmpty)
    }
}
