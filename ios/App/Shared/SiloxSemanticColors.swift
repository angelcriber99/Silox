import SwiftUI

enum SiloxColors {
    enum Token: CaseIterable {
        case backgroundPrimary, backgroundSecondary, surfaceElevated, surfaceMuted, borderSubtle
        case textPrimary, textSecondary, textTertiary, textOnAccent
        case accent, accentSecondary, positive, negative, warning, logoContrastBackdrop
    }

    static let backgroundPrimary = color(.backgroundPrimary)
    static let backgroundSecondary = color(.backgroundSecondary)
    static let surfaceElevated = color(.surfaceElevated)
    static let surfaceMuted = color(.surfaceMuted)
    static let borderSubtle = color(.borderSubtle)
    static let textPrimary = color(.textPrimary)
    static let textSecondary = color(.textSecondary)
    static let textTertiary = color(.textTertiary)
    static let textOnAccent = color(.textOnAccent)
    static let accent = color(.accent)
    static let accentSecondary = color(.accentSecondary)
    static let positive = color(.positive)
    static let negative = color(.negative)
    static let warning = color(.warning)
    static let logoContrastBackdrop = color(.logoContrastBackdrop)

    static func uiColor(
        _ token: Token,
        style: UIUserInterfaceStyle,
        contrast: UIAccessibilityContrast = .normal
    ) -> UIColor {
        let isDark = style == .dark
        let isHighContrast = contrast == .high
        let hex: UInt32 = switch token {
        case .backgroundPrimary: isDark ? 0x0D1014 : 0xF6F1E7
        case .backgroundSecondary: isDark ? 0x151A20 : 0xFBF8F1
        case .surfaceElevated: isDark ? 0x1B2028 : 0xFFFFFF
        case .surfaceMuted: isDark ? 0x20262E : 0xEEE8DD
        case .borderSubtle:
            isHighContrast ? (isDark ? 0x566270 : 0xA89E90) : (isDark ? 0x2A313B : 0xD7D0C4)
        case .textPrimary: isDark ? 0xF5F4EF : 0x1C1D1F
        case .textSecondary:
            isHighContrast ? (isDark ? 0xD4D7DC : 0x444744) : (isDark ? 0xB6BAC0 : 0x5F625F)
        case .textTertiary:
            isHighContrast ? (isDark ? 0xC2C6CC : 0x4D514D) : (isDark ? 0x8B919A : 0x696D68)
        case .textOnAccent: isDark ? 0x0D1014 : 0xFFFFFF
        case .accent: isDark ? 0x6EA0FF : 0x2563EB
        case .accentSecondary: isDark ? 0x4FD1C5 : 0x0F766E
        case .positive: isDark ? 0x45D492 : 0x137A50
        case .negative: isDark ? 0xFF6B7A : 0xB42332
        case .warning: isDark ? 0xF5B95C : 0x9A5B00
        case .logoContrastBackdrop: 0x70757C
        }
        return UIColor(
            red: CGFloat((hex >> 16) & 0xFF) / 255,
            green: CGFloat((hex >> 8) & 0xFF) / 255,
            blue: CGFloat(hex & 0xFF) / 255,
            alpha: 1
        )
    }

    private static func color(_ token: Token) -> Color {
        Color(uiColor: UIColor { traits in
            uiColor(token, style: traits.userInterfaceStyle, contrast: traits.accessibilityContrast)
        })
    }
}
