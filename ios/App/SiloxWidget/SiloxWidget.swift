import SwiftUI
import WidgetKit

struct VolatileAsset: Codable, Hashable {
    let id: String?
    let ticker: String
    let name: String
    let changePercent: Double?
    let isPositive: Bool
}

struct WidgetSummaryResponse: Codable {
    let netSession: Double
    let totalValue: Double
    let volatileAssets: [VolatileAsset]
    let updatedAt: String
}

struct SiloxEntry: TimelineEntry {
    let date: Date
    let summary: WidgetSummaryResponse?
    let isStale: Bool
    let message: String?
}

struct SiloxProvider: TimelineProvider {
    private let cacheKey = "widget.summary.v1"

    func placeholder(in context: Context) -> SiloxEntry {
        SiloxEntry(date: .now, summary: .preview, isStale: false, message: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (SiloxEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : cachedEntry(message: nil))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<SiloxEntry>) -> Void) {
        Task {
            let entry = await fetch()
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(30 * 60))))
        }
    }

    private func fetch() async -> SiloxEntry {
        do {
            guard let tokenData = try WidgetCredentialStore.make().data(for: WidgetCredentialStore.tokenKey),
                  let token = String(data: tokenData, encoding: .utf8), !token.isEmpty else {
                return cachedEntry(message: "Abre Silox para activar el widget")
            }
            let rawURL = Bundle.main.object(forInfoDictionaryKey: "SILOX_API_BASE_URL") as? String ?? "https://example.invalid"
            guard let baseURL = URL(string: rawURL) else { return cachedEntry(message: "Configuración incompleta") }
            var request = URLRequest(url: baseURL.appending(path: "api/widget/summary"))
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.timeoutInterval = 15
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
                return cachedEntry(message: "No se pudo actualizar")
            }
            let summary = try JSONDecoder().decode(WidgetSummaryResponse.self, from: data)
            UserDefaults(suiteName: appGroup)?.set(data, forKey: cacheKey)
            return SiloxEntry(date: .now, summary: summary, isStale: false, message: nil)
        } catch {
            return cachedEntry(message: "Sin conexión")
        }
    }

    private func cachedEntry(message: String?) -> SiloxEntry {
        let data = UserDefaults(suiteName: appGroup)?.data(forKey: cacheKey)
        let summary = data.flatMap { try? JSONDecoder().decode(WidgetSummaryResponse.self, from: $0) }
        return SiloxEntry(date: .now, summary: summary, isStale: summary != nil, message: message)
    }

    private var appGroup: String {
        Bundle.main.object(forInfoDictionaryKey: "SILOX_APP_GROUP") as? String ?? "group.com.angelcriber.silox"
    }
}

struct SiloxWidgetEntryView: View {
    let entry: SiloxEntry
    @Environment(\.widgetFamily) private var family

    var body: some View {
        Group {
            if let summary = entry.summary {
                if family == .systemMedium { medium(summary) } else { compact(summary) }
            } else {
                VStack(spacing: 8) {
                    Image(systemName: "lock.shield")
                    Text(entry.message ?? "Abre Silox").font(.caption).multilineTextAlignment(.center)
                }
            }
        }
        .foregroundStyle(SiloxColors.textPrimary)
        .privacySensitive()
        .containerBackground(for: .widget) { SiloxColors.backgroundPrimary }
        .widgetURL(URL(string: "silox://portfolio"))
    }

    private func compact(_ summary: WidgetSummaryResponse) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("SILOX").font(.caption.bold()).foregroundStyle(SiloxColors.textSecondary)
                Spacer()
                if entry.isStale { Image(systemName: "wifi.slash").font(.caption2) }
            }
            Text(signedMoney(summary.netSession))
                .font(.title2.bold()).monospacedDigit().minimumScaleFactor(0.7)
                .foregroundStyle(summary.netSession > 0 ? SiloxColors.positive : summary.netSession < 0 ? SiloxColors.negative : SiloxColors.textPrimary)
            Spacer()
            Text(summary.totalValue, format: .currency(code: "EUR"))
                .font(.caption).monospacedDigit().foregroundStyle(SiloxColors.textSecondary)
            if let top = summary.volatileAssets.first {
                Text("\(top.ticker)  \(signedPercentage(top.changePercent ?? 0))")
                    .font(.caption.bold()).lineLimit(1)
            }
        }
    }

    private func medium(_ summary: WidgetSummaryResponse) -> some View {
        HStack(spacing: 18) {
            compact(summary).frame(maxWidth: .infinity)
            VStack(alignment: .leading, spacing: 8) {
                Text("EN MOVIMIENTO").font(.caption2.bold()).foregroundStyle(SiloxColors.textSecondary)
                ForEach(summary.volatileAssets.prefix(3), id: \.ticker) { asset in
                    Link(destination: asset.deepLink) {
                        HStack {
                            Text(asset.ticker).font(.caption.bold())
                            Spacer()
                            Text(signedPercentage(asset.changePercent ?? 0))
                                .font(.caption)
                                .foregroundStyle(performanceColor(asset.changePercent ?? 0))
                        }
                    }
                }
                Spacer()
            }
            .frame(maxWidth: .infinity)
        }
    }

    private func performanceColor(_ value: Double) -> Color {
        value > 0 ? SiloxColors.positive : value < 0 ? SiloxColors.negative : SiloxColors.textPrimary
    }

    private func signedMoney(_ value: Double) -> String {
        let formatted = abs(value).formatted(.currency(code: "EUR"))
        return value > 0 ? "+\(formatted)" : value < 0 ? "−\(formatted)" : formatted
    }

    private func signedPercentage(_ value: Double) -> String {
        let formatted = abs(value / 100).formatted(.percent.precision(.fractionLength(1)))
        return value > 0 ? "+\(formatted)" : value < 0 ? "−\(formatted)" : formatted
    }
}

struct SiloxWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SiloxWidget", provider: SiloxProvider()) { SiloxWidgetEntryView(entry: $0) }
            .configurationDisplayName("Resumen Silox")
            .description("Patrimonio y evolución diaria con acceso seguro de solo lectura.")
            .supportedFamilies([.systemSmall, .systemMedium])
    }
}

private extension WidgetSummaryResponse {
    static let preview = WidgetSummaryResponse(
        netSession: 145.50,
        totalValue: 12_540.20,
        volatileAssets: [VolatileAsset(id: "nvda", ticker: "NVDA", name: "NVIDIA", changePercent: 4.2, isPositive: true)],
        updatedAt: Date().ISO8601Format()
    )
}

private extension VolatileAsset {
    var deepLink: URL {
        let identifier = id ?? ticker
        let encoded = identifier.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? identifier
        return URL(string: "silox://asset/\(encoded)") ?? URL(string: "silox://portfolio")!
    }
}
