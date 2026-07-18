import SwiftUI

enum LoadState<Value> {
    case idle
    case loading
    case loaded(Value, cachedAt: Date?)
    case failed(String, cached: Value?, cachedAt: Date?)
}

struct StaleBanner: View {
    let date: Date
    var body: some View {
        Label("Datos guardados · \(date.formatted(date: .omitted, time: .shortened))", systemImage: "wifi.slash")
            .font(.caption)
            .foregroundStyle(SiloxColors.textSecondary)
            .frame(maxWidth: .infinity)
            .padding(8)
            .background(SiloxColors.warning.opacity(0.12))
            .accessibilityLabel("Datos sin conexión guardados el \(date.formatted())")
    }
}

struct ErrorStateView: View {
    let message: String
    let retry: () -> Void
    var body: some View {
        ContentUnavailableView {
            Label("No se pudo cargar", systemImage: "exclamationmark.triangle")
        } description: {
            Text(message)
        } actions: {
            Button("Reintentar", action: retry).siloxProminentButtonStyle()
        }
    }
}
