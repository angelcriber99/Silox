import SwiftUI

@main
struct SiloxApp: App {
    @StateObject private var environment = AppEnvironment.live()
    private let performanceMonitor = PerformanceMonitor()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(environment)
                .environmentObject(environment.session)
                .tint(SiloxColors.accent)
                .task { await environment.session.restore() }
                .onAppear { performanceMonitor.start() }
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
    let revolutImportRepository: RevolutImportRepository
    let preloader: AppDataPreloader

    init(api: APIClient, session: SessionStore, cache: ReadCache) {
        self.api = api
        self.session = session
        let portfolio = PortfolioRepository(api: api, cache: cache)
        let radar = RadarRepository(api: api, cache: cache)
        let transactions = TransactionRepository(api: api, cache: cache)
        let assets = AssetRepository(api: api, cache: cache)
        let insights = InsightsRepository(api: api, cache: cache)
        let settings = SettingsRepository(api: api, cache: cache)
        let revolutImport = RevolutImportRepository(api: api)
        portfolioRepository = portfolio
        radarRepository = radar
        transactionRepository = transactions
        assetRepository = assets
        insightsRepository = insights
        settingsRepository = settings
        revolutImportRepository = revolutImport
        preloader = AppDataPreloader(
            portfolio: portfolio,
            transactions: transactions,
            radar: radar,
            assets: assets,
            insights: insights,
            settings: settings
        )
    }

    static func live() -> AppEnvironment {
        let cache = ReadCache()
        let session = SessionStore(onSessionChange: { userID in
            await cache.setOwner(userID)
            if userID == nil {
                await cache.clearAll()
                try? WidgetCredentialStore.make().remove(WidgetCredentialStore.tokenKey)
                if let group = Bundle.main.object(forInfoDictionaryKey: "SILOX_APP_GROUP") as? String {
                    UserDefaults(suiteName: group)?.removeObject(forKey: "widget.summary.v1")
                }
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

/// Warms the data needed by every primary tab without delaying the first frame.
/// Repositories apply TTLs and single-flight deduplication, so this coordinator
/// can safely overlap the visible screen's own request.
actor AppDataPreloader {
    private let portfolio: PortfolioRepository
    private let transactions: TransactionRepository
    private let radar: RadarRepository
    private let assets: AssetRepository
    private let insights: InsightsRepository
    private let settings: SettingsRepository
    private var inFlight: Task<Void, Never>?

    init(
        portfolio: PortfolioRepository,
        transactions: TransactionRepository,
        radar: RadarRepository,
        assets: AssetRepository,
        insights: InsightsRepository,
        settings: SettingsRepository
    ) {
        self.portfolio = portfolio
        self.transactions = transactions
        self.radar = radar
        self.assets = assets
        self.insights = insights
        self.settings = settings
    }

    func prepare() async {
        if let inFlight {
            await inFlight.value
            return
        }
        let portfolio = portfolio
        let transactions = transactions
        let radar = radar
        let assets = assets
        let insights = insights
        let settings = settings
        let task = Task(priority: .userInitiated) {
            async let primaryPortfolio: PortfolioResponse? = try? portfolio.value()
            async let primaryAssets: [Asset]? = try? assets.list()
            _ = await (primaryPortfolio, primaryAssets)

            await Task.yield()
            let secondary = Task(priority: .utility) {
                async let transactionPage: TransactionPage? = try? transactions.value()
                async let radarValue: RadarResponse? = try? radar.value()
                async let history: [PortfolioHistoryPoint]? = try? insights.history()
                async let alerts: [PriceAlert]? = try? insights.alerts()
                async let preferences: NotificationPreferences? = try? settings.get()
                _ = await (transactionPage, radarValue, history, alerts, preferences)
            }
            await secondary.value
        }
        inFlight = task
        await task.value
        inFlight = nil
    }
}
