import XCTest
@testable import Silox

private final class MemorySecureStore: SecureStoring, @unchecked Sendable {
    var values: [String: Data] = [:]
    func data(for key: String) throws -> Data? { values[key] }
    func set(_ data: Data, for key: String) throws { values[key] = data }
    func remove(_ key: String) throws { values[key] = nil }
}

private final class LockedFlag: @unchecked Sendable {
    private let lock = NSLock()
    private var value = false

    func set() {
        lock.lock()
        value = true
        lock.unlock()
    }

    func get() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return value
    }
}

private final class AuthStubURLProtocol: URLProtocol, @unchecked Sendable {
    private static let lock = NSLock()
    nonisolated(unsafe) private static var requestCount = 0

    static func reset() {
        lock.lock()
        requestCount = 0
        lock.unlock()
    }

    static func count() -> Int {
        lock.lock()
        defer { lock.unlock() }
        return requestCount
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.lock.lock()
        Self.requestCount += 1
        Self.lock.unlock()
        Thread.sleep(forTimeInterval: 0.05)
        let data = Data(#"{"access_token":"fresh-access","refresh_token":"fresh-refresh","expires_at":4102444800,"user":{"id":"user-1","email":"test@example.com","user_metadata":{"full_name":"Test"}}}"#.utf8)
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
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
        let didCleanUp = LockedFlag()
        let store = SessionStore(secureStore: secure, onSignOut: { didCleanUp.set() })
        let user = UserProfile(id: "user-1", email: "test@example.com", displayName: nil)
        try store.accept(AuthSession(accessToken: "access", refreshToken: nil, expiresAt: nil, user: user))

        store.signOut()

        XCTAssertTrue(didCleanUp.get())
        XCTAssertEqual(store.state, .signedOut)
        XCTAssertNil(secure.values["auth.session"])
    }

    func testGoogleOAuthUsesPKCEAndNativeCallback() throws {
        let verifier = try SessionStore.pkceVerifier()
        let callbackScheme = "com.angelcriber.silox"
        let url = try SessionStore.googleAuthorizeURL(
            baseURL: URL(string: "https://project.supabase.co")!,
            verifier: verifier,
            callbackScheme: callbackScheme
        )
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        let values = Dictionary(uniqueKeysWithValues: items.compactMap { item in
            item.value.map { (item.name, $0) }
        })

        XCTAssertGreaterThanOrEqual(verifier.count, 43)
        XCTAssertEqual(values["provider"], "google")
        XCTAssertEqual(values["redirect_to"], "\(callbackScheme)://auth/callback")
        XCTAssertEqual(values["code_challenge_method"], "s256")
        XCTAssertFalse(values["code_challenge", default: ""].isEmpty)
    }

    func testOAuthCallbackSchemeMatchesARegisteredURLScheme() {
        XCTAssertEqual(OAuthCallbackConfiguration.scheme(), "com.angelcriber.silox")
        let urlTypes = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes") as? [[String: Any]] ?? []
        let schemes = urlTypes.flatMap { $0["CFBundleURLSchemes"] as? [String] ?? [] }
        XCTAssertTrue(schemes.contains(OAuthCallbackConfiguration.scheme()))
    }

    func testGoogleOAuthUsesTheExplicitCallbackScheme() throws {
        let url = try SessionStore.googleAuthorizeURL(
            baseURL: URL(string: "https://project.supabase.co")!,
            verifier: "test-verifier",
            callbackScheme: "silox.oauth.test"
        )
        let redirect = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?
            .first(where: { $0.name == "redirect_to" })?.value
        XCTAssertEqual(redirect, "silox.oauth.test://auth/callback")
    }

    func testConcurrentForcedTokenRequestsShareOneRefresh() async throws {
        AuthStubURLProtocol.reset()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [AuthStubURLProtocol.self]
        let secure = MemorySecureStore()
        let store = SessionStore(
            secureStore: secure,
            urlSession: URLSession(configuration: configuration),
            authConfigurationProvider: { (URL(string: "https://auth.silox.test")!, "anon-key") }
        )
        let user = UserProfile(id: "user-1", email: "test@example.com", displayName: "Test")
        try store.accept(AuthSession(
            accessToken: "expired",
            refreshToken: "refresh",
            expiresAt: .distantPast,
            user: user
        ))

        async let first = store.validAccessToken(forceRefresh: true)
        async let second = store.validAccessToken(forceRefresh: true)
        async let third = store.validAccessToken(forceRefresh: true)
        let tokens = await [first, second, third]

        XCTAssertEqual(tokens, ["fresh-access", "fresh-access", "fresh-access"])
        XCTAssertEqual(AuthStubURLProtocol.count(), 1)
        XCTAssertEqual(store.accessToken, "fresh-access")
    }
}
