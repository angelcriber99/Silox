import re
import sys

path = "ios/App/App/Features/Portfolio/PortfolioSharing.swift"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update PortfolioShareSnapshot struct properties
content = content.replace(
    "let balancesHidden: Bool",
    "let showTotalValue: Bool\n    let showPositions: Bool\n    let showAssetValues: Bool"
)

# 2. Update init
content = content.replace(
    "init(portfolio: PortfolioResponse, balancesHidden: Bool) {",
    "init(portfolio: PortfolioResponse, showTotalValue: Bool, showPositions: Bool, showAssetValues: Bool) {"
)
content = content.replace(
    "self.balancesHidden = balancesHidden",
    "self.showTotalValue = showTotalValue\n        self.showPositions = showPositions\n        self.showAssetValues = showAssetValues"
)

# 3. Update movements logic in init
content = content.replace(
    "movements = portfolio.positions",
    "if showPositions {\n            movements = portfolio.positions"
)
content = content.replace(
    ".map { $0 }",
    ".map { $0 }\n        } else {\n            movements = []\n        }"
)

# 4. Update labels
content = content.replace(
    "balancesHidden ? \"••••••\" : SiloxFormatters.money(totalValue.amount, currency: totalValue.currency)",
    "showTotalValue ? SiloxFormatters.money(totalValue.amount, currency: totalValue.currency) : \"••••••\""
)
content = content.replace(
    "balancesHidden ? \"••••\" : dailyGain.map { SiloxFormatters.signedMoney($0.amount, currency: $0.currency) } ?? \"—\"",
    "showTotalValue ? (dailyGain.map { SiloxFormatters.signedMoney($0.amount, currency: $0.currency) } ?? \"—\") : \"••••\""
)

# 5. Update PortfolioSharePresentation
content = content.replace(
    "let snapshot: PortfolioShareSnapshot",
    "let portfolio: PortfolioResponse\n    let initialBalancesHidden: Bool"
)

# 6. Update PortfolioSharePreviewSheet
old_sheet_start = "struct PortfolioSharePreviewSheet: View {"
old_sheet_end = "        }\n    }\n}"

new_sheet = """struct PortfolioSharePreviewSheet: View {
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
}"""

content = re.sub(r'(?s)struct PortfolioSharePreviewSheet: View \{.*?\n    \}\n\}', new_sheet, content)

# 7. Update PortfolioShareCard summary section
old_summary_regex = r'(?s)private var summary: some View \{\n.*?\n        \}'
new_summary = """private var summary: some View {
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
    }"""
content = re.sub(old_summary_regex, new_summary, content)

# 8. Update PortfolioShareCard movementSection
old_movement_regex = r'(?s)private var movementSection: some View \{.*?        \}'
new_movement = """@ViewBuilder
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
                        ForEach(Array(snapshot.movements.enumerated()), id: \.element.id) { index, movement in
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
    }"""
content = re.sub(old_movement_regex, new_movement, content)

# 9. Update ShareMovementRow
content = content.replace("let balancesHidden: Bool", "let showAssetValues: Bool")
content = content.replace(
    "if let amount = movement.dailyAmount {\n                    Text(balancesHidden ? \"••••\" : SiloxFormatters.signedMoney(amount.amount, currency: amount.currency))\n                }",
    "if let amount = movement.dailyAmount, showAssetValues {\n                    Text(SiloxFormatters.signedMoney(amount.amount, currency: amount.currency))\n                }"
)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Updated PortfolioSharing.swift")
