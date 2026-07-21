import XCTest
@testable import Silox

final class PortfolioSharingTests: XCTestCase {
    func testShareSnapshotUsesLargestDailyMovementsAndExcludesCash() {
        let portfolio = fixturePortfolio(positions: [
            position(id: "apple", ticker: "AAPL", name: "Apple", daily: "8", percent: 1.2),
            position(id: "bitcoin", ticker: "BTC", name: "Bitcoin", daily: "-20", percent: -2.1),
            position(id: "nvidia", ticker: "NVDA", name: "NVIDIA", daily: "14", percent: 1.6),
            position(id: "cash", ticker: nil, name: "Euro", daily: "100", percent: 0, kind: .cash)
        ])

        let snapshot = PortfolioShareSnapshot(portfolio: portfolio, balancesHidden: false)

        XCTAssertEqual(snapshot.movements.map(\.id), ["bitcoin", "nvidia", "apple"])
        XCTAssertEqual(snapshot.totalValueLabel, SiloxFormatters.money("12000", currency: "EUR"))
        XCTAssertEqual(snapshot.dailyGainLabel, SiloxFormatters.signedMoney("250", currency: "EUR"))
    }

    func testShareSnapshotRespectsBalancePrivacy() {
        let snapshot = PortfolioShareSnapshot(
            portfolio: fixturePortfolio(positions: [position(id: "apple", ticker: "AAPL", name: "Apple", daily: "8", percent: 1.2)]),
            balancesHidden: true
        )

        XCTAssertEqual(snapshot.totalValueLabel, "••••••")
        XCTAssertEqual(snapshot.dailyGainLabel, "••••")
    }

    func testPositionRankingHasAStableTieBreaker() {
        let positions = [
            position(id: "zulu", ticker: "ZZZ", name: "Zulu", daily: "10", percent: 1),
            position(id: "alpha", ticker: "AAA", name: "Alpha", daily: "10", percent: -1),
            position(id: "cash", ticker: nil, name: "Euro", daily: "30", percent: 0, kind: .cash)
        ]

        XCTAssertEqual(
            PortfolioPositionPresentation.visiblePositions(positions, search: "", sort: .day).map(\.id),
            ["alpha", "zulu"]
        )
    }

    @MainActor
    func testShareCardRendersAHighResolutionImage() {
        let snapshot = PortfolioShareSnapshot(
            portfolio: fixturePortfolio(positions: [position(id: "apple", ticker: "AAPL", name: "Apple", daily: "8", percent: 1.2)]),
            balancesHidden: false
        )

        let image = PortfolioShareImageRenderer.image(for: snapshot, colorScheme: .light)

        XCTAssertNotNil(image)
        XCTAssertGreaterThan(image?.size.width ?? 0, 1_000)
        XCTAssertGreaterThan(image?.size.height ?? 0, 500)
    }

    private func fixturePortfolio(positions: [Position]) -> PortfolioResponse {
        PortfolioResponse(
            totals: PortfolioTotals(
                totalValue: MoneyValue(amount: "12000", currency: "EUR"),
                totalCost: MoneyValue(amount: "10000", currency: "EUR"),
                totalGain: MoneyValue(amount: "2000", currency: "EUR"),
                totalGainPercent: 20,
                dailyGain: MoneyValue(amount: "250", currency: "EUR"),
                dailyGainPercent: 2.1,
                sessionGain: nil,
                sessionGainPercent: nil
            ),
            positions: positions,
            updatedAt: Date(timeIntervalSince1970: 1_752_941_600),
            marketState: nil
        )
    }

    private func position(
        id: String,
        ticker: String?,
        name: String,
        daily: String,
        percent: Double,
        kind: Asset.Kind = .stock
    ) -> Position {
        Position(
            id: id,
            asset: Asset(id: id, ticker: ticker, name: name, kind: kind, currency: "EUR"),
            quantity: "1",
            currentValue: MoneyValue(amount: "1000", currency: "EUR"),
            openCost: MoneyValue(amount: "900", currency: "EUR"),
            investedCash: MoneyValue(amount: "900", currency: "EUR"),
            gain: MoneyValue(amount: "100", currency: "EUR"),
            gainPercent: 11.1,
            dailyChange: MoneyValue(amount: daily, currency: "EUR"),
            dailyChangePercent: percent,
            sessionChangePercent: percent,
            currentPrice: MoneyValue(amount: "1000", currency: "EUR"),
            priceUpdatedAt: nil,
            isPriceStale: false,
            openPurchaseLots: []
        )
    }
}
