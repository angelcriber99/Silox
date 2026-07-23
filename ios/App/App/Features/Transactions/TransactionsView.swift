import SwiftUI

@MainActor
final class TransactionsViewModel: ObservableObject {
    @Published private(set) var state: LoadState<TransactionPage> = .idle
    @Published var query = ""
    @Published private(set) var isLoadingMore = false
    private let repository: TransactionRepository
    private var activeQuery = TransactionQuery()
    private var hasLoaded = false

    init(repository: TransactionRepository) { self.repository = repository }

    var items: [InvestmentTransaction] {
        switch state {
        case .loaded(let page, _): page.items
        case .failed(_, let page, _): page?.items ?? []
        default: []
        }
    }

    var hasNextPage: Bool {
        switch state {
        case .loaded(let page, _): page.nextCursor != nil
        case .failed(_, let page, _): page?.nextCursor != nil
        default: false
        }
    }

    func load(query: TransactionQuery) async {
        if !hasLoaded {
            hasLoaded = true
            if query == TransactionQuery(), let cached = await repository.cached() {
                state = .loaded(cached.value, cachedAt: cached.savedAt)
            } else {
                state = .loading
            }
        }
        activeQuery = query
        do {
            let page: TransactionPage
            if query == TransactionQuery() {
                page = try await repository.value()
            } else {
                page = try await repository.list(query: query)
            }
            state = .loaded(page, cachedAt: nil)
        }
        catch {
            let fallback = items.isEmpty ? await repository.cached() : nil
            state = .failed(error.localizedDescription, cached: items.isEmpty ? fallback?.value : currentPage, cachedAt: fallback?.savedAt)
        }
    }

    func refresh(query: TransactionQuery? = nil) async {
        if let query { activeQuery = query }
        var firstPage = activeQuery
        firstPage.cursor = nil
        do { state = .loaded(try await repository.list(query: firstPage), cachedAt: nil) }
        catch {
            let fallback = items.isEmpty ? await repository.cached() : nil
            state = .failed(error.localizedDescription, cached: items.isEmpty ? fallback?.value : currentPage, cachedAt: fallback?.savedAt)
        }
    }

    func loadMore() async {
        guard !isLoadingMore, hasNextPage, let cursor = currentPage?.nextCursor else { return }
        isLoadingMore = true
        defer { isLoadingMore = false }
        var nextQuery = activeQuery
        nextQuery.cursor = cursor
        do {
            let next = try await repository.list(query: nextQuery)
            let merged = TransactionPage(items: items + next.items, nextCursor: next.nextCursor)
            state = .loaded(merged, cachedAt: nil)
        } catch {
            state = .failed(error.localizedDescription, cached: currentPage, cachedAt: nil)
        }
    }

    func delete(_ transaction: InvestmentTransaction) async {
        do { try await repository.delete(id: transaction.id); await refresh() }
        catch { state = .failed(error.localizedDescription, cached: nil, cachedAt: nil) }
    }

    private var currentPage: TransactionPage? {
        switch state {
        case .loaded(let page, _): page
        case .failed(_, let page, _): page
        default: nil
        }
    }
}

private enum TransactionPeriod: String, CaseIterable, Identifiable {
    case all, month, year, custom
    var id: Self { self }
    var title: String {
        switch self {
        case .all: "Todo"
        case .month: "Mes"
        case .year: "Año"
        case .custom: "Personalizado"
        }
    }
}

struct TransactionsView: View {
    @StateObject private var model: TransactionsViewModel
    @State private var pendingDeletion: InvestmentTransaction?
    @State private var period: TransactionPeriod = .all
    @State private var referenceDate = Date()
    @State private var customStart = Calendar.current.date(byAdding: .month, value: -1, to: .now) ?? .now
    @State private var customEnd = Date()
    @State private var operation: InvestmentTransaction.Kind?
    let onAdd: () -> Void
    init(repository: TransactionRepository, onAdd: @escaping () -> Void = {}) {
        _model = StateObject(wrappedValue: TransactionsViewModel(repository: repository))
        self.onAdd = onAdd
    }

    var body: some View {
        NavigationStack {
            Group {
                switch model.state {
                case .idle, .loading: ProgressView("Cargando movimientos…")
                case .failed(let message, nil, _): ErrorStateView(message: message) { Task { await model.refresh() } }
                default: list
                }
            }
            .navigationTitle("Movimientos")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Menu {
                        Picker("Periodo", selection: $period) {
                            ForEach(TransactionPeriod.allCases) { Text($0.title).tag($0) }
                        }
                        Picker("Operación", selection: $operation) {
                            Text("Todas").tag(nil as InvestmentTransaction.Kind?)
                            ForEach(filterableKinds, id: \.self) { kind in
                                Text(kind.title).tag(kind as InvestmentTransaction.Kind?)
                            }
                        }
                    } label: {
                        Label(period.title, systemImage: "line.3.horizontal.decrease.circle")
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: onAdd) { Image(systemName: "plus") }
                        .accessibilityLabel("Añadir")
                }
            }
            .searchable(text: $model.query, prompt: "Buscar movimiento")
            .task(id: requestSignature) {
                if !model.query.isEmpty {
                    do { try await Task.sleep(for: .milliseconds(300)) }
                    catch { return }
                }
                guard !Task.isCancelled else { return }
                await model.load(query: requestQuery)
            }
            .onReceive(NotificationCenter.default.publisher(for: .siloxPortfolioChanged)) { _ in
                Task { await model.refresh() }
            }
            .confirmationDialog(
                "¿Eliminar este movimiento?",
                isPresented: Binding(
                    get: { pendingDeletion != nil },
                    set: { if !$0 { pendingDeletion = nil } }
                ),
                titleVisibility: .visible
            ) {
                Button("Eliminar", role: .destructive) {
                    guard let transaction = pendingDeletion else { return }
                    pendingDeletion = nil
                    Task { await model.delete(transaction) }
                }
                Button("Cancelar", role: .cancel) { pendingDeletion = nil }
            } message: {
                Text("La cartera se recalculará y esta acción no se puede deshacer.")
            }
        }
    }

    private var list: some View {
        List {
            if case .loaded(_, let cachedAt) = model.state, let cachedAt { StaleBanner(date: cachedAt).listRowInsets(EdgeInsets()) }
            filterControls
            if model.items.isEmpty {
                if model.query.isEmpty {
                    ContentUnavailableView("Sin movimientos", systemImage: "arrow.left.arrow.right", description: Text("No hay movimientos para estos filtros."))
                } else {
                    ContentUnavailableView.search(text: model.query)
                }
            } else {
                ForEach(groupedTransactions, id: \.month) { group in
                    Section(group.month.formatted(.dateTime.month(.wide).year())) {
                        ForEach(group.items) { transaction in
                            transactionRow(transaction)
                                .swipeActions {
                                    Button("Eliminar", role: .destructive) { pendingDeletion = transaction }
                                }
                        }
                    }
                }
                if model.hasNextPage {
                    HStack {
                        Spacer()
                        ProgressView().controlSize(.small)
                        Spacer()
                    }
                    .onAppear { Task { await model.loadMore() } }
                }
            }
        }
        .siloxContentBackground()
        .refreshable {
            async let fetch: () = model.refresh()
            async let delay: () = try? await Task.sleep(nanoseconds: 600_000_000)
            _ = await (fetch, delay)
        }
    }

    @ViewBuilder private var filterControls: some View {
        if period != .all {
            Section("Periodo") {
                if period == .month {
                    DatePicker("Mes", selection: $referenceDate, displayedComponents: .date)
                } else if period == .year {
                    Picker("Año", selection: yearBinding) {
                        ForEach(availableYears, id: \.self) { Text(String($0)).tag($0) }
                    }
                } else if period == .custom {
                    DatePicker("Desde", selection: $customStart, in: ...customEnd, displayedComponents: .date)
                    DatePicker("Hasta", selection: $customEnd, in: customStart..., displayedComponents: .date)
                }
                LabeledContent("Resultados cargados", value: String(model.items.count))
            }
        }
    }

    private var groupedTransactions: [(month: Date, items: [InvestmentTransaction])] {
        let calendar = Calendar.current
        let groups = Dictionary(grouping: model.items) { transaction in
            calendar.date(from: calendar.dateComponents([.year, .month], from: transaction.occurredAt)) ?? transaction.occurredAt
        }
        return groups.map { (month: $0.key, items: $0.value) }.sorted { $0.month > $1.month }
    }

    private var availableYears: [Int] {
        let current = Calendar.current.component(.year, from: .now)
        return Array((current - 15)...current).reversed()
    }

    private var filterableKinds: [InvestmentTransaction.Kind] {
        [.buy, .sell, .dividend, .withdrawal]
    }

    private var requestQuery: TransactionQuery {
        let calendar = Calendar.current
        var query = TransactionQuery(search: model.query, kind: operation)
        switch period {
        case .all: break
        case .month:
            query.from = calendar.date(from: calendar.dateComponents([.year, .month], from: referenceDate))
            query.to = query.from.flatMap { calendar.date(byAdding: DateComponents(month: 1, day: -1), to: $0) }
        case .year:
            query.year = calendar.component(.year, from: referenceDate)
        case .custom:
            query.from = calendar.startOfDay(for: customStart)
            query.to = calendar.startOfDay(for: customEnd)
        }
        return query
    }

    private var requestSignature: String {
        [
            model.query,
            period.rawValue,
            String(referenceDate.timeIntervalSince1970),
            String(customStart.timeIntervalSince1970),
            String(customEnd.timeIntervalSince1970),
            operation?.rawValue ?? "all",
        ].joined(separator: "|")
    }

    private var yearBinding: Binding<Int> {
        Binding(
            get: { Calendar.current.component(.year, from: referenceDate) },
            set: { year in
                var parts = Calendar.current.dateComponents([.month, .day], from: referenceDate)
                parts.year = year
                referenceDate = Calendar.current.date(from: parts) ?? referenceDate
            }
        )
    }

    private func transactionRow(_ transaction: InvestmentTransaction) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon(for: transaction.kind))
                .font(.title3)
                .foregroundStyle(color(for: transaction.kind))
                .frame(width: 34, height: 34)
                .background(color(for: transaction.kind).opacity(0.10), in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(transaction.asset?.displayName ?? transaction.kind.title).font(.headline)
                Text(transaction.kind.title + " · " + transaction.occurredAt.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption).foregroundStyle(SiloxColors.textSecondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(SiloxFormatters.money(
                    transaction.kind == .dividend ? (transaction.netAmount?.amount ?? transaction.amount.amount) : transaction.amount.amount,
                    currency: transaction.amount.currency
                ))
                    .font(.subheadline.weight(.semibold)).monospacedDigit()
                if transaction.kind == .dividend, dividendDeductions(transaction) > 0 {
                    Text("Bruto \(SiloxFormatters.money(transaction.amount.amount, currency: transaction.amount.currency))")
                        .font(.caption2)
                        .foregroundStyle(SiloxColors.textSecondary)
                } else if let quantity = transaction.quantity {
                    Text(SiloxFormatters.quantity(quantity, precision: 6) + " uds.").font(.caption2).foregroundStyle(SiloxColors.textSecondary)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func dividendDeductions(_ transaction: InvestmentTransaction) -> Decimal {
        (transaction.commission?.amount.decimalValue ?? 0)
            + (transaction.sourceWithholding?.amount.decimalValue ?? 0)
            + (transaction.destinationWithholding?.amount.decimalValue ?? 0)
    }

    private func icon(for kind: InvestmentTransaction.Kind) -> String {
        switch kind {
        case .buy: "arrow.down.circle.fill"
        case .sell: "arrow.up.circle.fill"
        case .dividend: "eurosign.circle.fill"
        case .deposit: "plus.circle.fill"
        case .withdrawal: "minus.circle.fill"
        case .transfer: "arrow.left.arrow.right.circle.fill"
        case .pending: "clock.fill"
        }
    }

    private func color(for kind: InvestmentTransaction.Kind) -> Color {
        switch kind {
        case .sell, .dividend, .deposit: SiloxColors.accentSecondary
        case .buy: SiloxColors.accent
        case .withdrawal: SiloxColors.textSecondary
        default: SiloxColors.textSecondary
        }
    }
}
