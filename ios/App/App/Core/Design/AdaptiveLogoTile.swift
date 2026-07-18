import SwiftUI
import UIKit

struct AdaptiveLogoTile: View {
    enum Mode: Hashable, Sendable {
        case normal
        case contrastBackdrop
        case auto
    }

    let image: UIImage
    let mode: Mode
    let size: CGFloat
    let cornerRadius: CGFloat
    let accessibilityLabel: String?

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.colorSchemeContrast) private var colorSchemeContrast
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var analysis: AdaptiveLogoAnalysis?

    private let analyzer: any AdaptiveLogoAnalyzing

    init(
        image: UIImage,
        mode: Mode = .auto,
        size: CGFloat = 38,
        cornerRadius: CGFloat = 11,
        accessibilityLabel: String? = nil
    ) {
        self.init(
            image: image,
            mode: mode,
            size: size,
            cornerRadius: cornerRadius,
            accessibilityLabel: accessibilityLabel,
            analyzer: AdaptiveLogoAnalyzer.shared
        )
    }

    init(
        image: UIImage,
        mode: Mode = .auto,
        size: CGFloat = 38,
        cornerRadius: CGFloat = 11,
        accessibilityLabel: String? = nil,
        analyzer: any AdaptiveLogoAnalyzing
    ) {
        precondition(size > 0, "AdaptiveLogoTile size must be greater than zero")
        precondition(cornerRadius >= 0, "AdaptiveLogoTile corner radius cannot be negative")
        self.image = image
        self.mode = mode
        self.size = size
        self.cornerRadius = cornerRadius
        self.accessibilityLabel = accessibilityLabel
        self.analyzer = analyzer
    }

    var body: some View {
        logoContent
            .frame(width: size, height: size)
            .background(backgroundStyle, in: tileShape)
            .clipShape(tileShape)
            .overlay {
                tileShape.stroke(borderColor, lineWidth: borderWidth)
            }
            .contentShape(tileShape)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.16), value: usesContrastBackdrop)
            .task(id: analysisTaskID) {
                guard mode == .auto else {
                    analysis = nil
                    return
                }

                analysis = nil
                let analyzedImage = image
                let analyzer = analyzer
                let result = await Task.detached(priority: .utility) {
                    analyzer.analysis(for: analyzedImage)
                }.value
                guard !Task.isCancelled else { return }
                analysis = result
            }
    }

    private var logoContent: some View {
        Image(uiImage: image)
            .renderingMode(.original)
            .resizable()
            .interpolation(.high)
            .antialiased(true)
            .scaledToFit()
            .padding(max(2, size * 0.08))
            .accessibilityElement(children: .ignore)
            .modifier(OptionalLogoAccessibilityLabel(label: accessibilityLabel))
    }

    private var tileShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
    }

    private var usesContrastBackdrop: Bool {
        Self.usesContrastBackdrop(mode: mode, analysis: analysis, colorScheme: colorScheme)
    }

    private var backgroundStyle: Color {
        if usesContrastBackdrop {
            return SiloxColors.logoContrastBackdrop.opacity(reduceTransparency ? 1 : 0.96)
        }

        return SiloxColors.surfaceElevated.opacity(reduceTransparency ? 1 : 0.96)
    }

    private var borderColor: Color {
        SiloxColors.borderSubtle.opacity(colorSchemeContrast == .increased ? 1 : 0.72)
    }

    private var borderWidth: CGFloat {
        colorSchemeContrast == .increased ? 1 : 0.5
    }

    private var analysisTaskID: AnalysisTaskID {
        AnalysisTaskID(image: ObjectIdentifier(image), mode: mode)
    }

    static func usesContrastBackdrop(
        mode: Mode,
        analysis: AdaptiveLogoAnalysis?,
        colorScheme: ColorScheme
    ) -> Bool {
        switch mode {
        case .normal:
            return false
        case .contrastBackdrop:
            return true
        case .auto:
            guard let analysis, analysis.tone != .noVisiblePixels else { return false }
            let surfaceLuminance = colorScheme == .light ? 1.0 : 0.014192365474852245
            let backdropLuminance = 0.176225601896322
            let surfaceContrast = contrastRatio(analysis.averageLuminance, surfaceLuminance)
            let backdropContrast = contrastRatio(analysis.averageLuminance, backdropLuminance)
            return surfaceContrast < 3 && backdropContrast > surfaceContrast
        }
    }

    private static func contrastRatio(_ first: Double, _ second: Double) -> Double {
        (max(first, second) + 0.05) / (min(first, second) + 0.05)
    }
}

private struct AnalysisTaskID: Hashable {
    let image: ObjectIdentifier
    let mode: AdaptiveLogoTile.Mode
}

private struct OptionalLogoAccessibilityLabel: ViewModifier {
    let label: String?

    @ViewBuilder
    func body(content: Content) -> some View {
        if let label, !label.isEmpty {
            content.accessibilityLabel(Text(label))
        } else {
            content.accessibilityHidden(true)
        }
    }
}

enum AdaptiveLogoTone: Equatable, Sendable {
    case predominantlyLight
    case predominantlyDark
    case balanced
    case noVisiblePixels
}

struct AdaptiveLogoAnalysis: Equatable, Sendable {
    let tone: AdaptiveLogoTone
    let visiblePixelCount: Int
    let lightPixelRatio: Double
    let darkPixelRatio: Double
    let averageLuminance: Double
}

protocol AdaptiveLogoAnalyzing: AnyObject {
    func analysis(for image: UIImage) -> AdaptiveLogoAnalysis
}

final class AdaptiveLogoAnalyzer: AdaptiveLogoAnalyzing {
    static let shared = AdaptiveLogoAnalyzer()

    private final class ResultBox {
        let value: AdaptiveLogoAnalysis

        init(_ value: AdaptiveLogoAnalysis) {
            self.value = value
        }
    }

    private let cache = NSCache<UIImage, ResultBox>()
    private let lock = NSLock()
    private var completedAnalysisPasses = 0

    var analysisPassCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return completedAnalysisPasses
    }

    init() {
        cache.countLimit = 512
    }

    func analysis(for image: UIImage) -> AdaptiveLogoAnalysis {
        lock.lock()
        defer { lock.unlock() }

        if let cached = cache.object(forKey: image) {
            return cached.value
        }

        let result = Self.analyzePixels(in: image)
        cache.setObject(ResultBox(result), forKey: image)
        completedAnalysisPasses += 1
        return result
    }

    func removeAllCachedResults() {
        lock.lock()
        defer { lock.unlock() }
        cache.removeAllObjects()
        completedAnalysisPasses = 0
    }

    private static func analyzePixels(in image: UIImage) -> AdaptiveLogoAnalysis {
        guard let sourceImage = normalizedCGImage(from: image) else {
            return AdaptiveLogoAnalysis(
                tone: .noVisiblePixels,
                visiblePixelCount: 0,
                lightPixelRatio: 0,
                darkPixelRatio: 0,
                averageLuminance: 0
            )
        }

        let dimension = 40
        let bytesPerPixel = 4
        let bytesPerRow = dimension * bytesPerPixel
        var pixels = [UInt8](repeating: 0, count: dimension * bytesPerRow)

        let rendered = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let baseAddress = buffer.baseAddress,
                  let context = CGContext(
                      data: baseAddress,
                      width: dimension,
                      height: dimension,
                      bitsPerComponent: 8,
                      bytesPerRow: bytesPerRow,
                      space: CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB(),
                      bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
                          | CGBitmapInfo.byteOrder32Big.rawValue
                  ) else { return false }

            context.interpolationQuality = .medium
            context.clear(CGRect(x: 0, y: 0, width: dimension, height: dimension))

            let scale = min(
                CGFloat(dimension) / CGFloat(sourceImage.width),
                CGFloat(dimension) / CGFloat(sourceImage.height)
            )
            let width = CGFloat(sourceImage.width) * scale
            let height = CGFloat(sourceImage.height) * scale
            let drawRect = CGRect(
                x: (CGFloat(dimension) - width) / 2,
                y: (CGFloat(dimension) - height) / 2,
                width: width,
                height: height
            )
            context.draw(sourceImage, in: drawRect)
            return true
        }

        guard rendered else {
            return AdaptiveLogoAnalysis(
                tone: .noVisiblePixels,
                visiblePixelCount: 0,
                lightPixelRatio: 0,
                darkPixelRatio: 0,
                averageLuminance: 0
            )
        }

        var visiblePixels = 0
        var lightPixels = 0
        var darkPixels = 0
        var luminanceTotal = 0.0

        for offset in stride(from: 0, to: pixels.count, by: bytesPerPixel) {
            let alpha = Int(pixels[offset + 3])
            guard alpha >= 26 else { continue }

            visiblePixels += 1
            let red = unpremultipliedComponent(pixels[offset], alpha: alpha)
            let green = unpremultipliedComponent(pixels[offset + 1], alpha: alpha)
            let blue = unpremultipliedComponent(pixels[offset + 2], alpha: alpha)
            let luminance = relativeLuminance(red: red, green: green, blue: blue)
            luminanceTotal += luminance

            if luminance >= 0.88 {
                lightPixels += 1
            } else if luminance <= 0.08 {
                darkPixels += 1
            }
        }

        guard visiblePixels > 0 else {
            return AdaptiveLogoAnalysis(
                tone: .noVisiblePixels,
                visiblePixelCount: 0,
                lightPixelRatio: 0,
                darkPixelRatio: 0,
                averageLuminance: 0
            )
        }

        let lightRatio = Double(lightPixels) / Double(visiblePixels)
        let darkRatio = Double(darkPixels) / Double(visiblePixels)
        let tone: AdaptiveLogoTone
        if lightRatio >= 0.7 {
            tone = .predominantlyLight
        } else if darkRatio >= 0.7 {
            tone = .predominantlyDark
        } else {
            tone = .balanced
        }

        return AdaptiveLogoAnalysis(
            tone: tone,
            visiblePixelCount: visiblePixels,
            lightPixelRatio: lightRatio,
            darkPixelRatio: darkRatio,
            averageLuminance: luminanceTotal / Double(visiblePixels)
        )
    }

    private static func normalizedCGImage(from image: UIImage) -> CGImage? {
        if image.imageOrientation == .up, let cgImage = image.cgImage {
            return cgImage
        }

        let format = UIGraphicsImageRendererFormat()
        format.opaque = false
        format.scale = 1
        let size = CGSize(width: max(1, image.size.width), height: max(1, image.size.height))
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }.cgImage
    }

    private static func unpremultipliedComponent(_ component: UInt8, alpha: Int) -> Double {
        min(1, (Double(component) * 255 / Double(alpha)) / 255)
    }

    private static func relativeLuminance(red: Double, green: Double, blue: Double) -> Double {
        func linearized(_ component: Double) -> Double {
            component <= 0.04045
                ? component / 12.92
                : pow((component + 0.055) / 1.055, 2.4)
        }

        return 0.2126 * linearized(red)
            + 0.7152 * linearized(green)
            + 0.0722 * linearized(blue)
    }
}
