import XCTest
@testable import Silox

final class ModelDecodingTests: XCTestCase {
    func testPortfolioDecodesStringMoneyAndISODate() throws {
        let data = Data(#"{"totals":{"totalValue":{"amount":"12540.20","currency":"EUR"},"totalCost":{"amount":"10000","currency":"EUR"},"totalGain":{"amount":"2540.20","currency":"EUR"},"totalGainPercent":25.402,"dailyGain":null},"positions":[],"updatedAt":"2026-07-17T12:00:00Z","marketState":{"isOpen":true,"label":"Mercado abierto"}}"#.utf8)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let response = try decoder.decode(PortfolioResponse.self, from: data)
        XCTAssertEqual(response.totals.totalValue.amount, "12540.20")
        XCTAssertEqual(response.totals.totalGainPercent, 25.402)
        XCTAssertTrue(response.marketState?.isOpen == true)
    }

    func testTransactionKindTitlesAreComplete() {
        XCTAssertEqual(Set(InvestmentTransaction.Kind.allCases.map(\.title)).count, InvestmentTransaction.Kind.allCases.count)
    }
}
