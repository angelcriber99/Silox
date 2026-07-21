import SwiftUI

struct SiloxCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SiloxColors.backgroundSecondary, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(SiloxColors.borderSubtle, lineWidth: 0.75)
            }
    }
}

struct SiloxAssetMark: View {
    let asset: Asset
    var size: CGFloat = 42
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var logoImage: UIImage?

    private var symbol: String {
        String(asset.shortLabel.prefix(2)).uppercased()
    }

    private var tint: Color {
        switch asset.kind {
        case .stock: SiloxColors.accent
        case .etf: SiloxColors.accent
        case .fund: SiloxColors.accentSecondary
        case .crypto: SiloxColors.accentSecondary
        case .metal: SiloxColors.textTertiary
        case .cash: SiloxColors.textSecondary
        case .other: SiloxColors.accent
        }
    }

    private var logoURL: URL? {
        guard let baseURL = AssetLogoLoader.baseURL else { return nil }
        return AssetLogoRequest.url(for: asset, baseURL: baseURL)
    }

    var body: some View {
        Group {
            if let logoImage {
                AdaptiveLogoTile(
                    image: logoImage,
                    mode: .auto,
                    size: size,
                    cornerRadius: size * 0.25,
                    accessibilityLabel: "Logo de \(asset.displayName)"
                )
                .transition(.opacity)
                .accessibilityIdentifier("asset-logo-\(logoIdentifier)")
            } else {
                fallbackTile
            }
        }
        .task(id: logoURL) {
            await loadLogo()
        }
    }

    private var fallbackTile: some View {
        fallback
            .frame(width: size, height: size)
            .background(SiloxColors.surfaceElevated, in: tileShape)
            .clipShape(tileShape)
            .overlay {
                tileShape.stroke(SiloxColors.borderSubtle, lineWidth: 0.75)
            }
    }

    private var tileShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
    }

    private var fallback: some View {
        Text(symbol)
            .font(.system(size: size * 0.31, weight: .heavy, design: .rounded))
            .foregroundStyle(tint)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityHidden(true)
    }

    private var logoIdentifier: String {
        AssetLogoRequest.identifier(for: asset) ?? symbol
    }

    @MainActor
    private func loadLogo() async {
        logoImage = nil
        guard let logoURL else { return }
        guard let image = await AssetLogoLoader.shared.image(for: logoURL) else {
            return
        }
        guard !Task.isCancelled else { return }
        if reduceMotion { logoImage = image }
        else { withAnimation(.easeInOut(duration: 0.15)) { logoImage = image } }
    }
}

enum AssetLogoRequest {
    private static let exchangeSuffixes: Set<String> = [
        "AS", "AX", "BR", "CO", "DE", "F", "HE", "HK", "IR", "L", "LS", "MC", "MI", "OL", "PA", "ST", "SW", "TO", "US", "VI"
    ]

    static func identifier(for asset: Asset) -> String? {
        guard asset.kind != .cash else { return nil }
        let raw = (asset.kind == .fund ? asset.shortLabel : (asset.ticker ?? asset.shortLabel))
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
        guard !raw.isEmpty else { return nil }

        if asset.kind == .crypto {
            return raw.split(separator: "-").first.map(String.init)
        }

        let parts = raw.split(separator: ".").map(String.init)
        if parts.count == 2 {
            return exchangeSuffixes.contains(parts[1]) ? parts[0] : parts.joined(separator: "-")
        }
        return parts.first ?? raw
    }

    static func url(for asset: Asset, baseURL: URL) -> URL? {
        guard let identifier = identifier(for: asset) else { return nil }
        var components = URLComponents(url: baseURL.appending(path: "api/logo"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "ticker", value: identifier),
            URLQueryItem(name: "kind", value: asset.kind == .crypto ? "crypto" : "market")
        ]
        return components?.url
    }
}

@MainActor
private final class AssetLogoLoader {
    static let shared = AssetLogoLoader()

    static var baseURL: URL? {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-ui-test-fixtures") {
            return URL(string: "https://ui-test.silox.local")
        }
        #endif
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "SILOX_API_BASE_URL") as? String else { return nil }
        return URL(string: raw)
    }

    private let memoryCache = NSCache<NSURL, UIImage>()
    private let session: URLSession

    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.requestCachePolicy = .returnCacheDataElseLoad
        configuration.urlCache = .shared
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-ui-test-fixtures") {
            configuration.protocolClasses = [UITestURLProtocol.self]
        }
        #endif
        session = URLSession(configuration: configuration)
    }

    func image(for url: URL) async -> UIImage? {
        if let cached = memoryCache.object(forKey: url as NSURL) {
            return cached
        }

        var request = URLRequest(url: url)
        request.cachePolicy = .returnCacheDataElseLoad
        request.timeoutInterval = 15

        do {
            let (data, response) = try await session.data(for: request)
            guard !Task.isCancelled,
                  data.count <= 1_000_000,
                  let httpResponse = response as? HTTPURLResponse,
                  (200..<300).contains(httpResponse.statusCode),
                  httpResponse.mimeType?.hasPrefix("image/") == true,
                  let image = UIImage(data: data),
                  image.size.width <= 2_048,
                  image.size.height <= 2_048 else { return nil }
            memoryCache.setObject(image, forKey: url as NSURL, cost: data.count)
            return image
        } catch is CancellationError {
            return nil
        } catch {
            return nil
        }
    }
}

extension View {
    @ViewBuilder
    func siloxGlassButtonStyle() -> some View {
        if #available(iOS 26.0, *) {
            buttonStyle(.glass)
        } else {
            buttonStyle(.bordered)
        }
    }

    @ViewBuilder
    func siloxProminentButtonStyle() -> some View {
        if #available(iOS 26.0, *) {
            buttonStyle(.glassProminent)
        } else {
            buttonStyle(.borderedProminent)
        }
    }

    @ViewBuilder
    func siloxTabBarBehavior() -> some View {
        if #available(iOS 26.0, *) {
            // A permanently visible tab bar avoids a minimization transition
            // racing a tab switch when the destination owns a ScrollView.
            tabBarMinimizeBehavior(.never)
        } else {
            self
        }
    }

    func siloxContentBackground() -> some View {
        scrollContentBackground(.hidden)
            .background(SiloxColors.backgroundPrimary)
    }

    @ViewBuilder
    func siloxPeriodControlSurface(cornerRadius: CGFloat = 10) -> some View {
        if #available(iOS 26.0, *) {
            self
        } else {
            modifier(SiloxMaterialFallbackModifier(cornerRadius: cornerRadius))
        }
    }

    func siloxInteractiveGlass(cornerRadius: CGFloat = 17) -> some View {
        modifier(SiloxInteractiveGlassModifier(cornerRadius: cornerRadius))
    }
}

struct SiloxGlassEffectGroup<Content: View>: View {
    let spacing: CGFloat
    @ViewBuilder let content: Content

    init(spacing: CGFloat = 8, @ViewBuilder content: () -> Content) {
        self.spacing = spacing
        self.content = content()
    }

    @ViewBuilder var body: some View {
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: spacing) { content }
        } else {
            content
        }
    }
}

private struct SiloxMaterialFallbackModifier: ViewModifier {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        content
            .background(
                reduceTransparency ? AnyShapeStyle(SiloxColors.surfaceElevated) : AnyShapeStyle(.thinMaterial),
                in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            )
            .overlay {
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .stroke(SiloxColors.borderSubtle, lineWidth: 0.75)
            }
    }
}

private struct SiloxInteractiveGlassModifier: ViewModifier {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    let cornerRadius: CGFloat

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *), !reduceTransparency {
            content
                .glassEffect(.regular.tint(SiloxColors.accent.opacity(0.08)).interactive(), in: .rect(cornerRadius: cornerRadius))
        } else {
            content.modifier(SiloxMaterialFallbackModifier(cornerRadius: cornerRadius))
        }
    }
}

extension Decimal {
    var doubleValue: Double { NSDecimalNumber(decimal: self).doubleValue }
}

extension String {
    var normalizedDecimal: Decimal? {
        let cleaned = trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: " ", with: "")
        guard !cleaned.isEmpty else { return nil }

        let unsigned = cleaned.first == "+" || cleaned.first == "-"
            ? cleaned.dropFirst()
            : Substring(cleaned)
        guard !unsigned.isEmpty,
              unsigned.allSatisfy({ $0.isNumber || $0 == "," || $0 == "." }),
              unsigned.filter({ $0 == "," || $0 == "." }).count <= 1 else { return nil }

        return Decimal(
            string: cleaned.replacingOccurrences(of: ",", with: "."),
            locale: Locale(identifier: "en_US_POSIX")
        )
    }

    var decimalValue: Decimal { normalizedDecimal ?? .zero }
}

extension Asset {
    var displayName: String {
        let cleanName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedName = cleanName.folding(options: .diacriticInsensitive, locale: .current).uppercased()

        // MyInvestor exposes this fund with its ISIN as ticker. Keep the name
        // users recognize in the list and leave the identifier as metadata.
        if normalizedName.contains("MSCI WORLD") { return "MSCI World" }
        if !cleanName.isEmpty, cleanName.caseInsensitiveCompare(ticker ?? "") != .orderedSame {
            return cleanName
        }
        return shortLabel
    }

    var metadataLabel: String {
        let tickerLabel = shortLabel
        return tickerLabel.caseInsensitiveCompare(displayName) == .orderedSame
            ? kind.displayName
            : tickerLabel
    }

    var shortLabel: String {
        let rawTicker = ticker?.split(separator: ".").first.map(String.init) ?? ""
        let looksLikeISIN = rawTicker.count == 12
            && rawTicker.prefix(2).allSatisfy(\.isLetter)
            && rawTicker.dropFirst(2).contains(where: \.isNumber)
        if !rawTicker.isEmpty, rawTicker.count <= 10, !looksLikeISIN { return rawTicker.uppercased() }

        let ignored = Set(["THE", "FUND", "INDEX", "ACC", "ETF"])
        let words = name
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber })
            .map { String($0).uppercased() }
            .filter { $0.count > 1 && !ignored.contains($0) }
        return words.first.map { String($0.prefix(8)) } ?? String(rawTicker.prefix(8)).uppercased()
    }
}

extension Asset.Kind {
    var displayName: String {
        switch self {
        case .stock: "Acción"
        case .etf: "ETF"
        case .fund: "Fondo"
        case .crypto: "Cripto"
        case .metal: "Metal"
        case .cash: "Liquidez"
        case .other: "Activo"
        }
    }
}

enum SiloxFormatters {
    static func money(_ value: String, currency: String = "EUR") -> String {
        value.decimalValue.formatted(.currency(code: currency))
    }

    static func percentage(_ value: Double) -> String {
        let prefix = value > 0 ? "+" : value < 0 ? "−" : ""
        return prefix + abs(value).formatted(.percent.precision(.fractionLength(2)).scale(1))
    }

    static func signedMoney(_ value: String, currency: String = "EUR") -> String {
        let decimal = value.decimalValue
        let formatted = money(NSDecimalNumber(decimal: abs(decimal)).stringValue, currency: currency)
        if decimal > 0 { return "+\(formatted)" }
        if decimal < 0 { return "−\(formatted)" }
        return formatted
    }

    static func quantity(_ value: String, precision: Int) -> String {
        value.decimalValue.formatted(.number.precision(.fractionLength(0...max(0, precision))))
    }
}
