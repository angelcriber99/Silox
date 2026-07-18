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
                    NavigationLink {
                        PortfolioHistoryView(repository: environment.insightsRepository)
                    } label: {
                        Label("Rendimiento", systemImage: "chart.line.uptrend.xyaxis")
                    }
                    NavigationLink {
                        AlertsView(repository: environment.insightsRepository)
                    } label: {
                        Label("Alertas", systemImage: "bell")
                    }
                }

                Section("Privacidad") {
                    Toggle(isOn: $hideBalances) {
                        Label("Ocultar saldos", systemImage: hideBalances ? "eye.slash" : "eye")
                    }
                    if useBiometrics {
                        Button(role: .destructive) { useBiometrics = false } label: {
                            Label("Desactivar Face ID", systemImage: "faceid")
                        }
                    } else {
                        Button {
                            Task {
                                if await BiometricAuth.authenticate(reason: "Activa la protección de Silox") {
                                    useBiometrics = true
                                    biometricMessage = nil
                                } else {
                                    biometricMessage = "Face ID no está disponible o no se autorizó."
                                }
                            }
                        } label: {
                            Label("Activar Face ID", systemImage: "faceid")
                        }
                    }
                    if let biometricMessage {
                        Text(biometricMessage).font(.caption).foregroundStyle(.secondary)
                    }
                }

                Section("Widget") {
                    LabeledContent("Credencial", value: widgetStatus)
                    Button { Task { await updateWidgetCredential() } } label: {
                        Label("Renovar acceso del widget", systemImage: "rectangle.3.group")
                    }
                    .disabled(isUpdatingWidget)
                    Text("La credencial se guarda en Keychain compartido. El App Group solo contiene la última respuesta cacheada.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Cuenta") {
                    Button(role: .destructive) { Task { await signOut() } } label: {
                        Label("Cerrar sesión", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                }

                Section {
                    Text("Silox iOS 1.0").font(.caption).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Más")
            .task { await refreshWidgetStatus() }
        }
    }

    private func refreshWidgetStatus() async {
        do {
            widgetStatus = try WidgetCredentialStore.make().data(for: WidgetCredentialStore.tokenKey) == nil
                ? "No configurado"
                : "Activo"
        } catch {
            widgetStatus = "No disponible"
        }
    }

    private func updateWidgetCredential() async {
        isUpdatingWidget = true
        defer { isUpdatingWidget = false }
        do {
            let response: WidgetCredentialResponse = try await environment.api.sendRaw(
                "api/widget/token",
                method: .put,
                body: EmptyResponse()
            )
            try WidgetCredentialStore.make().set(Data(response.token.utf8), for: WidgetCredentialStore.tokenKey)
            widgetStatus = "Activo"
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            widgetStatus = "Error al renovar"
        }
    }

    private func signOut() async {
        do {
            let _: WidgetRevocationResponse = try await environment.api.sendRaw(
                "api/widget/token",
                method: .delete,
                body: EmptyResponse()
            )
        } catch {
            // El cierre local debe seguir disponible sin conexión.
        }
        session.signOut()
        WidgetCenter.shared.reloadAllTimelines()
    }
}

private struct WidgetRevocationResponse: Decodable, Sendable { let revoked: Bool }
