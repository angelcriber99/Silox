import SwiftUI

@MainActor
final class RadarViewModel: ObservableObject {
    @Published private(set) var state: LoadState<RadarResponse> = .idle
    let repository: RadarRepository
    init(repository: RadarRepository) { self.repository = repository }
    func load() async {
        if let cached = await repository.cached() { state = .loaded(cached.value, cachedAt: cached.savedAt) }
        else { state = .loading }
        await refresh()
    }
    func refresh() async {
        do { state = .loaded(try await repository.refresh(), cachedAt: nil) }
        catch {
            let cached = await repository.cached()
            state = .failed(error.localizedDescription, cached: cached?.value, cachedAt: cached?.savedAt)
        }
    }
}

struct RadarView: View {
    @StateObject private var model: RadarViewModel
    init(repository: RadarRepository) { _model = StateObject(wrappedValue: RadarViewModel(repository: repository)) }

    var body: some View {
        NavigationStack {
            Group {
                switch model.state {
                case .idle, .loading: ProgressView("Cargando radar…")
                case .loaded(let value, let date): content(value, cachedAt: date)
                case .failed(let message, let value, let date):
                    if let value { content(value, cachedAt: date) }
                    else { ErrorStateView(message: message) { Task { await model.refresh() } } }
                }
            }
            .navigationTitle("Radar")
            .task { await model.load() }
        }
    }

    private func content(_ radar: RadarResponse, cachedAt: Date?) -> some View {
        List {
            if let cachedAt { StaleBanner(date: cachedAt).listRowInsets(EdgeInsets()) }
            Section("Próximos eventos") {
                if radar.events.isEmpty { Text("No hay eventos próximos.").foregroundStyle(.secondary) }
                ForEach(radar.events) { event in
                    HStack {
                        Image(systemName: "calendar")
                        VStack(alignment: .leading) {
                            Text(event.title)
                            Text(event.startsAt.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if let ticker = event.ticker { Text(ticker).font(.caption.bold()) }
                    }
                }
            }
            Section("Noticias") {
                if radar.news.isEmpty { Text("No hay noticias relevantes.").foregroundStyle(.secondary) }
                ForEach(radar.news) { item in
                    Link(destination: item.url) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.title).foregroundStyle(.primary)
                            Text("\(item.source) · \(item.publishedAt.formatted(.relative(presentation: .named)))")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .refreshable { await model.refresh() }
    }
}
