import SwiftUI

@MainActor
final class PortfolioViewModel: ObservableObject {
    @Published private(set) var state: LoadState<PortfolioResponse> = .idle
    private let repository: PortfolioRepository

    init(repository: PortfolioRepository) { self.repository = repository }

    func load() async {
        if case .idle = state {
            if let cached = await repository.cached() { state = .loaded(cached.value, cachedAt: cached.savedAt) }
            else { state = .loading }
        }
        await refresh()
    }

    func refresh() async {
        do { state = .loaded(try await repository.refresh(), cachedAt: nil) }
        catch {
            let cached = await repository.cached()
            state = .failed(error.localizedDescription, cached: cached?.value, cachedAt: cached?.savedAt)
        }
    }
}

struct PortfolioView: View {
    @StateObject private var model: PortfolioViewModel
    @AppStorage("hideBalances") private var hideBalances = false
    @Environment(\.scenePhase) private var scenePhase
    private let liveRefreshSeconds: UInt64 = 5
    let onAdd: () -> Void

    init(repository: PortfolioRepository, onAdd: @escaping () -> Void = {}) {
        _model = StateObject(wrappedValue: PortfolioViewModel(repository: repository))
        self.onAdd = onAdd
    }

    var body: some View {
        NavigationStack {
            Group {
                switch model.state {
                case .idle, .loading:
                    ProgressView("Cargando cartera…")
                case .loaded(let portfolio, let cachedAt):
                    portfolioContent(portfolio, cachedAt: cachedAt)
                case .failed(let message, let cached, let cachedAt):
                    if let cached { portfolioContent(cached, cachedAt: cachedAt) }
                    else { ErrorStateView(message: message) { Task { await model.refresh() } } }
                }
            }
            .navigationTitle("Cartera")
            .toolbar {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button(action: onAdd) { Image(systemName: "plus") }
                        .accessibilityLabel("Añadir")
                    Button { hideBalances.toggle() } label: {
                        Image(systemName: hideBalances ? "eye.slash" : "eye")
                    }
                    .accessibilityLabel(hideBalances ? "Mostrar saldos" : "Ocultar saldos")
                }
            }
            .task { await model.load() }
            .task(id: scenePhase) {
                guard scenePhase == .active else { return }
                while !Task.isCancelled {
                    try? await Task.sleep(for: .seconds(liveRefreshSeconds))
                    guard !Task.isCancelled, scenePhase == .active else { return }
                    await model.refresh()
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .siloxPortfolioChanged)) { _ in
                Task { await model.refresh() }
            }
        }
    }

    private func portfolioContent(_ portfolio: PortfolioResponse, cachedAt: Date?) -> some View {
        ScrollView {
            LazyVStack(spacing: 14) {
                if let cachedAt { StaleBanner(date: cachedAt) }
                SiloxCard {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack {
                            Text("Patrimonio").foregroundStyle(.secondary)
                            Spacer()
                            if let market = portfolio.marketState {
                                Label(market.label, systemImage: "circle.fill")
                                    .font(.caption).foregroundStyle(market.isOpen ? .green : .secondary)
                            }
                        }
                        Text(hideBalances ? "••••••" : SiloxFormatters.money(portfolio.totals.totalValue.amount, currency: portfolio.totals.totalValue.currency))
                            .font(.system(.largeTitle, design: .rounded, weight: .bold)).monospacedDigit()
                            .contentTransition(.numericText())
                        HStack {
                            metric("Rentabilidad", value: hideBalances ? "•••" : SiloxFormatters.percentage(portfolio.totals.totalGainPercent), positive: portfolio.totals.totalGainPercent >= 0)
                            Spacer()
                            metric("Resultado", value: hideBalances ? "••••" : SiloxFormatters.money(portfolio.totals.totalGain.amount, currency: portfolio.totals.totalGain.currency), positive: portfolio.totals.totalGain.amount.decimalValue >= 0)
                        }
                    }
                }
                if portfolio.positions.isEmpty {
                    ContentUnavailableView("Sin posiciones", systemImage: "chart.pie", description: Text("Añade tu primera inversión desde la pestaña Añadir."))
                } else {
                    ForEach(portfolio.positions) { PositionRow(position: $0, hideBalances: hideBalances) }
                }
                Text("Actualizado \(portfolio.updatedAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption).foregroundStyle(.secondary)
            }
            .padding()
        }
        .refreshable { await model.refresh() }
    }

    private func metric(_ title: String, value: String, positive: Bool) -> some View {
        VStack(alignment: .leading) {
            Text(title).font(.caption).foregroundStyle(.secondary)
            Text(value).font(.headline).monospacedDigit().foregroundStyle(positive ? SiloxColors.positive : SiloxColors.negative)
        }
    }
}

private struct PositionRow: View {
    let position: Position
    let hideBalances: Bool

    var body: some View {
        NavigationLink {
            PositionDetailView(position: position)
        } label: {
            SiloxCard {
                HStack(spacing: 12) {
                    Image(systemName: position.asset.kind == .crypto ? "bitcoinsign.circle.fill" : "chart.line.uptrend.xyaxis")
                        .frame(width: 38, height: 38).background(SiloxColors.accent.opacity(0.14), in: Circle())
                    VStack(alignment: .leading) {
                        Text(position.asset.ticker ?? position.asset.name).font(.headline)
                        Text(position.asset.name).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                    Spacer()
                    VStack(alignment: .trailing) {
                        Text(hideBalances ? "••••" : SiloxFormatters.money(position.currentValue.amount, currency: position.currentValue.currency)).font(.headline).monospacedDigit()
                        if let dailyChange = position.dailyChangePercent {
                            Text("Hoy \(SiloxFormatters.percentage(dailyChange))")
                                .font(.caption).foregroundStyle(dailyChange >= 0 ? .green : .red)
                        } else {
                            Text(SiloxFormatters.percentage(position.gainPercent)).font(.caption).foregroundStyle(position.gainPercent >= 0 ? .green : .red)
                        }
                    }
                }
                if position.isPriceStale {
                    Label("Precio sin actualizar", systemImage: "clock.badge.exclamationmark")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
    }
}

private struct PositionDetailView: View {
    let position: Position
    var body: some View {
        List {
            Section(position.asset.name) {
                LabeledContent("Tipo", value: position.asset.kind.rawValue.capitalized)
                LabeledContent("Cantidad", value: position.quantity)
                LabeledContent("Valor", value: SiloxFormatters.money(position.currentValue.amount, currency: position.currentValue.currency))
                LabeledContent("Coste abierto", value: SiloxFormatters.money(position.openCost.amount, currency: position.openCost.currency))
                LabeledContent("Rentabilidad", value: SiloxFormatters.percentage(position.gainPercent))
                if let currentPrice = position.currentPrice {
                    LabeledContent("Precio en directo", value: SiloxFormatters.money(currentPrice.amount, currency: currentPrice.currency))
                }
                if let priceUpdatedAt = position.priceUpdatedAt {
                    LabeledContent("Cotización", value: priceUpdatedAt.formatted(date: .abbreviated, time: .standard))
                }
                if position.isPriceStale { Label("La última cotización está obsoleta", systemImage: "clock.badge.exclamationmark").foregroundStyle(.orange) }
            }
        }
        .navigationTitle(position.asset.ticker ?? position.asset.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}
