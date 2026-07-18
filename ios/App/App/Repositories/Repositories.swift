import Foundation

extension Notification.Name {
    static let siloxPortfolioChanged = Notification.Name("silox.portfolio.changed")
}

final class PortfolioRepository: @unchecked Sendable {
    private let api: APIClient
    private let cache: ReadCache
    private let cacheKey = "portfolio-v1"

    init(api: APIClient, cache: ReadCache) { self.api = api; self.cache = cache }

    func cached() async -> ReadCache.Cached<PortfolioResponse>? { await cache.load(PortfolioResponse.self, key: cacheKey) }

    func refresh() async throws -> PortfolioResponse {
        let wire: PortfolioWire = try await api.get("api/mobile/v1/portfolio")
        let response = wire.domain()
        await cache.save(response, key: cacheKey)
        return response
    }
}

final class RadarRepository: @unchecked Sendable {
    private let api: APIClient
    private let cache: ReadCache
    private let cacheKey = "radar-v1"

    init(api: APIClient, cache: ReadCache) { self.api = api; self.cache = cache }
    func cached() async -> ReadCache.Cached<RadarResponse>? { await cache.load(RadarResponse.self, key: cacheKey) }
    func refresh() async throws -> RadarResponse {
        let portfolio: PortfolioWire = try await api.get("api/mobile/v1/portfolio")
        let activeTickers = portfolio.positions
            .filter { ($0.units?.decimalValue ?? 0) > 0 && Asset.Kind(serverValue: $0.type) != .cash }
            .map(\.ticker)
        let tickerSet = Set(activeTickers.map { $0.uppercased() })
        async let eventRequest: [RecurringEventWire] = api.get("api/mobile/v1/events")
        async let newsRequest: [NewsItemWire] = api.get("api/mobile/v1/news")
        let (events, news) = try await (eventRequest, newsRequest)
        let marketEvents: [MarketCalendarEventWire] = (try? await api.send(
            "api/mobile/v1/market/events",
            method: .post,
            body: MarketEventsRequest(tickers: activeTickers)
        )) ?? []
        let recurring = events
            .filter { event in event.asset?.ticker.map { tickerSet.contains($0.uppercased()) } ?? false }
            .map { $0.domain() }
        let combined = (recurring + marketEvents.map { $0.domain() })
            .filter { $0.startsAt >= Calendar.current.startOfDay(for: .now) }
            .sorted { $0.startsAt < $1.startsAt }
        let response = RadarResponse(
            news: news.map { $0.domain() }.filter { item in item.ticker.map { tickerSet.contains($0.uppercased()) } ?? false },
            events: combined,
            updatedAt: .now
        )
        await cache.save(response, key: cacheKey)
        return response
    }
}

final class TransactionRepository: @unchecked Sendable {
    private let api: APIClient
    private let cache: ReadCache
    private let cacheKey = "transactions-v1"

    init(api: APIClient, cache: ReadCache) { self.api = api; self.cache = cache }
    func cached() async -> ReadCache.Cached<TransactionPage>? { await cache.load(TransactionPage.self, key: cacheKey) }
    func list(cursor: String? = nil) async throws -> TransactionPage {
        let page = cursor.flatMap(Int.init) ?? 1
        let query = [URLQueryItem(name: "page", value: String(page)), URLQueryItem(name: "pageSize", value: "100")]
        let wire: TransactionPageWire = try await api.get("api/mobile/v1/transactions", query: query)
        let response = wire.domain()
        if cursor == nil { await cache.save(response, key: cacheKey) }
        return response
    }

    func listAll() async throws -> TransactionPage {
        var items: [InvestmentTransaction] = []
        var cursor: String? = nil
        repeat {
            let page = try await list(cursor: cursor)
            items.append(contentsOf: page.items)
            cursor = page.nextCursor
        } while cursor != nil && items.count < 10_000

        let response = TransactionPage(items: items, nextCursor: nil)
        await cache.save(response, key: cacheKey)
        return response
    }
    func create(_ request: CreateTransactionRequest) async throws -> InvestmentTransaction {
        guard let assetId = request.assetId, !assetId.isEmpty else { throw APIError.server(status: 400, code: "asset_required", message: "Selecciona un activo.") }
        let quantity = NSDecimalNumber(decimal: request.quantity?.decimalValue ?? 1).doubleValue
        let amount = NSDecimalNumber(decimal: request.amount.decimalValue).doubleValue
        let commission = NSDecimalNumber(decimal: request.commission.decimalValue).doubleValue
        let operation: String
        switch request.kind {
        case .buy: operation = "Compra"
        case .sell: operation = "Venta"
        case .dividend: operation = "Dividendo"
        case .withdrawal: operation = "Retirada"
        default: throw APIError.server(status: 400, code: "unsupported_kind", message: "Este tipo de operación todavía no está disponible en el alta rápida.")
        }
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        let wire = CreateTransactionWire(
            assetId: assetId,
            operation: operation,
            quantity: quantity,
            unitPrice: quantity == 0 ? 0 : amount / quantity,
            commission: commission,
            sourceWithholding: 0,
            destinationWithholding: 0,
            status: request.kind == .pending ? "Pendiente" : "Completada",
            date: formatter.string(from: request.occurredAt),
            notes: request.notes,
            cashImpact: request.updatesCash && (request.kind == .buy || request.kind == .sell)
                ? CreateTransactionWire.CashImpact(
                    operation: request.kind == .buy ? "Compra" : "Venta",
                    amount: amount + (request.kind == .buy ? commission : -commission)
                )
                : nil
        )
        let created: TransactionPageWire.Item = try await api.send("api/mobile/v1/transactions", method: .post, body: wire, idempotencyKey: request.idempotencyKey)
        await MainActor.run { NotificationCenter.default.post(name: .siloxPortfolioChanged, object: nil) }
        return TransactionPageWire(items: [created], page: 1, pageSize: 1, total: 1).domain().items[0]
    }
    func delete(id: String) async throws {
        try await api.delete("api/mobile/v1/transactions/\(id)", idempotencyKey: UUID().uuidString)
        await MainActor.run { NotificationCenter.default.post(name: .siloxPortfolioChanged, object: nil) }
    }
}

final class AssetRepository: @unchecked Sendable {
    private let api: APIClient
    init(api: APIClient) { self.api = api }

    func list() async throws -> [Asset] {
        let wire: [AssetWire] = try await api.get("api/mobile/v1/assets")
        return wire.map { $0.domain() }
    }

    func create(ticker: String, name: String?, type: String, currency: String) async throws -> Asset {
        let wire: AssetWire = try await api.send(
            "api/mobile/v1/assets",
            method: .post,
            body: CreateAssetWire(
                ticker: ticker.uppercased(),
                name: name?.isEmpty == true ? nil : name,
                type: type,
                strategy: "Satellite",
                currency: currency
            )
        )
        return wire.domain()
    }
}

final class InsightsRepository: @unchecked Sendable {
    private let api: APIClient
    init(api: APIClient) { self.api = api }

    func history() async throws -> [PortfolioHistoryPoint] {
        try await api.get("api/mobile/v1/portfolio/history")
    }

    func alerts() async throws -> [PriceAlert] {
        try await api.get("api/mobile/v1/alerts")
    }
}

final class SettingsRepository: @unchecked Sendable {
    private let api: APIClient
    init(api: APIClient) { self.api = api }

    func get() async throws -> NotificationPreferences {
        try await api.get("api/mobile/v1/settings")
    }

    func update(_ preferences: UpdateNotificationPreferences) async throws -> NotificationPreferences {
        try await api.send("api/mobile/v1/settings", method: .patch, body: preferences)
    }
}
