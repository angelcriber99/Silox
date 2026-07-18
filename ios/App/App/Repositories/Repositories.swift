import Foundation

extension Notification.Name {
    static let siloxPortfolioChanged = Notification.Name("silox.portfolio.changed")
}

actor PortfolioRepository {
    private let api: APIClient
    private let cache: ReadCache
    private let cacheKey = "portfolio-v1"
    private var refreshTask: (id: UUID, task: Task<PortfolioResponse, Error>)?

    init(api: APIClient, cache: ReadCache) { self.api = api; self.cache = cache }

    func cached() async -> ReadCache.Cached<PortfolioResponse>? { await cache.load(PortfolioResponse.self, key: cacheKey) }

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
}

final class RadarRepository: Sendable {
    private let api: APIClient
    private let cache: ReadCache
    private let cacheKey = "radar-v2"

    init(api: APIClient, cache: ReadCache) { self.api = api; self.cache = cache }
    func cached() async -> ReadCache.Cached<RadarResponse>? { await cache.load(RadarResponse.self, key: cacheKey) }
    func refresh() async throws -> RadarResponse {
        let wire: PortfolioRadarWire = try await api.get("api/mobile/v1/radar")
        let response = wire.domain()
        await cache.save(response, key: cacheKey)
        return response
    }
}

final class TransactionRepository: Sendable {
    private let api: APIClient
    private let cache: ReadCache
    private let cacheKey = "transactions-v1"

    init(api: APIClient, cache: ReadCache) { self.api = api; self.cache = cache }
    func cached() async -> ReadCache.Cached<TransactionPage>? { await cache.load(TransactionPage.self, key: cacheKey) }
    func list(query: TransactionQuery = TransactionQuery()) async throws -> TransactionPage {
        let wire: TransactionPageWire = try await api.get("api/mobile/v1/transactions", query: query.queryItems)
        let response = wire.domain()
        if query == TransactionQuery() { await cache.save(response, key: cacheKey) }
        return response
    }

    func list(cursor: String? = nil) async throws -> TransactionPage {
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
        await MainActor.run { NotificationCenter.default.post(name: .siloxPortfolioChanged, object: nil) }
    }
}

final class AssetRepository: Sendable {
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

final class InsightsRepository: Sendable {
    private let api: APIClient
    init(api: APIClient) { self.api = api }

    func history() async throws -> [PortfolioHistoryPoint] {
        try await api.get("api/mobile/v1/portfolio/history")
    }

    func alerts() async throws -> [PriceAlert] {
        let wire: [PriceAlertWire] = try await api.get("api/mobile/v1/alerts")
        return wire.map { $0.domain() }
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
        return wire.domain()
    }

    func deleteAlert(id: String) async throws {
        try await api.delete("api/mobile/v1/alerts/\(id)", idempotencyKey: UUID().uuidString)
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
    init(api: APIClient) { self.api = api }

    func get() async throws -> NotificationPreferences {
        try await api.get("api/mobile/v1/settings")
    }

    func update(_ preferences: UpdateNotificationPreferences) async throws -> NotificationPreferences {
        try await api.send("api/mobile/v1/settings", method: .patch, body: preferences)
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
