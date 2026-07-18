import XCTest
@testable import Silox

private final class APIStubURLProtocol: URLProtocol, @unchecked Sendable {
    typealias Handler = @Sendable (URLRequest, Int) -> (Int, Data)
    private static let lock = NSLock()
    nonisolated(unsafe) private static var handler: Handler?
    nonisolated(unsafe) private static var requests = 0

    static func configure(_ handler: @escaping Handler) {
        lock.lock()
        self.handler = handler
        requests = 0
        lock.unlock()
    }

    static func count() -> Int {
        lock.lock()
        defer { lock.unlock() }
        return requests
    }

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        Self.lock.lock()
        Self.requests += 1
        let index = Self.requests
        let handler = Self.handler
        Self.lock.unlock()
        let result = handler?(request, index) ?? (500, Data())
        let response = HTTPURLResponse(
            url: request.url!,
            statusCode: result.0,
            httpVersion: "HTTP/1.1",
            headerFields: ["Content-Type": "application/json"]
        )!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: result.1)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}
}

private actor TokenCallRecorder {
    private(set) var forcedValues: [Bool] = []
    func token(forceRefresh: Bool) -> String {
        forcedValues.append(forceRefresh)
        return forceRefresh ? "fresh" : "expired"
    }
}

final class ContractFixtureTests: XCTestCase {
    private struct APIValue: Codable, Sendable, Equatable { let value: String }
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
        XCTAssertEqual(portfolio.positions.first?.investedCash.amount, "1000")
        XCTAssertEqual(portfolio.positions.first?.openPurchaseLots.first?.remainingQuantity, "10")

        let transactions = fixture.transactions.data.domain()
        XCTAssertEqual(transactions.items.first?.kind, .buy)
        XCTAssertEqual(transactions.items.first?.amount.amount, "1000")
        XCTAssertEqual(transactions.items.first?.netAmount?.amount, "1000")

        XCTAssertEqual(fixture.news.data.first?.domain().source, "Reuters")
        XCTAssertEqual(fixture.widgetSummary.volatileAssets.first?.ticker, "AAPL")
        XCTAssertEqual(fixture.widgetCredential.token.hasPrefix("swx_widget_"), true)
    }

    func testAPIClientRetriesSafe401OnceWithForcedTokenRefresh() async throws {
        APIStubURLProtocol.configure { _, index in
            index == 1
                ? (401, Data(#"{"error":{"code":"expired","message":"Expired"}}"#.utf8))
                : (200, Data(#"{"data":{"value":"ok"}}"#.utf8))
        }
        let recorder = TokenCallRecorder()
        let client = makeAPIClient { forceRefresh in
            await recorder.token(forceRefresh: forceRefresh)
        }

        let value: APIValue = try await client.get("api/mobile/v1/test")

        XCTAssertEqual(value, APIValue(value: "ok"))
        XCTAssertEqual(APIStubURLProtocol.count(), 2)
        let forcedValues = await recorder.forcedValues
        XCTAssertEqual(forcedValues, [false, true])
    }

    func testAPIClientDoesNotRetryUnsafePostWithoutIdempotencyKey() async throws {
        APIStubURLProtocol.configure { _, _ in
            (401, Data(#"{"error":{"code":"expired","message":"Expired"}}"#.utf8))
        }
        let client = makeAPIClient { _ in "token" }

        do {
            let _: APIValue = try await client.send(
                "api/mobile/v1/test",
                method: .post,
                body: APIValue(value: "write")
            )
            XCTFail("Expected unauthorized")
        } catch {
            XCTAssertEqual(error as? APIError, .unauthorized)
        }
        XCTAssertEqual(APIStubURLProtocol.count(), 1)
    }

    func testPortfolioRefreshCoalescesConcurrentCallersAndCachesResult() async throws {
        APIStubURLProtocol.configure { request, _ in
            XCTAssertEqual(request.url?.path, "/api/mobile/v1/portfolio")
            Thread.sleep(forTimeInterval: 0.05)
            return (200, Data(#"{"data":{"asOf":"2026-07-18T16:00:00Z","displayCurrency":"EUR","marketState":"REGULAR_OPEN","totals":{"value":"100","cost":"90","profitLoss":"10","profitLossPercent":11.11,"dailyProfitLoss":null,"dailyProfitLossPercent":null,"sessionProfitLoss":null,"sessionProfitLossPercent":null},"positions":[]}}"#.utf8))
        }
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let cache = ReadCache(directory: directory)
        let repository = PortfolioRepository(api: makeAPIClient { _ in "token" }, cache: cache)

        async let first = repository.refresh()
        async let second = repository.refresh()
        async let third = repository.refresh()
        let responses = try await [first, second, third]
        let cached = await repository.cached()

        XCTAssertEqual(Set(responses.map(\.totals.totalValue.amount)), ["100"])
        XCTAssertEqual(APIStubURLProtocol.count(), 1)
        XCTAssertEqual(cached?.value.totals.totalValue.amount, "100")
    }

    func testAlertRepositoryUsesCRUDPathsAndStringPrices() async throws {
        APIStubURLProtocol.configure { request, index in
            if index == 3 { return (204, Data()) }
            let expectedMethod = index == 1 ? "POST" : "PATCH"
            XCTAssertEqual(request.httpMethod, expectedMethod)
            let body = (try? JSONSerialization.jsonObject(with: request.httpBody ?? Data())) as? [String: Any]
            XCTAssertTrue(body?["targetPrice"] == nil || body?["targetPrice"] is String)
            return (200, Data(#"{"data":{"id":"alert-1","ticker":"BTC","targetPrice":"95000.123456789","condition":"above","triggered":false,"createdAt":"2026-07-18T12:00:00Z"}}"#.utf8))
        }
        let repository = InsightsRepository(api: makeAPIClient { _ in "token" })

        let created = try await repository.createAlert(CreatePriceAlertRequest(
            ticker: "btc",
            targetPrice: "95000,123456789",
            condition: "above"
        ))
        let updated = try await repository.updateAlert(
            id: created.id,
            request: UpdatePriceAlertRequest(targetPrice: "95001.5")
        )
        try await repository.deleteAlert(id: updated.id)

        XCTAssertEqual(created.targetPrice, "95000.123456789")
        XCTAssertEqual(APIStubURLProtocol.count(), 3)
    }

    func testRevolutRepositoryUsesSharedImportEngineWithBearerMultipart() async throws {
        APIStubURLProtocol.configure { request, _ in
            XCTAssertEqual(request.url?.path, "/api/import/revolut")
            XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer token")
            XCTAssertTrue(request.value(forHTTPHeaderField: "Content-Type")?.hasPrefix("multipart/form-data; boundary=") == true)
            return (200, Data(#"{"success":true,"newTransactions":2,"updatedTransactions":1,"ignoredDuplicates":3,"accountingMovements":4,"skipped":[{"ticker":"?","fecha":"","reason":"fila inválida"}]}"#.utf8))
        }
        let repository = RevolutImportRepository(api: makeAPIClient { _ in "token" })

        let result = try await repository.importStatement(
            fileData: Data("Date,Ticker\n".utf8),
            fileName: "revolut.csv"
        )

        XCTAssertEqual(result.importedCount, 2)
        XCTAssertEqual(result.updatedCount, 1)
        XCTAssertEqual(result.ignoredDuplicates, 3)
        XCTAssertEqual(result.accountingMovements, 4)
        XCTAssertEqual(result.skippedCount, 1)
        XCTAssertEqual(APIStubURLProtocol.count(), 1)
    }

    private func makeAPIClient(
        tokenProvider: @escaping APIClient.TokenProvider
    ) -> APIClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [APIStubURLProtocol.self]
        return APIClient(
            configuration: APIConfiguration(baseURL: URL(string: "https://api.silox.test")!, requestTimeout: 1),
            session: URLSession(configuration: configuration),
            tokenProvider: tokenProvider
        )
    }
}
