import SwiftUI

@MainActor
private final class InsightsViewModel<Value: Sendable>: ObservableObject {
    enum State { case loading, loaded(Value), failed(String) }
    @Published var state: State = .loading
    private let loader: @Sendable () async throws -> Value

    init(loader: @escaping @Sendable () async throws -> Value) { self.loader = loader }

    func load() async {
        state = .loading
        do { state = .loaded(try await loader()) }
        catch { state = .failed(error.localizedDescription) }
    }
}

struct PortfolioHistoryView: View {
    @StateObject private var model: InsightsViewModel<[PortfolioHistoryPoint]>

    init(repository: InsightsRepository) {
        _model = StateObject(wrappedValue: InsightsViewModel(loader: { try await repository.history() }))
    }

    var body: some View {
        Group {
            switch model.state {
            case .loading: ProgressView("Cargando historial…")
            case .failed(let message): ErrorStateView(message: message) { Task { await model.load() } }
            case .loaded(let points):
                List {
                    if points.isEmpty {
                        ContentUnavailableView("Sin historial", systemImage: "clock.arrow.circlepath", description: Text("Los cierres diarios aparecerán aquí cuando existan snapshots."))
                    } else {
                        ForEach(points.reversed()) { point in
                            HStack {
                                Text(point.date).font(.body.monospacedDigit())
                                Spacer()
                                VStack(alignment: .trailing) {
                                    Text(SiloxFormatters.money(point.value ?? "0", currency: "EUR")).font(.headline).monospacedDigit()
                                    Text("Invertido: \(SiloxFormatters.money(point.invested ?? "0", currency: "EUR"))")
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
                .refreshable { await model.load() }
            }
        }
        .navigationTitle("Historial")
        .task { await model.load() }
    }
}

struct AlertsView: View {
    @StateObject private var model: InsightsViewModel<[PriceAlert]>

    init(repository: InsightsRepository) {
        _model = StateObject(wrappedValue: InsightsViewModel(loader: { try await repository.alerts() }))
    }

    var body: some View {
        Group {
            switch model.state {
            case .loading: ProgressView("Cargando alertas…")
            case .failed(let message): ErrorStateView(message: message) { Task { await model.load() } }
            case .loaded(let alerts):
                List {
                    if alerts.isEmpty {
                        ContentUnavailableView("Sin alertas", systemImage: "bell", description: Text("Las alertas de precio configuradas en Silox aparecerán aquí."))
                    } else {
                        ForEach(alerts) { alert in
                            HStack {
                                Image(systemName: alert.triggered ? "bell.badge.fill" : "bell.fill")
                                    .foregroundStyle(alert.triggered ? .orange : SiloxColors.accent)
                                VStack(alignment: .leading) {
                                    Text(alert.ticker).font(.headline)
                                    Text(alert.condition == "above" ? "Por encima" : "Por debajo").font(.caption).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(SiloxFormatters.money(alert.targetPrice ?? "0", currency: "EUR")).monospacedDigit()
                            }
                        }
                    }
                }
                .refreshable { await model.load() }
            }
        }
        .navigationTitle("Alertas")
        .task { await model.load() }
    }
}
