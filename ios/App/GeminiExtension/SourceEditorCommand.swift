import Foundation
import XcodeKit

class SourceEditorCommand: NSObject, XCSourceEditorCommand {
    
    func perform(with invocation: XCSourceEditorCommandInvocation, completionHandler: @escaping (Error?) -> Void ) -> Void {
        
        // 1. Extraer el texto seleccionado en Xcode
        guard let selection = invocation.buffer.selections.firstObject as? XCSourceTextRange else {
            completionHandler(nil)
            return
        }
        
        var selectedText = ""
        for lineIndex in selection.start.line...selection.end.line {
            if let line = invocation.buffer.lines[lineIndex] as? String {
                selectedText += line
            }
        }
        
        if selectedText.isEmpty {
            completionHandler(nil)
            return
        }
        
        // 2. Configurar la llamada HTTP a Gemini
        // Pega aquí tu clave de API (la que termina en ...rFkQ)
        let apiKey = "TU_CLAVE_API_AQUI"
        let urlString = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=\(apiKey)"
        
        guard let url = URL(string: urlString) else {
            completionHandler(nil)
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        // 3. El Prompt: Aquí defines la personalidad de tu Agente
        let prompt = """
        Eres un desarrollador experto en Swift. Analiza y refactoriza el siguiente código para mejorarlo, o coméntalo si es muy complejo.
        IMPORTANTE: Devuelve ÚNICAMENTE el código Swift resultante. No uses bloques de código markdown (```) ni des explicaciones.
        
        Código:
        \(selectedText)
        """
        
        // Estructura JSON que espera la API de Gemini
        let body: [String: Any] = [
            "contents": [
                [
                    "parts": [
                        ["text": prompt]
                    ]
                ]
            ]
        ]
        
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        // 4. Ejecutar la petición en segundo plano
        let task = URLSession.shared.dataTask(with: request) { data, response, error in
            // IMPORTANTE: Siempre debemos llamar al completionHandler al terminar
            defer { completionHandler(nil) }
            
            guard let data = data, error == nil else {
                print("Error de conexión: \(error?.localizedDescription ?? "Desconocido")")
                return
            }
            
            // 5. Parsear la respuesta JSON
            do {
                if let json = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any],
                   let candidates = json["candidates"] as? [[String: Any]],
                   let content = candidates.first?["content"] as? [String: Any],
                   let parts = content["parts"] as? [[String: Any]],
                   let generatedText = parts.first?["text"] as? String {
                    
                    // Limpiar posibles bloques de markdown residuales
                    let cleanText = generatedText.replacingOccurrences(of: "```swift", with: "").replacingOccurrences(of: "```", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
                    
                    let newLines = cleanText.components(separatedBy: "\n")
                    
                    // 6. Inyectar el código modificado de vuelta en Xcode
                    let startLine = selection.start.line
                    let endLine = selection.end.line
                    
                    // Borramos las líneas originales
                    for _ in startLine...endLine {
                        invocation.buffer.lines.removeObject(at: startLine)
                    }
                    
                    // Insertamos las nuevas
                    for (index, line) in newLines.enumerated() {
                        invocation.buffer.lines.insert(line, at: startLine + index)
                    }
                }
            } catch {
                print("Error parseando el JSON de Gemini")
            }
        }
        
        task.resume()
    }
}
