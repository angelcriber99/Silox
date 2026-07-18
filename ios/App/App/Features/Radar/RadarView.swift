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
    @State private var displayedMonth = Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: .now)) ?? .now
    @State private var selectedDate = Calendar.current.startOfDay(for: .now)
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
        ScrollView {
            LazyVStack(spacing: 14) {
                if let cachedAt { StaleBanner(date: cachedAt) }
                calendarCard(radar.events)

                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(selectedDate.formatted(.dateTime.weekday(.wide).day().month(.wide)))
                            .font(.headline)
                        Spacer()
                        Text("\(events(on: selectedDate, from: radar.events).count) eventos")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                    let dayEvents = events(on: selectedDate, from: radar.events)
                    if dayEvents.isEmpty {
                        ContentUnavailableView(
                            "Sin eventos este día",
                            systemImage: "calendar.badge.checkmark",
                            description: Text("Selecciona un día marcado en el calendario.")
                        )
                        .frame(minHeight: 150)
                    } else {
                        ForEach(dayEvents) { event in eventCard(event) }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                if !radar.news.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Noticias de tus posiciones").font(.headline)
                        ForEach(radar.news.prefix(8)) { item in
                            Link(destination: item.url) {
                                HStack(alignment: .top, spacing: 10) {
                                    Image(systemName: "newspaper").foregroundStyle(SiloxColors.accent)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(item.title).font(.subheadline.weight(.medium)).foregroundStyle(.primary).multilineTextAlignment(.leading)
                                        Text("\(item.source) · \(item.publishedAt.formatted(.relative(presentation: .named)))")
                                            .font(.caption).foregroundStyle(.secondary)
                                    }
                                }
                            }
                            Divider()
                        }
                    }
                    .padding(16)
                    .background(SiloxColors.secondaryBackground, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .refreshable { await model.refresh() }
        .onAppear {
            if let first = radar.events.first, events(on: selectedDate, from: radar.events).isEmpty {
                selectedDate = Calendar.current.startOfDay(for: first.startsAt)
                displayedMonth = monthStart(first.startsAt)
            }
        }
    }

    private func calendarCard(_ events: [MarketEvent]) -> some View {
        SiloxCard {
            VStack(spacing: 12) {
                HStack {
                    Button { moveMonth(-1) } label: { Image(systemName: "chevron.left") }
                    Spacer()
                    Text(displayedMonth.formatted(.dateTime.month(.wide).year())).font(.headline)
                    Spacer()
                    Button { moveMonth(1) } label: { Image(systemName: "chevron.right") }
                }
                .buttonStyle(.plain)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 8) {
                    ForEach(weekdaySymbols, id: \.self) { symbol in
                        Text(symbol).font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                    }
                    ForEach(Array(monthDays.enumerated()), id: \.offset) { _, date in
                        if let date {
                            dayCell(date, events: events)
                        } else {
                            Color.clear.frame(height: 38)
                        }
                    }
                }

                HStack(spacing: 14) {
                    legend("Resultados", color: .purple)
                    legend("Dividendo", color: SiloxColors.accent)
                    Spacer()
                    Text("Solo posiciones activas").font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
    }

    private func dayCell(_ date: Date, events: [MarketEvent]) -> some View {
        let dayEvents = self.events(on: date, from: events)
        let isSelected = Calendar.current.isDate(date, inSameDayAs: selectedDate)
        return Button {
            selectedDate = date
        } label: {
            VStack(spacing: 3) {
                Text(String(Calendar.current.component(.day, from: date)))
                    .font(.subheadline.weight(isSelected ? .bold : .regular))
                HStack(spacing: 2) {
                    ForEach(dayEvents.prefix(3)) { event in Circle().fill(eventColor(event)).frame(width: 4, height: 4) }
                }
                .frame(height: 4)
            }
            .frame(maxWidth: .infinity, minHeight: 38)
            .foregroundStyle(isSelected ? Color.black : Color.primary)
            .background(isSelected ? SiloxColors.accent : Color.clear, in: RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
    }

    private func eventCard(_ event: MarketEvent) -> some View {
        HStack(spacing: 12) {
            Image(systemName: event.kind.uppercased().contains("EARNING") ? "chart.bar.fill" : "banknote.fill")
                .foregroundStyle(eventColor(event))
                .frame(width: 38, height: 38)
                .background(eventColor(event).opacity(0.12), in: RoundedRectangle(cornerRadius: 11))
            VStack(alignment: .leading, spacing: 3) {
                Text(event.title).font(.subheadline.weight(.semibold))
                Text(event.startsAt.formatted(date: .abbreviated, time: .shortened)).font(.caption).foregroundStyle(.secondary)
            }
            Spacer()
            if let ticker = event.ticker {
                Text(ticker.split(separator: ".").first.map(String.init) ?? ticker)
                    .font(.caption.bold()).padding(.horizontal, 8).padding(.vertical, 5)
                    .background(SiloxColors.elevatedBackground, in: Capsule())
            }
        }
        .padding(14)
        .background(SiloxColors.secondaryBackground, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var weekdaySymbols: [String] {
        var calendar = Calendar.current
        calendar.firstWeekday = 2
        let symbols = calendar.veryShortStandaloneWeekdaySymbols
        return Array(symbols.dropFirst()) + Array(symbols.prefix(1))
    }

    private var monthDays: [Date?] {
        var calendar = Calendar.current
        calendar.firstWeekday = 2
        guard let range = calendar.range(of: .day, in: .month, for: displayedMonth) else { return [] }
        let weekday = calendar.component(.weekday, from: displayedMonth)
        let leading = (weekday - calendar.firstWeekday + 7) % 7
        return Array(repeating: nil, count: leading) + range.compactMap { day in
            calendar.date(byAdding: .day, value: day - 1, to: displayedMonth)
        }.map(Optional.some)
    }

    private func events(on date: Date, from events: [MarketEvent]) -> [MarketEvent] {
        events.filter { Calendar.current.isDate($0.startsAt, inSameDayAs: date) }
    }

    private func eventColor(_ event: MarketEvent) -> Color {
        event.kind.uppercased().contains("EARNING") ? .purple : SiloxColors.accent
    }

    private func legend(_ title: String, color: Color) -> some View {
        HStack(spacing: 4) { Circle().fill(color).frame(width: 6, height: 6); Text(title).font(.caption2).foregroundStyle(.secondary) }
    }

    private func monthStart(_ date: Date) -> Date {
        Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: date)) ?? date
    }

    private func moveMonth(_ amount: Int) {
        displayedMonth = Calendar.current.date(byAdding: .month, value: amount, to: displayedMonth) ?? displayedMonth
    }
}
