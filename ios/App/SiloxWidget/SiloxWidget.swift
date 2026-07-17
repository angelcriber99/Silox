import WidgetKit
import SwiftUI
import AppIntents

// MARK: - App Intent

struct SiloxWidgetConfiguration: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Configuración Silox"
    static var description = IntentDescription("Pega tu Llave de Widget secreta.")

    @Parameter(title: "Llave de Widget")
    var widgetKey: String?
}

// MARK: - Models

struct VolatileAsset: Codable, Hashable {
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

// MARK: - Provider

struct Provider: AppIntentTimelineProvider {
    
    // Default mock data for previews
    func placeholder(in context: Context) -> SiloxEntry {
        SiloxEntry(
            date: Date(),
            summary: WidgetSummaryResponse(
                netSession: 145.50,
                totalValue: 12540.20,
                volatileAssets: [
                    VolatileAsset(ticker: "ASTS", name: "AST SpaceMobile", changePercent: 37.4, isPositive: false),
                    VolatileAsset(ticker: "NVDA", name: "Nvidia Corp", changePercent: 4.2, isPositive: true)
                ],
                updatedAt: Date().ISO8601Format()
            ),
            error: nil
        )
    }

    func snapshot(for configuration: SiloxWidgetConfiguration, in context: Context) async -> SiloxEntry {
        placeholder(in: context)
    }

    func timeline(for configuration: SiloxWidgetConfiguration, in context: Context) async -> Timeline<SiloxEntry> {
        let entry = await fetchSummaryData(configuration: configuration)
        // Refresh every 30 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        return Timeline(entries: [entry], policy: .after(nextUpdate))
    }
    
    private func fetchSummaryData(configuration: SiloxWidgetConfiguration) async -> SiloxEntry {
        guard let rawKey = configuration.widgetKey, !rawKey.isEmpty else {
            return SiloxEntry(date: Date(), summary: nil, error: "Mantén pulsado para editar y pegar tu Llave.")
        }
        
        let key = rawKey.trimmingCharacters(in: .whitespacesAndNewlines)
        
        guard let url = URL(string: "https://silox-chi.vercel.app/api/widget/summary") else {
            return SiloxEntry(date: Date(), summary: nil, error: "URL de API inválida")
        }
        
        var request = URLRequest(url: url)
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            
            if let httpResp = response as? HTTPURLResponse, httpResp.statusCode != 200 {
                return SiloxEntry(date: Date(), summary: nil, error: "Llave incorrecta (\(httpResp.statusCode)).")
            }
            
            let summary = try JSONDecoder().decode(WidgetSummaryResponse.self, from: data)
            return SiloxEntry(date: Date(), summary: summary, error: nil)
            
        } catch {
            return SiloxEntry(date: Date(), summary: nil, error: "Sin conexión a internet")
        }
    }
}

// MARK: - Entry

struct SiloxEntry: TimelineEntry {
    let date: Date
    let summary: WidgetSummaryResponse?
    let error: String?
}

// MARK: - Views

struct SiloxWidgetEntryView : View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        Group {
            if let error = entry.error {
                Text(error)
                    .font(.caption)
                    .foregroundColor(.gray)
                    .multilineTextAlignment(.center)
                    .padding()
            } else if let summary = entry.summary {
                if family == .systemSmall {
                    SmallWidgetView(summary: summary)
                } else if family == .accessoryRectangular {
                    LockScreenRectangularView(summary: summary)
                } else if family == .accessoryInline {
                    LockScreenInlineView(summary: summary)
                } else {
                    MediumWidgetView(summary: summary)
                }
            } else {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
            }
        }
        .containerBackground(for: .widget) {
            Color(red: 0.05, green: 0.05, blue: 0.06)
        }
    }
}

struct SmallWidgetView: View {
    let summary: WidgetSummaryResponse
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("SESIÓN HOY")
                .font(.system(size: 10, weight: .bold, design: .rounded))
                .foregroundColor(.gray)
            
            let isPositive = summary.netSession >= 0
            Text(String(format: "%@%.2f €", isPositive ? "+" : "", summary.netSession))
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(isPositive ? .green : .red)
                .minimumScaleFactor(0.5)
            
            Spacer()
            
            if let topAsset = summary.volatileAssets.first {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Top Volatilidad")
                        .font(.system(size: 9))
                        .foregroundColor(.gray)
                    
                    HStack {
                        Text(topAsset.ticker)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(.white)
                        
                        Spacer()
                        
                        if let percent = topAsset.changePercent {
                            Text(String(format: "%@%.1f%%", topAsset.isPositive ? "+" : "", percent))
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(topAsset.isPositive ? .green : .red)
                        }
                    }
                }
                .padding(8)
                .background(Color.white.opacity(0.05))
                .cornerRadius(8)
            }
        }
        .padding(12)
    }
}

struct MediumWidgetView: View {
    let summary: WidgetSummaryResponse
    
    var body: some View {
        HStack(spacing: 16) {
            // Columna Izquierda (P&L)
            VStack(alignment: .leading, spacing: 4) {
                Text("SESIÓN HOY")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundColor(.gray)
                
                let isPositive = summary.netSession >= 0
                Text(String(format: "%@%.2f €", isPositive ? "+" : "", summary.netSession))
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundColor(isPositive ? .green : .red)
                    .minimumScaleFactor(0.5)
                
                Text(String(format: "%.2f €", summary.totalValue))
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(.gray)
                
                Spacer()
                
                Image(systemName: "chart.xyaxis.line")
                    .font(.system(size: 24))
                    .foregroundColor(isPositive ? .green : .red)
                    .opacity(0.5)
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            
            // Columna Derecha (Top Movers)
            VStack(alignment: .leading, spacing: 10) {
                Text("MÁS VOLÁTILES")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundColor(.gray)
                
                VStack(spacing: 8) {
                    ForEach(summary.volatileAssets, id: \.ticker) { asset in
                        HStack {
                            VStack(alignment: .leading) {
                                Text(asset.ticker)
                                    .font(.system(size: 13, weight: .bold))
                                    .foregroundColor(.white)
                                Text(asset.name)
                                    .font(.system(size: 9))
                                    .foregroundColor(.gray)
                                    .lineLimit(1)
                            }
                            Spacer()
                            if let percent = asset.changePercent {
                                Text(String(format: "%@%.1f%%", asset.isPositive ? "+" : "", percent))
                                    .font(.system(size: 12, weight: .bold))
                                    .foregroundColor(asset.isPositive ? .green : .red)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 3)
                                    .background(asset.isPositive ? Color.green.opacity(0.15) : Color.red.opacity(0.15))
                                    .cornerRadius(4)
                            }
                        }
                    }
                }
                Spacer()
            }
            .padding(.vertical, 16)
            .padding(.trailing, 16)
            .frame(maxWidth: .infinity)
        }
    }
}

struct LockScreenRectangularView: View {
    let summary: WidgetSummaryResponse
    
    var body: some View {
        let isPositive = summary.netSession >= 0
        VStack(alignment: .leading, spacing: 4) {
            Text("Silox")
                .font(.headline)
            HStack {
                Image(systemName: isPositive ? "chart.line.uptrend.xyaxis" : "chart.line.downtrend.xyaxis")
                Text(String(format: "%@%.2f €", isPositive ? "+" : "", summary.netSession))
                    .font(.system(.body, design: .rounded).bold())
            }
            if let top = summary.volatileAssets.first, let percent = top.changePercent {
                Text("\(top.ticker): \(top.isPositive ? "+" : "")\(String(format: "%.1f", percent))%")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

struct LockScreenInlineView: View {
    let summary: WidgetSummaryResponse
    
    var body: some View {
        let isPositive = summary.netSession >= 0
        Text("Silox: \(isPositive ? "+" : "")\(String(format: "%.2f", summary.netSession))€")
    }
}

// MARK: - Main Widget

struct SiloxWidget: Widget {
    let kind: String = "SiloxWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: SiloxWidgetConfiguration.self, provider: Provider()) { entry in
            SiloxWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Resumen Silox")
        .description("Muestra tu rendimiento diario y los activos más volátiles.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline])
        .contentMarginsDisabled() 
    }
}
