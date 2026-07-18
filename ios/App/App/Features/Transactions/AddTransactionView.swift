import SwiftUI

struct AddTransactionView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    let repository: TransactionRepository
    let assetRepository: AssetRepository
    @State private var kind: InvestmentTransaction.Kind = .buy
    @State private var assets: [Asset] = []
    @State private var assetId = ""
    @State private var quantity = ""
    @State private var executionPrice = ""
    @State private var cashAmount = ""
    @State private var commission = "0"
    @State private var sourceWithholding = "0"
    @State private var destinationWithholding = "0"
    @State private var date = Date()
    @State private var notes = ""
    @State private var updatesCash = true
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var presentedSheet: PresentedSheet?
    @State private var idempotencyKey = UUID().uuidString

    init(repository: TransactionRepository, assetRepository: AssetRepository, preselectedAssetId: String? = nil) {
        self.repository = repository
        self.assetRepository = assetRepository
        _assetId = State(initialValue: preselectedAssetId ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Operación") {
                    Picker("Tipo", selection: $kind) {
                        Text("Compra").tag(InvestmentTransaction.Kind.buy)
                        Text("Venta").tag(InvestmentTransaction.Kind.sell)
                    }
                    .pickerStyle(.segmented)

                    Menu {
                        Button("Dividendo") { kind = .dividend }
                        Button("Retirada") { kind = .withdrawal }
                        if !isTrade { Button("Volver a compra") { kind = .buy } }
                    } label: {
                        Label(isTrade ? "Otros movimientos" : kind.title, systemImage: "ellipsis.circle")
                            .font(.subheadline)
                    }
                }

                Section("Activo") {
                    if assets.isEmpty {
                        ContentUnavailableView(
                            "No hay activos",
                            systemImage: "chart.line.uptrend.xyaxis",
                            description: Text("Crea el primer activo antes de guardar el movimiento.")
                        )
                    } else {
                        Button { presentedSheet = .assetPicker } label: {
                            HStack(spacing: 12) {
                                if let selectedAsset {
                                    SiloxAssetMark(asset: selectedAsset, size: 38)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(selectedAsset.displayName).font(.headline).foregroundStyle(.primary)
                                        Text(selectedAsset.metadataLabel).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                                    }
                                } else {
                                    Image(systemName: "magnifyingglass").frame(width: 38, height: 38)
                                    Text("Seleccionar activo").foregroundStyle(.primary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
                            }
                        }
                        .buttonStyle(.plain)
                    }
                    Button { presentedSheet = .newAsset } label: { Label("Crear activo", systemImage: "plus") }
                }

                Section(isTrade ? "Ejecución" : "Importe") {
                    if isTrade {
                        numericField("Cantidad", text: $quantity, suffix: "uds.")
                        numericField("Precio de ejecución", text: $executionPrice, suffix: selectedAsset?.currency ?? "")
                    } else {
                        numericField("Importe", text: $cashAmount, suffix: selectedAsset?.currency ?? "")
                    }
                    numericField("Comisiones pagadas", text: $commission, suffix: selectedAsset?.currency ?? "")

                    if kind == .dividend {
                        numericField("Retención en origen", text: $sourceWithholding, suffix: selectedAsset?.currency ?? "")
                        numericField("Retención en destino", text: $destinationWithholding, suffix: selectedAsset?.currency ?? "")

                        if let netDividend {
                            LabeledContent("Neto en efectivo") {
                                Text(netDividend.formatted(.currency(code: selectedAsset?.currency ?? "EUR")))
                                    .font(.headline)
                                    .monospacedDigit()
                            }
                            Label(
                                "Se abonará en la cuenta de efectivo en \(selectedAsset?.currency ?? "EUR"); no se convertirá en acciones.",
                                systemImage: "banknote"
                            )
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        }
                    }

                    if isTrade, let total = calculatedTotal {
                        LabeledContent("Total de la operación") {
                            Text(total.formatted(.currency(code: selectedAsset?.currency ?? "EUR")))
                                .font(.headline)
                                .monospacedDigit()
                        }
                    }

                    if isTrade {
                        Toggle("Actualizar saldo de efectivo", isOn: $updatesCash)
                        Label(
                            updatesCash
                                ? "La operación actualizará automáticamente la cuenta de efectivo en \(selectedAsset?.currency ?? "la moneda del activo")."
                                : "Úsalo cuando el saldo ya se haya registrado mediante una importación u otra cuenta.",
                            systemImage: updatesCash ? "banknote.fill" : "banknote"
                        )
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                }

                Section("Detalles") {
                    DatePicker("Fecha de ejecución", selection: $date, displayedComponents: [.date])
                    TextField("Notas opcionales", text: $notes, axis: .vertical)
                        .lineLimit(2...4)
                }

                if let errorMessage {
                    Section { Label(errorMessage, systemImage: "exclamationmark.triangle.fill").foregroundStyle(SiloxColors.negative) }
                }
            }
            .navigationTitle("Añadir movimiento")
            .navigationBarTitleDisplayMode(.inline)
            .scrollContentBackground(.hidden)
            .background(SiloxColors.background)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") { Task { await save() } }.disabled(!canSave || isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
            .task { await loadAssets() }
            .sheet(item: $presentedSheet) { sheet in
                Group {
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
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationCornerRadius(28)
            }
        }
    }

    private enum PresentedSheet: String, Identifiable {
        case newAsset, assetPicker
        var id: String { rawValue }
    }

    private var isTrade: Bool { kind == .buy || kind == .sell }
    private var selectedAsset: Asset? { assets.first(where: { $0.id == assetId }) }
    private var calculatedTotal: Decimal? {
        guard let quantity = quantity.normalizedDecimal, quantity > 0,
              let price = executionPrice.normalizedDecimal, price > 0 else { return nil }
        return quantity * price
    }
    private var netDividend: Decimal? {
        guard kind == .dividend,
              let gross = cashAmount.normalizedDecimal,
              let fee = commission.normalizedDecimal,
              let sourceTax = sourceWithholding.normalizedDecimal,
              let destinationTax = destinationWithholding.normalizedDecimal else { return nil }
        return gross - fee - sourceTax - destinationTax
    }
    private var canSave: Bool {
        !assetId.isEmpty && (isTrade ? calculatedTotal != nil : (cashAmount.normalizedDecimal ?? 0) > 0)
    }

    private func numericField(_ title: String, text: Binding<String>, suffix: String) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack {
                Text(title)
                Spacer(minLength: 16)
                numericInput(title, text: text, suffix: suffix)
                    .frame(maxWidth: 150)
            }
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                numericInput(title, text: text, suffix: suffix)
            }
        }
    }

    private func numericInput(_ title: String, text: Binding<String>, suffix: String) -> some View {
        HStack(spacing: 8) {
            TextField("0", text: text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(dynamicTypeSize.isAccessibilitySize ? .leading : .trailing)
                .accessibilityLabel(title)
            if !suffix.isEmpty { Text(suffix).foregroundStyle(.secondary) }
        }
    }

    private func loadAssets() async {
        do {
            let loaded = try await assetRepository.list()
            assets = loaded.filter { $0.kind != .cash }
            if assetId.isEmpty, assets.count == 1 { assetId = assets[0].id }
        } catch { errorMessage = error.localizedDescription }
    }

    private func save() async {
        let operationAmount: Decimal
        if isTrade {
            guard let total = calculatedTotal else { errorMessage = "Revisa la cantidad y el precio de ejecución."; return }
            operationAmount = total
        } else {
            guard let parsed = cashAmount.normalizedDecimal, parsed > 0 else { errorMessage = "Introduce un importe válido."; return }
            operationAmount = parsed
        }
        guard let parsedCommission = commission.normalizedDecimal, parsedCommission >= 0 else {
            errorMessage = "Introduce una comisión válida."; return
        }
        guard let parsedSourceWithholding = sourceWithholding.normalizedDecimal, parsedSourceWithholding >= 0,
              let parsedDestinationWithholding = destinationWithholding.normalizedDecimal, parsedDestinationWithholding >= 0 else {
            errorMessage = "Introduce unas retenciones válidas."; return
        }
        if kind == .sell, parsedCommission >= operationAmount {
            errorMessage = "La comisión debe ser menor que el importe de la venta."; return
        }
        if kind == .dividend,
           operationAmount - parsedCommission - parsedSourceWithholding - parsedDestinationWithholding <= 0 {
            errorMessage = "Las comisiones y retenciones deben ser menores que el dividendo bruto."; return
        }
        isSaving = true
        defer { isSaving = false }
        do {
            _ = try await repository.create(CreateTransactionRequest(
                kind: kind,
                assetId: assetId.isEmpty ? nil : assetId,
                quantity: isTrade ? NSDecimalNumber(decimal: quantity.normalizedDecimal ?? 0).stringValue : nil,
                amount: NSDecimalNumber(decimal: operationAmount).stringValue,
                commission: NSDecimalNumber(decimal: parsedCommission).stringValue,
                sourceWithholding: NSDecimalNumber(decimal: parsedSourceWithholding).stringValue,
                destinationWithholding: NSDecimalNumber(decimal: parsedDestinationWithholding).stringValue,
                updatesCash: kind == .dividend || (isTrade && updatesCash),
                occurredAt: date,
                notes: notes.isEmpty ? nil : notes,
                idempotencyKey: idempotencyKey
            ))
            dismiss()
        } catch { errorMessage = error.localizedDescription }
    }
}

private struct AssetSelectionView: View {
    @Environment(\.dismiss) private var dismiss
    let assets: [Asset]
    @Binding var selection: String
    @State private var query = ""

    private var visibleAssets: [Asset] {
        let term = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return assets
            .filter {
                term.isEmpty
                    || $0.displayName.localizedCaseInsensitiveContains(term)
                    || $0.metadataLabel.localizedCaseInsensitiveContains(term)
            }
            .sorted {
                $0.displayName.localizedStandardCompare($1.displayName) == .orderedAscending
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
                            Text(asset.displayName).font(.headline).foregroundStyle(.primary)
                            Text(asset.metadataLabel).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                        }
                        Spacer()
                        if selection == asset.id { Image(systemName: "checkmark.circle.fill").foregroundStyle(SiloxColors.accent) }
                    }
                }
                .buttonStyle(.plain)
            }
            .scrollContentBackground(.hidden)
            .background(SiloxColors.background)
            .navigationTitle("Seleccionar activo")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, prompt: "Nombre o símbolo")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cerrar") { dismiss() } } }
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
                if let errorMessage { Section { Text(errorMessage).foregroundStyle(.red) } }
            }
            .scrollContentBackground(.hidden)
            .background(SiloxColors.background)
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
