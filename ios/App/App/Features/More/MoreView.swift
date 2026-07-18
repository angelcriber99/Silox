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
                Section("Aplicación") {
                    NavigationLink { MobilePreferencesView() } label: {
                        Label("Visualización y comportamiento", systemImage: "slider.horizontal.3")
                    }
                    NavigationLink { NotificationPreferencesView(repository: environment.settingsRepository) } label: {
                        Label("Notificaciones", systemImage: "bell.badge")
                    }
                }

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
                    Text("Silox iOS 1.1 · Build 2").font(.caption).foregroundStyle(.secondary)
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

private struct MobilePreferencesView: View {
    @AppStorage("appearanceMode") private var appearanceMode = "system"
    @AppStorage("compactPositions") private var compactPositions = false
    @AppStorage("portfolioSort") private var portfolioSort = "value"
    @AppStorage("quantityPrecision") private var quantityPrecision = 4
    @AppStorage("defaultCurrency") private var defaultCurrency = "EUR"
    @AppStorage("liveRefreshSeconds") private var liveRefreshSeconds = 5

    var body: some View {
        Form {
            Section("Apariencia") {
                Picker("Tema", selection: $appearanceMode) {
                    Text("Sistema").tag("system")
                    Text("Claro").tag("light")
                    Text("Oscuro").tag("dark")
                }
                Picker("Densidad de posiciones", selection: $compactPositions) {
                    Text("Cómoda").tag(false)
                    Text("Compacta").tag(true)
                }
            }

            Section("Cartera") {
                Picker("Orden predeterminado", selection: $portfolioSort) {
                    Text("Valor").tag("value")
                    Text("Movimiento diario").tag("day")
                }
                Stepper("Decimales en unidades: \(quantityPrecision)", value: $quantityPrecision, in: 0...8)
                Picker("Moneda para nuevos activos", selection: $defaultCurrency) {
                    ForEach(["EUR", "USD", "GBP", "CHF"], id: \.self) { Text($0) }
                }
            }

            Section("Datos en tiempo real") {
                Picker("Actualizar cada", selection: $liveRefreshSeconds) {
                    Text("3 segundos").tag(3)
                    Text("5 segundos").tag(5)
                    Text("10 segundos").tag(10)
                    Text("30 segundos").tag(30)
                }
                Text("Una frecuencia más alta consume más batería y datos móviles.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Experiencia móvil")
        .navigationBarTitleDisplayMode(.inline)
    }
}

private struct NotificationPreferencesView: View {
    let repository: SettingsRepository
    @State private var pushNotifications = false
    @State private var emailNotifications = true
    @State private var priceAlerts = true
    @State private var weeklyReport = false
    @State private var dividendAlerts = true
    @State private var isLoading = true
    @State private var isSaving = false
    @State private var message: String?

    var body: some View {
        Form {
            Section("Canales") {
                Toggle("Notificaciones push", isOn: $pushNotifications)
                Toggle("Notificaciones por email", isOn: $emailNotifications)
            }
            Section("Contenido") {
                Toggle("Alertas de precio", isOn: $priceAlerts)
                Toggle("Dividendos", isOn: $dividendAlerts)
                Toggle("Resumen semanal", isOn: $weeklyReport)
            }
            if let message { Section { Text(message).font(.caption).foregroundStyle(.secondary) } }
            Section {
                Button { Task { await save() } } label: {
                    HStack {
                        Spacer()
                        if isSaving { ProgressView() } else { Text("Guardar preferencias").fontWeight(.semibold) }
                        Spacer()
                    }
                }
                .disabled(isLoading || isSaving)
            }
        }
        .navigationTitle("Notificaciones")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
    }

    private func load() async {
        isLoading = true
        defer { isLoading = false }
        do {
            let value = try await repository.get()
            pushNotifications = value.pushNotifications
            emailNotifications = value.emailNotifications
            priceAlerts = value.priceAlerts
            weeklyReport = value.weeklyReport
            dividendAlerts = value.dividendAlerts
        } catch { message = error.localizedDescription }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }
        do {
            _ = try await repository.update(UpdateNotificationPreferences(
                pushNotifications: pushNotifications,
                emailNotifications: emailNotifications,
                priceAlerts: priceAlerts,
                weeklyReport: weeklyReport,
                dividendAlerts: dividendAlerts
            ))
            message = "Preferencias guardadas."
        } catch { message = error.localizedDescription }
    }
}
