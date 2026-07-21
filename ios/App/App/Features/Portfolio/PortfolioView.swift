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
        do { state = .loaded(try await repository.value(), cachedAt: nil) }
        catch {
            let cached = await repository.cached()
            state = .failed(error.localizedDescription, cached: cached?.value, cachedAt: cached?.savedAt)
        }
    }

    func refresh() async {
        do { state = .loaded(try await repository.refresh(), cachedAt: nil) }
        catch {
            let cached = await repository.cached()
            state = .failed(error.localizedDescription, cached: cached?.value, cachedAt: cached?.savedAt)
        }
    }
}

enum PortfolioPositionSort: String, CaseIterable, Identifiable {
    case day
    case value

    var id: Self { self }
    var title: String { self == .day ? "Movimiento de hoy" : "Valor" }
    var shortTitle: String { self == .day ? "Hoy" : "Valor" }
}

struct PortfolioView: View {
    @StateObject private var model: PortfolioViewModel
    @AppStorage("hideBalances") private var hideBalances = false
    @AppStorage("portfolioSort") private var positionSortRaw = PortfolioPositionSort.day.rawValue
    @AppStorage("compactPositions") private var compactPositions = false
    @AppStorage("quantityPrecision") private var quantityPrecision = 4
    @AppStorage("liveRefreshSeconds") private var liveRefreshSeconds = 5
    @AppStorage("showDailyAmount") private var showDailyAmount = true
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var search = ""
    @State private var sharePresentation: PortfolioSharePresentation?

    private let repository: PortfolioRepository
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
                    SiloxLoadingView(.portfolio)
                case .loaded(let portfolio, let cachedAt):
                    portfolioContent(portfolio, cachedAt: cachedAt)
                case .failed(let message, let cached, let cachedAt):
                    if let cached { portfolioContent(cached, cachedAt: cachedAt) }
                    else { ErrorStateView(message: message) { Task { await model.refresh() } } }
                }
            }
            .background(SiloxColors.backgroundPrimary.ignoresSafeArea())
            .navigationTitle("Cartera")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $search, prompt: "Buscar por nombre o símbolo")
            .toolbar {
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 1) {
                        Text("Silox").font(.headline)
                        if let market = currentPortfolio?.marketState {
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(market.isOpen ? SiloxColors.accentSecondary : SiloxColors.textSecondary)
                                    .frame(width: 5, height: 5)
                                Text(market.label).font(.caption2).foregroundStyle(SiloxColors.textSecondary)
                            }
                        }
                    }
                }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button {
                        presentShareCard(originatedFromScreenshot: false)
                    } label: {
                        Image(systemName: "square.and.arrow.up")
                    }
                    .accessibilityLabel("Compartir cartera")
                    Button { onAdd(nil) } label: { Image(systemName: "plus") }
                        .accessibilityLabel("Añadir movimiento")
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
                    do { try await Task.sleep(for: .seconds(Double(liveRefreshSeconds))) }
                    catch { return }
                    guard !Task.isCancelled, scenePhase == .active else { return }
                    await model.refresh()
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .siloxPortfolioChanged)) { _ in
                Task { await model.refresh() }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.userDidTakeScreenshotNotification)) { _ in
                presentShareCard(originatedFromScreenshot: true)
            }
            .sheet(item: $sharePresentation) { presentation in
                PortfolioSharePreviewSheet(presentation: presentation)
                    .presentationDetents([.large])
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
        let active = activePositions(portfolio.positions)
        let visible = visiblePositions(active)

        return ScrollView {
            LazyVStack(spacing: 14) {
                if let cachedAt { StaleBanner(date: cachedAt) }
                portfolioSummary(portfolio)
                positionsHeader(portfolio: portfolio, count: active.count)

                if visible.isEmpty {
                    ContentUnavailableView(
                        search.isEmpty ? "Sin posiciones" : "Sin resultados",
                        systemImage: search.isEmpty ? "chart.line.uptrend.xyaxis" : "magnifyingglass",
                        description: Text(search.isEmpty ? "Añade tu primera inversión." : "Prueba con otro nombre o símbolo.")
                    )
                    .frame(minHeight: 220)
                } else {
                    VStack(spacing: 0) {
                        ForEach(visible) { position in
                            PositionRow(
                                position: position,
                                hideBalances: hideBalances,
                                compact: compactPositions,
                                showDailyAmount: showDailyAmount,
                                quantityPrecision: quantityPrecision,
                                repository: repository,
                                onAdd: { onAdd(position.id) }
                            )
                            if position.id != visible.last?.id {
                                Divider().padding(.leading, 66)
                            }
                        }
                    }
                    .animation(reduceMotion ? nil : .snappy(duration: 0.34, extraBounce: 0.08), value: visible)
                    .background(SiloxColors.backgroundSecondary, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 20, style: .continuous)
                            .stroke(SiloxColors.textPrimary.opacity(0.07), lineWidth: 0.5)
                    }
                }

                Label(
                    "Actualizado \(portfolio.updatedAt.formatted(date: .omitted, time: .standard))",
                    systemImage: "arrow.triangle.2.circlepath"
                )
                .font(.caption2)
                .foregroundStyle(SiloxColors.textSecondary)
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
        let dailyAmount = totals.dailyGain
        let dailyDecimal = dailyAmount?.amount.decimalValue ?? Decimal(totals.dailyGainPercent ?? 0)
        let dailyColor = dailyDecimal > 0 ? SiloxColors.positive : dailyDecimal < 0 ? SiloxColors.negative : SiloxColors.textPrimary

        return SiloxCard {
            VStack(alignment: .leading, spacing: 15) {
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 6) {
                        summaryTitle
                        marketStatus(portfolio)
                    }
                } else {
                    HStack {
                        summaryTitle
                        Spacer(minLength: 8)
                        marketStatus(portfolio)
                    }
                }

                Text(hideBalances ? "••••••" : SiloxFormatters.money(totals.totalValue.amount, currency: totals.totalValue.currency))
                    .font(dynamicTypeSize.isAccessibilitySize ? .title.bold() : .largeTitle.bold())
                    .fontDesign(.rounded)
                    .monospacedDigit()
                    .contentTransition(.numericText())
                    .minimumScaleFactor(0.7)

                VStack(alignment: .leading, spacing: 5) {
                    Text("HOY · PRE + MERCADO + POST")
                        .font(.caption2.weight(.semibold))
                        .tracking(0.8)
                        .foregroundStyle(SiloxColors.textSecondary)
                    ViewThatFits(in: .horizontal) {
                        HStack(spacing: 8) {
                            dailySummaryAmount(dailyAmount, percent: totals.dailyGainPercent)
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            dailySummaryAmount(dailyAmount, percent: totals.dailyGainPercent)
                        }
                    }
                    .font(.title3.weight(.semibold))
                    .monospacedDigit()
                    .foregroundStyle(dailyColor)
                }
                .contentTransition(.numericText())
                .accessibilityElement(children: .combine)

                Divider().opacity(0.5)
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 12) {
                        summaryMetric("P&L total", totals.totalGain.amount, currency: totals.totalGain.currency, signed: true)
                        summaryMetric("Aportado neto", totals.totalCost.amount, currency: totals.totalCost.currency)
                        activeAssetsMetric(portfolio)
                    }
                } else {
                    HStack(spacing: 0) {
                        summaryMetric("P&L total", totals.totalGain.amount, currency: totals.totalGain.currency, signed: true)
                        Divider().padding(.horizontal, 12)
                        summaryMetric("Aportado neto", totals.totalCost.amount, currency: totals.totalCost.currency)
                        Divider().padding(.horizontal, 12)
                        activeAssetsMetric(portfolio)
                    }
                }
            }
        }
    }

    private var summaryTitle: some View {
        Text("PATRIMONIO")
            .font(.caption2.weight(.semibold))
            .tracking(1.2)
            .foregroundStyle(SiloxColors.textSecondary)
    }

    @ViewBuilder
    private func marketStatus(_ portfolio: PortfolioResponse) -> some View {
        if let market = portfolio.marketState {
            HStack(spacing: 5) {
                Image(systemName: market.isOpen ? "dot.radiowaves.left.and.right" : "moon.fill")
                Text(market.isOpen ? "En directo" : "Cerrado")
            }
            .font(.caption2.weight(.semibold))
            .foregroundStyle(market.isOpen ? SiloxColors.accentSecondary : SiloxColors.textSecondary)
        }
    }

    @ViewBuilder
    private func dailySummaryAmount(_ amount: MoneyValue?, percent: Double?) -> some View {
        Text(hideBalances ? "••••" : amount.map { SiloxFormatters.signedMoney($0.amount, currency: $0.currency) } ?? "—")
        Text(hideBalances ? "••" : percent.map(SiloxFormatters.percentage) ?? "—")
    }

    private func activeAssetsMetric(_ portfolio: PortfolioResponse) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Activos").font(.caption2).foregroundStyle(SiloxColors.textSecondary)
            Text(String(activePositions(portfolio.positions).count))
                .font(.caption.weight(.semibold)).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func summaryMetric(_ title: String, _ amount: String, currency: String, signed: Bool = false) -> some View {
        let decimal = amount.decimalValue
        let color = decimal > 0 ? SiloxColors.positive : decimal < 0 ? SiloxColors.negative : SiloxColors.textPrimary
        return VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption2).foregroundStyle(SiloxColors.textSecondary).lineLimit(1)
            Text(hideBalances ? "••••" : signed ? SiloxFormatters.signedMoney(amount, currency: currency) : SiloxFormatters.money(amount, currency: currency))
                .font(.caption.weight(.semibold))
                .monospacedDigit()
                .foregroundStyle(signed ? color : SiloxColors.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func positionsHeader(portfolio: PortfolioResponse, count: Int) -> some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text("Posiciones hoy").font(.title3.weight(.semibold))
                    if portfolio.marketState?.isOpen == true {
                        Image(systemName: "dot.radiowaves.left.and.right")
                            .font(.caption2)
                            .foregroundStyle(SiloxColors.accentSecondary)
                    }
                }
                Text("\(count) activos · día completo")
                    .font(.caption)
                    .foregroundStyle(SiloxColors.textSecondary)
            }
            Spacer()
            Menu {
                Picker("Orden", selection: Binding(
                    get: { PortfolioPositionSort(rawValue: positionSortRaw) ?? .day },
                    set: { positionSortRaw = $0.rawValue }
                )) {
                    ForEach(PortfolioPositionSort.allCases) { Text($0.title).tag($0) }
                }
            } label: {
                HStack(spacing: 5) {
                    Text((PortfolioPositionSort(rawValue: positionSortRaw) ?? .day).shortTitle)
                    Image(systemName: "arrow.up.arrow.down")
                }
                .font(.caption.weight(.semibold))
                .padding(.horizontal, 10)
                .frame(height: 34)
                .siloxInteractiveGlass(cornerRadius: 17)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Ordenar posiciones")
        }
        .padding(.top, 2)
    }

    private func visiblePositions(_ positions: [Position]) -> [Position] {
        PortfolioPositionPresentation.visiblePositions(
            positions,
            search: search,
            sort: PortfolioPositionSort(rawValue: positionSortRaw) ?? .day
        )
    }

    private func activePositions(_ positions: [Position]) -> [Position] {
        positions.filter { $0.asset.kind != .cash && $0.quantity.decimalValue > 0 }
    }

    private func presentShareCard(originatedFromScreenshot: Bool) {
        guard let portfolio = currentPortfolio else { return }
        sharePresentation = PortfolioSharePresentation(
            snapshot: PortfolioShareSnapshot(portfolio: portfolio, balancesHidden: hideBalances),
            originatedFromScreenshot: originatedFromScreenshot
        )
    }
}

private struct PositionRow: View {
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let position: Position
    let hideBalances: Bool
    let compact: Bool
    let showDailyAmount: Bool
    let quantityPrecision: Int
    let repository: PortfolioRepository
    let onAdd: () -> Void

    private var dailyColor: Color {
        let value = position.dailyChange?.amount.decimalValue ?? Decimal(position.dailyChangePercent ?? 0)
        if value > 0 { return SiloxColors.positive }
        if value < 0 { return SiloxColors.negative }
        return SiloxColors.textSecondary
    }

    var body: some View {
        NavigationLink {
            PositionDetailView(position: position, repository: repository, onAdd: onAdd)
        } label: {
            Group {
                if dynamicTypeSize.isAccessibilitySize { accessibleLayout }
                else { regularLayout }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, compact ? 10 : 13)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contextMenu {
            Button(action: onAdd) { Label("Añadir movimiento", systemImage: "plus") }
        }
        .accessibilityElement(children: .combine)
    }

    private var regularLayout: some View {
        HStack(spacing: 12) {
            assetMark
            assetIdentity
            Spacer(minLength: 6)
            positionValue(alignment: .trailing)
            Image(systemName: "chevron.right")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(SiloxColors.textTertiary)
        }
    }

    private var accessibleLayout: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                assetMark
                assetIdentity
            }
            positionValue(alignment: .leading)
        }
    }

    private var assetMark: some View {
        ZStack(alignment: .bottomTrailing) {
            SiloxAssetMark(asset: position.asset, size: compact ? 38 : 40)
            Circle()
                .fill(position.isPriceStale ? SiloxColors.warning : SiloxColors.accentSecondary)
                .frame(width: 8, height: 8)
                .overlay(Circle().stroke(SiloxColors.backgroundSecondary, lineWidth: 2))
        }
    }

    private var assetIdentity: some View {
        VStack(alignment: .leading, spacing: compact ? 2 : 4) {
            Text(position.asset.displayName)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(SiloxColors.textPrimary)
            Text(position.asset.metadataLabel)
                .font(.caption2)
                .foregroundStyle(SiloxColors.textSecondary)
            if !compact {
                Text("\(SiloxFormatters.quantity(position.quantity, precision: quantityPrecision)) uds.")
                    .font(.caption2)
                    .foregroundStyle(SiloxColors.textTertiary)
            }
        }
    }

    private func positionValue(alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: compact ? 2 : 4) {
            Text(hideBalances ? "••••" : SiloxFormatters.money(position.currentValue.amount, currency: position.currentValue.currency))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(SiloxColors.textPrimary)
                .monospacedDigit()
                .contentTransition(.numericText())
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 5) { dailyValue }
                VStack(alignment: alignment, spacing: 2) { dailyValue }
            }
            .font(.caption.weight(.semibold))
            .foregroundStyle(dailyColor)
            .monospacedDigit()
            if !compact && (position.isPriceStale || position.asset.kind == .fund) {
                Text(position.asset.kind == .fund ? navStatusText : "Precio retrasado")
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(position.isPriceStale ? SiloxColors.warning : SiloxColors.textTertiary)
            }
        }
    }

    private var navStatusText: String {
        guard let updatedAt = position.priceUpdatedAt else { return "NAV" }
        return "NAV Â· \(updatedAt.formatted(.dateTime.day().month()))"
    }

    @ViewBuilder private var dailyValue: some View {
        if showDailyAmount, let daily = position.dailyChange {
            Text(hideBalances ? "••" : SiloxFormatters.signedMoney(daily.amount, currency: daily.currency))
        }
        if let percent = position.dailyChangePercent {
            Text(SiloxFormatters.percentage(percent))
        }
    }
}

private struct PositionDetailView: View {
    @State private var position: Position
    @State private var showAllPurchaseLots = false
    @AppStorage("hideBalances") private var hideBalances = false
    @AppStorage("quantityPrecision") private var quantityPrecision = 4
    @AppStorage("liveRefreshSeconds") private var liveRefreshSeconds = 5
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let repository: PortfolioRepository
    let onAdd: () -> Void

    init(position: Position, repository: PortfolioRepository, onAdd: @escaping () -> Void) {
        _position = State(initialValue: position)
        self.repository = repository
        self.onAdd = onAdd
    }

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 14) {
                detailHeader
                LazyVGrid(columns: detailColumns, spacing: 10) {
                    DetailMetric(
                        title: "Valor actual",
                        value: hiddenMoney(position.currentValue),
                        icon: "wallet.bifold",
                        color: SiloxColors.textPrimary
                    )
                    DetailMetric(
                        title: "P&L total",
                        value: hideBalances ? "••••" : SiloxFormatters.signedMoney(position.gain.amount, currency: position.gain.currency),
                        detail: SiloxFormatters.percentage(position.gainPercent),
                        icon: "chart.line.uptrend.xyaxis",
                        color: performanceColor(position.gain.amount.decimalValue)
                    )
                    DetailMetric(
                        title: "Dinero invertido",
                        value: hiddenMoney(position.investedCash),
                        icon: "banknote",
                        color: SiloxColors.textPrimary
                    )
                    DetailMetric(
                        title: "Unidades",
                        value: SiloxFormatters.quantity(position.quantity, precision: quantityPrecision),
                        icon: "number",
                        color: SiloxColors.textPrimary
                    )
                }
                purchaseLotsCard
                quoteInformation

                Button(action: onAdd) {
                    Label("Añadir movimiento", systemImage: "plus")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                }
                .siloxProminentButtonStyle()
                .tint(SiloxColors.accent)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(SiloxColors.backgroundPrimary.ignoresSafeArea())
        .navigationTitle(position.asset.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await refresh() }
        .task(id: scenePhase) {
            guard scenePhase == .active else { return }
            await refresh()
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(Double(liveRefreshSeconds))) }
                catch { return }
                guard !Task.isCancelled, scenePhase == .active else { return }
                await refresh()
            }
        }
    }

    private var detailColumns: [GridItem] {
        Array(repeating: GridItem(.flexible()), count: dynamicTypeSize.isAccessibilitySize ? 1 : 2)
    }

    private var purchaseLotsCard: some View {
        let lots = showAllPurchaseLots
            ? position.openPurchaseLots
            : Array(position.openPurchaseLots.prefix(8))
        let hiddenCount = max(0, position.openPurchaseLots.count - 8)

        return SiloxCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top, spacing: 12) {
                    Image(systemName: "square.stack.3d.up.fill")
                        .foregroundStyle(SiloxColors.accent)
                        .frame(width: 30, height: 30)
                        .background(SiloxColors.accent.opacity(0.12), in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                    VStack(alignment: .leading, spacing: 3) {
                        Text("Rendimiento por compra")
                            .font(.subheadline.weight(.semibold))
                        Text("Lotes abiertos tras aplicar FIFO. Las ventas consumen primero las compras más antiguas.")
                            .font(.caption2)
                            .foregroundStyle(SiloxColors.textSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 4)
                    Text("\(position.openPurchaseLots.count)")
                        .font(.caption.weight(.bold))
                        .monospacedDigit()
                        .padding(.horizontal, 9)
                        .padding(.vertical, 5)
                        .background(SiloxColors.accent.opacity(0.12), in: Capsule())
                        .foregroundStyle(SiloxColors.accent)
                }

                HStack {
                    Text("Base de rendimiento")
                        .foregroundStyle(SiloxColors.textSecondary)
                    Spacer()
                    Text(hiddenMoney(position.openCost))
                        .fontWeight(.semibold)
                        .monospacedDigit()
                }
                .font(.caption)

                Divider().opacity(0.5)

                if lots.isEmpty {
                    ContentUnavailableView(
                        "No hay compras abiertas",
                        systemImage: "tray",
                        description: Text("Los lotes anteriores ya se consumieron mediante ventas FIFO o todavía no hay compras completadas.")
                    )
                    .frame(maxWidth: .infinity)
                } else {
                    LazyVStack(spacing: 0) {
                        ForEach(Array(lots.enumerated()), id: \.element.id) { index, lot in
                            PurchaseLotRow(
                                lot: lot,
                                currentPrice: position.currentPrice,
                                hideBalances: hideBalances,
                                quantityPrecision: quantityPrecision
                            )
                            if index < lots.count - 1 { Divider().padding(.leading, 42).opacity(0.45) }
                        }
                    }
                }

                if hiddenCount > 0 {
                    Button {
                        withAnimation(.snappy) { showAllPurchaseLots.toggle() }
                    } label: {
                        Label(
                            showAllPurchaseLots ? "Mostrar menos" : "Ver \(hiddenCount) lotes más",
                            systemImage: showAllPurchaseLots ? "chevron.up" : "chevron.down"
                        )
                        .font(.caption.weight(.semibold))
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(SiloxColors.textSecondary)
                }
            }
        }
    }

    private var detailHeader: some View {
        let dailyAmount = position.dailyChange?.amount.decimalValue ?? Decimal(position.dailyChangePercent ?? 0)
        let dailyColor = performanceColor(dailyAmount)

        return SiloxCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    SiloxAssetMark(asset: position.asset, size: 40)
                    VStack(alignment: .leading, spacing: 3) {
                        Text(position.asset.displayName).font(.headline).lineLimit(2)
                        Text("\(position.asset.metadataLabel) · \(position.asset.kind.displayName)")
                            .font(.caption).foregroundStyle(SiloxColors.textSecondary)
                    }
                    Spacer()
                    HStack(spacing: 5) {
                        Circle()
                            .fill(position.isPriceStale ? SiloxColors.warning : SiloxColors.accentSecondary)
                            .frame(width: 6, height: 6)
                        Text(position.asset.kind == .fund ? "NAV publicado" : (position.isPriceStale ? "Retrasado" : "En directo"))
                    }
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(position.isPriceStale ? SiloxColors.warning : SiloxColors.accentSecondary)
                }

                VStack(alignment: .leading, spacing: 5) {
                    Text(position.asset.kind == .fund ? "ÃšLTIMO NAV" : "PRECIO ACTUAL")
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(0.8)
                        .foregroundStyle(SiloxColors.textSecondary)
                    Text(position.currentPrice.map { SiloxFormatters.money($0.amount, currency: $0.currency) } ?? "Sin cotización")
                        .font(.system(size: 31, weight: .bold, design: .rounded))
                        .monospacedDigit()
                }

                HStack(spacing: 8) {
                    Text("Hoy completo")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(SiloxColors.textSecondary)
                    Spacer()
                    if let daily = position.dailyChange {
                        Text(hideBalances ? "••••" : SiloxFormatters.signedMoney(daily.amount, currency: daily.currency))
                    }
                    if let percent = position.dailyChangePercent {
                        Text(SiloxFormatters.percentage(percent))
                    }
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(dailyColor)
                .monospacedDigit()

                Text(position.asset.kind == .fund
                    ? "El fondo publica un valor liquidativo, no una cotizaciÃ³n intradÃ­a."
                    : "Incluye premercado, mercado regular y postmercado.")
                    .font(.caption2)
                    .foregroundStyle(SiloxColors.textSecondary)
            }
        }
    }

    private var quoteInformation: some View {
        SiloxCard {
            VStack(spacing: 12) {
                HStack {
                    Label("Cotización", systemImage: "bolt.horizontal.circle")
                        .font(.subheadline.weight(.semibold))
                    Spacer()
                    Text(position.asset.currency)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(SiloxColors.textSecondary)
                }
                Divider().opacity(0.5)
                HStack {
                    Text("Última actualización").foregroundStyle(SiloxColors.textSecondary)
                    Spacer()
                    Text(position.priceUpdatedAt?.formatted(date: .abbreviated, time: .standard) ?? "Sin datos")
                        .multilineTextAlignment(.trailing)
                }
                .font(.caption)
                if let daily = position.dailyChangePercent {
                    HStack {
                        Text("Variación del día").foregroundStyle(SiloxColors.textSecondary)
                        Spacer()
                        Text(SiloxFormatters.percentage(daily))
                            .fontWeight(.semibold)
                            .foregroundStyle(performanceColor(Decimal(daily)))
                    }
                    .font(.caption)
                }
            }
        }
    }

    private func hiddenMoney(_ value: MoneyValue) -> String {
        hideBalances ? "••••" : SiloxFormatters.money(value.amount, currency: value.currency)
    }

    private func performanceColor(_ value: Decimal) -> Color {
        if value > 0 { return SiloxColors.positive }
        if value < 0 { return SiloxColors.negative }
        return SiloxColors.textPrimary
    }

    private func refresh() async {
        guard let response = try? await repository.refresh(),
              let updated = response.positions.first(where: { $0.id == position.id }) else { return }
        position = updated
    }
}

private struct PurchaseLotRow: View {
    let lot: OpenPurchaseLot
    let currentPrice: MoneyValue?
    let hideBalances: Bool
    let quantityPrecision: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .firstTextBaseline) {
                Text(lot.date.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption.weight(.semibold))
                if lot.isPartial { lotBadge("Parcial", color: SiloxColors.warning) }
                if lot.isReward { lotBadge("Recompensa", color: SiloxColors.accentSecondary) }
                Spacer()
                performanceLabel
            }

            HStack(alignment: .bottom, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Unidades abiertas")
                        .font(.caption2)
                        .foregroundStyle(SiloxColors.textSecondary)
                    Text(openQuantityLabel)
                        .font(.caption.weight(.medium))
                        .monospacedDigit()
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Compra · Valor actual")
                        .font(.caption2)
                        .foregroundStyle(SiloxColors.textSecondary)
                    Text(hideBalances ? "••••" : valueLabel)
                        .font(.caption.weight(.medium))
                        .monospacedDigit()
                }
            }
        }
        .padding(.vertical, 12)
        .accessibilityElement(children: .combine)
    }

    private var openQuantityLabel: String {
        let remaining = SiloxFormatters.quantity(lot.remainingQuantity, precision: quantityPrecision)
        guard lot.isPartial else { return remaining }
        return "\(remaining) de \(SiloxFormatters.quantity(lot.originalQuantity, precision: quantityPrecision))"
    }

    private var valueLabel: String {
        let purchase = SiloxFormatters.money(lot.purchasePrice.amount, currency: lot.purchasePrice.currency)
        guard let value = currentValue else { return "\(purchase) · —" }
        return "\(purchase) · \(SiloxFormatters.money(decimalString(value), currency: lot.purchasePrice.currency))"
    }

    @ViewBuilder private var performanceLabel: some View {
        if hideBalances {
            Text("••••")
                .font(.caption.weight(.bold))
        } else if let pnl, let percent {
            VStack(alignment: .trailing, spacing: 1) {
                Text(SiloxFormatters.signedMoney(decimalString(pnl), currency: lot.purchasePrice.currency))
                Text(SiloxFormatters.percentage(percent))
                    .font(.caption2)
            }
            .font(.caption.weight(.bold))
            .foregroundStyle(pnl > 0 ? SiloxColors.positive : pnl < 0 ? SiloxColors.negative : SiloxColors.textPrimary)
            .monospacedDigit()
        } else {
            Text("Sin cotización")
                .font(.caption2)
                .foregroundStyle(SiloxColors.textSecondary)
        }
    }

    private func lotBadge(_ title: String, color: Color) -> some View {
        Text(title)
            .font(.system(size: 9, weight: .semibold))
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(color.opacity(0.12), in: Capsule())
            .foregroundStyle(color)
    }

    private var currentValue: Decimal? {
        guard let currentPrice else { return nil }
        return lot.remainingQuantity.decimalValue * currentPrice.amount.decimalValue
    }

    private var referenceValue: Decimal {
        lot.remainingQuantity.decimalValue * lot.performanceUnitCost.amount.decimalValue
    }

    private var pnl: Decimal? {
        currentValue.map { $0 - referenceValue }
    }

    private var percent: Double? {
        guard let pnl, referenceValue > 0 else { return nil }
        return NSDecimalNumber(decimal: pnl / referenceValue * 100).doubleValue
    }

    private func decimalString(_ value: Decimal) -> String {
        NSDecimalNumber(decimal: value).stringValue
    }
}

private struct DetailMetric: View {
    let title: String
    let value: String
    var detail: String? = nil
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack {
                Text(title).font(.caption).foregroundStyle(SiloxColors.textSecondary)
                Spacer()
                Image(systemName: icon).font(.caption).foregroundStyle(SiloxColors.textTertiary)
            }
            Text(value)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(color)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.75)
            if let detail {
                Text(detail).font(.caption2.weight(.medium)).foregroundStyle(color)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 95, alignment: .leading)
        .background(SiloxColors.backgroundSecondary, in: RoundedRectangle(cornerRadius: 17, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 17, style: .continuous)
                .stroke(SiloxColors.textPrimary.opacity(0.07), lineWidth: 0.5)
        }
    }
}
