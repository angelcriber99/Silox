import SwiftUI

enum SiloxColors {
    static let accent = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 48 / 255, green: 209 / 255, blue: 88 / 255, alpha: 1)
            : UIColor(red: 0.02, green: 0.43, blue: 0.21, alpha: 1)
    })
    static let positive = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(red: 48 / 255, green: 209 / 255, blue: 88 / 255, alpha: 1) : .systemGreen
    })
    static let negative = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(red: 1, green: 69 / 255, blue: 58 / 255, alpha: 1) : .systemRed
    })
    static let warning = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(red: 1, green: 214 / 255, blue: 10 / 255, alpha: 1) : .systemOrange
    })
    static let background = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? .black : .systemGroupedBackground
    })
    static let secondaryBackground = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(white: 17 / 255, alpha: 1) : .secondarySystemGroupedBackground
    })
    static let elevatedBackground = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark ? UIColor(white: 28 / 255, alpha: 1) : .tertiarySystemGroupedBackground
    })
}

struct SiloxCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SiloxColors.secondaryBackground, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(Color.primary.opacity(0.08), lineWidth: 0.5)
            }
    }
}

struct SiloxAssetMark: View {
    let asset: Asset
    var size: CGFloat = 42

    private var symbol: String {
        String(asset.shortLabel.prefix(2)).uppercased()
    }

    private var tint: Color {
        switch asset.kind {
        case .stock: SiloxColors.warning
        case .etf: .blue
        case .fund: .purple
        case .crypto: .orange
        case .metal: .gray
        case .cash: .secondary
        case .other: SiloxColors.accent
        }
    }

    private var logoURL: URL? {
        guard asset.kind != .cash,
              let rawBaseURL = Bundle.main.object(forInfoDictionaryKey: "SILOX_API_BASE_URL") as? String,
              let baseURL = URL(string: rawBaseURL) else { return nil }
        let ticker = asset.kind == .fund ? asset.shortLabel : (asset.ticker ?? asset.shortLabel)
        let withoutExchange = ticker.split(separator: ".").first.map(String.init) ?? ticker
        let identifier = withoutExchange.split(separator: "-").first.map(String.init) ?? withoutExchange
        guard !identifier.isEmpty else { return nil }
        var components = URLComponents(url: baseURL.appending(path: "api/logo"), resolvingAgainstBaseURL: false)
        components?.queryItems = [URLQueryItem(name: "ticker", value: identifier.uppercased())]
        return components?.url
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
                .fill(Color.white.opacity(0.94))
            if let logoURL {
                AsyncImage(url: logoURL, transaction: Transaction(animation: .easeInOut(duration: 0.15))) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                            .padding(size * 0.12)
                            .transition(.opacity)
                    case .empty:
                        ProgressView().controlSize(.mini).tint(tint)
                    case .failure:
                        fallback
                    @unknown default:
                        fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.25, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
                .stroke(tint.opacity(0.24), lineWidth: 0.75)
        }
        .accessibilityHidden(true)
    }

    private var fallback: some View {
        Text(symbol)
            .font(.system(size: size * 0.31, weight: .heavy, design: .rounded))
            .foregroundStyle(tint)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(tint.opacity(0.13))
    }
}

extension View {
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
            tabBarMinimizeBehavior(.onScrollDown)
        } else {
            self
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
            .replacingOccurrences(of: ",", with: ".")
        return Decimal(string: cleaned, locale: Locale(identifier: "en_US_POSIX"))
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
        value.formatted(.percent.precision(.fractionLength(2)).scale(1))
    }

    static func signedMoney(_ value: String, currency: String = "EUR") -> String {
        let decimal = value.decimalValue
        let formatted = money(NSDecimalNumber(decimal: abs(decimal)).stringValue, currency: currency)
        return decimal >= 0 ? "+\(formatted)" : "−\(formatted)"
    }

    static func quantity(_ value: String, precision: Int) -> String {
        value.decimalValue.formatted(.number.precision(.fractionLength(0...max(0, precision))))
    }
}
