import UIKit
import XCTest
@testable import Silox

final class SiloxSemanticColorTests: XCTestCase {
    func testLightPaletteMatchesProductSpecification() throws {
        let expected: [SiloxColors.Token: UInt32] = [
            .backgroundPrimary: 0xF6F1E7, .backgroundSecondary: 0xFBF8F1,
            .surfaceElevated: 0xFFFFFF, .surfaceMuted: 0xEEE8DD, .borderSubtle: 0xD7D0C4,
            .textPrimary: 0x1C1D1F, .textSecondary: 0x5F625F, .textTertiary: 0x696D68,
            .accent: 0x2563EB, .accentSecondary: 0x0F766E,
            .positive: 0x137A50, .negative: 0xB42332, .warning: 0x9A5B00,
            .logoContrastBackdrop: 0x70757C
        ]

        try assertPalette(expected, style: .light)
    }

    func testDarkPaletteMatchesProductSpecification() throws {
        let expected: [SiloxColors.Token: UInt32] = [
            .backgroundPrimary: 0x0D1014, .backgroundSecondary: 0x151A20,
            .surfaceElevated: 0x1B2028, .surfaceMuted: 0x20262E, .borderSubtle: 0x2A313B,
            .textPrimary: 0xF5F4EF, .textSecondary: 0xB6BAC0, .textTertiary: 0x8B919A,
            .accent: 0x6EA0FF, .accentSecondary: 0x4FD1C5,
            .positive: 0x45D492, .negative: 0xFF6B7A, .warning: 0xF5B95C,
            .logoContrastBackdrop: 0x70757C
        ]

        try assertPalette(expected, style: .dark)
    }

    func testSemanticTextAndStatusColorsMeetNormalTextContrast() throws {
        let foregrounds: [SiloxColors.Token] = [
            .textPrimary, .textSecondary, .textTertiary,
            .accent, .accentSecondary, .positive, .negative, .warning
        ]

        for style in [UIUserInterfaceStyle.light, .dark] {
            let background = SiloxColors.uiColor(.backgroundPrimary, style: style)
            for foreground in foregrounds {
                let ratio = try contrastRatio(
                    SiloxColors.uiColor(foreground, style: style),
                    background
                )
                XCTAssertGreaterThanOrEqual(ratio, 4.5, "\(foreground) failed in \(style)")
            }
        }
    }

    func testIncreaseContrastStrengthensSupportingTokens() throws {
        for style in [UIUserInterfaceStyle.light, .dark] {
            for token in [SiloxColors.Token.borderSubtle, .textSecondary, .textTertiary] {
                let normal = try rgbHex(SiloxColors.uiColor(token, style: style))
                let increased = try rgbHex(SiloxColors.uiColor(token, style: style, contrast: .high))
                XCTAssertNotEqual(normal, increased)
            }
        }
    }

    func testPerformancePercentagesAlwaysCarryDirection() {
        XCTAssertTrue(SiloxFormatters.percentage(1.16).hasPrefix("+"))
        XCTAssertTrue(SiloxFormatters.percentage(-24.2).hasPrefix("−"))
        XCTAssertFalse(SiloxFormatters.percentage(0).hasPrefix("+"))
        XCTAssertFalse(SiloxFormatters.percentage(0).hasPrefix("−"))
        XCTAssertFalse(SiloxFormatters.signedMoney("0").hasPrefix("+"))
    }

    private func assertPalette(
        _ expected: [SiloxColors.Token: UInt32],
        style: UIUserInterfaceStyle
    ) throws {
        for (token, expectedHex) in expected {
            XCTAssertEqual(try rgbHex(SiloxColors.uiColor(token, style: style)), expectedHex, "\(token)")
        }
    }

    private func rgbHex(_ color: UIColor) throws -> UInt32 {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard color.getRed(&red, green: &green, blue: &blue, alpha: &alpha) else {
            throw ColorTestError.unreadable
        }
        return UInt32((red * 255).rounded()) << 16
            | UInt32((green * 255).rounded()) << 8
            | UInt32((blue * 255).rounded())
    }

    private func contrastRatio(_ foreground: UIColor, _ background: UIColor) throws -> Double {
        let foregroundLuminance = try relativeLuminance(foreground)
        let backgroundLuminance = try relativeLuminance(background)
        return (max(foregroundLuminance, backgroundLuminance) + 0.05)
            / (min(foregroundLuminance, backgroundLuminance) + 0.05)
    }

    private func relativeLuminance(_ color: UIColor) throws -> Double {
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0
        guard color.getRed(&red, green: &green, blue: &blue, alpha: &alpha) else {
            throw ColorTestError.unreadable
        }
        func linearize(_ value: CGFloat) -> Double {
            let component = Double(value)
            return component <= 0.04045
                ? component / 12.92
                : pow((component + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue)
    }
}

private enum ColorTestError: Error {
    case unreadable
}
