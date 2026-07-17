import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("useBiometrics") private var useBiometrics = false
    @State private var isUnlocked = false

    var body: some View {
        Group {
            switch session.state {
            case .restoring:
                LaunchView()
            case .signedOut:
                SignInView()
            case .signedIn:
                if requiresUnlock {
                    BiometricLockView(unlock: unlock, signOut: session.signOut)
                } else {
                    MainTabView()
                }
            }
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: session.state)
        .task(id: session.state) { await unlockIfNeeded() }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active, useBiometrics { isUnlocked = false }
            if phase == .active { Task { await unlockIfNeeded() } }
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
        ZStack {
            SiloxColors.background.ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 42, weight: .semibold))
                    .foregroundStyle(SiloxColors.accent)
                Text("Silox").font(.largeTitle.bold())
                ProgressView().accessibilityLabel("Cargando")
            }
        }
    }
}

struct MainTabView: View {
    @EnvironmentObject private var environment: AppEnvironment
    @State private var showsAdd = false

    var body: some View {
        TabView {
            PortfolioView(repository: environment.portfolioRepository, onAdd: { showsAdd = true })
                .tabItem { Label("Cartera", systemImage: "chart.pie.fill") }
            RadarView(repository: environment.radarRepository)
                .tabItem { Label("Radar", systemImage: "dot.radiowaves.left.and.right") }
            TransactionsView(repository: environment.transactionRepository, onAdd: { showsAdd = true })
                .tabItem { Label("Movimientos", systemImage: "arrow.left.arrow.right") }
            MoreView()
                .tabItem { Label("Más", systemImage: "ellipsis") }
        }
        .siloxTabBarBehavior()
        .sheet(isPresented: $showsAdd) {
            AddTransactionView(
                repository: environment.transactionRepository,
                assetRepository: environment.assetRepository
            )
        }
    }
}
