#if DEBUG
import Foundation
import UIKit

final class UITestURLProtocol: URLProtocol, @unchecked Sendable {
    override class func canInit(with request: URLRequest) -> Bool {
        request.url?.host == "ui-test.silox.local"
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let url = request.url else {
            client?.urlProtocol(self, didFailWithError: URLError(.badURL))
            return
        }

        if url.path == "/api/logo" {
            let png = Self.fixtureLogoPNG()
            let response = HTTPURLResponse(
                url: url,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "image/png", "Cache-Control": "public, max-age=86400"]
            )!
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .allowed)
            client?.urlProtocol(self, didLoad: png)
            client?.urlProtocolDidFinishLoading(self)
            return
        }

        guard let body = Self.responseBody(for: url.path),
              let response = HTTPURLResponse(
                url: url,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: ["Content-Type": "application/json"]
              ) else {
            client?.urlProtocol(self, didFailWithError: URLError(.resourceUnavailable))
            return
        }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: body)
        client?.urlProtocolDidFinishLoading(self)
    }

    override func stopLoading() {}

    private static func fixtureLogoPNG() -> Data {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 64, height: 64))
        return renderer.pngData { context in
            UIColor.systemBlue.setFill()
            context.cgContext.fillEllipse(in: CGRect(x: 2, y: 2, width: 60, height: 60))
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 34, weight: .bold),
                .foregroundColor: UIColor.white
            ]
            let text = NSAttributedString(string: "A", attributes: attributes)
            let textSize = text.size()
            text.draw(at: CGPoint(x: (64 - textSize.width) / 2, y: (64 - textSize.height) / 2 - 1))
        }
    }

    private static func responseBody(for path: String) -> Data? {
        let json: String
        switch path {
        case "/api/mobile/v1/portfolio":
            json = #"""
            {"data":{
              "asOf":"2026-07-18T16:00:00Z","displayCurrency":"EUR","marketState":"REGULAR_OPEN",
              "totals":{"value":"875","cost":"750","profitLoss":"125","profitLossPercent":16.67,"dailyProfitLoss":"12.5","dailyProfitLossPercent":1.45,"sessionProfitLoss":"8","sessionProfitLossPercent":0.92},
              "positions":[{
                "assetId":"11111111-1111-4111-8111-111111111111","ticker":"AAPL","name":"Apple","type":"Acción","currency":"USD",
                "units":"7","totalCost":"750","investedCash":"500","currentPrice":"125","currentValue":"875","profitLoss":"125","profitLossPercent":16.67,
                "dailyChange":"12.5","dailyChangePercent":1.45,"sessionChangePercent":0.92,"isPriceStale":false,"priceUpdatedAt":"2026-07-18T16:00:00Z",
                "openPurchaseLots":[
                  {"transactionId":"33333333-3333-4333-8333-333333333333","date":"2026-07-17","operation":"Compra","originalQuantity":"2","remainingQuantity":"2","purchasePrice":"75","commission":"0","performanceUnitCost":"75","investedUnitCost":"0"},
                  {"transactionId":"22222222-2222-4222-8222-222222222222","date":"2026-06-10","operation":"Compra","originalQuantity":"10","remainingQuantity":"5","purchasePrice":"100","commission":"0","performanceUnitCost":"100","investedUnitCost":"100"}
                ]
              }]
            }}
            """#
        case "/api/mobile/v1/assets":
            json = #"""
            {"data":[{"id":"11111111-1111-4111-8111-111111111111","ticker":"AAPL","name":"Apple","type":"Acción","strategy":"Core","currency":"USD"}]}
            """#
        case "/api/mobile/v1/transactions":
            json = #"""
            {"data":{"items":[],"page":1,"pageSize":100,"total":0}}
            """#
        case "/api/mobile/v1/radar":
            json = #"""
            {"data":{"assets":[],"events":[],"news":[],"updatedAt":"2026-07-18T16:00:00Z"}}
            """#
        default:
            return nil
        }
        return Data(json.utf8)
    }
}
#endif
