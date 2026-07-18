import SwiftUI
import UIKit
import XCTest
@testable import Silox

final class AdaptiveLogoTileTests: XCTestCase {
    func testDefaultsUseRecommendedGeometry() {
        let tile = AdaptiveLogoTile(image: makeImage(color: .red))

        XCTAssertEqual(tile.mode, .auto)
        XCTAssertEqual(tile.size, 38)
        XCTAssertEqual(tile.cornerRadius, 11)
    }

    func testGeometryCanBeConfiguredWithinRecommendedRange() {
        let tile = AdaptiveLogoTile(image: makeImage(color: .red), size: 40, cornerRadius: 12)

        XCTAssertEqual(tile.size, 40)
        XCTAssertEqual(tile.cornerRadius, 12)
    }

    func testAnalyzerIgnoresTransparentPixelsWhenClassifyingLightLogo() {
        let analyzer = AdaptiveLogoAnalyzer()
        let image = makeImage(background: .clear, foreground: .white)

        let result = analyzer.analysis(for: image)

        XCTAssertEqual(result.tone, .predominantlyLight)
        XCTAssertGreaterThan(result.visiblePixelCount, 0)
        XCTAssertGreaterThanOrEqual(result.lightPixelRatio, 0.95)
        XCTAssertGreaterThanOrEqual(result.averageLuminance, 0.95)
    }

    func testAnalyzerClassifiesPredominantlyDarkVisiblePixels() {
        let analyzer = AdaptiveLogoAnalyzer()

        let result = analyzer.analysis(for: makeImage(color: .black))

        XCTAssertEqual(result.tone, .predominantlyDark)
        XCTAssertGreaterThanOrEqual(result.darkPixelRatio, 0.95)
    }

    func testAnalyzerKeepsMixedColorLogoBalanced() {
        let analyzer = AdaptiveLogoAnalyzer()
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 40, height: 40))
        let image = renderer.image { context in
            UIColor.black.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 20, height: 40))
            UIColor.white.setFill()
            context.fill(CGRect(x: 20, y: 0, width: 20, height: 40))
        }

        let result = analyzer.analysis(for: image)

        XCTAssertEqual(result.tone, .balanced)
        XCTAssertEqual(result.lightPixelRatio, 0.5, accuracy: 0.05)
        XCTAssertEqual(result.darkPixelRatio, 0.5, accuracy: 0.05)
    }

    func testAnalyzerReportsFullyTransparentLogoAsHavingNoVisiblePixels() {
        let analyzer = AdaptiveLogoAnalyzer()

        let result = analyzer.analysis(for: makeImage(color: .clear))

        XCTAssertEqual(result.tone, .noVisiblePixels)
        XCTAssertEqual(result.visiblePixelCount, 0)
    }

    func testAnalysisResultIsCachedForTheSameImageInstance() {
        let analyzer = AdaptiveLogoAnalyzer()
        let image = makeImage(color: .white)

        let first = analyzer.analysis(for: image)
        let second = analyzer.analysis(for: image)

        XCTAssertEqual(first, second)
        XCTAssertEqual(analyzer.analysisPassCount, 1)
    }

    func testExplicitModesAlwaysOverrideAutomaticAnalysis() {
        let light = AdaptiveLogoAnalysis(
            tone: .predominantlyLight,
            visiblePixelCount: 10,
            lightPixelRatio: 1,
            darkPixelRatio: 0,
            averageLuminance: 1
        )

        XCTAssertFalse(AdaptiveLogoTile.usesContrastBackdrop(mode: .normal, analysis: light, colorScheme: .light))
        XCTAssertTrue(AdaptiveLogoTile.usesContrastBackdrop(mode: .contrastBackdrop, analysis: nil, colorScheme: .dark))
    }

    func testAutoUsesBackdropOnlyWhenLogoToneConflictsWithCurrentSurface() {
        let light = AdaptiveLogoAnalysis(
            tone: .predominantlyLight,
            visiblePixelCount: 10,
            lightPixelRatio: 1,
            darkPixelRatio: 0,
            averageLuminance: 1
        )
        let dark = AdaptiveLogoAnalysis(
            tone: .predominantlyDark,
            visiblePixelCount: 10,
            lightPixelRatio: 0,
            darkPixelRatio: 1,
            averageLuminance: 0
        )

        XCTAssertTrue(AdaptiveLogoTile.usesContrastBackdrop(mode: .auto, analysis: light, colorScheme: .light))
        XCTAssertFalse(AdaptiveLogoTile.usesContrastBackdrop(mode: .auto, analysis: light, colorScheme: .dark))
        XCTAssertFalse(AdaptiveLogoTile.usesContrastBackdrop(mode: .auto, analysis: dark, colorScheme: .light))
        XCTAssertTrue(AdaptiveLogoTile.usesContrastBackdrop(mode: .auto, analysis: dark, colorScheme: .dark))
    }

    func testAutoMeasuresRealContrastForIntermediateMonochromeLogo() {
        let lowContrastDark = AdaptiveLogoAnalysis(
            tone: .balanced,
            visiblePixelCount: 10,
            lightPixelRatio: 0,
            darkPixelRatio: 0,
            averageLuminance: 0.03
        )

        XCTAssertTrue(AdaptiveLogoTile.usesContrastBackdrop(mode: .auto, analysis: lowContrastDark, colorScheme: .dark))
        XCTAssertFalse(AdaptiveLogoTile.usesContrastBackdrop(mode: .auto, analysis: lowContrastDark, colorScheme: .light))
    }

    func testSemanticBackdropMatchesSpecifiedNeutralColor() throws {
        let traits = UITraitCollection(userInterfaceStyle: .light)
        let color = UIColor(SiloxColors.logoContrastBackdrop).resolvedColor(with: traits)
        var red: CGFloat = 0
        var green: CGFloat = 0
        var blue: CGFloat = 0
        var alpha: CGFloat = 0

        XCTAssertTrue(color.getRed(&red, green: &green, blue: &blue, alpha: &alpha))
        XCTAssertEqual(red, 112 / 255, accuracy: 0.001)
        XCTAssertEqual(green, 117 / 255, accuracy: 0.001)
        XCTAssertEqual(blue, 124 / 255, accuracy: 0.001)
        XCTAssertEqual(alpha, 1, accuracy: 0.001)
    }

    private func makeImage(color: UIColor) -> UIImage {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 40, height: 40))
        return renderer.image { context in
            color.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 40, height: 40))
        }
    }

    private func makeImage(background: UIColor, foreground: UIColor) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.opaque = false
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 40, height: 40), format: format)
        return renderer.image { context in
            background.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 40, height: 40))
            foreground.setFill()
            context.fill(CGRect(x: 14, y: 8, width: 12, height: 24))
        }
    }
}
