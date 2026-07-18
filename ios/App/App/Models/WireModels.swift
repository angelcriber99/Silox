import Foundation

struct PortfolioWire: Decodable, Sendable {
    struct Totals: Decodable, Sendable {
        let value: String?
        let cost: String?
        let profitLoss: String?
        let profitLossPercent: Double
        let dailyProfitLoss: String?
        let dailyProfitLossPercent: Double?
        let sessionProfitLoss: String?
        let sessionProfitLossPercent: Double?
    }
    struct WirePosition: Decodable, Sendable {
        struct PurchaseLot: Decodable, Sendable {
            let transactionId: String
            let date: String
            let operation: String
            let originalQuantity: String?
            let remainingQuantity: String?
            let purchasePrice: String?
            let commission: String?
            let performanceUnitCost: String?
            let investedUnitCost: String?
        }
        let assetId: String?
        let ticker: String
        let name: String?
        let type: String
        let currency: String
        let units: String?
        let totalCost: String?
        let investedCash: String?
        let currentValue: String?
        let profitLoss: String?
        let profitLossPercent: Double?
        let dailyChange: String?
        let dailyChangePercent: Double?
        let sessionChangePercent: Double?
        let currentPrice: String?
        let priceUpdatedAt: Date?
        let isPriceStale: Bool?
        let openPurchaseLots: [PurchaseLot]?
    }
    let asOf: Date
    let displayCurrency: String
    let marketState: String
    let totals: Totals
    let positions: [WirePosition]

    func domain() -> PortfolioResponse {
        let currency = displayCurrency
        return PortfolioResponse(
            totals: PortfolioTotals(
                totalValue: MoneyValue(amount: totals.value ?? "0", currency: currency),
                totalCost: MoneyValue(amount: totals.cost ?? "0", currency: currency),
                totalGain: MoneyValue(amount: totals.profitLoss ?? "0", currency: currency),
                totalGainPercent: totals.profitLossPercent,
                dailyGain: totals.dailyProfitLoss.map { MoneyValue(amount: $0, currency: currency) },
                dailyGainPercent: totals.dailyProfitLossPercent,
                sessionGain: totals.sessionProfitLoss.map { MoneyValue(amount: $0, currency: currency) },
                sessionGainPercent: totals.sessionProfitLossPercent
            ),
            positions: positions.map { item in
                let asset = Asset(
                    id: item.assetId ?? item.ticker,
                    ticker: item.ticker,
                    name: item.name ?? item.ticker,
                    kind: Asset.Kind(serverValue: item.type),
                    currency: item.currency
                )
                return Position(
                    id: item.assetId ?? item.ticker,
                    asset: asset,
                    quantity: item.units ?? "0",
                    currentValue: MoneyValue(amount: item.currentValue ?? "0", currency: currency),
                    openCost: MoneyValue(amount: item.totalCost ?? "0", currency: currency),
                    investedCash: MoneyValue(amount: item.investedCash ?? item.totalCost ?? "0", currency: currency),
                    gain: MoneyValue(amount: item.profitLoss ?? "0", currency: currency),
                    gainPercent: item.profitLossPercent ?? 0,
                    dailyChange: item.dailyChange.map { MoneyValue(amount: $0, currency: currency) },
                    dailyChangePercent: item.dailyChangePercent,
                    sessionChangePercent: item.sessionChangePercent,
                    currentPrice: item.currentPrice.map { MoneyValue(amount: $0, currency: item.currency) },
                    priceUpdatedAt: item.priceUpdatedAt,
                    isPriceStale: item.isPriceStale ?? true,
                    openPurchaseLots: (item.openPurchaseLots ?? []).map { lot in
                        OpenPurchaseLot(
                            id: lot.transactionId,
                            date: Self.dayFormatter.date(from: lot.date) ?? .distantPast,
                            operation: lot.operation,
                            originalQuantity: lot.originalQuantity ?? "0",
                            remainingQuantity: lot.remainingQuantity ?? "0",
                            purchasePrice: MoneyValue(amount: lot.purchasePrice ?? "0", currency: item.currency),
                            commission: MoneyValue(amount: lot.commission ?? "0", currency: item.currency),
                            performanceUnitCost: MoneyValue(amount: lot.performanceUnitCost ?? "0", currency: item.currency),
                            investedUnitCost: MoneyValue(amount: lot.investedUnitCost ?? "0", currency: item.currency)
                        )
                    }
                )
            },
            updatedAt: asOf,
            marketState: MarketState(
                isOpen: ["PRE", "REGULAR", "POST", "OPEN", "REGULAR_OPEN"].contains { marketState.uppercased().contains($0) },
                label: Self.marketLabel(for: marketState),
                code: marketState
            )
        )
    }

    private static func marketLabel(for state: String) -> String {
        let value = state.uppercased()
        if value.contains("PRE") { return "Premercado" }
        if value.contains("POST") { return "Postmercado" }
        if value.contains("REGULAR") || value.contains("OPEN") { return "Mercado regular" }
        return "Mercado cerrado"
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

struct TransactionPageWire: Decodable, Sendable {
    struct Item: Decodable, Sendable {
        struct AssetInfo: Decodable, Sendable { let ticker: String; let name: String?; let type: String; let currency: String }
        let id: String
        let assetId: String
        let operation: String
        let quantity: String?
        let unitPrice: String?
        let commission: String?
        let sourceWithholding: String?
        let destinationWithholding: String?
        let status: String
        let date: String
        let notes: String?
        let asset: AssetInfo?
    }
    let items: [Item]
    let page: Int
    let pageSize: Int
    let total: Int

    func domain() -> TransactionPage {
        let next = page * pageSize < total ? String(page + 1) : nil
        return TransactionPage(items: items.map { item in
            let currency = item.asset?.currency ?? "EUR"
            let quantity = item.quantity?.decimalValue ?? .zero
            let unitPrice = item.unitPrice?.decimalValue ?? .zero
            let commission = item.commission?.decimalValue ?? .zero
            let sourceWithholding = item.sourceWithholding?.decimalValue ?? .zero
            let destinationWithholding = item.destinationWithholding?.decimalValue ?? .zero
            let gross = quantity * unitPrice
            let deductions = commission + sourceWithholding + destinationWithholding
            let amount = NSDecimalNumber(decimal: gross).stringValue
            let netAmount = NSDecimalNumber(decimal: max(0, gross - deductions)).stringValue
            let asset = item.asset.map {
                Asset(id: item.assetId, ticker: $0.ticker, name: $0.name ?? $0.ticker, kind: Asset.Kind(serverValue: $0.type), currency: $0.currency)
            }
            return InvestmentTransaction(
                id: item.id,
                kind: InvestmentTransaction.Kind(serverValue: item.operation, status: item.status),
                asset: asset,
                quantity: item.quantity,
                amount: MoneyValue(amount: amount, currency: currency),
                netAmount: MoneyValue(amount: netAmount, currency: currency),
                commission: MoneyValue(amount: NSDecimalNumber(decimal: commission).stringValue, currency: currency),
                sourceWithholding: MoneyValue(amount: NSDecimalNumber(decimal: sourceWithholding).stringValue, currency: currency),
                destinationWithholding: MoneyValue(amount: NSDecimalNumber(decimal: destinationWithholding).stringValue, currency: currency),
                occurredAt: Self.dayFormatter.date(from: item.date) ?? .distantPast,
                notes: item.notes,
                version: nil
            )
        }, nextCursor: next)
    }

    private static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .iso8601)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

struct PortfolioRadarWire: Decodable, Sendable {
    struct RadarAssetWire: Decodable, Sendable {
        let id: String
        let ticker: String
        let name: String
        let type: String
        let currency: String

        func domain() -> Asset {
            Asset(id: id, ticker: ticker, name: name, kind: Asset.Kind(serverValue: type), currency: currency)
        }
    }

    struct RadarEventWire: Decodable, Sendable {
        let id: String
        let assetId: String?
        let ticker: String
        let date: Date
        let endDate: Date?
        let datePrecision: String
        let type: String
        let title: String
        let description: String?
        let certainty: String
        let impact: String
        let sourceName: String?
        let sourceUrl: URL?
        let sourcePublishedAt: Date?

        func domain() -> MarketEvent {
            MarketEvent(
                id: id,
                title: title,
                startsAt: date,
                kind: type,
                ticker: ticker,
                assetId: assetId,
                endsAt: endDate,
                datePrecision: datePrecision,
                description: description,
                certainty: certainty,
                impact: impact,
                sourceName: sourceName,
                sourceURL: sourceUrl,
                sourcePublishedAt: sourcePublishedAt
            )
        }
    }

    let assets: [RadarAssetWire]
    let events: [RadarEventWire]
    let news: [NewsItemWire]
    let updatedAt: Date

    func domain() -> RadarResponse {
        RadarResponse(
            assets: assets.map { $0.domain() },
            news: news.map { $0.domain() },
            events: events.map { $0.domain() },
            updatedAt: updatedAt
        )
    }
}

struct NewsItemWire: Decodable, Sendable {
    let id: String
    let title: String
    let source: String
    let publishedAt: Date
    let url: URL
    let ticker: String?

    func domain() -> NewsItem {
        NewsItem(
            id: id,
            title: title,
            source: source,
            publishedAt: publishedAt,
            url: url,
            ticker: ticker
        )
    }
}

struct AssetWire: Codable, Sendable {
    let id: String
    let ticker: String
    let name: String?
    let type: String
    let strategy: String
    let currency: String

    func domain() -> Asset {
        Asset(id: id, ticker: ticker, name: name ?? ticker, kind: Asset.Kind(serverValue: type), currency: currency)
    }
}

struct CreateAssetWire: Encodable, Sendable {
    let ticker: String
    let name: String?
    let type: String
    let strategy: String
    let currency: String
}

extension Asset.Kind {
    init(serverValue: String) {
        let value = serverValue.folding(options: .diacriticInsensitive, locale: .current).lowercased()
        if value.contains("cripto") { self = .crypto }
        else if value.contains("etf") { self = .etf }
        else if value.contains("fondo") { self = .fund }
        else if value.contains("metal") { self = .metal }
        else if value.contains("liquidez") || value.contains("monetario") { self = .cash }
        else if value.contains("accion") { self = .stock }
        else { self = .other }
    }
}

extension InvestmentTransaction.Kind {
    init(serverValue: String, status: String) {
        if status == "Pendiente" { self = .pending; return }
        switch serverValue {
        case "Compra": self = .buy
        case "Venta": self = .sell
        case "Dividendo": self = .dividend
        case "Retirada": self = .withdrawal
        case "Traspaso Salida", "Traspaso Entrada": self = .transfer
        default: self = .deposit
        }
    }
}

struct CreateTransactionWire: Encodable, Sendable {
    struct CashImpact: Encodable, Sendable {
        let operation: String
        let amount: Double
    }
    let assetId: String
    let operation: String
    let quantity: Double
    let unitPrice: Double
    let commission: Double
    let sourceWithholding: Double
    let destinationWithholding: Double
    let status: String
    let date: String
    let notes: String?
    let cashImpact: CashImpact?
}
