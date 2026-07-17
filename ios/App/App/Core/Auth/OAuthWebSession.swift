import AuthenticationServices
import UIKit

enum OAuthWebSessionError: LocalizedError {
    case couldNotStart
    case missingCallback

    var errorDescription: String? {
        switch self {
        case .couldNotStart: "No se pudo abrir el acceso seguro de Google."
        case .missingCallback: "Google no devolvió una sesión válida."
        }
    }
}

@MainActor
final class OAuthWebSession: NSObject, ASWebAuthenticationPresentationContextProviding {
    private var session: ASWebAuthenticationSession?

    func authenticate(url: URL, callbackURLScheme: String) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(url: url, callbackURLScheme: callbackURLScheme) { [weak self] callbackURL, error in
                self?.session = nil
                if let error { continuation.resume(throwing: error); return }
                guard let callbackURL else { continuation.resume(throwing: OAuthWebSessionError.missingCallback); return }
                continuation.resume(returning: callbackURL)
            }
            session.presentationContextProvider = self
            session.prefersEphemeralWebBrowserSession = false
            self.session = session
            if !session.start() {
                self.session = nil
                continuation.resume(throwing: OAuthWebSessionError.couldNotStart)
            }
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        return scenes.flatMap(\.windows).first(where: \.isKeyWindow) ?? ASPresentationAnchor()
    }
}
