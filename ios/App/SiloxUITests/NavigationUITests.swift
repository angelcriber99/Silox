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

    func testPurchaseLotsAndDividendDeductionsAreVisible() {
        let app = XCUIApplication()
        app.launchArguments += ["-ui-test-authenticated", "-ui-test-fixtures"]
        app.launch()

        let appleRow = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Apple'" )).firstMatch
        XCTAssertTrue(appleRow.waitForExistence(timeout: 5))
        appleRow.tap()
        XCTAssertTrue(app.staticTexts["Rendimiento por compra"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.staticTexts["Recompensa"].exists)
        XCTAssertTrue(app.staticTexts["Parcial"].exists)
        capture("rendimiento-por-compra-fifo")

        app.navigationBars.buttons.element(boundBy: 0).tap()
        app.buttons["Añadir"].tap()
        XCTAssertTrue(app.navigationBars["Añadir movimiento"].waitForExistence(timeout: 3))
        app.buttons["Otros movimientos"].tap()
        app.buttons["Dividendo"].tap()
        XCTAssertTrue(app.staticTexts["Retención en origen"].exists)
        XCTAssertTrue(app.staticTexts["Retención en destino"].exists)
        capture("dividendo-retenciones-efectivo")
    }

    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
