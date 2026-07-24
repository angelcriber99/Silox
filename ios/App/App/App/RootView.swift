import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    @EnvironmentObject private var environment: AppEnvironment
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("useBiometrics") private var useBiometrics = false
    @AppStorage("appearanceMode") private var appearanceMode = "system"
    @State private var isUnlocked = false
    @State private var router = AppRouter()

    var body: some View {
        Group {
            switch session.state {
            case .restoring:
                LaunchView()
            case .signedOut:
                SignInView()
            case .signedIn:
                if requiresUnlock {
                    BiometricLockView(unlock: unlock, signOut: { Task { await session.signOut() } })
                } else {
                    MainTabView(router: router)
                }
            }
        }
        .foregroundStyle(SiloxColors.textPrimary)
        .background(SiloxColors.backgroundPrimary.ignoresSafeArea())
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: session.state)
        .preferredColorScheme(preferredColorScheme)
        .task(id: session.state) { await unlockIfNeeded() }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active, useBiometrics { isUnlocked = false }
            if phase == .active {
                Task {
                    await unlockIfNeeded()
                    if case .signedIn = session.state { await environment.preloader.prepare() }
                }
            }
        }
        .onOpenURL { url in _ = router.handle(url) }
        .task { routeUITestLaunchArgumentIfNeeded() }
    }

    private var preferredColorScheme: ColorScheme? {
        switch appearanceMode {
        case "light": .light
        case "dark": .dark
        default: nil
        }
    }

    private var requiresUnlock: Bool {
        useBiometrics && !isUnlocked && !ProcessInfo.processInfo.arguments.contains("-ui-test-authenticated")
    }

    private func unlockIfNeeded() async {
        guard case .signedIn = session.state, useBiometrics, !isUnlocked else { return }
        await unlock()
    }

    private func unlock() async {
        isUnlocked = await BiometricAuth.authenticate(reason: "Desbloquea tu cartera Silox")
    }

    private func routeUITestLaunchArgumentIfNeeded() {
        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        guard let marker = arguments.firstIndex(of: "-ui-test-deep-link"),
              arguments.indices.contains(marker + 1),
              let url = URL(string: arguments[marker + 1]) else { return }
        _ = router.handle(url)
        #endif
    }
}

private struct BiometricLockView: View {
    let unlock: () async -> Void
    let signOut: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "faceid").font(.system(size: 54)).foregroundStyle(SiloxColors.accent)
            Text("Silox está bloqueado").font(.title2.bold())
            Button("Desbloquear con Face ID") { Task { await unlock() } }.siloxProminentButtonStyle()
            Button("Cerrar sesión", role: .destructive, action: signOut)
        }
        .padding()
    }
}

private struct LaunchView: View {
    var body: some View {
        SiloxLoadingView(.launch)
            .ignoresSafeArea()
    }
}

struct MainTabView: View {
    @EnvironmentObject private var environment: AppEnvironment
    @Bindable var router: AppRouter

    var body: some View {
        TabView(selection: tabSelection) {
            PortfolioView(repository: environment.portfolioRepository, onAdd: presentAdd)
                .tabItem { Label(AppTab.portfolio.title, systemImage: AppTab.portfolio.systemImage) }
                .tag(AppTab.portfolio)
            AnalysisView(
                portfolioRepository: environment.portfolioRepository,
                insightsRepository: environment.insightsRepository,
                onAdd: { presentAdd(nil) }
            )
                .tabItem { Label(AppTab.analysis.title, systemImage: AppTab.analysis.systemImage) }
                .tag(AppTab.analysis)
            RadarView(repository: environment.radarRepository)
                .tabItem { Label(AppTab.radar.title, systemImage: AppTab.radar.systemImage) }
                .tag(AppTab.radar)
            MoreView(onAdd: { presentAdd(nil) })
                .tabItem { Label(AppTab.settings.title, systemImage: AppTab.settings.systemImage) }
                .tag(AppTab.settings)
        }
        .siloxTabBarBehavior()
        .toolbarBackground(.visible, for: .tabBar)
        .sheet(item: $router.presentedSheet) { sheet in
            switch sheet {
            case .addMovement(let assetID):
                AddTransactionView(
                    repository: environment.transactionRepository,
                    assetRepository: environment.assetRepository,
                    preselectedAssetId: assetID
                )
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
            }
        }
        .fullScreenCover(item: $router.presentedAsset) { asset in
            RoutedAssetView(
                assetID: asset.id,
                repository: environment.portfolioRepository,
                onAdd: { router.presentAddMovement(assetID: $0) }
            )
        }
        .task { await environment.preloader.prepare() }
    }

    private func presentAdd(_ assetID: String?) {
        router.presentAddMovement(assetID: assetID)
    }

    /// Keep tab changes as a UIKit-owned transition. The tab bar must not
    /// inherit unrelated state animations from the root hierarchy.
    private var tabSelection: Binding<AppTab> {
        Binding(
            get: { router.selectedTab },
            set: { tab in
                guard router.selectedTab != tab else { return }
                var transaction = Transaction(animation: nil)
                transaction.disablesAnimations = true
                withTransaction(transaction) {
                    router.selectedTab = tab
                }
            }
        )
    }
}
