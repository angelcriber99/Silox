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
        XCTAssertFalse(app.buttons["Añadir"].exists)

        app.buttons["Ajustes"].tap()
        XCTAssertTrue(app.navigationBars["Ajustes"].waitForExistence(timeout: 2))
    }

    func testAddFlowUsesAssetSelectionInsteadOfInternalIdentifier() {
        let app = XCUIApplication()
        app.launchArguments.append("-ui-test-authenticated")
        app.launch()

        XCTAssertTrue(app.buttons["Añadir movimiento"].waitForExistence(timeout: 5))
        app.buttons["Añadir movimiento"].tap()

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
        app.buttons["Añadir movimiento"].tap()
        XCTAssertTrue(app.navigationBars["Añadir movimiento"].waitForExistence(timeout: 3))
        app.buttons["Otros movimientos"].tap()
        app.buttons["Dividendo"].tap()
        XCTAssertTrue(app.staticTexts["Retención en origen"].exists)
        XCTAssertTrue(app.staticTexts["Retención en destino"].exists)
        capture("dividendo-retenciones-efectivo")
    }

    func testAssetLogoLoadsInsideItsNativeMark() {
        let app = XCUIApplication()
        app.launchArguments += ["-ui-test-authenticated", "-ui-test-fixtures"]
        app.launch()

        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS 'Apple'" )).firstMatch.waitForExistence(timeout: 5))
        XCTAssertTrue(app.images["asset-logo-AAPL"].waitForExistence(timeout: 3))
        capture("logo-activo-redimensionado")
    }

    func testDeepLinkSelectsSettingsTab() {
        let app = XCUIApplication()
        app.launchArguments += ["-ui-test-authenticated", "-ui-test-deep-link", "silox://settings"]
        app.launch()

        XCTAssertTrue(app.navigationBars["Ajustes"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.tabBars.buttons["Ajustes"].isSelected)
    }

    func testDeepLinkOpensAddMovementWithoutSaving() {
        let app = XCUIApplication()
        app.launchArguments += ["-ui-test-authenticated", "-ui-test-deep-link", "silox://transactions/add"]
        app.launch()

        XCTAssertTrue(app.navigationBars["Añadir movimiento"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["Guardar"].exists)
    }

    func testAssetDeepLinkResolvesTickerIntoNativeDetail() {
        let app = XCUIApplication()
        app.launchArguments += [
            "-ui-test-authenticated",
            "-ui-test-fixtures",
            "-ui-test-deep-link",
            "silox://asset/AAPL"
        ]
        app.launch()

        XCTAssertTrue(app.navigationBars["Apple"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["Compras FIFO abiertas"].exists)
        XCTAssertTrue(app.buttons["Cerrar"].exists)
    }

    func testNativeTabsPreserveIndependentNavigationHistory() {
        let app = XCUIApplication()
        app.launchArguments += ["-ui-test-authenticated", "-ui-test-fixtures"]
        app.launch()

        let appleRow = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Apple'" )).firstMatch
        XCTAssertTrue(appleRow.waitForExistence(timeout: 5))
        appleRow.tap()
        XCTAssertTrue(app.staticTexts["Rendimiento por compra"].waitForExistence(timeout: 3))

        app.tabBars.buttons["Movimientos"].tap()
        XCTAssertTrue(app.navigationBars["Movimientos"].waitForExistence(timeout: 3))
        app.tabBars.buttons["Cartera"].tap()

        XCTAssertTrue(app.staticTexts["Rendimiento por compra"].waitForExistence(timeout: 3))
        XCTAssertTrue(app.navigationBars["Apple"].exists)
    }

    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
