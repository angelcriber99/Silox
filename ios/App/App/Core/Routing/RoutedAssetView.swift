import SwiftUI

struct RoutedAssetView: View {
    private enum ViewState { case loading, loaded(Position), missing, failed(String) }

    @Environment(\.dismiss) private var dismiss
    @State private var state: ViewState = .loading
    let assetID: String
    let repository: PortfolioRepository
    let onAdd: (String) -> Void

    var body: some View {
        NavigationStack {
            Group {
                switch state {
                case .loading: ProgressView("Abriendo activo…")
                case .loaded(let position): assetContent(position)
                case .missing:
                    ContentUnavailableView("Activo no encontrado", systemImage: "magnifyingglass", description: Text("Puede que ya no forme parte de tu cartera."))
                case .failed(let message): ErrorStateView(message: message) { Task { await load() } }
                }
            }
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cerrar") { dismiss() } } }
            .task(id: assetID) { await load() }
        }
    }

    private var navigationTitle: String {
        if case .loaded(let position) = state { return position.asset.displayName }
        return "Activo"
    }

    private func assetContent(_ position: Position) -> some View {
        List {
            Section("Posición") {
                LabeledContent("Valor actual", value: SiloxFormatters.money(position.currentValue.amount, currency: position.currentValue.currency))
                LabeledContent("Dinero invertido", value: SiloxFormatters.money(position.investedCash.amount, currency: position.investedCash.currency))
                LabeledContent("Rentabilidad", value: SiloxFormatters.percentage(position.gainPercent))
                LabeledContent("Unidades", value: SiloxFormatters.quantity(position.quantity, precision: 8))
            }
            if !position.openPurchaseLots.isEmpty {
                Section("Compras FIFO abiertas") {
                    ForEach(position.openPurchaseLots) { lot in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(lot.date, format: .dateTime.day().month(.abbreviated).year())
                                Spacer()
                                Text(SiloxFormatters.quantity(lot.remainingQuantity, precision: 8)).monospacedDigit()
                            }
                            Text(SiloxFormatters.money(lot.performanceUnitCost.amount, currency: lot.performanceUnitCost.currency))
                                .font(.caption).foregroundStyle(SiloxColors.textSecondary)
                        }
                    }
                }
            }
            Section {
                Button {
                    dismiss()
                    onAdd(position.id)
                } label: { Label("Añadir movimiento", systemImage: "plus").frame(maxWidth: .infinity) }
            }
        }
        .siloxContentBackground()
        .refreshable {
            async let fetch: () = load(forceRefresh: true)
            async let delay = try? await Task.sleep(nanoseconds: 600_000_000)
            _ = await (fetch, delay)
        }
    }

    private func load(forceRefresh: Bool = false) async {
        state = .loading
        do {
            let portfolio: PortfolioResponse
            if !forceRefresh, let cached = await repository.cached() { portfolio = cached.value }
            else { portfolio = try await repository.refresh() }
            if let position = findPosition(in: portfolio) { state = .loaded(position); return }
            let refreshed = forceRefresh ? portfolio : try await repository.refresh()
            state = findPosition(in: refreshed).map(ViewState.loaded) ?? .missing
        } catch { state = .failed(error.localizedDescription) }
    }

    private func findPosition(in portfolio: PortfolioResponse) -> Position? {
        portfolio.positions.first { position in
            position.id.caseInsensitiveCompare(assetID) == .orderedSame
                || position.asset.id.caseInsensitiveCompare(assetID) == .orderedSame
                || position.asset.ticker?.caseInsensitiveCompare(assetID) == .orderedSame
        }
    }
}
