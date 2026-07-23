import Foundation

let path = "ios/App/App/Features/Portfolio/PortfolioSharing.swift"
var content = try String(contentsOfFile: path, encoding: .utf8)

// 1. Update PortfolioShareSnapshot struct properties
content = content.replacingOccurrences(
    of: "let balancesHidden: Bool",
    with: "let showTotalValue: Bool\n    let showPositions: Bool\n    let showAssetValues: Bool"
)

// 2. Update init
content = content.replacingOccurrences(
    of: "init(portfolio: PortfolioResponse, balancesHidden: Bool) {",
    with: "init(portfolio: PortfolioResponse, showTotalValue: Bool, showPositions: Bool, showAssetValues: Bool) {"
)
content = content.replacingOccurrences(
    of: "self.balancesHidden = balancesHidden",
    with: "self.showTotalValue = showTotalValue\n        self.showPositions = showPositions\n        self.showAssetValues = showAssetValues"
)

// 3. Update movements logic in init
content = content.replacingOccurrences(
    of: "movements = portfolio.positions",
    with: "if showPositions {\n            movements = portfolio.positions"
)
content = content.replacingOccurrences(
    of: ".map { $0 }",
    with: ".map { $0 }\n        } else {\n            movements = []\n        }"
)

// 4. Update labels
content = content.replacingOccurrences(
    of: "balancesHidden ? \"••••••\" : SiloxFormatters.money(totalValue.amount, currency: totalValue.currency)",
    with: "showTotalValue ? SiloxFormatters.money(totalValue.amount, currency: totalValue.currency) : \"••••••\""
)
content = content.replacingOccurrences(
    of: "balancesHidden ? \"••••\" : dailyGain.map { SiloxFormatters.signedMoney($0.amount, currency: $0.currency) } ?? \"—\"",
    with: "showTotalValue ? (dailyGain.map { SiloxFormatters.signedMoney($0.amount, currency: $0.currency) } ?? \"—\") : \"••••\""
)

// 5. Update PortfolioSharePresentation
content = content.replacingOccurrences(
    of: "let snapshot: PortfolioShareSnapshot",
    with: "let portfolio: PortfolioResponse\n    let initialBalancesHidden: Bool"
)

// 6. Update PortfolioSharePreviewSheet
let oldSheetStart = "struct PortfolioSharePreviewSheet: View {"
let oldSheetEnd = "        }\n    }\n}"

let newSheet = """
struct PortfolioSharePreviewSheet: View {
    let presentation: PortfolioSharePresentation
    @Environment(\\.dismiss) private var dismiss
    @Environment(\\.colorScheme) private var colorScheme
    @Environment(\\.accessibilityReduceMotion) private var reduceMotion
    @State private var renderedImage: UIImage?
    @State private var showingActivity = false

    @State private var showTotalValue: Bool
    @State private var showPositions: Bool
    @State private var showAssetValues: Bool

    init(presentation: PortfolioSharePresentation) {
        self.presentation = presentation
        _showTotalValue = State(initialValue: !presentation.initialBalancesHidden)
        _showPositions = State(initialValue: true)
        _showAssetValues = State(initialValue: !presentation.initialBalancesHidden)
    }

    private var currentSnapshot: PortfolioShareSnapshot {
        PortfolioShareSnapshot(
            portfolio: presentation.portfolio,
            showTotalValue: showTotalValue,
            showPositions: showPositions,
            showAssetValues: showAssetValues
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    PortfolioShareCard(snapshot: currentSnapshot)
                        .frame(maxWidth: 540)
                        .scaleEffect(reduceMotion ? 1 : 0.985)
                        .animation(reduceMotion ? nil : .snappy(duration: 0.32, extraBounce: 0.08), value: renderedImage != nil)
                        .accessibilityLabel("Tarjeta para compartir del patrimonio")
                        .onChange(of: showTotalValue) { _ in renderImage() }
                        .onChange(of: showPositions) { _ in renderImage() }
                        .onChange(of: showAssetValues) { _ in renderImage() }

                    VStack(alignment: .leading, spacing: 6) {
                        Text(presentation.originatedFromScreenshot ? "Tu captura está lista para compartir" : "Comparte una tarjeta, no una captura")
                            .font(.headline)
                        Text("Personaliza los datos que quieres incluir en la imagen.")
                            .font(.subheadline)
                            .foregroundStyle(SiloxColors.textSecondary)
                    }
                    .frame(maxWidth: 540, alignment: .leading)

                    VStack(spacing: 12) {
                        Toggle("Mostrar Patrimonio (Dinero)", isOn: $showTotalValue)
                            .tint(SiloxColors.accent)
                        Toggle("Incluir lista de activos", isOn: $showPositions)
                            .tint(SiloxColors.accent)
                        if showPositions {
                            Toggle("Mostrar importe individual de activos", isOn: $showAssetValues)
                                .tint(SiloxColors.accent)
                        }
                    }
                    .frame(maxWidth: 540)
                    .padding(.vertical, 10)

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
                renderImage()
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

    private func renderImage() {
        renderedImage = PortfolioShareImageRenderer.image(for: currentSnapshot, colorScheme: colorScheme)
    }
}
"""

if let range = content.range(of: "(?s)struct PortfolioSharePreviewSheet: View \\{.*?\\n    \\}\n\\}", options: .regularExpression) {
    content.replaceSubrange(range, with: newSheet)
} else {
    print("Could not find PortfolioSharePreviewSheet")
}

// 7. Update PortfolioShareCard summary section
let oldSummaryRegex = "(?s)private var summary: some View \\{\\n.*?\\n        \\}"
let newSummary = """
    private var summary: some View {
        VStack(alignment: .leading, spacing: 13) {
            Text(snapshot.showTotalValue ? "PATRIMONIO" : "RENTABILIDAD")
                .font(.caption.weight(.bold))
                .tracking(1.35)
                .foregroundStyle(SiloxColors.textSecondary)
            
            if snapshot.showTotalValue {
                Text(snapshot.totalValueLabel)
                    .font(.system(size: 61, weight: .bold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.58)
                    .lineLimit(1)
                    .foregroundStyle(SiloxColors.textPrimary)
            }
            
            HStack(spacing: 10) {
                if snapshot.showTotalValue {
                    Text(snapshot.dailyGainLabel)
                }
                Text(snapshot.dailyGainPercent.map(SiloxFormatters.percentage) ?? "—")
            }
            .font(snapshot.showTotalValue ? .title3.weight(.bold) : .system(size: 44, weight: .bold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(dailyColor)
        }
    }
"""
if let range = content.range(of: oldSummaryRegex, options: .regularExpression) {
    content.replaceSubrange(range, with: newSummary)
} else {
    print("Could not find summary")
}


// 8. Update PortfolioShareCard movementSection
let oldMovementRegex = "(?s)private var movementSection: some View \\{.*?        \\}"
let newMovement = """
    @ViewBuilder
    private var movementSection: some View {
        if snapshot.showPositions {
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
                        ForEach(Array(snapshot.movements.enumerated()), id: \\.element.id) { index, movement in
                            ShareMovementRow(
                                rank: index + 1,
                                movement: movement,
                                showAssetValues: snapshot.showAssetValues
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
    }
"""
if let range = content.range(of: oldMovementRegex, options: .regularExpression) {
    content.replaceSubrange(range, with: newMovement)
} else {
    print("Could not find movementSection")
}


// 9. Update ShareMovementRow
content = content.replacingOccurrences(
    of: "let balancesHidden: Bool",
    with: "let showAssetValues: Bool"
)
content = content.replacingOccurrences(
    of: "if let amount = movement.dailyAmount {\n                    Text(balancesHidden ? \"••••\" : SiloxFormatters.signedMoney(amount.amount, currency: amount.currency))\n                }",
    with: "if let amount = movement.dailyAmount, showAssetValues {\n                    Text(SiloxFormatters.signedMoney(amount.amount, currency: amount.currency))\n                }"
)


try content.write(toFile: path, atomically: true, encoding: .utf8)
print("Updated PortfolioSharing.swift")
