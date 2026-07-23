import SwiftUI
@main
struct TestApp: App {
    var body: some Scene {
        WindowGroup { Text("Catalyst") }
        #if targetEnvironment(macCatalyst)
        MenuBarExtra("Catalyst Menu", systemImage: "star") {
            Text("Works!")
        }
        #endif
    }
}
