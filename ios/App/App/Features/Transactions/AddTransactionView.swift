import SwiftUI
import UIKit

struct AddTransactionView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let repository: TransactionRepository
    let assetRepository: AssetRepository

    @State private var kind: InvestmentTransaction.Kind = .buy
    @State private var assets: [Asset] = []
    @State private var assetId = ""
    @State private var quantity = ""
    @State private var unitPrice = ""
    @State private var dividendAmount = ""
    @State private var date = Date()
    @State private var didAttemptSave = false
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var presentedSheet: PresentedSheet?
    @State private var idempotencyKey = UUID().uuidString
    @FocusState private var focusedField: FocusField?

    init(repository: TransactionRepository, assetRepository: AssetRepository, preselectedAssetId: String? = nil) {
        self.repository = repository
        self.assetRepository = assetRepository
        _assetId = State(initialValue: preselectedAssetId ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TransactionKindPicker(selection: $kind)
                } header: {
                    Text("¿Qué quieres registrar?")
                } footer: {
                    Text(kind == .dividend
                         ? "Un dividendo entra como efectivo; no compra nuevas acciones."
                         : "Selecciona el tipo de movimiento antes de introducir sus datos.")
                }

                Section("Activo") {
                    if assets.isEmpty {
                        ContentUnavailableView(
                            "No hay activos",
                            systemImage: "chart.line.uptrend.xyaxis",
                            description: Text("Crea tu primer activo para registrar un movimiento.")
                        )
                        Button { presentedSheet = .newAsset } label: {
                            Label("Crear activo", systemImage: "plus")
                        }
                    } else {
                        Button { presentedSheet = .assetPicker } label: {
                            AssetSelectionRow(asset: selectedAsset)
                        }
                        .buttonStyle(.plain)
                        .accessibilityHint("Abre la búsqueda de activos")

                        if didAttemptSave, assetId.isEmpty {
                            validationLabel("Selecciona el activo al que pertenece este movimiento.")
                        }

                        Button { presentedSheet = .newAsset } label: {
                            Label("No encuentro el activo", systemImage: "plus.circle")
                                .font(.subheadline)
                        }
                        .tint(SiloxColors.accent)
                    }
                }

                Section(kind == .dividend ? "Datos del dividendo" : "Datos de la operación") {
                    if isTrade {
                        numericField(
                            "Cantidad",
                            text: $quantity,
                            suffix: "uds.",
                            field: .quantity,
                            helper: "El número de unidades compradas o vendidas."
                        )
                        if didAttemptSave, invalidField == .quantity {
                            validationLabel("Introduce una cantidad mayor que cero.")
                        }

                        numericField(
                            kind == .buy ? "Precio de compra" : "Precio de venta",
                            text: $unitPrice,
                            suffix: selectedAsset?.currency ?? "",
                            field: .unitPrice,
                            helper: "El precio pagado o recibido por cada unidad."
                        )
                    } else {
                        numericField(
                            "Importe del dividendo",
                            text: $dividendAmount,
                            suffix: selectedAsset?.currency ?? "",
                            field: .dividendAmount,
                            helper: "El efectivo recibido por este dividendo."
                        )
                    }

                    if didAttemptSave, invalidField == .unitPrice || invalidField == .dividendAmount {
                        validationLabel(kind == .dividend
                                        ? "Introduce un importe de dividendo mayor que cero."
                                        : "Introduce un precio mayor que cero.")
                    }

                    DatePicker("Fecha", selection: $date, displayedComponents: [.date])
                }

                if let summary = summary {
                    Section("Resumen") {
                        TransactionSummaryView(summary: summary)
                    }
                }

                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(SiloxColors.negative)
                            .accessibilityLabel("Error: \(errorMessage)")
                    }
                }
            }
            .navigationTitle("Nuevo movimiento")
            .navigationBarTitleDisplayMode(.inline)
            .siloxContentBackground()
            .scrollDismissesKeyboard(.interactively)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                primaryAction
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Button("Siguiente") { advanceFocus() }
                        .disabled(focusedField == nil)
                    Spacer()
                    Button("Listo") { focusedField = nil }
                }
            }
            .interactiveDismissDisabled(isSaving)
            .task { await loadAssets() }
            .onChange(of: kind) { _, _ in resetOperationFields() }
            .sheet(item: $presentedSheet) { sheet in
                switch sheet {
                case .newAsset:
                    NewAssetView(repository: assetRepository) { asset in
                        assets.insert(asset, at: 0)
                        assetId = asset.id
                    }
                case .assetPicker:
                    AssetSelectionView(assets: assets, selection: $assetId)
                }
            }
        }
    }

    private var primaryAction: some View {
        Button {
            Task { await save() }
        } label: {
            HStack(spacing: 8) {
                if isSaving { ProgressView().tint(SiloxColors.textOnAccent) }
                Text(isSaving ? "Guardando…" : "Registrar \(kind.title.lowercased())")
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 48)
        }
        .siloxProminentButtonStyle()
        .tint(SiloxColors.accent)
        .disabled(isSaving)
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.ultraThinMaterial)
        .accessibilityHint("Revisa los campos pendientes antes de registrar el movimiento")
    }

    private enum PresentedSheet: String, Identifiable {
        case newAsset, assetPicker
        var id: String { rawValue }
    }

    private enum FocusField: Hashable {
        case quantity, unitPrice, dividendAmount
    }

    private var isTrade: Bool { kind == .buy || kind == .sell }
    private var selectedAsset: Asset? { assets.first(where: { $0.id == assetId }) }
    private var quantityValue: Decimal? { quantity.normalizedDecimal }
    private var unitPriceValue: Decimal? { unitPrice.normalizedDecimal }
    private var amountValue: Decimal? {
        if kind == .dividend { return dividendAmount.normalizedDecimal }
        guard let quantityValue, let unitPriceValue else { return nil }
        return quantityValue * unitPriceValue
    }

    private var invalidField: FocusField? {
        guard !assetId.isEmpty else { return nil }
        if isTrade, (quantityValue ?? 0) <= 0 { return .quantity }
        if kind == .dividend, (amountValue ?? 0) <= 0 { return .dividendAmount }
        if isTrade, (unitPriceValue ?? 0) <= 0 { return .unitPrice }
        return nil
    }

    private var summary: TransactionSummary? {
        guard let amountValue, amountValue > 0 else { return nil }
        let currency = selectedAsset?.currency ?? "EUR"

        if kind == .dividend {
            return TransactionSummary(
                headline: "Recibirás \(formatted(amountValue, currency: currency)) en efectivo",
                details: [
                    ("Dividendo", formatted(amountValue, currency: currency))
                ],
                footnote: "No se añadirán acciones a tu cartera."
            )
        }

        guard let quantityValue, quantityValue > 0 else { return nil }
        let cashImpact = amountValue
        let verb = kind == .buy ? "Saldrán" : "Entrarán"
        return TransactionSummary(
            headline: "\(verb) \(formatted(cashImpact, currency: currency)) de efectivo",
            details: [
                ("Precio por unidad", formatted(unitPriceValue ?? 0, currency: currency)),
                ("Importe total", formatted(amountValue, currency: currency))
            ],
            footnote: "El saldo de efectivo se actualizará automáticamente."
        )
    }

    private func numericField(
        _ title: String,
        text: Binding<String>,
        suffix: String,
        field: FocusField,
        helper: String
    ) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            ViewThatFits(in: .horizontal) {
                HStack {
                    Text(title)
                    Spacer(minLength: 16)
                    numericInput(title, text: text, suffix: suffix, field: field)
                        .frame(maxWidth: 170)
                }
                VStack(alignment: .leading, spacing: 8) {
                    Text(title)
                    numericInput(title, text: text, suffix: suffix, field: field)
                }
            }
            Text(helper)
                .font(.caption2)
                .foregroundStyle(SiloxColors.textSecondary)
                .accessibilityHidden(true)
        }
    }

    private func numericInput(_ title: String, text: Binding<String>, suffix: String, field: FocusField) -> some View {
        HStack(spacing: 8) {
            TextField("0", text: text)
                .keyboardType(.decimalPad)
                .textInputAutocapitalization(.never)
                .multilineTextAlignment(dynamicTypeSize.isAccessibilitySize ? .leading : .trailing)
                .focused($focusedField, equals: field)
                .accessibilityLabel(title)
            if !suffix.isEmpty {
                Text(suffix)
                    .foregroundStyle(SiloxColors.textSecondary)
                    .accessibilityHidden(true)
            }
        }
    }

    private func validationLabel(_ message: String) -> some View {
        Label(message, systemImage: "exclamationmark.circle.fill")
            .font(.caption)
            .foregroundStyle(SiloxColors.negative)
            .accessibilityLabel("Error: \(message)")
    }

    private func formatted(_ value: Decimal, currency: String) -> String {
        value.formatted(.currency(code: currency))
    }

    private func resetOperationFields() {
        quantity = ""
        unitPrice = ""
        dividendAmount = ""
        errorMessage = nil
        didAttemptSave = false
        focusedField = nil
    }

    private func advanceFocus() {
        switch focusedField {
        case .quantity: focusedField = .unitPrice
        case .unitPrice, .dividendAmount, nil: focusedField = nil
        }
    }

    private func loadAssets() async {
        do {
            let loaded = try await assetRepository.list()
            assets = loaded.filter { $0.kind != .cash }
            if assetId.isEmpty, assets.count == 1 { assetId = assets[0].id }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func save() async {
        didAttemptSave = true
        errorMessage = nil
        guard !assetId.isEmpty else {
            errorMessage = "Selecciona un activo antes de continuar."
            return
        }
        guard let invalidField else {
            guard let amountValue else { return }
            isSaving = true
            defer { isSaving = false }
            do {
                _ = try await repository.create(CreateTransactionRequest(
                    kind: kind,
                    assetId: assetId,
                    quantity: isTrade ? NSDecimalNumber(decimal: quantityValue ?? 0).stringValue : nil,
                    amount: NSDecimalNumber(decimal: amountValue).stringValue,
                    commission: "0",
                    sourceWithholding: "0",
                    destinationWithholding: "0",
                    updatesCash: true,
                    occurredAt: date,
                    notes: nil,
                    idempotencyKey: idempotencyKey
                ))
                UINotificationFeedbackGenerator().notificationOccurred(.success)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            return
        }

        focusedField = invalidField
    }
}

private struct TransactionKindPicker: View {
    @Binding var selection: InvestmentTransaction.Kind

    private let options: [(kind: InvestmentTransaction.Kind, icon: String, title: String)] = [
        (.buy, "arrow.down.circle.fill", "Comprar"),
        (.sell, "arrow.up.circle.fill", "Vender"),
        (.dividend, "banknote.fill", "Dividendo")
    ]

    var body: some View {
        HStack(spacing: 8) {
            choices
        }
    }

    @ViewBuilder private var choices: some View {
        ForEach(options, id: \.kind) { option in
            Button {
                selection = option.kind
            } label: {
                VStack(spacing: 5) {
                    Image(systemName: option.icon)
                        .imageScale(.medium)
                    Text(option.title)
                        .font(.footnote.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.78)
                        .allowsTightening(true)
                }
                .frame(maxWidth: .infinity)
                    .frame(minHeight: 62)
                    .foregroundStyle(selection == option.kind ? SiloxColors.textOnAccent : SiloxColors.textPrimary)
                    .background(selection == option.kind ? SiloxColors.accent : SiloxColors.backgroundSecondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay {
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(selection == option.kind ? Color.clear : SiloxColors.borderSubtle, lineWidth: 0.75)
                    }
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("transaction-kind-\(option.kind.rawValue)")
            .accessibilityAddTraits(selection == option.kind ? .isSelected : [])
        }
    }
}

private struct AssetSelectionRow: View {
    let asset: Asset?

    var body: some View {
        HStack(spacing: 12) {
            if let asset {
                SiloxAssetMark(asset: asset, size: 38)
                VStack(alignment: .leading, spacing: 2) {
                    Text(asset.displayName)
                        .font(.headline)
                        .foregroundStyle(SiloxColors.textPrimary)
                    Text(asset.metadataLabel)
                        .font(.caption)
                        .foregroundStyle(SiloxColors.textSecondary)
                        .lineLimit(1)
                }
            } else {
                Image(systemName: "magnifyingglass")
                    .frame(width: 38, height: 38)
                    .foregroundStyle(SiloxColors.accent)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Buscar activo")
                        .font(.headline)
                        .foregroundStyle(SiloxColors.textPrimary)
                    Text("Acción, ETF, fondo o criptomoneda")
                        .font(.caption)
                        .foregroundStyle(SiloxColors.textSecondary)
                }
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(SiloxColors.textTertiary)
        }
        .contentShape(Rectangle())
    }
}

private struct TransactionSummary {
    let headline: String
    let details: [(String, String)]
    let footnote: String
}

private struct TransactionSummaryView: View {
    let summary: TransactionSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(summary.headline)
                .font(.headline)
                .foregroundStyle(SiloxColors.textPrimary)
                .monospacedDigit()
            ForEach(Array(summary.details.enumerated()), id: \.offset) { _, item in
                LabeledContent(item.0) {
                    Text(item.1)
                        .monospacedDigit()
                        .foregroundStyle(SiloxColors.textSecondary)
                }
            }
            Label(summary.footnote, systemImage: "banknote")
                .font(.caption)
                .foregroundStyle(SiloxColors.textSecondary)
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
    }
}

private struct AssetSelectionView: View {
    @Environment(\.dismiss) private var dismiss
    let assets: [Asset]
    @Binding var selection: String
    @State private var query = ""
    @State private var isSearchPresented = false

    private var visibleAssets: [Asset] {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return assets
            .filter {
                term.isEmpty
                    || $0.displayName.localizedCaseInsensitiveContains(term)
                    || $0.metadataLabel.localizedCaseInsensitiveContains(term)
            }
            .sorted {
                if $0.id == selection { return true }
                if $1.id == selection { return false }
                return $0.displayName.localizedStandardCompare($1.displayName) == .orderedAscending
            }
    }

    var body: some View {
        NavigationStack {
            List(visibleAssets) { asset in
                Button {
                    selection = asset.id
                    dismiss()
                } label: {
                    HStack(spacing: 12) {
                        SiloxAssetMark(asset: asset, size: 38)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(asset.displayName).font(.headline).foregroundStyle(SiloxColors.textPrimary)
                            Text(asset.metadataLabel).font(.caption).foregroundStyle(SiloxColors.textSecondary).lineLimit(1)
                        }
                        Spacer()
                        if selection == asset.id {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(SiloxColors.accent)
                        }
                    }
                }
                .buttonStyle(.plain)
            }
            .overlay {
                if visibleAssets.isEmpty {
                    ContentUnavailableView("No se han encontrado activos", systemImage: "magnifyingglass", description: Text("Prueba con el nombre o el símbolo."))
                }
            }
            .siloxContentBackground()
            .navigationTitle("Buscar activo")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, isPresented: $isSearchPresented, prompt: "Nombre o símbolo")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cerrar") { dismiss() } } }
            .task { isSearchPresented = true }
        }
    }
}

private struct NewAssetView: View {
    @Environment(\.dismiss) private var dismiss
    let repository: AssetRepository
    let onCreated: (Asset) -> Void
    @State private var ticker = ""
    @State private var name = ""
    @State private var type = "Acción"
    @AppStorage("defaultCurrency") private var currency = "EUR"
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Activo") {
                    TextField("Ticker", text: $ticker).textInputAutocapitalization(.characters)
                    TextField("Nombre (opcional)", text: $name)
                    Picker("Tipo", selection: $type) {
                        ForEach(["Acción", "ETF", "Fondo", "Criptomoneda", "Metal"], id: \.self) { Text($0) }
                    }
                    Picker("Moneda", selection: $currency) {
                        ForEach(["EUR", "USD", "GBP", "CHF"], id: \.self) { Text($0) }
                    }
                }
                if let errorMessage { Section { Text(errorMessage).foregroundStyle(SiloxColors.negative) } }
            }
            .siloxContentBackground()
            .navigationTitle("Nuevo activo")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Crear") { Task { await create() } }.disabled(ticker.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }
            }
        }
    }

    private func create() async {
        isSaving = true
        defer { isSaving = false }
        do {
            let asset = try await repository.create(ticker: ticker, name: name, type: type, currency: currency)
            onCreated(asset)
            dismiss()
        } catch { errorMessage = error.localizedDescription }
    }
}
