import XCTest

final class NavigationUITests: XCTestCase {
    func testMainTabsAreReachable() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-test-authenticated")
        app.launch()

        XCTAssertTrue(app.tabBars.buttons["Cartera"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.tabBars.buttons["Radar"].exists)
        XCTAssertTrue(app.tabBars.buttons["Movimientos"].exists)
        XCTAssertTrue(app.tabBars.buttons["Más"].exists)
        XCTAssertTrue(app.buttons["Añadir"].exists)

        app.tabBars.buttons["Más"].tap()
        XCTAssertTrue(app.navigationBars["Más"].waitForExistence(timeout: 2))
    }

    func testAddFlowUsesAssetSelectionInsteadOfInternalIdentifier() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-test-authenticated")
        app.launch()

        XCTAssertTrue(app.buttons["Añadir"].waitForExistence(timeout: 5))
        app.buttons["Añadir"].tap()

        XCTAssertTrue(app.navigationBars["Añadir movimiento"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.buttons["Crear activo"].exists)
        XCTAssertFalse(app.textFields["ID del activo (opcional)"].exists)
    }
}
