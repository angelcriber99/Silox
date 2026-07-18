import XCTest
@testable import Silox

final class ModelDecodingTests: XCTestCase {
    func testPortfolioDecodesStringMoneyAndISODate() throws {
        let data = Data(#"{"totals":{"totalValue":{"amount":"12540.20","currency":"EUR"},"totalCost":{"amount":"10000","currency":"EUR"},"totalGain":{"amount":"2540.20","currency":"EUR"},"totalGainPercent":25.402,"dailyGain":null,"dailyGainPercent":null,"sessionGain":null,"sessionGainPercent":null},"positions":[],"updatedAt":"2026-07-17T12:00:00Z","marketState":{"isOpen":true,"label":"Mercado abierto","code":null}}"#.utf8)
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

    func testSpanishDecimalInputIsNormalized() {
        XCTAssertEqual("1 234,56".normalizedDecimal, Decimal(string: "1234.56"))
        XCTAssertNil("12,3,4".normalizedDecimal)
    }

    func testLongIdentifierUsesRecognizableAssetLabel() {
        let asset = Asset(
            id: "msci",
            ticker: "IE00BYX5P602",
            name: "MSCI World Index Fund P-Acc-EUR",
            kind: .fund,
            currency: "EUR"
        )
        XCTAssertEqual(asset.shortLabel, "MSCI")
        XCTAssertEqual(asset.displayName, "MSCI World")
        XCTAssertEqual(asset.metadataLabel, "MSCI")
    }

    func testAssetLogoRequestNormalizesMarketAndCryptoTickers() throws {
        let baseURL = try XCTUnwrap(URL(string: "https://silox.example"))
        let crypto = Asset(id: "btc", ticker: "BTC-USD", name: "Bitcoin", kind: .crypto, currency: "EUR")
        let exchangeStock = Asset(id: "aapl", ticker: "AAPL.US", name: "Apple", kind: .stock, currency: "USD")
        let shareClass = Asset(id: "brkb", ticker: "BRK.B", name: "Berkshire Hathaway", kind: .stock, currency: "USD")

        XCTAssertEqual(AssetLogoRequest.identifier(for: crypto), "BTC")
        XCTAssertEqual(AssetLogoRequest.identifier(for: exchangeStock), "AAPL")
        XCTAssertEqual(AssetLogoRequest.identifier(for: shareClass), "BRK-B")
        XCTAssertEqual(AssetLogoRequest.url(for: crypto, baseURL: baseURL)?.absoluteString, "https://silox.example/api/logo?ticker=BTC&kind=crypto")
    }

    func testPortfolioRadarDecodesEventWindowsAndSources() throws {
        let data = Data(#"""
        {
          "assets":[{"id":"asts-id","ticker":"ASTS","name":"AST SpaceMobile","type":"Acción","currency":"USD"}],
          "events":[{
            "id":"launch-1","assetId":"asts-id","ticker":"ASTS",
            "date":"2026-08-01T12:00:00Z","endDate":"2026-08-15T12:00:00Z",
            "datePrecision":"range","type":"CATALYST","title":"Lanzamiento o misión relevante",
            "description":"BlueBird launch in the first half of August","certainty":"scheduled","impact":"high",
            "sourceName":"Business Wire","sourceUrl":"https://example.com/asts","sourcePublishedAt":"2026-06-25T10:00:00Z"
          }],
          "news":[],"updatedAt":"2026-07-18T12:00:00Z"
        }
        """#.utf8)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let radar = try decoder.decode(PortfolioRadarWire.self, from: data).domain()

        XCTAssertEqual(radar.assets?.first?.ticker, "ASTS")
        XCTAssertEqual(radar.events.first?.certainty, "scheduled")
        XCTAssertEqual(radar.events.first?.impact, "high")
        XCTAssertEqual(radar.events.first?.endsAt?.ISO8601Format(), "2026-08-15T12:00:00Z")
        XCTAssertEqual(radar.events.first?.sourceURL?.host, "example.com")
    }

    func testTransactionDecimalsDecodeCurrentStringsAndLegacyNumbers() throws {
        let data = Data(#"{"items":[{"id":"tx","assetId":"asset","operation":"Compra","quantity":0.00000001,"unitPrice":"12345.67890123456789","amount":"0.0001234567890123456789","netAmount":0.00012,"commission":0.01,"sourceWithholding":"0","destinationWithholding":0,"status":"Completada","date":"2026-07-18","notes":null,"asset":{"ticker":"BTC","name":"Bitcoin","type":"Criptomoneda","currency":"EUR"},"version":3}],"limit":50,"nextCursor":"opaque-cursor"}"#.utf8)
        let page = try JSONDecoder().decode(TransactionPageWire.self, from: data).domain()

        XCTAssertEqual(page.nextCursor, "opaque-cursor")
        XCTAssertEqual(page.items.first?.quantity, "0.00000001")
        XCTAssertEqual(page.items.first?.amount.amount, "0.0001234567890123456789")
        XCTAssertEqual(page.items.first?.netAmount?.amount, "0.00012")
        XCTAssertEqual(page.items.first?.commission?.amount, "0.01")
        XCTAssertEqual(page.items.first?.version, 3)
    }

    func testTransactionQueryUsesCursorContractAndFilters() {
        let query = TransactionQuery(
            cursor: "opaque",
            limit: 25,
            search: "Apple",
            year: 2026,
            kind: .dividend,
            assetId: "asset-id"
        )
        let values = Dictionary(uniqueKeysWithValues: query.queryItems.compactMap { item in
            item.value.map { (item.name, $0) }
        })

        XCTAssertEqual(values["cursor"], "opaque")
        XCTAssertEqual(values["limit"], "25")
        XCTAssertEqual(values["query"], "Apple")
        XCTAssertEqual(values["year"], "2026")
        XCTAssertEqual(values["operation"], "Dividendo")
        XCTAssertNil(values["page"])
        XCTAssertNil(values["pageSize"])
    }

    func testTransactionAndAlertWritesEncodeDecimalsAsStrings() throws {
        let transaction = CreateTransactionWire(
            assetId: "asset",
            operation: "Compra",
            quantity: "0.00000001",
            unitPrice: "12345.67890123456789",
            commission: "0.000000001",
            sourceWithholding: "0",
            destinationWithholding: "0",
            updateCash: true,
            status: "Completada",
            date: "2026-07-18",
            notes: nil
        )
        let transactionJSON = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(transaction)) as? [String: Any])
        XCTAssertEqual(transactionJSON["quantity"] as? String, "0.00000001")
        XCTAssertEqual(transactionJSON["unitPrice"] as? String, "12345.67890123456789")
        XCTAssertEqual(transactionJSON["updateCash"] as? Bool, true)
        XCTAssertNil(transactionJSON["cashImpact"])

        let alert = CreatePriceAlertWire(ticker: "BTC", targetPrice: "98765.43210987654321", condition: "above")
        let alertJSON = try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(alert)) as? [String: Any])
        XCTAssertEqual(alertJSON["targetPrice"] as? String, "98765.43210987654321")
    }

    func testPriceAlertDecodesLegacyNumericTarget() throws {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let wire = try decoder.decode(
            PriceAlertWire.self,
            from: Data(#"{"id":"alert","ticker":"BTC","targetPrice":95000.25,"condition":"above","triggered":false,"createdAt":"2026-07-18T12:00:00Z"}"#.utf8)
        )
        XCTAssertEqual(wire.domain().targetPrice, "95000.25")
    }
}
