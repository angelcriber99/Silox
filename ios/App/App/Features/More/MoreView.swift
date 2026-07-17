import SwiftUI
import WidgetKit

struct MoreView: View {
    @EnvironmentObject private var environment: AppEnvironment
    @EnvironmentObject private var session: SessionStore
    @AppStorage("hideBalances") private var hideBalances = false
    @AppStorage("useBiometrics") private var useBiometrics = false
    @State private var widgetStatus = "No configurado"
    @State private var isUpdatingWidget = false
    @State private var biometricMessage: String?

    var body: some View {
        NavigationStack {
            List {
                Section("Inversión") {
                    NavigationLink("Historial") { PortfolioHistoryView(repository: environment.insightsRepository) }
                    NavigationLink("Alertas") { AlertsView(repository: environment.insightsRepository) }
                }
                Section("Privacidad") {
                    Toggle("Ocultar saldos", isOn: $hideBalances)
                    if useBiometrics {
                        Button("Desactivar Face ID", role: .destructive) { useBiometrics = false }
                    } else {
                        Button("Activar Face ID") {
                            Task {
                                if await BiometricAuth.authenticate(reason: "Activa la protección de Silox") {
                                    useBiometrics = true
                                    biometricMessage = nil
                                } else {
                                    biometricMessage = "Face ID no está disponible o no se autorizó."
                                }
                            }
                        }
                    }
                    if let biometricMessage { Text(biometricMessage).font(.caption).foregroundStyle(.secondary) }
                }
                Section("Widget") {
                    LabeledContent("Credencial", value: widgetStatus)
                    Button("Emitir o renovar acceso de lectura") { Task { await updateWidgetCredential() } }
                        .disabled(isUpdatingWidget)
                    Text("La credencial se guarda en Keychain compartido. El App Group solo contiene la última respuesta cacheada.")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Section("Cuenta") {
                    Button("Cerrar sesión", role: .destructive) { Task { await signOut() } }
                }
                Section { Text("Silox iOS 1.0").font(.caption).foregroundStyle(.secondary) }
            }
            .navigationTitle("Más")
            .task { await refreshWidgetStatus() }
        }
    }

    private func refreshWidgetStatus() async {
        do { widgetStatus = try WidgetCredentialStore.make().data(for: WidgetCredentialStore.tokenKey) == nil ? "No configurado" : "Activo" }
        catch { widgetStatus = "No disponible" }
    }

    private func updateWidgetCredential() async {
        isUpdatingWidget = true
        defer { isUpdatingWidget = false }
        do {
            let body = EmptyResponse()
            let response: WidgetCredentialResponse = try await environment.api.sendRaw(
                "api/widget/token",
                method: .put,
                body: body
            )
            try WidgetCredentialStore.make().set(Data(response.token.utf8), for: WidgetCredentialStore.tokenKey)
            widgetStatus = "Activo"
            WidgetCenter.shared.reloadAllTimelines()
        } catch { widgetStatus = "Error al renovar" }
    }

    private func signOut() async {
        do {
            let _: WidgetRevocationResponse = try await environment.api.sendRaw(
                "api/widget/token",
                method: .delete,
                body: EmptyResponse()
            )
        } catch {
            // Local sign-out must remain available offline; local credentials and caches are always removed.
        }
        session.signOut()
        WidgetCenter.shared.reloadAllTimelines()
    }
}

private struct WidgetRevocationResponse: Decodable, Sendable { let revoked: Bool }
