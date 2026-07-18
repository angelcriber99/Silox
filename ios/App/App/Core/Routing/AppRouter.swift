import Foundation
import Observation

enum AppTab: String, CaseIterable, Identifiable, Sendable {
    case portfolio, transactions, radar, settings

    var id: Self { self }
    var title: String {
        switch self {
        case .portfolio: "Cartera"
        case .transactions: "Movimientos"
        case .radar: "Radar"
        case .settings: "Ajustes"
        }
    }
    var systemImage: String {
        switch self {
        case .portfolio: "chart.pie"
        case .transactions: "arrow.left.arrow.right"
        case .radar: "dot.radiowaves.left.and.right"
        case .settings: "gearshape"
        }
    }
}

enum AppSheet: Identifiable, Equatable {
    case addMovement(assetID: String?)

    var id: String {
        switch self {
        case .addMovement(let assetID): "add-movement-\(assetID ?? "none")"
        }
    }
}

struct RoutedAsset: Identifiable, Equatable { let id: String }

enum SiloxDeepLink: Equatable {
    case tab(AppTab)
    case addMovement(assetID: String?)
    case asset(id: String)

    init?(url: URL) {
        guard url.scheme?.lowercased() == "silox" else { return nil }
        let destination = url.host?.lowercased()
        let components = url.pathComponents.filter { $0 != "/" }
        switch destination {
        case "portfolio": self = .tab(.portfolio)
        case "transactions":
            self = components.first?.lowercased() == "add" ? .addMovement(assetID: nil) : .tab(.transactions)
        case "radar": self = .tab(.radar)
        case "settings": self = .tab(.settings)
        case "asset":
            guard let id = components.first?.removingPercentEncoding, !id.isEmpty else { return nil }
            self = .asset(id: id)
        default: return nil
        }
    }
}

@MainActor
@Observable
final class AppRouter {
    var selectedTab: AppTab = .portfolio
    var presentedSheet: AppSheet?
    var presentedAsset: RoutedAsset?

    func presentAddMovement(assetID: String? = nil) {
        presentedAsset = nil
        presentedSheet = .addMovement(assetID: assetID)
    }

    @discardableResult
    func handle(_ url: URL) -> Bool {
        guard let deepLink = SiloxDeepLink(url: url) else { return false }
        route(to: deepLink)
        return true
    }

    func route(to deepLink: SiloxDeepLink) {
        switch deepLink {
        case .tab(let tab):
            selectedTab = tab
            presentedAsset = nil
        case .addMovement(let assetID):
            selectedTab = .transactions
            presentAddMovement(assetID: assetID)
        case .asset(let id):
            selectedTab = .portfolio
            presentedSheet = nil
            presentedAsset = RoutedAsset(id: id)
        }
    }
}
