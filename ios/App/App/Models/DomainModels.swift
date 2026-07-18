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
    let gain: MoneyValue
    let gainPercent: Double
    let dailyChange: MoneyValue?
    let dailyChangePercent: Double?
    let sessionChangePercent: Double?
    let currentPrice: MoneyValue?
    let priceUpdatedAt: Date?
    let isPriceStale: Bool
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
