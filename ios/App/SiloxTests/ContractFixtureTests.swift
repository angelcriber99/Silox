import XCTest
@testable import Silox

final class ContractFixtureTests: XCTestCase {
    private struct Envelope<Value: Decodable>: Decodable { let data: Value }
    private struct ContractFixture: Decodable {
        let portfolio: Envelope<PortfolioWire>
        let transactions: Envelope<TransactionPageWire>
        let news: Envelope<[NewsItemWire]>
        let widgetSummary: WidgetSummary
        let widgetCredential: WidgetCredentialResponse
    }
    private struct WidgetSummary: Decodable {
        struct Mover: Decodable { let ticker: String; let changePercent: Double? }
        let netSession: Double
        let totalValue: Double
        let volatileAssets: [Mover]
        let updatedAt: String
    }

    func testSwiftDecodesBackendContractFixture() throws {
        let source = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .appending(path: "../../../__tests__/fixtures/mobile-api-contract.json")
            .standardizedFileURL
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let fixture = try decoder.decode(ContractFixture.self, from: Data(contentsOf: source))

        let portfolio = fixture.portfolio.data.domain()
        XCTAssertEqual(portfolio.totals.totalValue.amount, "12540.20")
        XCTAssertEqual(portfolio.totals.sessionGainPercent, 0.42)
        XCTAssertEqual(portfolio.positions.first?.asset.ticker, "AAPL")
        XCTAssertEqual(portfolio.positions.first?.sessionChangePercent, 0.4)

        let transactions = fixture.transactions.data.domain()
        XCTAssertEqual(transactions.items.first?.kind, .buy)
        XCTAssertEqual(transactions.items.first?.amount.amount, "1000")

        XCTAssertEqual(fixture.news.data.first?.domain().source, "Reuters")
        XCTAssertEqual(fixture.widgetSummary.volatileAssets.first?.ticker, "AAPL")
        XCTAssertEqual(fixture.widgetCredential.token.hasPrefix("swx_widget_"), true)
    }
}
