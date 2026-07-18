import SwiftUI

@MainActor
final class TransactionsViewModel: ObservableObject {
    @Published private(set) var state: LoadState<TransactionPage> = .idle
    @Published var query = ""
    private let repository: TransactionRepository

    init(repository: TransactionRepository) { self.repository = repository }

    var filtered: [InvestmentTransaction] {
        let items: [InvestmentTransaction]
        switch state {
        case .loaded(let page, _): items = page.items
        case .failed(_, let page, _): items = page?.items ?? []
        default: items = []
        }
        guard !query.isEmpty else { return items }
        return items.filter { transaction in
            transaction.kind.title.localizedCaseInsensitiveContains(query)
                || (transaction.asset?.name.localizedCaseInsensitiveContains(query) ?? false)
                || (transaction.asset?.ticker?.localizedCaseInsensitiveContains(query) ?? false)
        }
    }

    func load() async {
        if let cached = await repository.cached() { state = .loaded(cached.value, cachedAt: cached.savedAt) }
        else { state = .loading }
        await refresh()
    }

    func refresh() async {
        do { state = .loaded(try await repository.listAll(), cachedAt: nil) }
        catch {
            let cached = await repository.cached()
            state = .failed(error.localizedDescription, cached: cached?.value, cachedAt: cached?.savedAt)
        }
    }

    func delete(_ transaction: InvestmentTransaction) async {
        do { try await repository.delete(id: transaction.id); await refresh() }
        catch { state = .failed(error.localizedDescription, cached: nil, cachedAt: nil) }
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
            .task { await model.load() }
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
            if visibleTransactions.isEmpty {
                ContentUnavailableView.search(text: model.query)
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
            }
        }
        .refreshable { await model.refresh() }
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
                LabeledContent("Resultados", value: String(visibleTransactions.count))
            }
        }
    }

    private var visibleTransactions: [InvestmentTransaction] {
        let calendar = Calendar.current
        return model.filtered.filter { transaction in
            switch period {
            case .all: true
            case .month: calendar.isDate(transaction.occurredAt, equalTo: referenceDate, toGranularity: .month)
            case .year: calendar.component(.year, from: transaction.occurredAt) == calendar.component(.year, from: referenceDate)
            case .custom:
                transaction.occurredAt >= calendar.startOfDay(for: customStart)
                    && transaction.occurredAt < (calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: customEnd)) ?? customEnd)
            }
        }
    }

    private var groupedTransactions: [(month: Date, items: [InvestmentTransaction])] {
        let calendar = Calendar.current
        let groups = Dictionary(grouping: visibleTransactions) { transaction in
            calendar.date(from: calendar.dateComponents([.year, .month], from: transaction.occurredAt)) ?? transaction.occurredAt
        }
        return groups.map { (month: $0.key, items: $0.value) }.sorted { $0.month > $1.month }
    }

    private var availableYears: [Int] {
        let years = Set(model.filtered.map { Calendar.current.component(.year, from: $0.occurredAt) })
        return years.sorted(by: >).isEmpty ? [Calendar.current.component(.year, from: .now)] : years.sorted(by: >)
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
                Text(transaction.asset?.shortLabel ?? transaction.kind.title).font(.headline)
                Text(transaction.kind.title + " · " + transaction.occurredAt.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                Text(SiloxFormatters.money(transaction.amount.amount, currency: transaction.amount.currency))
                    .font(.subheadline.weight(.semibold)).monospacedDigit()
                if let quantity = transaction.quantity {
                    Text(SiloxFormatters.quantity(quantity, precision: 6) + " uds.").font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .accessibilityElement(children: .combine)
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
        switch kind { case .sell, .dividend, .deposit: .green; case .buy, .withdrawal: .orange; default: .secondary }
    }
}
