import Foundation

extension Notification.Name {
    static let siloxPortfolioChanged = Notification.Name("silox.portfolio.changed")
}

enum CacheLifetime {
    static let portfolio: TimeInterval = 15
    static let transactions: TimeInterval = 60
    static let radar: TimeInterval = 5 * 60
    static let assets: TimeInterval = 10 * 60
    static let history: TimeInterval = 5 * 60
    static let alerts: TimeInterval = 2 * 60
    static let settings: TimeInterval = 15 * 60
}

actor PortfolioRepository {
    private let api: APIClient
    private let cache: ReadCache
    private let cacheKey = "portfolio-v1"
    private var refreshTask: (id: UUID, task: Task<PortfolioResponse, Error>)?

    init(api: APIClient, cache: ReadCache) { self.api = api; self.cache = cache }

    func cached() async -> ReadCache.Cached<PortfolioResponse>? { await cache.load(PortfolioResponse.self, key: cacheKey) }

    func value(maxAge: TimeInterval = CacheLifetime.portfolio) async throws -> PortfolioResponse {
        if let cached = await cached(), cached.isFresh(for: maxAge) { return cached.value }
        return try await refresh()
    }

    func refresh() async throws -> PortfolioResponse {
        if let refreshTask { return try await refreshTask.task.value }

        let id = UUID()
        let task = Task { [api, cache, cacheKey] in
            let wire: PortfolioWire = try await api.get("api/mobile/v1/portfolio")
            try Task.checkCancellation()
            let response = wire.domain()
            await cache.save(response, key: cacheKey)
            return response
        }
        refreshTask = (id, task)

        do {
            let response = try await task.value
            if refreshTask?.id == id { refreshTask = nil }
            return response
        } catch {
            if refreshTask?.id == id { refreshTask = nil }
            throw error
        }
    }

    func recommendedRefreshInterval(userPreference: TimeInterval) async -> TimeInterval {
        let serverInterval = await api.recommendedRefreshInterval(
            for: "/api/mobile/v1/portfolio",
            fallback: userPreference
        )
        return max(userPreference, serverInterval)
    }
}

final class RadarRepository: Sendable {
    private let api: APIClient
    private let cache: ReadCache
    private let cacheKey = "radar-v2"
    private let refreshFlight = SingleFlight<RadarResponse>()

    init(api: APIClient, cache: ReadCache) { self.api = api; self.cache = cache }
    func cached() async -> ReadCache.Cached<RadarResponse>? { await cache.load(RadarResponse.self, key: cacheKey) }
    func value(maxAge: TimeInterval = CacheLifetime.radar) async throws -> RadarResponse {
        if let cached = await cached(), cached.isFresh(for: maxAge) { return cached.value }
        return try await refresh()
    }
    func refresh() async throws -> RadarResponse {
        try await refreshFlight.run { [api, cache, cacheKey] in
            let wire: PortfolioRadarWire = try await api.get("api/mobile/v1/radar")
            let response = wire.domain()
            await cache.save(response, key: cacheKey)
            return response
        }
    }
}

final class TransactionRepository: Sendable {
    private let api: APIClient
    private let cache: ReadCache
    private let cacheKey = "transactions-v1"
    private let defaultPageFlight = SingleFlight<TransactionPage>()

    init(api: APIClient, cache: ReadCache) { self.api = api; self.cache = cache }
    func cached() async -> ReadCache.Cached<TransactionPage>? { await cache.load(TransactionPage.self, key: cacheKey) }
    func value(maxAge: TimeInterval = CacheLifetime.transactions) async throws -> TransactionPage {
        if let cached = await cached(), cached.isFresh(for: maxAge) { return cached.value }
        return try await list(query: TransactionQuery())
    }

    func list(query: TransactionQuery = TransactionQuery()) async throws -> TransactionPage {
        let load: @Sendable () async throws -> TransactionPage = { [api] in
            let wire: TransactionPageWire = try await api.get("api/mobile/v1/transactions", query: query.queryItems)
            return wire.domain()
        }
        guard query == TransactionQuery() else { return try await load() }
        return try await defaultPageFlight.run { [cache, cacheKey] in
            let response = try await load()
            await cache.save(response, key: cacheKey)
            return response
        }
    }

    func list(cursor: String?) async throws -> TransactionPage {
        try await list(query: TransactionQuery(cursor: cursor))
    }

    func listAll() async throws -> TransactionPage {
        var items: [InvestmentTransaction] = []
        var query = TransactionQuery()
        repeat {
            let page = try await list(query: query)
            items.append(contentsOf: page.items)
            query.cursor = page.nextCursor
        } while query.cursor != nil && items.count < 10_000

        let response = TransactionPage(items: items, nextCursor: nil)
        await cache.save(response, key: cacheKey)
        return response
    }
    func create(_ request: CreateTransactionRequest) async throws -> InvestmentTransaction {
        guard let assetId = request.assetId, !assetId.isEmpty else { throw APIError.server(status: 400, code: "asset_required", message: "Selecciona un activo.") }
        let quantity = try canonicalDecimal(request.quantity ?? "1", field: "cantidad", allowsZero: request.kind == .dividend)
        let amount = try canonicalDecimal(request.amount, field: "importe", allowsZero: false)
        let commission = try canonicalDecimal(request.commission, field: "comisión")
        let sourceWithholding = try canonicalDecimal(request.sourceWithholding, field: "retención de origen")
        let destinationWithholding = try canonicalDecimal(request.destinationWithholding, field: "retención de destino")
        let unitPrice: String
        if request.kind == .dividend {
            unitPrice = amount
        } else {
            guard let quantityValue = quantity.normalizedDecimal, quantityValue > 0,
                  let amountValue = amount.normalizedDecimal else {
                throw APIError.server(status: 400, code: "invalid_quantity", message: "La cantidad debe ser mayor que cero.")
            }
            unitPrice = NSDecimalNumber(decimal: amountValue / quantityValue).stringValue
        }
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
            unitPrice: unitPrice,
            commission: commission,
            sourceWithholding: sourceWithholding,
            destinationWithholding: destinationWithholding,
            updateCash: request.updatesCash,
            status: request.kind == .pending ? "Pendiente" : "Completada",
            date: formatter.string(from: request.occurredAt),
            notes: request.notes
        )
        let created: TransactionPageWire.Item = try await api.send("api/mobile/v1/transactions", method: .post, body: wire, idempotencyKey: request.idempotencyKey)
        await cache.remove(cacheKey)
        await MainActor.run { NotificationCenter.default.post(name: .siloxPortfolioChanged, object: nil) }
        return TransactionPageWire(items: [created], page: 1, pageSize: 1, total: 1).domain().items[0]
    }

    private func canonicalDecimal(_ raw: String, field: String, allowsZero: Bool = true) throws -> String {
        guard let value = raw.normalizedDecimal, value >= 0, allowsZero || value > 0 else {
            throw APIError.server(status: 400, code: "invalid_decimal", message: "El campo \(field) no contiene un decimal válido.")
        }
        return NSDecimalNumber(decimal: value).stringValue
    }
    func delete(id: String) async throws {
        try await api.delete("api/mobile/v1/transactions/\(id)", idempotencyKey: UUID().uuidString)
        await cache.remove(cacheKey)
        await MainActor.run { NotificationCenter.default.post(name: .siloxPortfolioChanged, object: nil) }
    }
}

final class AssetRepository: Sendable {
    private let api: APIClient
    private let cache: ReadCache
    private let cacheKey = "assets-v1"
    private let refreshFlight = SingleFlight<[Asset]>()

    init(api: APIClient, cache: ReadCache) { self.api = api; self.cache = cache }

    func cached() async -> ReadCache.Cached<[Asset]>? { await cache.load([Asset].self, key: cacheKey) }

    func list(maxAge: TimeInterval = CacheLifetime.assets) async throws -> [Asset] {
        if let cached = await cached(), cached.isFresh(for: maxAge) { return cached.value }
        return try await refreshFlight.run { [api, cache, cacheKey] in
            let wire: [AssetWire] = try await api.get("api/mobile/v1/assets")
            let response = wire.map { $0.domain() }
            await cache.save(response, key: cacheKey)
            return response
        }
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
        await cache.remove(cacheKey)
        return wire.domain()
    }
}

final class InsightsRepository: Sendable {
    private let api: APIClient
    private let cache: ReadCache
    private let historyKey = "portfolio-history-v1"
    private let alertsKey = "price-alerts-v1"
    private let historyFlight = SingleFlight<[PortfolioHistoryPoint]>()
    private let alertsFlight = SingleFlight<[PriceAlert]>()

    init(api: APIClient, cache: ReadCache) { self.api = api; self.cache = cache }

    func cachedHistory() async -> ReadCache.Cached<[PortfolioHistoryPoint]>? {
        await cache.load([PortfolioHistoryPoint].self, key: historyKey)
    }

    func cachedAlerts() async -> ReadCache.Cached<[PriceAlert]>? {
        await cache.load([PriceAlert].self, key: alertsKey)
    }

    func history(maxAge: TimeInterval = CacheLifetime.history) async throws -> [PortfolioHistoryPoint] {
        if let cached = await cachedHistory(), cached.isFresh(for: maxAge) { return cached.value }
        return try await historyFlight.run { [api, cache, historyKey] in
            let value: [PortfolioHistoryPoint] = try await api.get("api/mobile/v1/portfolio/history")
            await cache.save(value, key: historyKey)
            return value
        }
    }

    func alerts(maxAge: TimeInterval = CacheLifetime.alerts) async throws -> [PriceAlert] {
        if let cached = await cachedAlerts(), cached.isFresh(for: maxAge) { return cached.value }
        return try await alertsFlight.run { [api, cache, alertsKey] in
            let wire: [PriceAlertWire] = try await api.get("api/mobile/v1/alerts")
            let value = wire.map { $0.domain() }
            await cache.save(value, key: alertsKey)
            return value
        }
    }

    func createAlert(_ request: CreatePriceAlertRequest) async throws -> PriceAlert {
        let wire: PriceAlertWire = try await api.send(
            "api/mobile/v1/alerts",
            method: .post,
            body: CreatePriceAlertWire(
                ticker: request.ticker.trimmingCharacters(in: .whitespacesAndNewlines).uppercased(),
                targetPrice: try canonicalAlertPrice(request.targetPrice),
                condition: try validatedAlertCondition(request.condition)
            )
        )
        await cache.remove(alertsKey)
        return wire.domain()
    }

    func updateAlert(id: String, request: UpdatePriceAlertRequest) async throws -> PriceAlert {
        guard request.targetPrice != nil || request.condition != nil || request.triggered != nil else {
            throw APIError.server(status: 400, code: "empty_alert_update", message: "No hay cambios para la alerta.")
        }
        let wire: PriceAlertWire = try await api.send(
            "api/mobile/v1/alerts/\(id)",
            method: .patch,
            body: UpdatePriceAlertWire(
                targetPrice: try request.targetPrice.map(canonicalAlertPrice),
                condition: try request.condition.map(validatedAlertCondition),
                triggered: request.triggered
            )
        )
        await cache.remove(alertsKey)
        return wire.domain()
    }

    func deleteAlert(id: String) async throws {
        try await api.delete("api/mobile/v1/alerts/\(id)", idempotencyKey: UUID().uuidString)
        await cache.remove(alertsKey)
    }

    private func canonicalAlertPrice(_ raw: String) throws -> String {
        guard let value = raw.normalizedDecimal, value > 0 else {
            throw APIError.server(status: 400, code: "invalid_alert_price", message: "El precio objetivo no contiene un decimal válido.")
        }
        return NSDecimalNumber(decimal: value).stringValue
    }

    private func validatedAlertCondition(_ raw: String) throws -> String {
        let value = raw.lowercased()
        guard value == "above" || value == "below" else {
            throw APIError.server(status: 400, code: "invalid_alert_condition", message: "La condición de la alerta no es válida.")
        }
        return value
    }
}

final class SettingsRepository: Sendable {
    private let api: APIClient
    private let cache: ReadCache
    private let cacheKey = "notification-settings-v1"
    private let refreshFlight = SingleFlight<NotificationPreferences>()

    init(api: APIClient, cache: ReadCache) { self.api = api; self.cache = cache }

    func get(maxAge: TimeInterval = CacheLifetime.settings) async throws -> NotificationPreferences {
        if let cached = await cache.load(NotificationPreferences.self, key: cacheKey), cached.isFresh(for: maxAge) {
            return cached.value
        }
        return try await refreshFlight.run { [api, cache, cacheKey] in
            let value: NotificationPreferences = try await api.get("api/mobile/v1/settings")
            await cache.save(value, key: cacheKey)
            return value
        }
    }

    func update(_ preferences: UpdateNotificationPreferences) async throws -> NotificationPreferences {
        let value: NotificationPreferences = try await api.send("api/mobile/v1/settings", method: .patch, body: preferences)
        await cache.save(value, key: cacheKey)
        return value
    }
}

final class RevolutImportRepository: Sendable {
    private let api: APIClient

    init(api: APIClient) { self.api = api }

    func importStatement(fileData: Data, fileName: String, mimeType: String = "text/csv") async throws -> RevolutDirectImportResult {
        let wire: RevolutDirectImportWire = try await api.upload(
            "api/import/revolut",
            fileData: fileData,
            fileName: fileName,
            mimeType: mimeType,
            unwrapEnvelope: false
        )
        await MainActor.run { NotificationCenter.default.post(name: .siloxPortfolioChanged, object: nil) }
        return wire.domain()
    }

}
