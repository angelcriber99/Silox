import SwiftUI

@main
struct SiloxApp: App {
    @StateObject private var environment = AppEnvironment.live()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(environment)
                .environmentObject(environment.session)
                .tint(SiloxColors.accent)
                .task { await environment.session.restore() }
        }
    }
}

@MainActor
final class AppEnvironment: ObservableObject {
    let api: APIClient
    let session: SessionStore
    let portfolioRepository: PortfolioRepository
    let radarRepository: RadarRepository
    let transactionRepository: TransactionRepository
    let assetRepository: AssetRepository
    let insightsRepository: InsightsRepository
    let settingsRepository: SettingsRepository

    init(api: APIClient, session: SessionStore, cache: ReadCache) {
        self.api = api
        self.session = session
        portfolioRepository = PortfolioRepository(api: api, cache: cache)
        radarRepository = RadarRepository(api: api, cache: cache)
        transactionRepository = TransactionRepository(api: api, cache: cache)
        assetRepository = AssetRepository(api: api)
        insightsRepository = InsightsRepository(api: api)
        settingsRepository = SettingsRepository(api: api)
    }

    static func live() -> AppEnvironment {
        let cache = ReadCache()
        let session = SessionStore(onSignOut: {
            cache.clearAll()
            try? WidgetCredentialStore.make().remove(WidgetCredentialStore.tokenKey)
            if let group = Bundle.main.object(forInfoDictionaryKey: "SILOX_APP_GROUP") as? String {
                UserDefaults(suiteName: group)?.removeObject(forKey: "widget.summary.v1")
            }
        })
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-ui-test-fixtures") {
            let configuration = URLSessionConfiguration.ephemeral
            configuration.protocolClasses = [UITestURLProtocol.self]
            let api = APIClient(
                configuration: APIConfiguration(baseURL: URL(string: "https://ui-test.silox.local")!),
                session: URLSession(configuration: configuration),
                tokenProvider: { await session.validAccessToken() }
            )
            return AppEnvironment(api: api, session: session, cache: cache)
        }
        #endif
        let api = APIClient(configuration: .fromBundle, tokenProvider: { await session.validAccessToken() })
        return AppEnvironment(api: api, session: session, cache: cache)
    }
}
