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
        let source = asset.ticker ?? asset.name
        return String(source.split(separator: ".").first?.prefix(2) ?? "--").uppercased()
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

    var body: some View {
        Text(symbol)
            .font(.system(size: size * 0.31, weight: .heavy, design: .rounded))
            .foregroundStyle(tint)
            .frame(width: size, height: size)
            .background(tint.opacity(0.13), in: RoundedRectangle(cornerRadius: size * 0.25, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: size * 0.25, style: .continuous)
                    .stroke(tint.opacity(0.24), lineWidth: 0.75)
            }
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
    var decimalValue: Decimal { Decimal(string: self) ?? .zero }
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
}
