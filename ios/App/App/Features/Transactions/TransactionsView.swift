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
        do { state = .loaded(try await repository.list(), cachedAt: nil) }
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

struct TransactionsView: View {
    @StateObject private var model: TransactionsViewModel
    @State private var pendingDeletion: InvestmentTransaction?
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
            if model.filtered.isEmpty {
                ContentUnavailableView.search(text: model.query)
            } else {
                ForEach(model.filtered) { transaction in
                    HStack(spacing: 12) {
                        Image(systemName: icon(for: transaction.kind)).foregroundStyle(color(for: transaction.kind))
                        VStack(alignment: .leading) {
                            Text(transaction.kind.title).font(.headline)
                            Text(transaction.asset?.ticker ?? transaction.asset?.name ?? "Efectivo").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        VStack(alignment: .trailing) {
                            Text(SiloxFormatters.money(transaction.amount.amount, currency: transaction.amount.currency)).monospacedDigit()
                            Text(transaction.occurredAt.formatted(date: .abbreviated, time: .omitted)).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .accessibilityElement(children: .combine)
                    .swipeActions {
                        Button("Eliminar", role: .destructive) { pendingDeletion = transaction }
                    }
                }
            }
        }
        .refreshable { await model.refresh() }
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
