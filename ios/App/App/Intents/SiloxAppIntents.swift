import AppIntents
import Foundation

enum SiloxIntentSection: String, AppEnum {
    case portfolio, transactions, radar, settings
    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Sección de Silox")
    static let caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .portfolio: "Cartera", .transactions: "Movimientos", .radar: "Radar", .settings: "Ajustes"
    ]
    var deepLink: URL { URL(string: "silox://\(rawValue)")! }
}

struct OpenSiloxSectionIntent: AppIntent {
    static let title: LocalizedStringResource = "Abrir sección de Silox"
    static let description = IntentDescription("Abre Silox directamente en una de sus secciones principales.")
    @Parameter(title: "Sección") var section: SiloxIntentSection
    static var parameterSummary: some ParameterSummary { Summary("Abrir \(\.$section) en Silox") }
    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(section.deepLink))
    }
}

struct AddSiloxMovementIntent: AppIntent {
    static let title: LocalizedStringResource = "Añadir movimiento en Silox"
    static let description = IntentDescription("Abre el formulario de Silox. El movimiento solo se guarda después de revisarlo y confirmarlo en la app.")
    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(URL(string: "silox://transactions/add")!))
    }
}

struct SiloxShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenSiloxSectionIntent(),
            phrases: ["Abrir una sección en \(.applicationName)", "Navegar por \(.applicationName)"],
            shortTitle: "Abrir Silox",
            systemImageName: "chart.pie"
        )
        AppShortcut(
            intent: AddSiloxMovementIntent(),
            phrases: ["Añadir movimiento en \(.applicationName)", "Registrar inversión en \(.applicationName)"],
            shortTitle: "Añadir movimiento",
            systemImageName: "plus.circle"
        )
    }
}
