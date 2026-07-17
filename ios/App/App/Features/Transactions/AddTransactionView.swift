import SwiftUI

struct AddTransactionView: View {
    @Environment(\.dismiss) private var dismiss
    let repository: TransactionRepository
    let assetRepository: AssetRepository
    @State private var kind: InvestmentTransaction.Kind = .buy
    @State private var assets: [Asset] = []
    @State private var assetId = ""
    @State private var quantity = ""
    @State private var amount = ""
    @State private var commission = "0"
    @State private var updatesCash = true
    @State private var date = Date()
    @State private var notes = ""
    @State private var isSaving = false
    @State private var errorMessage: String?
    @State private var showsNewAsset = false
    @State private var idempotencyKey = UUID().uuidString

    var body: some View {
        NavigationStack {
            Form {
                Section("Operación") {
                    Picker("Tipo", selection: $kind) {
                        ForEach([InvestmentTransaction.Kind.buy, .sell, .dividend, .withdrawal], id: \.self) { Text($0.title).tag($0) }
                    }
                    if assets.isEmpty {
                        ContentUnavailableView(
                            "No hay activos",
                            systemImage: "chart.line.uptrend.xyaxis",
                            description: Text("Crea el primer activo antes de guardar el movimiento.")
                        )
                    } else {
                        Picker("Activo", selection: $assetId) {
                            Text("Selecciona un activo").tag("")
                            ForEach(assets) { asset in
                                Text("\(asset.ticker ?? asset.name) · \(asset.name)").tag(asset.id)
                            }
                        }
                    }
                    Button("Crear activo") { showsNewAsset = true }
                    TextField("Cantidad", text: $quantity).keyboardType(.decimalPad)
                    TextField("Importe total", text: $amount).keyboardType(.decimalPad)
                    TextField("Comisión", text: $commission).keyboardType(.decimalPad)
                    if kind == .buy || kind == .sell {
                        Toggle("Actualizar saldo de liquidez", isOn: $updatesCash)
                    }
                    DatePicker("Fecha", selection: $date)
                    TextField("Notas", text: $notes, axis: .vertical)
                }
                if let errorMessage { Section { Text(errorMessage).foregroundStyle(.red) } }
            }
            .navigationTitle("Añadir movimiento")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancelar") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") { Task { await save() } }.disabled(assetId.isEmpty || amount.isEmpty || isSaving)
                }
            }
            .interactiveDismissDisabled(isSaving)
            .task { await loadAssets() }
            .sheet(isPresented: $showsNewAsset) {
                NewAssetView(repository: assetRepository) { asset in
                    assets.insert(asset, at: 0)
                    assetId = asset.id
                }
            }
        }
    }

    private func loadAssets() async {
        do {
            assets = try await assetRepository.list()
            if assetId.isEmpty, assets.count == 1 { assetId = assets[0].id }
        } catch { errorMessage = error.localizedDescription }
    }

    private func save() async {
        guard Decimal(string: amount) != nil else { errorMessage = "Introduce un importe válido."; return }
        if kind == .buy || kind == .sell {
            guard let parsed = Decimal(string: quantity), parsed > 0 else { errorMessage = "Introduce una cantidad mayor que cero."; return }
        } else if !quantity.isEmpty, Decimal(string: quantity) == nil {
            errorMessage = "Introduce una cantidad válida."; return
        }
        guard let parsedCommission = Decimal(string: commission), parsedCommission >= 0 else {
            errorMessage = "Introduce una comisión válida."; return
        }
        if kind == .sell, let parsedAmount = Decimal(string: amount), parsedCommission >= parsedAmount {
            errorMessage = "La comisión debe ser menor que el importe de la venta."; return
        }
        isSaving = true
        defer { isSaving = false }
        do {
            _ = try await repository.create(CreateTransactionRequest(
                kind: kind,
                assetId: assetId.isEmpty ? nil : assetId,
                quantity: quantity.isEmpty ? nil : quantity,
                amount: amount,
                commission: commission,
                updatesCash: updatesCash,
                occurredAt: date,
                notes: notes.isEmpty ? nil : notes,
                idempotencyKey: idempotencyKey
            ))
            dismiss()
        } catch { errorMessage = error.localizedDescription }
    }
}

private struct NewAssetView: View {
    @Environment(\.dismiss) private var dismiss
    let repository: AssetRepository
    let onCreated: (Asset) -> Void
    @State private var ticker = ""
    @State private var name = ""
    @State private var type = "Acción"
    @State private var currency = "EUR"
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Activo") {
                    TextField("Ticker", text: $ticker).textInputAutocapitalization(.characters)
                    TextField("Nombre (opcional)", text: $name)
                    Picker("Tipo", selection: $type) {
                        ForEach(["Acción", "ETF", "Fondo", "Criptomoneda", "Metal", "Liquidez"], id: \.self) { Text($0) }
                    }
                    Picker("Moneda", selection: $currency) {
                        ForEach(["EUR", "USD", "GBP", "CHF"], id: \.self) { Text($0) }
                    }
                }
                if let errorMessage { Section { Text(errorMessage).foregroundStyle(.red) } }
            }
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
