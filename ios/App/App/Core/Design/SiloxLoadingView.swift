import SwiftUI

/// A stable, non-blocking loading surface shared by the investment tabs.
///
/// The layouts deliberately mirror the structure of the destination screen so
/// replacing a loading state does not move the navigation or tab bar around.
enum SiloxLoadingContext: String, CaseIterable, Sendable {
    case launch
    case portfolio
    case analysis
    case radar

    var title: String {
        switch self {
        case .launch: "Iniciando Silox"
        case .portfolio: "Cargando cartera"
        case .analysis: "Preparando análisis"
        case .radar: "Buscando eventos"
        }
    }

    var message: String {
        switch self {
        case .launch: "Preparando tu espacio de inversión"
        case .portfolio: "Actualizando posiciones y mercado"
        case .analysis: "Calculando rendimiento y asignación"
        case .radar: "Revisando los próximos eventos de tus posiciones"
        }
    }

    var accessibilityLabel: String {
        "\(title). \(message)"
    }
}

struct SiloxLoadingView: View {
    let context: SiloxLoadingContext
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    init(_ context: SiloxLoadingContext) {
        self.context = context
    }

    var body: some View {
        Group {
            if context == .launch {
                launchContent
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 14) {
                        loadingHeader
                        placeholderContent
                    }
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background(SiloxColors.backgroundPrimary)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(context.accessibilityLabel)
        .accessibilityAddTraits(.updatesFrequently)
    }

    private var launchContent: some View {
        VStack(spacing: 16) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 42, weight: .semibold))
                .foregroundStyle(SiloxColors.accent)
                .accessibilityHidden(true)
            Text("Silox")
                .font(.largeTitle.bold())
                .foregroundStyle(SiloxColors.textPrimary)
                .accessibilityHidden(true)
            SiloxLoadingIndicator(reduceMotion: reduceMotion)
                .accessibilityHidden(true)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var loadingHeader: some View {
        HStack(spacing: 12) {
            SiloxLoadingIndicator(reduceMotion: reduceMotion)
                .frame(width: 24, height: 24)
            VStack(alignment: .leading, spacing: 3) {
                Text(context.title)
                    .font(.headline)
                    .foregroundStyle(SiloxColors.textPrimary)
                Text(context.message)
                    .font(.caption)
                    .foregroundStyle(SiloxColors.textSecondary)
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 5)
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private var placeholderContent: some View {
        switch context {
        case .portfolio:
            portfolioSkeleton
        case .analysis:
            analysisSkeleton
        case .radar:
            radarSkeleton
        case .launch:
            EmptyView()
        }
    }

    private var portfolioSkeleton: some View {
        VStack(spacing: 14) {
            SiloxLoadingCard {
                VStack(alignment: .leading, spacing: 14) {
                    SiloxSkeletonLine(width: 96, height: 10, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency)
                    SiloxSkeletonLine(width: 188, height: 34, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency)
                    HStack(spacing: 22) {
                        SiloxSkeletonLine(width: 88, height: 12, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency)
                        SiloxSkeletonLine(width: 94, height: 12, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency)
                    }
                }
            }
            SiloxSkeletonLine(width: 126, height: 14, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency)
            ForEach(0..<4, id: \.self) { index in
                positionSkeleton(index: index)
            }
        }
    }

    private var analysisSkeleton: some View {
        VStack(spacing: 14) {
            SiloxLoadingCard {
                VStack(alignment: .leading, spacing: 14) {
                    SiloxSkeletonLine(width: 100, height: 10, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency)
                    SiloxSkeletonLine(width: 172, height: 32, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency)
                    chartSkeleton
                }
            }
            SiloxLoadingCard {
                VStack(alignment: .leading, spacing: 13) {
                    SiloxSkeletonLine(width: 116, height: 10, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency)
                    ForEach(0..<3, id: \.self) { index in
                        HStack(spacing: 10) {
                            SiloxSkeletonLine(width: 30, height: 30, cornerRadius: 15, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency, phaseOffset: Double(index) * 0.13)
                            VStack(alignment: .leading, spacing: 7) {
                                SiloxSkeletonLine(width: 136, height: 11, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency, phaseOffset: Double(index) * 0.13)
                                SiloxSkeletonLine(width: 92, height: 9, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency, phaseOffset: Double(index) * 0.13)
                            }
                            Spacer()
                            SiloxSkeletonLine(width: 48, height: 11, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency, phaseOffset: Double(index) * 0.13)
                        }
                    }
                }
            }
        }
    }

    private var radarSkeleton: some View {
        VStack(spacing: 14) {
            SiloxLoadingCard {
                VStack(alignment: .leading, spacing: 14) {
                    SiloxSkeletonLine(width: 128, height: 10, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency)
                    SiloxSkeletonLine(width: 196, height: 16, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency)
                    HStack(spacing: 10) {
                        ForEach(0..<3, id: \.self) { index in
                            SiloxSkeletonLine(width: 76, height: 44, cornerRadius: 11, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency, phaseOffset: Double(index) * 0.1)
                        }
                    }
                }
            }
            SiloxLoadingCard {
                VStack(spacing: 13) {
                    HStack {
                        SiloxSkeletonLine(width: 34, height: 34, cornerRadius: 17, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency)
                        Spacer()
                        SiloxSkeletonLine(width: 94, height: 13, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency)
                        Spacer()
                        SiloxSkeletonLine(width: 34, height: 34, cornerRadius: 17, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency)
                    }
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 9), count: 7), spacing: 10) {
                        ForEach(0..<28, id: \.self) { index in
                            SiloxSkeletonLine(width: nil, height: 26, cornerRadius: 8, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency, phaseOffset: Double(index % 7) * 0.06)
                        }
                    }
                }
            }
        }
    }

    private var chartSkeleton: some View {
        GeometryReader { proxy in
            let heights: [CGFloat] = [0.68, 0.44, 0.58, 0.30, 0.49, 0.22, 0.38]
            HStack(alignment: .bottom, spacing: 7) {
                ForEach(heights.indices, id: \.self) { index in
                    SiloxSkeletonLine(
                        width: nil,
                        height: max(18, proxy.size.height * heights[index]),
                        cornerRadius: 6,
                        reduceMotion: reduceMotion,
                        reduceTransparency: reduceTransparency,
                        phaseOffset: Double(index) * 0.08
                    )
                }
            }
        }
        .frame(height: 104)
    }

    private func positionSkeleton(index: Int) -> some View {
        SiloxLoadingCard {
            HStack(spacing: 12) {
                SiloxSkeletonLine(width: 40, height: 40, cornerRadius: 11, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency, phaseOffset: Double(index) * 0.1)
                VStack(alignment: .leading, spacing: 7) {
                    SiloxSkeletonLine(width: 118, height: 13, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency, phaseOffset: Double(index) * 0.1)
                    SiloxSkeletonLine(width: 76, height: 10, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency, phaseOffset: Double(index) * 0.1)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 7) {
                    SiloxSkeletonLine(width: 70, height: 13, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency, phaseOffset: Double(index) * 0.1)
                    SiloxSkeletonLine(width: 46, height: 10, reduceMotion: reduceMotion, reduceTransparency: reduceTransparency, phaseOffset: Double(index) * 0.1)
                }
            }
        }
    }
}

private struct SiloxLoadingCard<Content: View>: View {
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

private struct SiloxLoadingIndicator: View {
    let reduceMotion: Bool

    var body: some View {
        TimelineView(.animation(minimumInterval: reduceMotion ? 1 : 1.0 / 20)) { timeline in
            let rotation = reduceMotion ? 0 : timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 1.2) / 1.2 * 360
            Circle()
                .trim(from: 0.09, to: 0.76)
                .stroke(SiloxColors.accent, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                .rotationEffect(.degrees(rotation))
                .frame(width: 22, height: 22)
        }
    }
}

private struct SiloxSkeletonLine: View {
    let width: CGFloat?
    let height: CGFloat
    var cornerRadius: CGFloat = 6
    let reduceMotion: Bool
    let reduceTransparency: Bool
    var phaseOffset: Double = 0

    @State private var isAnimating = false

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
            .fill(SiloxColors.surfaceMuted)
            .frame(width: width, height: height)
            .overlay {
                if !reduceMotion && !reduceTransparency {
                    GeometryReader { proxy in
                        LinearGradient(
                            colors: [.clear, SiloxColors.surfaceElevated.opacity(0.66), .clear],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                        .frame(width: max(28, proxy.size.width * 0.62))
                        .offset(x: isAnimating ? proxy.size.width : -proxy.size.width * 0.62)
                    }
                    .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
                }
            }
            .onAppear {
                guard !reduceMotion, !reduceTransparency else { return }
                withAnimation(.linear(duration: 1.35).repeatForever(autoreverses: false).delay(phaseOffset)) {
                    isAnimating = true
                }
            }
            .onChange(of: reduceMotion) { _, value in
                if value { isAnimating = false }
            }
            .onChange(of: reduceTransparency) { _, value in
                if value { isAnimating = false }
            }
            .accessibilityHidden(true)
    }
}
