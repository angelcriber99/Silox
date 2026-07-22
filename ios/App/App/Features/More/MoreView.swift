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
                Section("Experiencia") {
                    NavigationLink { MobilePreferencesView() } label: {
                        SettingsDestinationLabel(
                            title: "Apariencia y cartera",
                            subtitle: "Tema, densidad, orden y tiempo real",
                            icon: "slider.horizontal.3",
                            tint: SiloxColors.accent
                        )
                    }
                    NavigationLink { NotificationPreferencesView(repository: environment.settingsRepository) } label: {
                        SettingsDestinationLabel(
                            title: "Notificaciones",
                            subtitle: "Precios, dividendos y resúmenes",
                            icon: "bell.badge",
                            tint: SiloxColors.accent
                        )
                    }
                }

                Section("Análisis") {
                    NavigationLink { PortfolioHistoryView(repository: environment.insightsRepository) } label: {
                        SettingsDestinationLabel(
                            title: "Rendimiento",
                            subtitle: "Histórico de patrimonio y capital",
                            icon: "chart.line.uptrend.xyaxis",
                            tint: SiloxColors.accent
                        )
                    }
                    NavigationLink { AlertsView(repository: environment.insightsRepository) } label: {
                        SettingsDestinationLabel(
                            title: "Alertas de precio",
                            subtitle: "Objetivos y avisos configurados",
                            icon: "bell",
                            tint: SiloxColors.accentSecondary
                        )
                    }
                }

                Section("Datos") {
                    NavigationLink { RevolutImportView(repository: environment.revolutImportRepository) } label: {
                        SettingsDestinationLabel(
                            title: "Importar extracto",
                            subtitle: "Revolut o MyInvestor · CSV y Excel",
                            icon: "square.and.arrow.down",
                            tint: SiloxColors.accentSecondary
                        )
                    }
                }

                Section("Privacidad") {
                    SettingsToggleRow(
                        title: "Ocultar saldos",
                        subtitle: "Protege los importes en todas las pantallas",
                        icon: hideBalances ? "eye.slash" : "eye",
                        tint: SiloxColors.accent,
                        isOn: $hideBalances
                    )
                    Button { Task { await toggleBiometrics() } } label: {
                        SettingsActionLabel(
                            title: useBiometrics ? "Desactivar Face ID" : "Activar Face ID",
                            subtitle: useBiometrics ? "Protección biométrica activa" : "Solicitar Face ID al volver a Silox",
                            icon: "faceid",
                            tint: SiloxColors.accent
                        )
                    }
                    .buttonStyle(.plain)
                    if let biometricMessage {
                        Text(biometricMessage).font(.caption).foregroundStyle(SiloxColors.textSecondary)
                    }
                }

                Section("Widget") {
                    HStack(spacing: 12) {
                        SettingsIcon(symbol: "rectangle.3.group", tint: SiloxColors.accentSecondary)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Widget de cartera").font(.subheadline.weight(.semibold))
                            Text(widgetStatus).font(.caption).foregroundStyle(SiloxColors.textSecondary)
                        }
                        Spacer()
                        if isUpdatingWidget { ProgressView() }
                        else {
                            Button("Renovar") { Task { await updateWidgetCredential() } }
                                .siloxGlassButtonStyle()
                                .controlSize(.small)
                        }
                    }
                }

                Section("Cuenta") {
                    NavigationLink { DeleteAccountView() } label: {
                        SettingsDestinationLabel(
                            title: "Eliminar cuenta",
                            subtitle: "Borra definitivamente tu cuenta y tus datos",
                            icon: "person.crop.circle.badge.minus",
                            tint: SiloxColors.negative
                        )
                    }
                    Button(role: .destructive) { Task { await signOut() } } label: {
                        SettingsActionLabel(
                            title: "Cerrar sesión",
                            subtitle: "Elimina la sesión y los datos cacheados del dispositivo",
                            icon: "rectangle.portrait.and.arrow.right",
                            tint: SiloxColors.negative,
                            showsChevron: false
                        )
                    }
                    .buttonStyle(.plain)
                }

                Section("Legal") {
                    Link(destination: URL(string: "https://silox-chi.vercel.app/privacy")!) {
                        SettingsActionLabel(
                            title: "Política de privacidad",
                            subtitle: "Datos tratados, seguridad y tus derechos",
                            icon: "hand.raised",
                            tint: SiloxColors.textPrimary
                        )
                    }
                    Link(destination: URL(string: "https://silox-chi.vercel.app/terms")!) {
                        SettingsActionLabel(
                            title: "Términos de uso",
                            subtitle: "Alcance y limitaciones del servicio",
                            icon: "doc.text",
                            tint: SiloxColors.textPrimary
                        )
                    }
                }

                Section { Text(appVersion).font(.caption2).foregroundStyle(SiloxColors.textTertiary) }
            }
            .listStyle(.insetGrouped)
            .siloxContentBackground()
            .navigationTitle("Ajustes")
            .task { await refreshWidgetStatus() }
        }
    }

    private var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "—"
        return "Silox iOS \(version) · Build \(build)"
    }

    private func toggleBiometrics() async {
        if useBiometrics {
            useBiometrics = false
            biometricMessage = nil
            return
        }
        if await BiometricAuth.authenticate(reason: "Activa la protección de Silox") {
            useBiometrics = true
            biometricMessage = nil
        } else {
            biometricMessage = "Face ID no está disponible o no se autorizó."
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

private struct DeleteAccountView: View {
    @EnvironmentObject private var environment: AppEnvironment
    @EnvironmentObject private var session: SessionStore
    @State private var confirmation = ""
    @State private var isDeleting = false
    @State private var showFinalConfirmation = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section {
                Label("Esta acción es permanente", systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(SiloxColors.negative)
                Text("Se eliminarán tu cuenta, posiciones, movimientos, alertas, preferencias e histórico de Silox. Exporta antes cualquier dato que necesites conservar.")
                    .font(.subheadline)
                    .foregroundStyle(SiloxColors.textSecondary)
            }

            Section {
                TextField("Escribe BORRAR", text: $confirmation)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                Button("Eliminar mi cuenta", role: .destructive) {
                    showFinalConfirmation = true
                }
                .disabled(confirmation != "BORRAR" || isDeleting)
            } header: {
                Text("Confirmación")
            } footer: {
                Text("La eliminación se aplica a todos los dispositivos asociados a esta cuenta.")
            }

            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.circle")
                        .font(.caption)
                        .foregroundStyle(SiloxColors.negative)
                }
            }
        }
        .siloxContentBackground()
        .navigationTitle("Eliminar cuenta")
        .navigationBarTitleDisplayMode(.inline)
        .interactiveDismissDisabled(isDeleting)
        .confirmationDialog(
            "¿Eliminar definitivamente la cuenta?",
            isPresented: $showFinalConfirmation,
            titleVisibility: .visible
        ) {
            Button("Eliminar cuenta y datos", role: .destructive) { Task { await deleteAccount() } }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("No podrás deshacer esta operación.")
        }
    }

    private func deleteAccount() async {
        isDeleting = true
        errorMessage = nil
        defer { isDeleting = false }
        do {
            let _: EmptyResponse = try await environment.api.send(
                "api/mobile/v1/me",
                method: .delete,
                body: DeleteAccountRequest(confirmation: confirmation),
                idempotencyKey: UUID().uuidString
            )
            session.signOut()
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct DeleteAccountRequest: Encodable, Sendable {
    let confirmation: String
}

private struct WidgetRevocationResponse: Decodable, Sendable { let revoked: Bool }

private struct SettingsIcon: View {
    let symbol: String
    let tint: Color

    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: 16, weight: .semibold))
            .foregroundStyle(tint)
            .frame(width: 34, height: 34)
            .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

private struct SettingsDestinationLabel: View {
    let title: String
    let subtitle: String
    let icon: String
    let tint: Color

    var body: some View {
        HStack(spacing: 12) {
            SettingsIcon(symbol: icon, tint: tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(SiloxColors.textPrimary)
                Text(subtitle).font(.caption).foregroundStyle(SiloxColors.textSecondary).lineLimit(1)
            }
            Spacer()
        }
        .contentShape(Rectangle())
    }
}

private struct SettingsActionLabel: View {
    let title: String
    let subtitle: String
    let icon: String
    let tint: Color
    var showsChevron = true

    var body: some View {
        HStack(spacing: 12) {
            SettingsIcon(symbol: icon, tint: tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold)).foregroundStyle(tint)
                Text(subtitle).font(.caption).foregroundStyle(SiloxColors.textSecondary).lineLimit(2)
            }
            Spacer()
            if showsChevron {
                Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(SiloxColors.textTertiary)
            }
        }
        .contentShape(Rectangle())
    }
}

private struct SettingsToggleRow: View {
    let title: String
    let subtitle: String
    let icon: String
    let tint: Color
    @Binding var isOn: Bool

    var body: some View {
        HStack(spacing: 12) {
            SettingsIcon(symbol: icon, tint: tint)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.subheadline.weight(.semibold))
                Text(subtitle).font(.caption).foregroundStyle(SiloxColors.textSecondary).lineLimit(2)
            }
            Spacer()
            Toggle("", isOn: $isOn).labelsHidden()
        }
    }
}

private struct MobilePreferencesView: View {
    @AppStorage("appearanceMode") private var appearanceMode = "system"
    @AppStorage("compactPositions") private var compactPositions = false
    @AppStorage("showDailyAmount") private var showDailyAmount = true
    @AppStorage("portfolioSort") private var portfolioSort = "day"
    @AppStorage("quantityPrecision") private var quantityPrecision = 4
    @AppStorage("defaultCurrency") private var defaultCurrency = "EUR"
    @AppStorage("liveRefreshSeconds") private var liveRefreshSeconds = 5

    var body: some View {
        Form {
            Section {
                Picker("Tema", selection: $appearanceMode) {
                    Label("Sistema", systemImage: "circle.lefthalf.filled").tag("system")
                    Label("Claro", systemImage: "sun.max").tag("light")
                    Label("Oscuro", systemImage: "moon").tag("dark")
                }
                .pickerStyle(.segmented)
                .siloxPeriodControlSurface()
            } header: {
                Text("Apariencia")
            } footer: {
                Text("Silox mantiene la misma jerarquía visual y colores de rendimiento que la versión web.")
            }

            Section("Lista de posiciones") {
                Picker("Densidad", selection: $compactPositions) {
                    Text("Cómoda").tag(false)
                    Text("Compacta").tag(true)
                }
                .pickerStyle(.segmented)
                .siloxPeriodControlSurface()
                Toggle("Mostrar importe diario", isOn: $showDailyAmount)
                Picker("Orden predeterminado", selection: $portfolioSort) {
                    Text("Movimiento de hoy").tag("day")
                    Text("Valor de la posición").tag("value")
                }
                Stepper("Decimales en unidades: \(quantityPrecision)", value: $quantityPrecision, in: 0...8)
            }

            Section {
                Picker("Actualizar cada", selection: $liveRefreshSeconds) {
                    Text("5 segundos · recomendado").tag(5)
                    Text("10 segundos").tag(10)
                    Text("30 segundos").tag(30)
                    Text("60 segundos").tag(60)
                }
                LabeledContent("Estado") {
                    HStack(spacing: 5) {
                        Image(systemName: "dot.radiowaves.left.and.right")
                        Text("Tiempo real activo")
                    }
                    .foregroundStyle(SiloxColors.accentSecondary)
                }
            } header: {
                Text("Datos en tiempo real")
            } footer: {
                Text("La actualización se pausa cuando Silox está en segundo plano para proteger batería y datos móviles.")
            }

            Section("Operaciones") {
                Picker("Moneda para nuevos activos", selection: $defaultCurrency) {
                    ForEach(["EUR", "USD", "GBP", "CHF"], id: \.self) { Text($0) }
                }
            }

            Section {
                Button("Restaurar ajustes recomendados", role: .destructive, action: resetDefaults)
            }
        }
        .siloxContentBackground()
        .navigationTitle("Experiencia móvil")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func resetDefaults() {
        appearanceMode = "system"
        compactPositions = false
        showDailyAmount = true
        portfolioSort = "day"
        quantityPrecision = 4
        defaultCurrency = "EUR"
        liveRefreshSeconds = 5
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
            Section {
                Toggle(isOn: $pushNotifications) {
                    Label("Notificaciones push", systemImage: "app.badge")
                }
                Toggle(isOn: $emailNotifications) {
                    Label("Notificaciones por email", systemImage: "envelope")
                }
            } header: {
                Text("Canales")
            } footer: {
                Text("Elige cómo quieres recibir los avisos importantes de tu cartera.")
            }

            Section("Contenido") {
                Toggle(isOn: $priceAlerts) { Label("Alertas de precio", systemImage: "bell") }
                Toggle(isOn: $dividendAlerts) { Label("Dividendos", systemImage: "banknote") }
                Toggle(isOn: $weeklyReport) { Label("Resumen semanal", systemImage: "calendar") }
            }

            if let message {
                Section {
                    Label(message, systemImage: message == "Preferencias guardadas." ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(message == "Preferencias guardadas." ? SiloxColors.accentSecondary : SiloxColors.negative)
                }
            }

            Section {
                Button { Task { await save() } } label: {
                    HStack {
                        Spacer()
                        if isSaving { ProgressView() }
                        else { Text("Guardar preferencias").fontWeight(.semibold) }
                        Spacer()
                    }
                }
                .disabled(isLoading || isSaving)
            }
        }
        .siloxContentBackground()
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
