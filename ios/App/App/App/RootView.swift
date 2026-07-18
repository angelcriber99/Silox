import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionStore
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @AppStorage("useBiometrics") private var useBiometrics = false
    @AppStorage("appearanceMode") private var appearanceMode = "system"
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
        .preferredColorScheme(preferredColorScheme)
        .task(id: session.state) { await unlockIfNeeded() }
        .onChange(of: scenePhase) { _, phase in
            if phase != .active, useBiometrics { isUnlocked = false }
            if phase == .active { Task { await unlockIfNeeded() } }
        }
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
    private enum Section: Hashable { case portfolio, transactions, radar, more }

    @EnvironmentObject private var environment: AppEnvironment
    @State private var showsAdd = false
    @State private var selectedSection: Section = .portfolio
    @State private var preselectedAssetId: String?

    var body: some View {
        TabView(selection: $selectedSection) {
            PortfolioView(repository: environment.portfolioRepository, onAdd: presentAdd)
                .tag(Section.portfolio)
            TransactionsView(repository: environment.transactionRepository, onAdd: { presentAdd(nil) })
                .tag(Section.transactions)
            RadarView(repository: environment.radarRepository)
                .tag(Section.radar)
            MoreView()
                .tag(Section.more)
        }
        .toolbar(.hidden, for: .tabBar)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            SiloxTabBar(selection: $selectedSection, onAdd: { presentAdd(nil) })
        }
        .sheet(isPresented: $showsAdd, onDismiss: { preselectedAssetId = nil }) {
            AddTransactionView(
                repository: environment.transactionRepository,
                assetRepository: environment.assetRepository,
                preselectedAssetId: preselectedAssetId
            )
        }
    }

    private func presentAdd(_ assetId: String?) {
        preselectedAssetId = assetId
        showsAdd = true
    }

    private struct SiloxTabBar: View {
        @Binding var selection: Section
        let onAdd: () -> Void

        var body: some View {
            HStack(spacing: 0) {
                tab(.portfolio, title: "Cartera", icon: "chart.pie")
                tab(.transactions, title: "Movimientos", icon: "arrow.left.arrow.right")
                Button(action: onAdd) {
                    VStack(spacing: 1) {
                        Image(systemName: "plus")
                            .font(.system(size: 19, weight: .bold))
                            .frame(width: 42, height: 38)
                            .foregroundStyle(.black)
                            .background(SiloxColors.accent, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                        Text("Añadir").font(.caption2.weight(.medium)).foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Añadir")
                tab(.radar, title: "Radar", icon: "dot.radiowaves.left.and.right")
                tab(.more, title: "Más", icon: "line.3.horizontal")
            }
            .padding(.horizontal, 4)
            .padding(.top, 7)
            .padding(.bottom, 4)
            .background(.ultraThinMaterial)
            .overlay(alignment: .top) { Divider().opacity(0.45) }
        }

        private func tab(_ section: Section, title: String, icon: String) -> some View {
            Button {
                selection = section
            } label: {
                VStack(spacing: 4) {
                    Image(systemName: icon)
                        .font(.system(size: 18, weight: selection == section ? .semibold : .regular))
                        .frame(width: 40, height: 24)
                        .background(selection == section ? SiloxColors.accent.opacity(0.12) : .clear, in: Capsule())
                    Text(title).font(.caption2.weight(.medium))
                }
                .foregroundStyle(selection == section ? SiloxColors.accent : .secondary)
                .frame(maxWidth: .infinity)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(selection == section ? .isSelected : [])
        }
    }
}
