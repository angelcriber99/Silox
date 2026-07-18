import Foundation

struct UserProfile: Codable, Sendable, Equatable, Identifiable {
    let id: String
    let email: String
    let displayName: String?
}

struct MoneyValue: Codable, Sendable, Equatable {
    let amount: String
    let currency: String
}

struct PortfolioResponse: Codable, Sendable, Equatable {
    let totals: PortfolioTotals
    let positions: [Position]
    let updatedAt: Date
    let marketState: MarketState?
}

struct PortfolioTotals: Codable, Sendable, Equatable {
    let totalValue: MoneyValue
    let totalCost: MoneyValue
    let totalGain: MoneyValue
    let totalGainPercent: Double
    let dailyGain: MoneyValue?
    let dailyGainPercent: Double?
    let sessionGain: MoneyValue?
    let sessionGainPercent: Double?
}

struct Position: Codable, Sendable, Equatable, Identifiable {
    let id: String
    let asset: Asset
    let quantity: String
    let currentValue: MoneyValue
    let openCost: MoneyValue
    let investedCash: MoneyValue
    let gain: MoneyValue
    let gainPercent: Double
    let dailyChange: MoneyValue?
    let dailyChangePercent: Double?
    let sessionChangePercent: Double?
    let currentPrice: MoneyValue?
    let priceUpdatedAt: Date?
    let isPriceStale: Bool
    let openPurchaseLots: [OpenPurchaseLot]
}

struct OpenPurchaseLot: Codable, Sendable, Equatable, Identifiable {
    let id: String
    let date: Date
    let operation: String
    let originalQuantity: String
    let remainingQuantity: String
    let purchasePrice: MoneyValue
    let commission: MoneyValue
    let performanceUnitCost: MoneyValue
    let investedUnitCost: MoneyValue

    var isReward: Bool { investedUnitCost.amount.decimalValue == 0 }
    var isPartial: Bool {
        let epsilon = Decimal(sign: .plus, exponent: -8, significand: 1)
        return remainingQuantity.decimalValue < originalQuantity.decimalValue - epsilon
    }
}

struct Asset: Codable, Sendable, Equatable, Identifiable {
    enum Kind: String, Codable, Sendable { case stock, etf, fund, crypto, metal, cash, other }
    let id: String
    let ticker: String?
    let name: String
    let kind: Kind
    let currency: String
}

struct MarketState: Codable, Sendable, Equatable {
    let isOpen: Bool
    let label: String
    let code: String?
}

struct TransactionPage: Codable, Sendable, Equatable {
    let items: [InvestmentTransaction]
    let nextCursor: String?
}

struct TransactionQuery: Sendable, Equatable {
    var cursor: String?
    var limit: Int
    var search: String?
    var year: Int?
    var kind: InvestmentTransaction.Kind?
    var assetId: String?
    var from: Date?
    var to: Date?

    init(
        cursor: String? = nil,
        limit: Int = 50,
        search: String? = nil,
        year: Int? = nil,
        kind: InvestmentTransaction.Kind? = nil,
        assetId: String? = nil,
        from: Date? = nil,
        to: Date? = nil
    ) {
        self.cursor = cursor
        self.limit = min(max(limit, 1), 100)
        self.search = search
        self.year = year
        self.kind = kind
        self.assetId = assetId
        self.from = from
        self.to = to
    }

    var queryItems: [URLQueryItem] {
        var items = [URLQueryItem(name: "limit", value: String(limit))]
        if let cursor, !cursor.isEmpty {
            items.append(URLQueryItem(name: "cursor", value: cursor))
        }
        if let search = search?.trimmingCharacters(in: .whitespacesAndNewlines), !search.isEmpty {
            items.append(URLQueryItem(name: "query", value: search))
        }
        if let year { items.append(URLQueryItem(name: "year", value: String(year))) }
        if let kind { items.append(URLQueryItem(name: "operation", value: kind.title)) }
        if let assetId, !assetId.isEmpty { items.append(URLQueryItem(name: "assetId", value: assetId)) }
        if let from { items.append(URLQueryItem(name: "from", value: Self.dayString(from))) }
        if let to { items.append(URLQueryItem(name: "to", value: Self.dayString(to))) }
        return items
    }

    private static func dayString(_ date: Date) -> String {
        var calendar = Calendar(identifier: .iso8601)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", components.year ?? 0, components.month ?? 0, components.day ?? 0)
    }
}

struct InvestmentTransaction: Codable, Sendable, Equatable, Identifiable {
    enum Kind: String, Codable, Sendable, CaseIterable {
        case buy, sell, dividend, deposit, withdrawal, transfer, pending

        var title: String {
            switch self {
            case .buy: "Compra"
            case .sell: "Venta"
            case .dividend: "Dividendo"
            case .deposit: "Ingreso"
            case .withdrawal: "Retirada"
            case .transfer: "Traspaso"
            case .pending: "Pendiente"
            }
        }
    }
    let id: String
    let kind: Kind
    let asset: Asset?
    let quantity: String?
    let amount: MoneyValue
    let netAmount: MoneyValue?
    let commission: MoneyValue?
    let sourceWithholding: MoneyValue?
    let destinationWithholding: MoneyValue?
    let occurredAt: Date
    let notes: String?
    let version: Int?
}

struct CreateTransactionRequest: Codable, Sendable {
    let kind: InvestmentTransaction.Kind
    let assetId: String?
    let quantity: String?
    let amount: String
    let commission: String
    let sourceWithholding: String
    let destinationWithholding: String
    let updatesCash: Bool
    let occurredAt: Date
    let notes: String?
    let idempotencyKey: String
}

struct PortfolioHistoryPoint: Codable, Sendable, Equatable, Identifiable {
    var id: String { date }
    let date: String
    let value: String?
    let invested: String?
    let updatedAt: Date?
}

struct PriceAlert: Codable, Sendable, Equatable, Identifiable {
    let id: String
    let ticker: String
    let targetPrice: String?
    let condition: String
    let triggered: Bool
    let createdAt: Date
}

struct CreatePriceAlertRequest: Codable, Sendable, Equatable {
    let ticker: String
    let targetPrice: String
    let condition: String
}

struct UpdatePriceAlertRequest: Codable, Sendable, Equatable {
    let targetPrice: String?
    let condition: String?
    let triggered: Bool?

    init(targetPrice: String? = nil, condition: String? = nil, triggered: Bool? = nil) {
        self.targetPrice = targetPrice
        self.condition = condition
        self.triggered = triggered
    }
}

struct RevolutDirectImportResult: Codable, Sendable, Equatable {
    let importedCount: Int
    let ignoredDuplicates: Int
    let updatedCount: Int
    let accountingMovements: Int
    let skippedCount: Int
}

struct RadarResponse: Codable, Sendable, Equatable {
    let assets: [Asset]?
    let news: [NewsItem]
    let events: [MarketEvent]
    let updatedAt: Date
}

struct NewsItem: Codable, Sendable, Equatable, Identifiable {
    let id: String
    let title: String
    let source: String
    let publishedAt: Date
    let url: URL
    let ticker: String?
}

struct MarketEvent: Codable, Sendable, Equatable, Identifiable {
    let id: String
    let title: String
    let startsAt: Date
    let kind: String
    let ticker: String?
    var assetId: String? = nil
    var endsAt: Date? = nil
    var datePrecision: String? = nil
    var description: String? = nil
    var certainty: String? = nil
    var impact: String? = nil
    var sourceName: String? = nil
    var sourceURL: URL? = nil
    var sourcePublishedAt: Date? = nil
}

struct WidgetCredentialResponse: Codable, Sendable {
    let token: String
    let expiresAt: Date?
}

struct NotificationPreferences: Codable, Sendable, Equatable {
    let pushNotifications: Bool
    let emailNotifications: Bool
    let priceAlerts: Bool
    let weeklyReport: Bool
    let dividendAlerts: Bool
    let updatedAt: Date?
}

struct UpdateNotificationPreferences: Encodable, Sendable {
    let pushNotifications: Bool
    let emailNotifications: Bool
    let priceAlerts: Bool
    let weeklyReport: Bool
    let dividendAlerts: Bool
}
