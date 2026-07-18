import Foundation
import AuthenticationServices
import CryptoKit
import Security

struct AuthSession: Codable, Sendable, Equatable {
    let accessToken: String
    let refreshToken: String?
    let expiresAt: Date?
    let user: UserProfile
}

private struct SupabaseUserPayload: Decodable {
    struct Metadata: Decodable {
        let fullName: String?
        let name: String?
        enum CodingKeys: String, CodingKey { case fullName = "full_name"; case name }
    }
    let id: String
    let email: String?
    let userMetadata: Metadata?
    enum CodingKeys: String, CodingKey { case id, email; case userMetadata = "user_metadata" }
}

private struct SupabaseSessionPayload: Decodable {
    let accessToken: String
    let refreshToken: String?
    let expiresAt: Int?
    let user: SupabaseUserPayload
    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt = "expires_at"
        case user
    }
}

@MainActor
final class SessionStore: ObservableObject {
    enum State: Equatable { case restoring, signedOut, signedIn(UserProfile) }

    @Published private(set) var state: State = .restoring
    @Published private(set) var errorMessage: String?
    private var session: AuthSession?
    private let secureStore: SecureStoring
    private let urlSession: URLSession
    private let authConfigurationProvider: (() throws -> (URL, String))?
    private let onSignOut: @Sendable () -> Void
    private var oauthWebSession: OAuthWebSession?
    private let sessionKey = "auth.session"
    private var refreshTask: (id: UUID, task: Task<Bool, Never>)?

    var accessToken: String? { session?.accessToken }

    init(
        secureStore: SecureStoring = SecureKeychainStore(),
        urlSession: URLSession = .shared,
        authConfigurationProvider: (() throws -> (URL, String))? = nil,
        onSignOut: @escaping @Sendable () -> Void = {}
    ) {
        self.secureStore = secureStore
        self.urlSession = urlSession
        self.authConfigurationProvider = authConfigurationProvider
        self.onSignOut = onSignOut
    }

    func restore() async {
        if ProcessInfo.processInfo.arguments.contains("-ui-test-authenticated") {
            let user = UserProfile(id: "ui-test", email: "demo@silox.local", displayName: "Demo")
            session = AuthSession(accessToken: "ui-test-token", refreshToken: nil, expiresAt: nil, user: user)
            state = .signedIn(user)
            return
        }
        do {
            guard let data = try secureStore.data(for: sessionKey) else { state = .signedOut; return }
            let restored = try JSONDecoder().decode(AuthSession.self, from: data)
            session = restored
            if restored.expiresAt.map({ $0 <= Date().addingTimeInterval(60) }) == true {
                guard await refreshSession() else { return }
            } else {
                state = .signedIn(restored.user)
            }
        } catch {
            errorMessage = "No se pudo restaurar la sesión."
            state = .signedOut
        }
    }

    func signIn(email: String, password: String) async {
        struct Credentials: Encodable { let email: String; let password: String }
        do {
            let (baseURL, anonKey) = try authConfiguration()
            var components = URLComponents(url: baseURL.appending(path: "auth/v1/token"), resolvingAgainstBaseURL: false)
            components?.queryItems = [URLQueryItem(name: "grant_type", value: "password")]
            guard let url = components?.url else { throw APIError.invalidResponse }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue(anonKey, forHTTPHeaderField: "apikey")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(Credentials(email: email, password: password))
            request.timeoutInterval = 30
            let (data, response) = try await urlSession.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
            guard (200..<300).contains(http.statusCode) else {
                throw APIError.server(status: http.statusCode, code: "sign_in_failed", message: "Correo o contraseña incorrectos.")
            }
            try accept(session(from: try JSONDecoder().decode(SupabaseSessionPayload.self, from: data), fallbackEmail: email))
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "No se pudo iniciar sesión."
        }
    }

    func signInWithGoogle() async {
        do {
            errorMessage = nil
            let (baseURL, anonKey) = try authConfiguration()
            let verifier = try Self.pkceVerifier()
            let authorizeURL = try Self.googleAuthorizeURL(baseURL: baseURL, verifier: verifier)

            let webSession = OAuthWebSession()
            oauthWebSession = webSession
            defer { oauthWebSession = nil }
            let callback = try await webSession.authenticate(url: authorizeURL, callbackURLScheme: "com.angelcriber.silox")
            try await acceptOAuthCallback(callback, verifier: verifier, baseURL: baseURL, anonKey: anonKey)
        } catch {
            let nsError = error as NSError
            if nsError.domain == ASWebAuthenticationSessionError.errorDomain,
               nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                return
            }
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "No se pudo iniciar sesión con Google."
        }
    }

    /// Returns a token that remains valid for the next request, refreshing the
    /// Supabase session before expiry. APIClient calls this for every request so
    /// foreground sessions do not fail as soon as their first JWT expires.
    func validAccessToken(forceRefresh: Bool = false) async -> String? {
        guard let session else { return nil }
        if !forceRefresh, session.expiresAt.map({ $0 > Date().addingTimeInterval(60) }) ?? true {
            return session.accessToken
        }
        return await refreshSession() ? self.session?.accessToken : nil
    }

    @discardableResult
    private func refreshSession() async -> Bool {
        if let refreshTask { return await refreshTask.task.value }
        let id = UUID()
        let task = Task { @MainActor [weak self] in
            await self?.performSessionRefresh() ?? false
        }
        refreshTask = (id, task)
        let result = await task.value
        if refreshTask?.id == id { refreshTask = nil }
        return result
    }

    private func performSessionRefresh() async -> Bool {
        guard let refreshToken = session?.refreshToken, !refreshToken.isEmpty else {
            signOut()
            return false
        }
        do {
            struct RefreshBody: Encodable {
                let refreshToken: String
                enum CodingKeys: String, CodingKey { case refreshToken = "refresh_token" }
            }
            let (baseURL, anonKey) = try authConfiguration()
            var components = URLComponents(url: baseURL.appending(path: "auth/v1/token"), resolvingAgainstBaseURL: false)
            components?.queryItems = [URLQueryItem(name: "grant_type", value: "refresh_token")]
            guard let url = components?.url else { throw APIError.invalidResponse }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue(anonKey, forHTTPHeaderField: "apikey")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(RefreshBody(refreshToken: refreshToken))
            request.timeoutInterval = 30
            let (data, response) = try await urlSession.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                throw APIError.unauthorized
            }
            let payload = try JSONDecoder().decode(SupabaseSessionPayload.self, from: data)
            try accept(session(from: payload, fallbackEmail: session?.user.email ?? ""))
            return true
        } catch {
            signOut()
            errorMessage = "La sesión ha caducado. Vuelve a iniciar sesión."
            return false
        }
    }

    private func authConfiguration() throws -> (URL, String) {
        if let authConfigurationProvider { return try authConfigurationProvider() }
        guard let rawURL = Bundle.main.object(forInfoDictionaryKey: "SILOX_SUPABASE_URL") as? String,
              let baseURL = URL(string: rawURL),
              let anonKey = Bundle.main.object(forInfoDictionaryKey: "SILOX_SUPABASE_ANON_KEY") as? String,
              !anonKey.hasPrefix("CONFIGURE_") else {
            throw APIError.server(status: 0, code: "auth_not_configured", message: "Configura Supabase en el xcconfig local o de CI.")
        }
        return (baseURL, anonKey)
    }

    private func acceptOAuthCallback(_ callback: URL, verifier: String, baseURL: URL, anonKey: String) async throws {
        let components = URLComponents(url: callback, resolvingAgainstBaseURL: false)
        if let description = components?.queryItems?.first(where: { $0.name == "error_description" })?.value {
            throw APIError.server(status: 401, code: "oauth_failed", message: description)
        }
        if let code = components?.queryItems?.first(where: { $0.name == "code" })?.value {
            struct ExchangeBody: Encodable {
                let authCode: String
                let codeVerifier: String
                enum CodingKeys: String, CodingKey {
                    case authCode = "auth_code"
                    case codeVerifier = "code_verifier"
                }
            }
            var tokenComponents = URLComponents(url: baseURL.appending(path: "auth/v1/token"), resolvingAgainstBaseURL: false)
            tokenComponents?.queryItems = [URLQueryItem(name: "grant_type", value: "pkce")]
            guard let url = tokenComponents?.url else { throw APIError.invalidResponse }
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue(anonKey, forHTTPHeaderField: "apikey")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(ExchangeBody(authCode: code, codeVerifier: verifier))
            request.timeoutInterval = 30
            let (data, response) = try await urlSession.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                throw APIError.server(status: (response as? HTTPURLResponse)?.statusCode ?? 0, code: "oauth_exchange_failed", message: "No se pudo completar el acceso con Google.")
            }
            try accept(session(from: try JSONDecoder().decode(SupabaseSessionPayload.self, from: data), fallbackEmail: ""))
            return
        }

        let fragmentItems = URLComponents(string: "?" + (components?.fragment ?? ""))?.queryItems ?? []
        guard let accessToken = fragmentItems.first(where: { $0.name == "access_token" })?.value else {
            throw OAuthWebSessionError.missingCallback
        }
        let refreshToken = fragmentItems.first(where: { $0.name == "refresh_token" })?.value
        let expiresIn = fragmentItems.first(where: { $0.name == "expires_in" })?.value.flatMap(TimeInterval.init)
        var userRequest = URLRequest(url: baseURL.appending(path: "auth/v1/user"))
        userRequest.setValue(anonKey, forHTTPHeaderField: "apikey")
        userRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
            userRequest.timeoutInterval = 30
            let (userData, userResponse) = try await urlSession.data(for: userRequest)
        guard let http = userResponse as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw APIError.unauthorized }
        let user = try JSONDecoder().decode(SupabaseUserPayload.self, from: userData)
        try accept(AuthSession(
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresAt: expiresIn.map { Date().addingTimeInterval($0) },
            user: UserProfile(
                id: user.id,
                email: user.email ?? "",
                displayName: user.userMetadata?.fullName ?? user.userMetadata?.name
            )
        ))
    }

    static func pkceVerifier() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw APIError.invalidResponse
        }
        return base64URL(Data(bytes))
    }

    static func googleAuthorizeURL(baseURL: URL, verifier: String) throws -> URL {
        let challenge = base64URL(Data(SHA256.hash(data: Data(verifier.utf8))))
        var components = URLComponents(url: baseURL.appending(path: "auth/v1/authorize"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "provider", value: "google"),
            URLQueryItem(name: "redirect_to", value: "com.angelcriber.silox://auth/callback"),
            URLQueryItem(name: "code_challenge", value: challenge),
            URLQueryItem(name: "code_challenge_method", value: "s256"),
        ]
        guard let url = components?.url else { throw APIError.invalidResponse }
        return url
    }

    static func base64URL(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    private func session(from payload: SupabaseSessionPayload, fallbackEmail: String) -> AuthSession {
        let profile = UserProfile(
            id: payload.user.id,
            email: payload.user.email ?? fallbackEmail,
            displayName: payload.user.userMetadata?.fullName ?? payload.user.userMetadata?.name
        )
        return AuthSession(
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
            expiresAt: payload.expiresAt.map { Date(timeIntervalSince1970: TimeInterval($0)) },
            user: profile
        )
    }

    func accept(_ newSession: AuthSession) throws {
        try secureStore.set(JSONEncoder().encode(newSession), for: sessionKey)
        session = newSession
        state = .signedIn(newSession.user)
        errorMessage = nil
    }

    func signOut() {
        refreshTask?.task.cancel()
        refreshTask = nil
        if let accessToken = session?.accessToken,
           let (baseURL, anonKey) = try? authConfiguration() {
            let urlSession = self.urlSession
            Task.detached {
                var components = URLComponents(url: baseURL.appending(path: "auth/v1/logout"), resolvingAgainstBaseURL: false)
                components?.queryItems = [URLQueryItem(name: "scope", value: "local")]
                guard let url = components?.url else { return }
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue(anonKey, forHTTPHeaderField: "apikey")
                request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
                request.timeoutInterval = 15
                _ = try? await urlSession.data(for: request)
            }
        }
        try? secureStore.remove(sessionKey)
        onSignOut()
        session = nil
        state = .signedOut
    }
}
