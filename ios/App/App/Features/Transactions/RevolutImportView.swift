import SwiftUI
import UniformTypeIdentifiers

struct RevolutImportView: View {
    let repository: RevolutImportRepository
    @State private var showsImporter = false
    @State private var fileName: String?
    @State private var result: RevolutDirectImportResult?
    @State private var isWorking = false
    @State private var errorMessage: String?

    var body: some View {
        Form {
            Section {
                Button {
                    showsImporter = true
                } label: {
                    Label(fileName ?? "Seleccionar extracto", systemImage: "doc.badge.plus")
                }
                .disabled(isWorking)
            } header: {
                Text("Revolut o MyInvestor")
            } footer: {
                Text("Al seleccionar el archivo se importará con las mismas reglas FIFO, dividendos, staking, recompensas, comisiones e impuestos que la aplicación web. Los duplicados se omiten.")
            }

            if isWorking {
                Section { ProgressView("Importando movimientos…") }
            }

            if let result {
                Section("Importación completada") {
                    Label("\(result.importedCount) movimientos nuevos", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(SiloxColors.positive)
                    if result.updatedCount > 0 {
                        LabeledContent("Actualizados", value: String(result.updatedCount))
                    }
                    if result.ignoredDuplicates > 0 {
                        LabeledContent("Duplicados omitidos", value: String(result.ignoredDuplicates))
                    }
                    if result.accountingMovements > 0 {
                        LabeledContent("Movimientos de efectivo", value: String(result.accountingMovements))
                    }
                    if result.skippedCount > 0 {
                        Label("\(result.skippedCount) filas requieren revisión", systemImage: "exclamationmark.triangle")
                            .foregroundStyle(SiloxColors.warning)
                    }
                }
            }

            if let errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(SiloxColors.negative)
                }
            }
        }
        .navigationTitle("Importar extracto")
        .navigationBarTitleDisplayMode(.inline)
        .fileImporter(
            isPresented: $showsImporter,
            allowedContentTypes: [.commaSeparatedText, .plainText, .spreadsheet],
            allowsMultipleSelection: false
        ) { selection in
            Task { await handle(selection) }
        }
    }

    private func handle(_ selection: Result<[URL], Error>) async {
        isWorking = true
        errorMessage = nil
        result = nil
        defer { isWorking = false }

        do {
            guard let url = try selection.get().first else { return }
            let accessing = url.startAccessingSecurityScopedResource()
            defer { if accessing { url.stopAccessingSecurityScopedResource() } }
            let data = try Data(contentsOf: url, options: .mappedIfSafe)
            guard data.count <= 10 * 1_024 * 1_024 else { throw ImportViewError.fileTooLarge }
            fileName = url.lastPathComponent
            let mimeType = url.pathExtension.lowercased() == "xlsx"
                ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : "text/csv"
            result = try await repository.importStatement(
                fileData: data,
                fileName: url.lastPathComponent,
                mimeType: mimeType
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private enum ImportViewError: LocalizedError {
    case fileTooLarge
    var errorDescription: String? { "El archivo supera el límite de 10 MB." }
}
