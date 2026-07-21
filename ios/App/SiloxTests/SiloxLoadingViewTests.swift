import XCTest
@testable import Silox

final class SiloxLoadingViewTests: XCTestCase {
    func testInvestmentLoadingContextsUseSpecificStatusCopy() {
        XCTAssertEqual(SiloxLoadingContext.portfolio.title, "Cargando cartera")
        XCTAssertEqual(SiloxLoadingContext.analysis.title, "Preparando análisis")
        XCTAssertEqual(SiloxLoadingContext.radar.title, "Buscando eventos")
    }

    func testEveryLoadingContextHasAnAccessibleNonEmptyDescription() {
        for context in SiloxLoadingContext.allCases {
            XCTAssertFalse(context.title.isEmpty)
            XCTAssertFalse(context.message.isEmpty)
            XCTAssertTrue(context.accessibilityLabel.contains(context.title))
        }
    }
}
