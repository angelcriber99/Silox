import SwiftUI
import UIKit

/// The share payload intentionally mirrors the privacy setting of the portfolio screen.
/// It contains a rendered card rather than a screenshot of live application UI.
struct PortfolioShareSnapshot: Equatable {
    struct Movement: Equatable, Identifiable {
        let id: String
        let assetName: String
        let ticker: String
        let dailyAmount: MoneyValue?
        let dailyPercent: Double?

        var magnitude: Decimal {
            abs(dailyAmount?.amount.decimalValue ?? Decimal(dailyPercent ?? 0))
        }
    }

    let totalValue: MoneyValue
    let dailyGain: MoneyValue?
    let dailyGainPercent: Double?
    let movements: [Movement]
    let updatedAt: Date
    let balancesHidden: Bool

    init(portfolio: PortfolioResponse, balancesHidden: Bool) {
        totalValue = portfolio.totals.totalValue
        dailyGain = portfolio.totals.dailyGain
        dailyGainPercent = portfolio.totals.dailyGainPercent
        updatedAt = portfolio.updatedAt
        self.balancesHidden = balancesHidden
        movements = portfolio.positions
            .filter { $0.asset.kind != .cash && $0.quantity.decimalValue > 0 }
            .map {
                Movement(
                    id: $0.id,
                    assetName: $0.asset.displayName,
                    ticker: $0.asset.ticker ?? $0.asset.shortLabel,
                    dailyAmount: $0.dailyChange,
                    dailyPercent: $0.dailyChangePercent
                )
            }
            .sorted { left, right in
                if left.magnitude != right.magnitude { return left.magnitude > right.magnitude }
                return left.id.localizedStandardCompare(right.id) == .orderedAscending
            }
            .prefix(3)
            .map { $0 }
    }

    var totalValueLabel: String {
        balancesHidden ? "••••••" : SiloxFormatters.money(totalValue.amount, currency: totalValue.currency)
    }

    var dailyGainLabel: String {
        balancesHidden ? "••••" : dailyGain.map { SiloxFormatters.signedMoney($0.amount, currency: $0.currency) } ?? "—"
    }
}

struct PortfolioSharePresentation: Identifiable {
    let id = UUID()
    let snapshot: PortfolioShareSnapshot
    let originatedFromScreenshot: Bool
}

@MainActor
enum PortfolioShareImageRenderer {
    static func image(for snapshot: PortfolioShareSnapshot, colorScheme: ColorScheme) -> UIImage? {
        let renderer = ImageRenderer(
            content: PortfolioShareCard(snapshot: snapshot)
                .environment(\.colorScheme, colorScheme)
                .frame(width: 1_080)
        )
        renderer.scale = 1
        renderer.isOpaque = true
        return renderer.uiImage
    }
}

struct PortfolioSharePreviewSheet: View {
    let presentation: PortfolioSharePresentation
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var renderedImage: UIImage?
    @State private var showingActivity = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    PortfolioShareCard(snapshot: presentation.snapshot)
                        .frame(maxWidth: 540)
                        .scaleEffect(reduceMotion ? 1 : 0.985)
                        .animation(reduceMotion ? nil : .snappy(duration: 0.32, extraBounce: 0.08), value: renderedImage != nil)
                        .accessibilityLabel("Tarjeta para compartir del patrimonio")

                    VStack(alignment: .leading, spacing: 6) {
                        Text(presentation.originatedFromScreenshot ? "Tu captura está lista para compartir" : "Comparte una tarjeta, no una captura")
                            .font(.headline)
                        Text(presentation.snapshot.balancesHidden
                             ? "Los importes se han ocultado porque tienes activada la privacidad de saldos."
                             : "Incluye el patrimonio y los movimientos más destacados de hoy.")
                            .font(.subheadline)
                            .foregroundStyle(SiloxColors.textSecondary)
                    }
                    .frame(maxWidth: 540, alignment: .leading)

                    Button {
                        showingActivity = true
                    } label: {
                        Label("Compartir tarjeta", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .siloxProminentButtonStyle()
                    .tint(SiloxColors.accent)
                    .disabled(renderedImage == nil)
                    .accessibilityHint("Abre las opciones de compartir de iPhone")
                }
                .padding(20)
            }
            .background(SiloxColors.backgroundPrimary)
            .navigationTitle("Compartir cartera")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cerrar") { dismiss() }
                }
            }
            .task(id: presentation.id) {
                renderedImage = PortfolioShareImageRenderer.image(for: presentation.snapshot, colorScheme: colorScheme)
            }
            .sheet(isPresented: $showingActivity) {
                if let renderedImage {
                    PortfolioActivitySheet(
                        activityItems: [renderedImage],
                        subject: "Mi cartera en Silox"
                    )
                }
            }
        }
    }
}

struct PortfolioActivitySheet: UIViewControllerRepresentable {
    let activityItems: [Any]
    let subject: String

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
        controller.setValue(subject, forKey: "subject")
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

private struct PortfolioShareCard: View {
    let snapshot: PortfolioShareSnapshot
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    private var dailyColor: Color {
        let value = snapshot.dailyGain?.amount.decimalValue ?? Decimal(snapshot.dailyGainPercent ?? 0)
        if value > 0 { return SiloxColors.positive }
        if value < 0 { return SiloxColors.negative }
        return SiloxColors.textPrimary
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 34) {
            header
            summary
            movementSection
            footer
        }
        .padding(64)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(cardBackground, in: RoundedRectangle(cornerRadius: 42, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 42, style: .continuous)
                .stroke(SiloxColors.borderSubtle, lineWidth: 1)
        }
    }

    private var cardBackground: some ShapeStyle {
        if reduceTransparency {
            return AnyShapeStyle(SiloxColors.backgroundSecondary)
        }
        return AnyShapeStyle(
            LinearGradient(
                colors: [SiloxColors.backgroundSecondary, SiloxColors.surfaceElevated],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
    }

    private var header: some View {
        HStack(alignment: .top) {
            HStack(spacing: 14) {
                Image(systemName: "chart.line.uptrend.xyaxis")
                    .font(.system(size: 27, weight: .bold))
                    .foregroundStyle(SiloxColors.textOnAccent)
                    .frame(width: 58, height: 58)
                    .background(SiloxColors.accent, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    Text("SILOX")
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .tracking(1.2)
                    Text("Mi cartera")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(SiloxColors.textSecondary)
                }
            }
            Spacer(minLength: 16)
            Text("HOY")
                .font(.caption.weight(.bold))
                .tracking(1.1)
                .foregroundStyle(SiloxColors.accent)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(SiloxColors.accent.opacity(0.12), in: Capsule())
        }
    }

    private var summary: some View {
        VStack(alignment: .leading, spacing: 13) {
            Text("PATRIMONIO")
                .font(.caption.weight(.bold))
                .tracking(1.35)
                .foregroundStyle(SiloxColors.textSecondary)
            Text(snapshot.totalValueLabel)
                .font(.system(size: 61, weight: .bold, design: .rounded))
                .monospacedDigit()
                .minimumScaleFactor(0.58)
                .lineLimit(1)
                .foregroundStyle(SiloxColors.textPrimary)
            HStack(spacing: 10) {
                Text(snapshot.dailyGainLabel)
                Text(snapshot.dailyGainPercent.map(SiloxFormatters.percentage) ?? "—")
            }
            .font(.title3.weight(.bold))
            .monospacedDigit()
            .foregroundStyle(dailyColor)
            if snapshot.balancesHidden {
                Label("Importes ocultos", systemImage: "eye.slash")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(SiloxColors.textSecondary)
            }
        }
    }

    private var movementSection: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack {
                Text("MOVIMIENTOS DESTACADOS")
                    .font(.caption.weight(.bold))
                    .tracking(1.1)
                    .foregroundStyle(SiloxColors.textSecondary)
                Spacer()
                Text("Sesión de hoy")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(SiloxColors.textTertiary)
            }

            if snapshot.movements.isEmpty {
                Text("Aún no hay movimientos destacados para mostrar.")
                    .font(.subheadline)
                    .foregroundStyle(SiloxColors.textSecondary)
                    .padding(.vertical, 12)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(snapshot.movements.enumerated()), id: \.element.id) { index, movement in
                        ShareMovementRow(
                            rank: index + 1,
                            movement: movement,
                            balancesHidden: snapshot.balancesHidden
                        )
                        if index < snapshot.movements.count - 1 {
                            Divider().overlay(SiloxColors.borderSubtle)
                        }
                    }
                }
                .background(SiloxColors.surfaceMuted.opacity(0.58), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            }
        }
    }

    private var footer: some View {
        HStack {
            Text("Actualizado \(snapshot.updatedAt.formatted(date: .abbreviated, time: .shortened))")
            Spacer()
            Text("silox.app")
                .fontWeight(.semibold)
        }
        .font(.caption)
        .foregroundStyle(SiloxColors.textTertiary)
    }
}

private struct ShareMovementRow: View {
    let rank: Int
    let movement: PortfolioShareSnapshot.Movement
    let balancesHidden: Bool

    private var color: Color {
        let value = movement.dailyAmount?.amount.decimalValue ?? Decimal(movement.dailyPercent ?? 0)
        if value > 0 { return SiloxColors.positive }
        if value < 0 { return SiloxColors.negative }
        return SiloxColors.textSecondary
    }

    var body: some View {
        HStack(spacing: 15) {
            Text("\(rank)")
                .font(.caption.weight(.bold))
                .monospacedDigit()
                .foregroundStyle(SiloxColors.textSecondary)
                .frame(width: 28, height: 28)
                .background(SiloxColors.backgroundSecondary, in: Circle())
            VStack(alignment: .leading, spacing: 3) {
                Text(movement.assetName)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
                Text(movement.ticker)
                    .font(.caption)
                    .foregroundStyle(SiloxColors.textSecondary)
            }
            Spacer(minLength: 12)
            VStack(alignment: .trailing, spacing: 3) {
                if let amount = movement.dailyAmount {
                    Text(balancesHidden ? "••••" : SiloxFormatters.signedMoney(amount.amount, currency: amount.currency))
                }
                Text(movement.dailyPercent.map(SiloxFormatters.percentage) ?? "—")
            }
            .font(.caption.weight(.bold))
            .monospacedDigit()
            .foregroundStyle(color)
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 15)
    }
}

enum PortfolioPositionPresentation {
    static func visiblePositions(
        _ positions: [Position],
        search: String,
        sort: PortfolioPositionSort
    ) -> [Position] {
        let term = search.trimmingCharacters(in: .whitespacesAndNewlines)
        return positions
            .filter { $0.asset.kind != .cash && $0.quantity.decimalValue > 0 }
            .filter { position in
                term.isEmpty
                    || position.asset.displayName.localizedCaseInsensitiveContains(term)
                    || position.asset.name.localizedCaseInsensitiveContains(term)
                    || position.asset.shortLabel.localizedCaseInsensitiveContains(term)
                    || (position.asset.ticker?.localizedCaseInsensitiveContains(term) ?? false)
            }
            .sorted { left, right in
                switch sort {
                case .day:
                    let leftMagnitude = abs(left.dailyChange?.amount.decimalValue ?? Decimal(left.dailyChangePercent ?? 0))
                    let rightMagnitude = abs(right.dailyChange?.amount.decimalValue ?? Decimal(right.dailyChangePercent ?? 0))
                    if leftMagnitude != rightMagnitude { return leftMagnitude > rightMagnitude }
                case .value:
                    let leftValue = left.currentValue.amount.decimalValue
                    let rightValue = right.currentValue.amount.decimalValue
                    if leftValue != rightValue { return leftValue > rightValue }
                }
                return left.id.localizedStandardCompare(right.id) == .orderedAscending
            }
    }
}
