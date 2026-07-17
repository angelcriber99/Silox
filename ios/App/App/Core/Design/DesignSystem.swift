import SwiftUI

enum SiloxColors {
    static let accent = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.25, green: 0.82, blue: 0.53, alpha: 1)
            : UIColor(red: 0.02, green: 0.43, blue: 0.21, alpha: 1)
    })
    static let positive = Color.green
    static let negative = Color.red
    static let background = Color(uiColor: .systemBackground)
    static let secondaryBackground = Color(uiColor: .secondarySystemBackground)
}

struct SiloxCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(SiloxColors.secondaryBackground, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
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
}
