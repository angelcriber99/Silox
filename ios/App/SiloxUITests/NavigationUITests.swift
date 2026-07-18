import XCTest

final class NavigationUITests: XCTestCase {
    func testMainTabsAreReachable() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-test-authenticated")
        app.launch()

        XCTAssertTrue(app.buttons["Cartera"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Radar"].exists)
        XCTAssertTrue(app.buttons["Movimientos"].exists)
        XCTAssertTrue(app.buttons["Ajustes"].exists)
        XCTAssertTrue(app.buttons["Añadir"].exists)

        app.buttons["Ajustes"].tap()
        XCTAssertTrue(app.navigationBars["Ajustes"].waitForExistence(timeout: 2))
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
