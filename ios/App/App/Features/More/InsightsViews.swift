import SwiftUI
import Charts
import Observation
import Accessibility

@MainActor
private final class AnalysisViewModel: ObservableObject {
    @Published private(set) var portfolio: PortfolioResponse?
    @Published private(set) var history: [PortfolioHistoryPoint] = []
    @Published private(set) var isLoading = true
    @Published private(set) var isRefreshing = false
    @Published private(set) var errorMessage: String?

    private let portfolioRepository: PortfolioRepository
    private let insightsRepository: InsightsRepository

    init(portfolioRepository: PortfolioRepository, insightsRepository: InsightsRepository) {
        self.portfolioRepository = portfolioRepository
        self.insightsRepository = insightsRepository
    }

    func load() async {
        async let cachedPortfolio = portfolioRepository.cached()
        async let cachedHistory = insightsRepository.cachedHistory()
        let cached = await (cachedPortfolio, cachedHistory)
        portfolio = cached.0?.value
        history = cached.1?.value ?? []
        isLoading = portfolio == nil
        // Cached content is already on screen. Revalidating it must not add
        // and remove a status row above the page, because that makes the whole
        // analysis layout jump as soon as the user switches tabs.
        await refresh(force: false, showsActivity: false)
    }

    func refresh(force: Bool = true, showsActivity: Bool = true) async {
        if showsActivity { isRefreshing = true }
        defer {
            if showsActivity { isRefreshing = false }
            isLoading = false
        }
        do {
            async let portfolioValue = try loadPortfolio(force: force)
            async let historyValue = try insightsRepository.history(maxAge: force ? 0 : CacheLifetime.history)
            let values = try await (portfolioValue, historyValue)
            portfolio = values.0
            history = values.1
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadPortfolio(force: Bool) async throws -> PortfolioResponse {
        if force { return try await portfolioRepository.refresh() }
        return try await portfolioRepository.value()
    }
}

struct AnalysisView: View {
    @StateObject private var model: AnalysisViewModel
    @AppStorage("hideBalances") private var hideBalances = false
    @State private var timeRange: HistoryRange = .year
    @State private var rawSelectedDate: String?
    let onAdd: () -> Void

    init(
        portfolioRepository: PortfolioRepository,
        insightsRepository: InsightsRepository,
        onAdd: @escaping () -> Void = {}
    ) {
        _model = StateObject(wrappedValue: AnalysisViewModel(
            portfolioRepository: portfolioRepository,
            insightsRepository: insightsRepository
        ))
        self.onAdd = onAdd
    }

    var body: some View {
        NavigationStack {
            Group {
                if let portfolio = model.portfolio {
                    content(portfolio)
                } else if let error = model.errorMessage, !model.isLoading {
                    ErrorStateView(message: error) { Task { await model.refresh() } }
                } else {
                    SiloxLoadingView(.analysis)
                }
            }
            .background(SiloxColors.backgroundPrimary.ignoresSafeArea())
            .navigationTitle("Análisis")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: onAdd) { Image(systemName: "plus") }
                        .accessibilityLabel("Añadir movimiento")
                }
            }
            .task { await model.load() }
        }
    }

    private func content(_ portfolio: PortfolioResponse) -> some View {
        ScrollView {
            LazyVStack(spacing: 14) {
                if model.isRefreshing {
                    HStack(spacing: 7) {
                        ProgressView().controlSize(.mini)
                        Text("Actualizando en segundo plano")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }
                performanceCard(portfolio)
                combinedPerformanceCard(portfolio)
                allocationCard(portfolio)
                moversCard(portfolio)
                if let error = model.errorMessage {
                    Label(error, systemImage: "wifi.exclamationmark")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 4)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .refreshable {
            async let fetch: () = model.refresh()
            async let delay = try? await Task.sleep(nanoseconds: 600_000_000)
            _ = await (fetch, delay)
        }
    }

    private func performanceCard(_ portfolio: PortfolioResponse) -> some View {
        let totals = portfolio.totals
        return SiloxCard {
            VStack(alignment: .leading, spacing: 15) {
                Text("RENDIMIENTO")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(0.9)
                    .foregroundStyle(.secondary)
                Text(hiddenMoney(totals.totalValue))
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .monospacedDigit()
                HStack(spacing: 0) {
                    metric(
                        "Hoy completo",
                        money: totals.dailyGain,
                        percent: totals.dailyGainPercent,
                        color: performanceColor(totals.dailyGain?.amount.decimalValue ?? 0)
                    )
                    Divider().padding(.horizontal, 12)
                    metric(
                        "P&L total",
                        money: totals.totalGain,
                        percent: totals.totalGainPercent,
                        color: performanceColor(totals.totalGain.amount.decimalValue)
                    )
                }
                .frame(height: 46)
                Text("Hoy incluye premercado, sesión regular y postmercado.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func combinedPerformanceCard(_ portfolio: PortfolioResponse) -> some View {
        let allPoints = chartPoints(portfolio)
        let filteredPoints = allPoints.filter { point in
            guard let cutoff = timeRange.cutoff else { return true }
            return (HistoryDateParser.date(from: point.date) ?? .distantPast) >= cutoff
        }
        
        return SiloxCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Evolución del patrimonio").font(.headline)
                        Text("Valor de cartera frente a dinero aportado").font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Image(systemName: "chart.xyaxis.line").foregroundStyle(SiloxColors.accent)
                }
                
                Picker("Periodo", selection: $timeRange) {
                    ForEach(HistoryRange.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)
                .siloxPeriodControlSurface()
                
                if filteredPoints.count < 2 {
                    ContentUnavailableView(
                        "Aún no hay histórico suficiente",
                        systemImage: "chart.line.uptrend.xyaxis",
                        description: Text("La gráfica aparecerá al registrar movimientos o valoraciones de cartera.")
                    )
                    .frame(height: 190)
                } else {
                    VStack(spacing: 12) {
                        portfolioChartLegend

                        Chart(filteredPoints) { point in
                            if let chartDate = point.chartDate {
                            if let value = point.value, let valuationSegment = point.valuationSegment {
                                LineMark(
                                    x: .value("Fecha", chartDate),
                                    y: .value("Patrimonio", value),
                                    series: .value("Tramo valorado", valuationSegment)
                                )
                                .foregroundStyle(SiloxColors.accent)
                                .interpolationMethod(.monotone)
                                .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                            }
                            
                            if let invested = point.invested {
                                LineMark(
                                    x: .value("Fecha", chartDate),
                                    y: .value("Aportado", invested),
                                    series: .value("Serie", "Aportado")
                                )
                                .foregroundStyle(SiloxColors.textSecondary)
                                .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, dash: [5, 4]))
                            }

                            if let value = point.value, let rawSelectedDate, rawSelectedDate == point.date {
                                RuleMark(x: .value("Fecha", chartDate))
                                    .foregroundStyle(.secondary.opacity(0.5))
                                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                                
                                PointMark(
                                    x: .value("Fecha", chartDate),
                                    y: .value("Patrimonio", value)
                                )
                                .foregroundStyle(SiloxColors.accent)
                                .symbolSize(100)
                                .annotation(position: .top, spacing: 10) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(point.date)
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                        Text(hideBalances ? "****" : SiloxFormatters.money(String(describing: value), currency: "EUR"))
                                            .font(.caption.weight(.bold))
                                            .foregroundStyle(.primary)
                                    }
                                    .padding(6)
                                    .background(.background.opacity(0.95), in: RoundedRectangle(cornerRadius: 8))
                                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(.separator, lineWidth: 0.5))
                                }
                            }
                            }
                        }
                        .chartLegend(.hidden)
                        .chartXAxis {
                            AxisMarks(values: .automatic(desiredCount: 4)) { value in
                                AxisGridLine()
                                AxisTick()
                                if let date = value.as(Date.self) {
                                    AxisValueLabel {
                                        Text(date, format: .dateTime.month(.abbreviated).day())
                                    }
                                }
                            }
                        }
                        .chartYAxis { 
                            AxisMarks(position: .leading) { value in
                                AxisGridLine()
                                AxisTick()
                                if let doubleValue = value.as(Double.self) {
                                    AxisValueLabel {
                                        Text(doubleValue >= 1000 ? "€\(Int(doubleValue / 1000))k" : "€\(Int(doubleValue))")
                                    }
                                }
                            }
                        }
                        .frame(height: 200)
                        .chartOverlay { proxy in
                            GeometryReader { geo in
                                if let plotFrame = proxy.plotFrame {
                                    Rectangle().fill(.clear).contentShape(Rectangle())
                                        .gesture(
                                            DragGesture(minimumDistance: 0)
                                                .onChanged { value in
                                                    let x = value.location.x - geo[plotFrame].origin.x
                                                    if let date: Date = proxy.value(atX: x) {
                                                        rawSelectedDate = filteredPoints
                                                            .compactMap(\.chartDate)
                                                            .min(by: { abs($0.timeIntervalSince(date)) < abs($1.timeIntervalSince(date)) })?
                                                            .formatted(.iso8601.year().month().day())
                                                    }
                                                }
                                                .onEnded { _ in rawSelectedDate = nil }
                                        )
                                }
                            }
                        }
                    }
                    .accessibilityLabel("Evolución del valor de cartera y del dinero aportado")

                    if filteredPoints.contains(where: { $0.source == .transaction }) {
                        Label(
                            "El capital anterior se ha reconstruido desde los movimientos importados. No se muestran precios ni rentabilidad donde no hay una valoración histórica real.",
                            systemImage: "info.circle"
                        )
                        .font(.caption2)
                        .foregroundStyle(SiloxColors.textSecondary)
                    }
                }
            }
        }
    }

    private var portfolioChartLegend: some View {
        HStack(spacing: 16) {
            chartLegendItem("Valor de cartera", color: SiloxColors.accent)
            chartLegendItem("Dinero aportado", color: SiloxColors.textSecondary, dashed: true)
        }
        .font(.caption2)
        .foregroundStyle(SiloxColors.textSecondary)
        .accessibilityElement(children: .combine)
    }

    private func chartLegendItem(_ title: String, color: Color, dashed: Bool = false) -> some View {
        HStack(spacing: 6) {
            Capsule()
                .stroke(color, style: StrokeStyle(lineWidth: 2, dash: dashed ? [5, 4] : []))
                .frame(width: 24, height: 2)
            Text(title)
        }
    }

    private func allocationCard(_ portfolio: PortfolioResponse) -> some View {
        let positions = activePositions(portfolio)
        let total = positions.reduce(0) { $0 + $1.currentValue.amount.decimalValue.doubleValue }
        return SiloxCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Concentración").font(.headline)
                ForEach(Array(positions.prefix(4))) { position in
                    let value = position.currentValue.amount.decimalValue.doubleValue
                    let weight = total > 0 ? value / total : 0
                    VStack(spacing: 6) {
                        HStack {
                            Text(position.asset.displayName).font(.subheadline.weight(.medium)).lineLimit(1)
                            Spacer()
                            Text(weight, format: .percent.precision(.fractionLength(1)))
                                .font(.caption.weight(.semibold)).monospacedDigit()
                        }
                        ProgressView(value: weight).tint(SiloxColors.accent)
                    }
                }
            }
        }
    }

    private func moversCard(_ portfolio: PortfolioResponse) -> some View {
        let movers = activePositions(portfolio)
            .filter { $0.dailyChangePercent != nil }
            .sorted { abs($0.dailyChangePercent ?? 0) > abs($1.dailyChangePercent ?? 0) }
            .prefix(4)
        return SiloxCard {
            VStack(alignment: .leading, spacing: 12) {
                Text("Movimiento de hoy").font(.headline)
                ForEach(Array(movers)) { position in
                    HStack(spacing: 10) {
                        SiloxAssetMark(asset: position.asset, size: 34)
                        Text(position.asset.displayName).font(.subheadline.weight(.medium)).lineLimit(1)
                        Spacer()
                        Text(SiloxFormatters.percentage(position.dailyChangePercent ?? 0))
                            .font(.subheadline.weight(.semibold))
                            .monospacedDigit()
                            .foregroundStyle(performanceColor(Decimal(position.dailyChangePercent ?? 0)))
                    }
                }
            }
        }
    }

    private func metric(_ title: String, money: MoneyValue?, percent: Double?, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption2).foregroundStyle(.secondary)
            HStack(spacing: 5) {
                Text(hideBalances ? "••••" : money.map { SiloxFormatters.signedMoney($0.amount, currency: $0.currency) } ?? "—")
                if let percent { Text(SiloxFormatters.percentage(percent)) }
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(color)
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func activePositions(_ portfolio: PortfolioResponse) -> [Position] {
        portfolio.positions
            .filter { $0.asset.kind != .cash && $0.quantity.decimalValue > 0 }
            .sorted { $0.currentValue.amount.decimalValue > $1.currentValue.amount.decimalValue }
    }

    private func hiddenMoney(_ value: MoneyValue) -> String {
        hideBalances ? "••••••" : SiloxFormatters.money(value.amount, currency: value.currency)
    }

    private func performanceColor(_ value: Decimal) -> Color {
        if value > 0 { return SiloxColors.positive }
        if value < 0 { return SiloxColors.negative }
        return .primary
    }

    private func chartPoints(_ portfolio: PortfolioResponse) -> [AnalysisChartPoint] {
        var rawValues = model.history.compactMap { point -> AnalysisChartPoint? in
            guard HistoryDateParser.date(from: point.date) != nil else { return nil }
            let value = point.value?.decimalValue.doubleValue
            let invested = point.invested?.decimalValue.doubleValue
            guard value?.isFinite != false, invested?.isFinite != false else { return nil }
            return AnalysisChartPoint(
                date: point.date,
                value: value,
                invested: invested,
                dailyPnL: nil,
                source: point.source,
                valuationSegment: nil
            )
        }
        let today = Date.now.formatted(.iso8601.year().month().day())
        let liveValue = portfolio.totals.totalValue.amount.decimalValue.doubleValue
        let liveInvested = portfolio.totals.totalCost.amount.decimalValue.doubleValue
        
        if let todayIndex = rawValues.lastIndex(where: { $0.date == today }) {
            rawValues[todayIndex] = AnalysisChartPoint(
                date: today,
                value: liveValue,
                invested: liveInvested,
                dailyPnL: nil,
                source: .snapshot,
                valuationSegment: nil
            )
        } else {
            rawValues.append(AnalysisChartPoint(
                date: today,
                value: liveValue,
                invested: liveInvested,
                dailyPnL: nil,
                source: .snapshot,
                valuationSegment: nil
            ))
        }
        rawValues.sort { $0.date < $1.date }

        var values: [AnalysisChartPoint] = []
        var segment = 0
        for i in rawValues.indices {
            var current = rawValues[i]
            let previous = i > 0 ? rawValues[i - 1] : nil
            let contiguousValuations = current.value != nil
                && previous?.value != nil
                && HistoryDateParser.isContiguous(previous?.date, current.date)
            if current.value != nil {
                if !contiguousValuations { segment += 1 }
                current.valuationSegment = "snapshot-\(segment)"
            }

            let pnl: Double? = contiguousValuations
                ? current.value! - previous!.value! - ((current.invested ?? 0) - (previous!.invested ?? 0))
                : nil
            
            let finalPnl: Double?
            if i == rawValues.count - 1 && current.date == today {
                finalPnl = portfolio.totals.dailyGain?.amount.decimalValue.doubleValue ?? pnl
            } else {
                finalPnl = pnl
            }
            
            current.dailyPnL = finalPnl
            values.append(current)
        }
        
        return values
    }
}

private struct AnalysisChartPoint: Identifiable {
    var id: String { date }
    let date: String
    let value: Double?
    let invested: Double?
    var dailyPnL: Double?
    let source: PortfolioHistoryPoint.Source?
    var valuationSegment: String?

    var hasValuation: Bool { value != nil }
    var chartDate: Date? { HistoryDateParser.date(from: date) }
}

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
    @State private var rawSelectedDate: Date?

    init(repository: InsightsRepository) {
        _model = StateObject(wrappedValue: InsightsViewModel(loader: { try await repository.history() }))
    }

    var body: some View {
        Group {
            switch model.state {
            case .loading: ProgressView("Cargando historial…")
            case .failed(let message): ErrorStateView(message: message) { Task { await model.load() } }
            case .loaded(let points):
                let visible = visiblePoints(points)
                let chartPoints = historicalChartPoints(visible)
                List {
                    if points.isEmpty {
                        ContentUnavailableView("Sin historial", systemImage: "clock.arrow.circlepath", description: Text("Los cierres diarios aparecerán aquí cuando existan snapshots."))
                    } else {
                        Section {
                            Picker("Periodo", selection: $range) {
                                ForEach(HistoryRange.allCases) { Text($0.title).tag($0) }
                            }
                            .pickerStyle(.segmented)
                            .siloxPeriodControlSurface()

                            if visible.contains(where: { $0.source == .transaction }) {
                                Label(
                                    "El capital se ha reconstruido desde los movimientos importados. Solo se dibuja patrimonio cuando hay una valoración histórica real.",
                                    systemImage: "info.circle"
                                )
                                .font(.caption)
                                .foregroundStyle(SiloxColors.textSecondary)
                            }

                            Chart(chartPoints) { chartPoint in
                                let point = chartPoint.point
                                if let date = point.chartDate {
                                    if let value = point.value?.decimalValue.doubleValue, let valuationSegment = chartPoint.valuationSegment {
                                    LineMark(
                                        x: .value("Fecha", date),
                                        y: .value("Patrimonio", value),
                                        series: .value("Tramo valorado", valuationSegment)
                                    )
                                    .foregroundStyle(by: .value("Serie", "Patrimonio"))
                                    .interpolationMethod(.catmullRom)
                                    .lineStyle(StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round))
                                    }

                                    if let invested = point.invested?.decimalValue.doubleValue {
                                        LineMark(
                                            x: .value("Fecha", date),
                                            y: .value("Capital invertido", invested)
                                    )
                                    .foregroundStyle(by: .value("Serie", "Invertido"))
                                    .lineStyle(StrokeStyle(lineWidth: 2, lineCap: .round, dash: [5, 4]))
                                    }

                                    if let value = point.value?.decimalValue.doubleValue, let rawSelectedDate, rawSelectedDate == date {
                                        RuleMark(x: .value("Fecha", date))
                                            .foregroundStyle(.secondary.opacity(0.5))
                                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                                        
                                        PointMark(
                                            x: .value("Fecha", date),
                                            y: .value("Patrimonio", value)
                                        )
                                        .foregroundStyle(SiloxColors.accent)
                                        .symbolSize(100)
                                        .annotation(position: .top, spacing: 10) {
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(date.formatted(date: .abbreviated, time: .omitted))
                                                    .font(.caption2)
                                                    .foregroundStyle(.secondary)
                                                Text(SiloxFormatters.money(point.value ?? "0", currency: "EUR"))
                                                    .font(.caption.weight(.bold))
                                                    .foregroundStyle(.primary)
                                            }
                                            .padding(6)
                                            .background(.background.opacity(0.95), in: RoundedRectangle(cornerRadius: 8))
                                            .overlay(RoundedRectangle(cornerRadius: 8).stroke(.separator, lineWidth: 0.5))
                                        }
                                    }
                                }
                            }
                            .chartForegroundStyleScale([
                                "Patrimonio": SiloxColors.accent,
                                "Invertido": SiloxColors.textSecondary,
                            ])
                            .chartLegend(position: .bottom, alignment: .leading)
                            .chartYAxis { 
                                AxisMarks(position: .leading) { value in
                                    AxisGridLine()
                                    AxisTick()
                                    if let doubleValue = value.as(Double.self) {
                                        AxisValueLabel {
                                            Text(doubleValue >= 1000 ? "€\(Int(doubleValue / 1000))k" : "€\(Int(doubleValue))")
                                        }
                                    }
                                }
                            }
                            .frame(height: 240)
                            .chartOverlay { proxy in
                                GeometryReader { geo in
                                    if let plotFrame = proxy.plotFrame {
                                        Rectangle().fill(.clear).contentShape(Rectangle())
                                            .gesture(
                                                DragGesture(minimumDistance: 0)
                                                    .onChanged { value in
                                                        let x = value.location.x - geo[plotFrame].origin.x
                                                        if let date: Date = proxy.value(atX: x) {
                                                            rawSelectedDate = visible
                                                                .compactMap(\.chartDate)
                                                                .min(by: { abs($0.timeIntervalSince(date)) < abs($1.timeIntervalSince(date)) })
                                                        }
                                                    }
                                                    .onEnded { _ in rawSelectedDate = nil }
                                            )
                                    }
                                }
                            }
                            .accessibilityLabel("Gráfico de patrimonio e inversión")
                            .accessibilityChartDescriptor(
                                PortfolioHistoryAccessibilityDescriptor(points: visible)
                            )
                        }

                        Section("Cierres") {
                            ForEach(visible.reversed()) { point in
                                ViewThatFits(in: .horizontal) {
                                    HStack { historyPoint(point) }
                                    VStack(alignment: .leading, spacing: 6) { historyPoint(point) }
                                }
                            }
                        }
                    }
                }
                .siloxContentBackground()
                .refreshable {
            async let fetch: () = model.load()
            async let delay = try? await Task.sleep(nanoseconds: 600_000_000)
            _ = await (fetch, delay)
        }
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
            Text(point.value.map { SiloxFormatters.money($0, currency: "EUR") } ?? "Sin valoración").font(.headline).monospacedDigit()
            Text("Invertido: \(SiloxFormatters.money(point.invested ?? "0", currency: "EUR"))")
                .font(.caption).foregroundStyle(SiloxColors.textSecondary)
            if point.source == .transaction {
                Text("Reconstruido desde movimientos")
                    .font(.caption2)
                    .foregroundStyle(SiloxColors.warning)
            }
        }
    }

    private func visiblePoints(_ points: [PortfolioHistoryPoint]) -> [PortfolioHistoryPoint] {
        guard let cutoff = range.cutoff else { return points }
        return points.filter { ($0.chartDate ?? .distantPast) >= cutoff }
    }

    private func historicalChartPoints(_ points: [PortfolioHistoryPoint]) -> [HistoricalChartPoint] {
        var segment = 0
        var previousValuation: PortfolioHistoryPoint?
        return points.map { point in
            guard point.value?.decimalValue.doubleValue != nil else {
                previousValuation = nil
                return HistoricalChartPoint(point: point, valuationSegment: nil)
            }
            if previousValuation == nil || !HistoryDateParser.isContiguous(previousValuation?.date, point.date) {
                segment += 1
            }
            previousValuation = point
            return HistoricalChartPoint(point: point, valuationSegment: "snapshot-\(segment)")
        }
    }
}

private struct HistoricalChartPoint: Identifiable {
    var id: String { point.id }
    let point: PortfolioHistoryPoint
    let valuationSegment: String?
}

private enum HistoryRange: String, CaseIterable, Identifiable {
    case day, week, month, ytd, year, all
    var id: Self { self }
    var title: String {
        switch self { case .day: "1D"; case .week: "1S"; case .month: "1M"; case .ytd: "YTD"; case .year: "1A"; case .all: "Todo" }
    }
    var cutoff: Date? {
        switch self {
        case .day: Calendar.current.date(byAdding: .day, value: -1, to: .now)
        case .week: Calendar.current.date(byAdding: .day, value: -7, to: .now)
        case .month: Calendar.current.date(byAdding: .month, value: -1, to: .now)
        case .ytd: Calendar.current.date(from: Calendar.current.dateComponents([.year], from: .now))
        case .year: Calendar.current.date(byAdding: .year, value: -1, to: .now)
        case .all: nil
        }
    }
}

private enum HistoryDateParser {
    static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static func date(from value: String) -> Date? { dayFormatter.date(from: value) }

    static func isContiguous(_ previous: String?, _ current: String) -> Bool {
        guard let previous, let previousDate = date(from: previous), let currentDate = date(from: current) else { return false }
        let elapsedDays = Calendar(identifier: .iso8601)
            .dateComponents([.day], from: previousDate, to: currentDate)
            .day ?? Int.max
        // Daily snapshots can legitimately skip weekends and market holidays.
        // Missing valuations themselves still break the line; a short calendar
        // gap must not make an otherwise continuous portfolio look disconnected.
        return elapsedDays >= 0 && elapsedDays <= 7
    }
}

private extension PortfolioHistoryPoint {
    var chartDate: Date? { HistoryDateParser.date(from: date) }
}

private struct PortfolioHistoryAccessibilityDescriptor: AXChartDescriptorRepresentable {
    let points: [PortfolioHistoryPoint]

    func makeChartDescriptor() -> AXChartDescriptor {
        let datedPoints = points.compactMap { point -> (PortfolioHistoryPoint, Date)? in
            point.chartDate.map { (point, $0) }
        }
        let categories = datedPoints.map { Self.dateFormatter.string(from: $0.1) }
        let values = datedPoints.flatMap { point, _ in
            [point.value?.decimalValue.doubleValue, point.invested?.decimalValue.doubleValue].compactMap { $0 }
        }
        let minimum = values.min() ?? 0
        let maximum = values.max() ?? 1
        let range = minimum == maximum ? (minimum - 1)...(maximum + 1) : minimum...maximum

        let xAxis = AXCategoricalDataAxisDescriptor(title: "Fecha", categoryOrder: categories)
        let yAxis = AXNumericDataAxisDescriptor(
            title: "Euros",
            range: range,
            gridlinePositions: []
        ) { value in
            value.formatted(.currency(code: "EUR"))
        }
        let portfolioSeries = AXDataSeriesDescriptor(
            name: "Patrimonio",
            isContinuous: true,
            dataPoints: datedPoints.compactMap { point, date in
                guard let value = point.value?.decimalValue.doubleValue else { return nil }
                return AXDataPoint(x: Self.dateFormatter.string(from: date), y: value)
            }
        )
        let investedSeries = AXDataSeriesDescriptor(
            name: "Capital invertido",
            isContinuous: true,
            dataPoints: datedPoints.compactMap { point, date in
                guard let value = point.invested?.decimalValue.doubleValue else { return nil }
                return AXDataPoint(x: Self.dateFormatter.string(from: date), y: value)
            }
        )

        return AXChartDescriptor(
            title: "Evolución de la cartera",
            summary: "Compara el patrimonio con el capital invertido para el periodo seleccionado.",
            xAxis: xAxis,
            yAxis: yAxis,
            series: [portfolioSeries, investedSeries]
        )
    }

    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.setLocalizedDateFormatFromTemplate("d MMM y")
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
                .siloxContentBackground()
                .refreshable {
            async let fetch: () = model.load()
            async let delay = try? await Task.sleep(nanoseconds: 600_000_000)
            _ = await (fetch, delay)
        }
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
                .foregroundStyle(alert.triggered ? SiloxColors.warning : SiloxColors.accent)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 3) {
                Text(alert.ticker).font(.headline)
                Text(alert.condition == "above" ? "Avisar por encima" : "Avisar por debajo")
                    .font(.caption).foregroundStyle(SiloxColors.textSecondary)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 3) {
                Text(alert.targetPrice ?? "—").font(.headline).monospacedDigit()
                Text(alert.triggered ? "Activada" : "Vigilando").font(.caption2).foregroundStyle(SiloxColors.textSecondary)
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
                    .siloxPeriodControlSurface()
                }
                if let errorMessage {
                    Section { Label(errorMessage, systemImage: "exclamationmark.triangle.fill").foregroundStyle(SiloxColors.negative) }
                }
            }
            .siloxContentBackground()
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
