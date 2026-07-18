import SwiftUI
import Charts
import Observation

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
    @State private var range: HistoryRange = .year

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
                        Section {
                            Picker("Periodo", selection: $range) {
                                ForEach(HistoryRange.allCases) { Text($0.title).tag($0) }
                            }
                            .pickerStyle(.segmented)

                            Chart(visiblePoints(points)) { point in
                                if let date = point.chartDate {
                                    LineMark(
                                        x: .value("Fecha", date),
                                        y: .value("Patrimonio", point.value?.decimalValue.doubleValue ?? 0)
                                    )
                                    .foregroundStyle(by: .value("Serie", "Patrimonio"))
                                    .interpolationMethod(.catmullRom)

                                    LineMark(
                                        x: .value("Fecha", date),
                                        y: .value("Capital invertido", point.invested?.decimalValue.doubleValue ?? 0)
                                    )
                                    .foregroundStyle(by: .value("Serie", "Invertido"))
                                    .lineStyle(StrokeStyle(lineWidth: 1.5, dash: [5, 4]))
                                }
                            }
                            .chartForegroundStyleScale([
                                "Patrimonio": SiloxColors.accent,
                                "Invertido": Color.secondary,
                            ])
                            .chartLegend(position: .bottom, alignment: .leading)
                            .frame(height: 240)
                            .accessibilityLabel("Gráfico de patrimonio e inversión")
                        }

                        Section("Cierres") {
                            ForEach(visiblePoints(points).reversed()) { point in
                                ViewThatFits(in: .horizontal) {
                                    HStack { historyPoint(point) }
                                    VStack(alignment: .leading, spacing: 6) { historyPoint(point) }
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

    @ViewBuilder private func historyPoint(_ point: PortfolioHistoryPoint) -> some View {
        Text(point.chartDate?.formatted(date: .abbreviated, time: .omitted) ?? point.date)
            .font(.body.monospacedDigit())
        Spacer(minLength: 8)
        VStack(alignment: .trailing) {
            Text(SiloxFormatters.money(point.value ?? "0", currency: "EUR")).font(.headline).monospacedDigit()
            Text("Invertido: \(SiloxFormatters.money(point.invested ?? "0", currency: "EUR"))")
                .font(.caption).foregroundStyle(.secondary)
        }
    }

    private func visiblePoints(_ points: [PortfolioHistoryPoint]) -> [PortfolioHistoryPoint] {
        guard let cutoff = range.cutoff else { return points }
        return points.filter { ($0.chartDate ?? .distantPast) >= cutoff }
    }
}

private enum HistoryRange: String, CaseIterable, Identifiable {
    case month, quarter, year, all
    var id: Self { self }
    var title: String {
        switch self { case .month: "1M"; case .quarter: "3M"; case .year: "1A"; case .all: "Todo" }
    }
    var cutoff: Date? {
        switch self {
        case .month: Calendar.current.date(byAdding: .month, value: -1, to: .now)
        case .quarter: Calendar.current.date(byAdding: .month, value: -3, to: .now)
        case .year: Calendar.current.date(byAdding: .year, value: -1, to: .now)
        case .all: nil
        }
    }
}

private extension PortfolioHistoryPoint {
    var chartDate: Date? { Self.dayFormatter.date(from: date) }
    static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

@MainActor
@Observable
private final class AlertsViewModel {
    enum State { case loading, loaded([PriceAlert]), failed(String) }
    var state: State = .loading
    private let repository: InsightsRepository

    init(repository: InsightsRepository) { self.repository = repository }

    func load() async {
        do { state = .loaded(try await repository.alerts()) }
        catch { state = .failed(error.localizedDescription) }
    }

    func save(alert: PriceAlert?, ticker: String, targetPrice: String, condition: String) async throws {
        if let alert {
            _ = try await repository.updateAlert(
                id: alert.id,
                request: UpdatePriceAlertRequest(targetPrice: targetPrice, condition: condition)
            )
        } else {
            _ = try await repository.createAlert(CreatePriceAlertRequest(ticker: ticker, targetPrice: targetPrice, condition: condition))
        }
        await load()
    }

    func reactivate(_ alert: PriceAlert) async {
        do {
            _ = try await repository.updateAlert(id: alert.id, request: UpdatePriceAlertRequest(triggered: false))
            await load()
        } catch { state = .failed(error.localizedDescription) }
    }

    func delete(_ alert: PriceAlert) async {
        do {
            try await repository.deleteAlert(id: alert.id)
            await load()
        } catch { state = .failed(error.localizedDescription) }
    }
}

struct AlertsView: View {
    @State private var model: AlertsViewModel
    @State private var presentedEditor: AlertEditorDestination?

    init(repository: InsightsRepository) {
        _model = State(initialValue: AlertsViewModel(repository: repository))
    }

    var body: some View {
        Group {
            switch model.state {
            case .loading:
                ProgressView("Cargando alertas…")
            case .failed(let message):
                ErrorStateView(message: message) { Task { await model.load() } }
            case .loaded(let alerts):
                List {
                    if alerts.isEmpty {
                        ContentUnavailableView(
                            "Sin alertas",
                            systemImage: "bell",
                            description: Text("Crea una alerta para recibir un aviso cuando un activo alcance tu objetivo.")
                        )
                    } else {
                        ForEach(alerts) { alert in
                            Button { presentedEditor = .edit(alert) } label: {
                                alertRow(alert)
                            }
                            .buttonStyle(.plain)
                            .swipeActions(edge: .trailing) {
                                Button("Eliminar", role: .destructive) { Task { await model.delete(alert) } }
                            }
                            .swipeActions(edge: .leading) {
                                if alert.triggered {
                                    Button("Reactivar") { Task { await model.reactivate(alert) } }
                                        .tint(SiloxColors.accent)
                                }
                            }
                        }
                    }
                }
                .refreshable { await model.load() }
            }
        }
        .navigationTitle("Alertas")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button { presentedEditor = .create } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Crear alerta")
            }
        }
        .sheet(item: $presentedEditor) { destination in
            AlertEditorView(alert: destination.alert) { ticker, targetPrice, condition in
                try await model.save(alert: destination.alert, ticker: ticker, targetPrice: targetPrice, condition: condition)
            }
        }
        .task { await model.load() }
    }

    private func alertRow(_ alert: PriceAlert) -> some View {
        HStack(spacing: 12) {
            Image(systemName: alert.triggered ? "bell.badge.fill" : "bell.fill")
                .foregroundStyle(alert.triggered ? .orange : SiloxColors.accent)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(alert.ticker).font(.headline)
                Text(alert.condition == "above" ? "Avisar por encima" : "Avisar por debajo")
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 3) {
                Text(alert.targetPrice ?? "—").font(.headline).monospacedDigit()
                Text(alert.triggered ? "Activada" : "Vigilando").font(.caption2).foregroundStyle(.secondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private enum AlertEditorDestination: Identifiable {
    case create
    case edit(PriceAlert)

    var id: String { alert?.id ?? "create" }
    var alert: PriceAlert? {
        if case .edit(let alert) = self { return alert }
        return nil
    }
}

private struct AlertEditorView: View {
    @Environment(\.dismiss) private var dismiss
    let alert: PriceAlert?
    let onSave: (String, String, String) async throws -> Void
    @State private var ticker: String
    @State private var targetPrice: String
    @State private var condition: String
    @State private var isSaving = false
    @State private var errorMessage: String?

    init(alert: PriceAlert?, onSave: @escaping (String, String, String) async throws -> Void) {
        self.alert = alert
        self.onSave = onSave
        _ticker = State(initialValue: alert?.ticker ?? "")
        _targetPrice = State(initialValue: alert?.targetPrice ?? "")
        _condition = State(initialValue: alert?.condition ?? "above")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Objetivo") {
                    TextField("Ticker", text: $ticker)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                        .disabled(alert != nil)
                    TextField("Precio objetivo", text: $targetPrice)
                        .keyboardType(.decimalPad)
                    Picker("Condición", selection: $condition) {
                        Text("Por encima").tag("above")
                        Text("Por debajo").tag("below")
                    }
                    .pickerStyle(.segmented)
                }
                if let errorMessage {
                    Section { Label(errorMessage, systemImage: "exclamationmark.triangle.fill").foregroundStyle(SiloxColors.negative) }
                }
            }
            .navigationTitle(alert == nil ? "Nueva alerta" : "Editar alerta")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") { Task { await save() } }
                        .disabled(ticker.trimmingCharacters(in: .whitespaces).isEmpty || (targetPrice.normalizedDecimal ?? 0) <= 0 || isSaving)
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        do {
            try await onSave(ticker, targetPrice, condition)
            dismiss()
        } catch { errorMessage = error.localizedDescription }
    }
}
