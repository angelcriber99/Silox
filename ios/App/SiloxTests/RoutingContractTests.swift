import XCTest
@testable import Silox

@MainActor
final class RoutingContractTests: XCTestCase {
    func testSupportedDeepLinksResolve() throws {
        XCTAssertEqual(SiloxDeepLink(url: try url("silox://portfolio")), .tab(.portfolio))
        XCTAssertEqual(SiloxDeepLink(url: try url("silox://analysis")), .tab(.analysis))
        XCTAssertEqual(SiloxDeepLink(url: try url("silox://transactions")), .tab(.transactions))
        XCTAssertEqual(SiloxDeepLink(url: try url("silox://radar")), .tab(.radar))
        XCTAssertEqual(SiloxDeepLink(url: try url("silox://settings")), .tab(.settings))
        XCTAssertEqual(SiloxDeepLink(url: try url("silox://asset/asset-123")), .asset(id: "asset-123"))
    }

    func testAddMovementDeepLinkOnlyPresentsEditor() throws {
        let router = AppRouter()
        XCTAssertTrue(router.handle(try url("silox://transactions/add")))
        XCTAssertEqual(router.selectedTab, .transactions)
        XCTAssertEqual(router.presentedSheet, .addMovement(assetID: nil))
        XCTAssertNil(router.presentedAsset)
    }

    func testAssetDeepLinkSelectsPortfolioAndPreservesIdentifier() throws {
        let router = AppRouter()
        router.selectedTab = .settings
        XCTAssertTrue(router.handle(try url("silox://asset/IE00BYX5P602")))
        XCTAssertEqual(router.selectedTab, .portfolio)
        XCTAssertEqual(router.presentedAsset, RoutedAsset(id: "IE00BYX5P602"))
    }

    func testForeignAndMalformedURLsAreRejected() throws {
        XCTAssertNil(SiloxDeepLink(url: try url("https://silox.app/portfolio")))
        XCTAssertNil(SiloxDeepLink(url: try url("silox://asset")))
        XCTAssertNil(SiloxDeepLink(url: try url("silox://unknown")))
    }

    private func url(_ value: String) throws -> URL { try XCTUnwrap(URL(string: value)) }
}
