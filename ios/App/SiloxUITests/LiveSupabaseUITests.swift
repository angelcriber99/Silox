import XCTest

final class LiveSupabaseUITests: XCTestCase {
    func testLivePortfolioAndAssetCreation() throws {
        let app = try launchAndSignIn()

        XCTAssertTrue(app.navigationBars["Cartera"].waitForExistence(timeout: 12))
        XCTAssertTrue(app.staticTexts["AAPL"].waitForExistence(timeout: 20))
        capture("02-cartera-supabase")

        let appleRow = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'AAPL'" )).firstMatch
        XCTAssertTrue(appleRow.waitForExistence(timeout: 5))
        appleRow.tap()
        XCTAssertTrue(app.navigationBars["AAPL"].waitForExistence(timeout: 5))
        capture("03-detalle-cotizacion")
        app.navigationBars.buttons.element(boundBy: 0).tap()

        XCTAssertTrue(app.navigationBars["Cartera"].waitForExistence(timeout: 5))
        app.buttons["Añadir"].tap()
        XCTAssertTrue(app.navigationBars["Nuevo movimiento"].waitForExistence(timeout: 5))
        capture("04-anadir-movimiento")
        app.buttons["Crear activo"].tap()
        XCTAssertTrue(app.navigationBars["Nuevo activo"].waitForExistence(timeout: 5))
        capture("05-nuevo-activo")

        app.textFields["Ticker"].tap()
        app.textFields["Ticker"].typeText("MSFT")
        app.textFields["Nombre (opcional)"].tap()
        app.textFields["Nombre (opcional)"].typeText("Microsoft")
        app.navigationBars["Nuevo activo"].buttons["Crear"].tap()

        XCTAssertTrue(app.navigationBars["Nuevo movimiento"].waitForExistence(timeout: 12))
        XCTAssertFalse(app.staticTexts["No hay activos"].exists)
        capture("06-activo-creado-y-seleccionado")
    }

    func testLivePortfolioAndTransactionsReadback() throws {
        let app = try launchAndSignIn()

        XCTAssertTrue(app.navigationBars["Cartera"].waitForExistence(timeout: 12))
        XCTAssertTrue(app.staticTexts["AAPL"].waitForExistence(timeout: 20))
        XCTAssertTrue(app.staticTexts["MSFT"].waitForExistence(timeout: 20))
        capture("07-cartera-dos-activos")

        app.buttons["Movimientos"].tap()
        XCTAssertTrue(app.navigationBars["Movimientos"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["AAPL"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.staticTexts["MSFT"].waitForExistence(timeout: 8))
        capture("08-movimientos-supabase")
    }

    private func launchAndSignIn() throws -> XCUIApplication {
        let environment = ProcessInfo.processInfo.environment
        let testBundle = Bundle(for: Self.self)
        guard let email = environment["SILOX_E2E_EMAIL"]
                ?? testBundle.object(forInfoDictionaryKey: "SILOX_E2E_EMAIL") as? String,
              let password = environment["SILOX_E2E_PASSWORD"]
                ?? testBundle.object(forInfoDictionaryKey: "SILOX_E2E_PASSWORD") as? String,
              !email.isEmpty, !password.isEmpty else {
            throw XCTSkip("Define SILOX_E2E_EMAIL y SILOX_E2E_PASSWORD para ejecutar la prueba real.")
        }

        let app = XCUIApplication()
        app.launch()

        let emailField = app.textFields["Correo electrónico"]
        if emailField.waitForExistence(timeout: 3) {
            capture("01-login")
            emailField.tap()
            emailField.typeText(email)
            let passwordField = app.secureTextFields["Contraseña"]
            passwordField.tap()
            passwordField.typeText(password)
            app.buttons["Entrar"].tap()
        }
        return app
    }

    private func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
