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

private enum PerformancePeriod: String, CaseIterable, Identifiable {
    case session
    case day

    var id: Self { self }
    var title: String { self == .session ? "Sesión" : "Día completo" }
}

private enum PositionSort: String, CaseIterable, Identifiable {
    case value
    case day

    var id: Self { self }
    var title: String { self == .value ? "Valor" : "Día" }
}

struct PortfolioView: View {
    @StateObject private var model: PortfolioViewModel
    @AppStorage("hideBalances") private var hideBalances = false
    @Environment(\.scenePhase) private var scenePhase
    @State private var performancePeriod: PerformancePeriod = .session
    @State private var positionSort: PositionSort = .value
    @State private var search = ""

    private let repository: PortfolioRepository
    private let liveRefreshSeconds: UInt64 = 5
    let onAdd: (String?) -> Void

    init(repository: PortfolioRepository, onAdd: @escaping (String?) -> Void = { _ in }) {
        self.repository = repository
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
            .background(SiloxColors.background.ignoresSafeArea())
            .navigationTitle("Cartera")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 1) {
                        Text("Silox").font(.headline)
                        if let market = currentPortfolio?.marketState {
                            HStack(spacing: 4) {
                                Circle().fill(market.isOpen ? SiloxColors.positive : Color.secondary).frame(width: 5, height: 5)
                                Text(market.label).font(.caption2).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button { onAdd(nil) } label: { Image(systemName: "plus") }
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
                    do { try await Task.sleep(for: .seconds(liveRefreshSeconds)) }
                    catch { return }
                    guard !Task.isCancelled, scenePhase == .active else { return }
                    await model.refresh()
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .siloxPortfolioChanged)) { _ in
                Task { await model.refresh() }
            }
        }
    }

    private var currentPortfolio: PortfolioResponse? {
        switch model.state {
        case .loaded(let portfolio, _): portfolio
        case .failed(_, let portfolio, _): portfolio
        default: nil
        }
    }

    private func portfolioContent(_ portfolio: PortfolioResponse, cachedAt: Date?) -> some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                if let cachedAt { StaleBanner(date: cachedAt) }
                portfolioSummary(portfolio)
                allocationCard(portfolio.positions)

                Button { onAdd(nil) } label: {
                    Label("Añadir movimiento", systemImage: "plus")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 46)
                        .foregroundStyle(.black)
                        .background(SiloxColors.accent, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)

                positionsHeader(portfolio)

                let positions = visiblePositions(portfolio.positions)
                if positions.isEmpty {
                    ContentUnavailableView(
                        search.isEmpty ? "Sin posiciones" : "Sin resultados",
                        systemImage: search.isEmpty ? "chart.pie" : "magnifyingglass",
                        description: Text(search.isEmpty ? "Añade tu primera inversión." : "Prueba con otro nombre o símbolo.")
                    )
                    .padding(.vertical, 28)
                } else {
                    ForEach(positions) { position in
                        PositionRow(
                            position: position,
                            period: performancePeriod,
                            hideBalances: hideBalances,
                            repository: repository,
                            onAdd: { onAdd(position.id) }
                        )
                    }
                }

                Label(
                    "Actualizado (portfolio.updatedAt.formatted(date: .omitted, time: .standard))",
                    systemImage: "arrow.triangle.2.circlepath"
                )
                .font(.caption2)
                .foregroundStyle(.secondary)
                .padding(.top, 2)
            }
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 14)
        }
        .refreshable { await model.refresh() }
    }

    private func portfolioSummary(_ portfolio: PortfolioResponse) -> some View {
        let totals = portfolio.totals
        let selectedAmount = performancePeriod == .session
            ? totals.sessionGain ?? totals.dailyGain
            : totals.dailyGain
        let selectedPercent = performancePeriod == .session
            ? totals.sessionGainPercent ?? totals.dailyGainPercent
            : totals.dailyGainPercent
        let amountPositive = (selectedAmount?.amount.decimalValue ?? .zero) >= 0

        return SiloxCard {
            VStack(alignment: .leading, spacing: 13) {
                HStack {
                    Text("VALOR DE LA CARTERA")
                        .font(.caption2.weight(.semibold))
                        .tracking(1.2)
                        .foregroundStyle(.secondary)
                    Spacer()
                    if let market = portfolio.marketState {
                        Text(market.isOpen ? "En directo" : "Cerrado")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(market.isOpen ? SiloxColors.positive : .secondary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 5)
                            .background((market.isOpen ? SiloxColors.positive : Color.secondary).opacity(0.10), in: Capsule())
                    }
                }

                Text(hideBalances ? "••••••" : SiloxFormatters.money(totals.totalValue.amount, currency: totals.totalValue.currency))
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .tracking(-1.1)
                    .monospacedDigit()
                    .contentTransition(.numericText())

                Picker("Periodo del rendimiento", selection: $performancePeriod) {
                    ForEach(PerformancePeriod.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)

                VStack(alignment: .leading, spacing: 4) {
                    Text(performancePeriod == .session ? "Rendimiento del periodo activo" : "Acumulado de pre, regular y post")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    HStack(spacing: 7) {
                        Text(hideBalances ? "••••" : selectedAmount.map { SiloxFormatters.signedMoney($0.amount, currency: $0.currency) } ?? "—")
                        Text(hideBalances ? "••" : selectedPercent.map(SiloxFormatters.percentage) ?? "—")
                    }
                    .font(.subheadline.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(amountPositive ? SiloxColors.positive : SiloxColors.negative)
                }
                .contentTransition(.numericText())
                .accessibilityElement(children: .combine)

                Divider().opacity(0.55)
                HStack(spacing: 0) {
                    summaryMetric("Aportado neto", totals.totalCost.amount, currency: totals.totalCost.currency)
                    Divider().padding(.horizontal, 10)
                    summaryMetric("P&L total", totals.totalGain.amount, currency: totals.totalGain.currency, signed: true)
                    Divider().padding(.horizontal, 10)
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Posiciones").font(.caption2).foregroundStyle(.secondary)
                        Text(String(portfolio.positions.count)).font(.caption.weight(.semibold)).monospacedDigit()
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(height: 36)
            }
        }
    }

    private func summaryMetric(_ title: String, _ amount: String, currency: String, signed: Bool = false) -> some View {
        let positive = amount.decimalValue >= 0
        return VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
            Text(hideBalances ? "••••" : signed ? SiloxFormatters.signedMoney(amount, currency: currency) : SiloxFormatters.money(amount, currency: currency))
                .font(.caption.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(signed ? (positive ? SiloxColors.positive : SiloxColors.negative) : Color.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func allocationCard(_ positions: [Position]) -> some View {
        let items = allocationItems(positions)
        if !items.isEmpty {
            SiloxCard {
                VStack(spacing: 10) {
                    GeometryReader { geometry in
                        HStack(spacing: 0) {
                            ForEach(items) { item in
                                Rectangle()
                                    .fill(item.color)
                                    .frame(width: geometry.size.width * item.weight / 100)
                            }
                        }
                        .clipShape(Capsule())
                    }
                    .frame(height: 7)

                    HStack(spacing: 10) {
                        Text("Distribución").font(.caption.weight(.semibold))
                        Spacer(minLength: 4)
                        ForEach(items.prefix(3)) { item in
                            HStack(spacing: 4) {
                                Circle().fill(item.color).frame(width: 5, height: 5)
                                Text(item.title).lineLimit(1)
                                Text(item.weight.formatted(.number.precision(.fractionLength(0))) + "%")
                                    .fontWeight(.semibold)
                                    .foregroundStyle(.primary)
                            }
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        }
                    }
                    .minimumScaleFactor(0.7)
                }
            }
        }
    }

    private func positionsHeader(_ portfolio: PortfolioResponse) -> some View {
        VStack(spacing: 10) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Posiciones").font(.title3.weight(.semibold))
                    Text("\(portfolio.positions.count) activos").font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Picker("Orden", selection: $positionSort) {
                    ForEach(PositionSort.allCases) { Text($0.title).tag($0) }
                }
                .pickerStyle(.segmented)
                .frame(width: 128)
            }

            HStack(spacing: 9) {
                Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                TextField("Buscar activo", text: $search)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                Image(systemName: "slider.horizontal.3").font(.caption).foregroundStyle(.tertiary)
            }
            .font(.subheadline)
            .padding(.horizontal, 12)
            .frame(height: 42)
            .background(SiloxColors.secondaryBackground, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 13, style: .continuous).stroke(Color.primary.opacity(0.08), lineWidth: 0.5)
            }
        }
        .padding(.top, 4)
    }

    private func visiblePositions(_ positions: [Position]) -> [Position] {
        let term = search.trimmingCharacters(in: .whitespacesAndNewlines)
        return positions
            .filter { position in
                term.isEmpty
                    || position.asset.name.localizedCaseInsensitiveContains(term)
                    || (position.asset.ticker?.localizedCaseInsensitiveContains(term) ?? false)
            }
            .sorted { left, right in
                if positionSort == .day {
                    return abs(left.dailyChange?.amount.decimalValue.doubleValue ?? 0)
                        > abs(right.dailyChange?.amount.decimalValue.doubleValue ?? 0)
                }
                return left.currentValue.amount.decimalValue > right.currentValue.amount.decimalValue
            }
    }

    private struct AllocationItem: Identifiable {
        let id: Asset.Kind
        let title: String
        let weight: Double
        let color: Color
    }

    private func allocationItems(_ positions: [Position]) -> [AllocationItem] {
        var values: [Asset.Kind: Double] = [:]
        for position in positions {
            values[position.asset.kind, default: 0] += position.currentValue.amount.decimalValue.doubleValue
        }
        let total = values.values.reduce(0, +)
        guard total > 0 else { return [] }
        return values.map { kind, value in
            AllocationItem(id: kind, title: allocationTitle(kind), weight: value / total * 100, color: allocationColor(kind))
        }
        .sorted { $0.weight > $1.weight }
    }

    private func allocationTitle(_ kind: Asset.Kind) -> String {
        switch kind {
        case .stock: "Acciones"
        case .etf: "ETF"
        case .fund: "Fondos"
        case .crypto: "Crypto"
        case .metal: "Metal"
        case .cash: "Liquidez"
        case .other: "Otros"
        }
    }

    private func allocationColor(_ kind: Asset.Kind) -> Color {
        switch kind {
        case .stock: SiloxColors.warning
        case .etf: .blue
        case .fund: .purple
        case .crypto: .orange
        case .metal: .gray
        case .cash: .secondary
        case .other: SiloxColors.accent
        }
    }
}

private struct PositionRow: View {
    let position: Position
    let period: PerformancePeriod
    let hideBalances: Bool
    let repository: PortfolioRepository
    let onAdd: () -> Void

    private var visiblePercent: Double? {
        period == .session
            ? position.sessionChangePercent ?? position.dailyChangePercent
            : position.dailyChangePercent
    }

    var body: some View {
        SiloxCard {
            HStack(spacing: 11) {
                NavigationLink {
                    PositionDetailView(position: position, repository: repository)
                } label: {
                    HStack(spacing: 11) {
                        ZStack(alignment: .bottomTrailing) {
                            SiloxAssetMark(asset: position.asset)
                            if position.isPriceStale {
                                Circle()
                                    .fill(SiloxColors.warning)
                                    .frame(width: 9, height: 9)
                                    .overlay(Circle().stroke(SiloxColors.secondaryBackground, lineWidth: 2))
                            }
                        }

                        VStack(alignment: .leading, spacing: 3) {
                            HStack(spacing: 5) {
                                Text(position.asset.ticker ?? position.asset.name).font(.subheadline.weight(.semibold))
                                if position.isPriceStale {
                                    Text("RETRASADO")
                                        .font(.system(size: 8, weight: .bold))
                                        .foregroundStyle(SiloxColors.warning)
                                        .padding(.horizontal, 4)
                                        .padding(.vertical, 2)
                                        .background(SiloxColors.warning.opacity(0.10), in: RoundedRectangle(cornerRadius: 4))
                                }
                            }
                            Text(position.asset.name).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                            HStack(spacing: 4) {
                                Text(position.currentPrice.map { SiloxFormatters.money($0.amount, currency: $0.currency) } ?? "Sin cotización")
                                Text("·")
                                Text(SiloxFormatters.percentage(position.gainPercent) + " total")
                                    .foregroundStyle(position.gainPercent >= 0 ? SiloxColors.positive : SiloxColors.negative)
                            }
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        }
                        Spacer(minLength: 5)
                        VStack(alignment: .trailing, spacing: 3) {
                            Text(hideBalances ? "••••" : SiloxFormatters.money(position.currentValue.amount, currency: position.currentValue.currency))
                                .font(.subheadline.weight(.semibold))
                                .monospacedDigit()
                            if let percent = visiblePercent {
                                HStack(spacing: 4) {
                                    Text(SiloxFormatters.percentage(percent))
                                    Text(period == .session ? "SESIÓN" : "DÍA")
                                        .font(.system(size: 8, weight: .semibold))
                                        .opacity(0.72)
                                }
                                .font(.caption.weight(.semibold))
                                .monospacedDigit()
                                .foregroundStyle(percent >= 0 ? SiloxColors.positive : SiloxColors.negative)
                            }
                            if let daily = position.dailyChange {
                                Text(hideBalances ? "••" : SiloxFormatters.signedMoney(daily.amount, currency: daily.currency) + " hoy")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                                    .monospacedDigit()
                            }
                        }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Button(action: onAdd) {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .semibold))
                        .frame(width: 36, height: 36)
                        .background(SiloxColors.elevatedBackground, in: Circle())
                        .overlay(Circle().stroke(Color.primary.opacity(0.10), lineWidth: 0.5))
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .accessibilityLabel("Añadir movimiento en \(position.asset.ticker ?? position.asset.name)")
            }
        }
    }
}

private struct PositionDetailView: View {
    @State private var position: Position
    @Environment(\.scenePhase) private var scenePhase
    let repository: PortfolioRepository

    init(position: Position, repository: PortfolioRepository) {
        _position = State(initialValue: position)
        self.repository = repository
    }

    var body: some View {
        List {
            Section {
                HStack(spacing: 13) {
                    SiloxAssetMark(asset: position.asset, size: 48)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(position.asset.name).font(.headline)
                        if let price = position.currentPrice {
                            Text(SiloxFormatters.money(price.amount, currency: price.currency))
                                .font(.title3.weight(.semibold))
                                .monospacedDigit()
                        }
                    }
                    Spacer()
                    if position.isPriceStale {
                        Label("Retrasado", systemImage: "clock.badge.exclamationmark")
                            .font(.caption2).foregroundStyle(SiloxColors.warning)
                    } else {
                        Label("En directo", systemImage: "circle.fill")
                            .font(.caption2).foregroundStyle(SiloxColors.positive)
                    }
                }
            }
            Section("Tu posición") {
                LabeledContent("Cantidad", value: position.quantity)
                LabeledContent("Valor", value: SiloxFormatters.money(position.currentValue.amount, currency: position.currentValue.currency))
                LabeledContent("Coste abierto", value: SiloxFormatters.money(position.openCost.amount, currency: position.openCost.currency))
                LabeledContent("Rentabilidad", value: SiloxFormatters.percentage(position.gainPercent))
                if let daily = position.dailyChange {
                    LabeledContent("Resultado de hoy", value: SiloxFormatters.signedMoney(daily.amount, currency: daily.currency))
                }
            }
            Section("Cotización") {
                if let priceUpdatedAt = position.priceUpdatedAt {
                    LabeledContent("Última actualización", value: priceUpdatedAt.formatted(date: .abbreviated, time: .standard))
                }
                if let session = position.sessionChangePercent {
                    LabeledContent("Sesión activa", value: SiloxFormatters.percentage(session))
                }
                if let daily = position.dailyChangePercent {
                    LabeledContent("Día completo", value: SiloxFormatters.percentage(daily))
                }
            }
        }
        .navigationTitle(position.asset.ticker ?? position.asset.name)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await refresh() }
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            await refresh()
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(5)) }
                catch { return }
                guard !Task.isCancelled, scenePhase == .active else { return }
                await refresh()
            }
        }
    }

    private func refresh() async {
        guard let response = try? await repository.refresh(),
              let updated = response.positions.first(where: { $0.id == position.id }) else { return }
        position = updated
    }
}
