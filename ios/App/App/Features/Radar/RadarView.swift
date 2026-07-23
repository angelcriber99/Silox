import SwiftUI

@MainActor
final class RadarViewModel: ObservableObject {
    @Published private(set) var state: LoadState<RadarResponse> = .idle
    let repository: RadarRepository

    init(repository: RadarRepository) { self.repository = repository }

    func load() async {
        if let cached = await repository.cached() { state = .loaded(cached.value, cachedAt: cached.savedAt) }
        else { state = .loading }
        do { state = .loaded(try await repository.value(), cachedAt: nil) }
        catch {
            let cached = await repository.cached()
            state = .failed(error.localizedDescription, cached: cached?.value, cachedAt: cached?.savedAt)
        }
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
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var displayedMonth = Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: .now)) ?? .now
    @State private var selectedDate = Calendar.current.startOfDay(for: .now)

    init(repository: RadarRepository) {
        _model = StateObject(wrappedValue: RadarViewModel(repository: repository))
    }

    var body: some View {
        NavigationStack {
            Group {
                switch model.state {
                case .idle, .loading:
                    SiloxLoadingView(.radar)
                case .loaded(let value, let date):
                    content(value, cachedAt: date)
                case .failed(let message, let value, let date):
                    if let value { content(value, cachedAt: date) }
                    else { ErrorStateView(message: message) { Task { await model.refresh() } } }
                }
            }
            .background(SiloxColors.backgroundPrimary.ignoresSafeArea())
            .navigationTitle("Radar")
            .task { await model.load() }
        }
    }

    private func content(_ radar: RadarResponse, cachedAt: Date?) -> some View {
        let assets = radar.assets ?? []
        return ScrollView {
            LazyVStack(spacing: 14) {
                if let cachedAt { StaleBanner(date: cachedAt) }

                if assets.isEmpty {
                    ContentUnavailableView(
                        "Sin posiciones abiertas",
                        systemImage: "calendar.badge.exclamationmark",
                        description: Text("Radar mostrará eventos cuando tengas dinero invertido en al menos un activo.")
                    )
                    .frame(minHeight: 360)
                } else {
                    overview(radar)
                    calendarCard(radar.events)
                    selectedDay(radar)
                    newsSection(radar)
                    Label(
                        "Actualizado \(radar.updatedAt.formatted(date: .omitted, time: .shortened))",
                        systemImage: "arrow.triangle.2.circlepath"
                    )
                    .font(.caption2)
                    .foregroundStyle(SiloxColors.textSecondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .refreshable {
            async let fetch: () = model.refresh()
            async let delay = try? await Task.sleep(nanoseconds: 600_000_000)
            _ = await (fetch, delay)
        }
        .onAppear {
            if let first = radar.events.first, events(on: selectedDate, from: radar.events).isEmpty {
                selectedDate = Calendar.current.startOfDay(for: first.startsAt)
                displayedMonth = monthStart(first.startsAt)
            }
        }
    }

    private func overview(_ radar: RadarResponse) -> some View {
        let highImpact = radar.events.filter { $0.impact == "high" }.count
        let uncertain = radar.events.filter { $0.certainty == "estimated" || $0.certainty == "speculative" }.count
        return SiloxCard {
            VStack(alignment: .leading, spacing: 13) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("RADAR DE CARTERA")
                            .font(.system(size: 10, weight: .semibold))
                            .tracking(0.9)
                            .foregroundStyle(SiloxColors.accent)
                        Text("Solo activos con inversión activa")
                            .font(.subheadline.weight(.semibold))
                    }
                    Spacer()
                    Image(systemName: "dot.radiowaves.left.and.right")
                        .foregroundStyle(SiloxColors.accent)
                }
                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 10) {
                        overviewMetric("Posiciones", value: radar.assets?.count ?? 0)
                        overviewMetric("Alto impacto", value: highImpact)
                        overviewMetric("Por confirmar", value: uncertain)
                    }
                } else {
                    HStack(spacing: 0) {
                        overviewMetric("Posiciones", value: radar.assets?.count ?? 0)
                        Divider().padding(.horizontal, 12)
                        overviewMetric("Alto impacto", value: highImpact)
                        Divider().padding(.horizontal, 12)
                        overviewMetric("Por confirmar", value: uncertain)
                    }
                }
            }
        }
    }

    private func overviewMetric(_ title: String, value: Int) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(String(value)).font(.headline).monospacedDigit()
            Text(title).font(.caption2).foregroundStyle(SiloxColors.textSecondary).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func selectedDay(_ radar: RadarResponse) -> some View {
        let dayEvents = events(on: selectedDate, from: radar.events)
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(selectedDate.formatted(.dateTime.weekday(.wide).day().month(.wide)))
                        .font(.headline)
                    Text(dayEvents.isEmpty ? "Sin eventos" : "\(dayEvents.count) eventos de cartera")
                        .font(.caption).foregroundStyle(SiloxColors.textSecondary)
                }
                Spacer()
            }
            if dayEvents.isEmpty {
                ContentUnavailableView(
                    "Día sin eventos",
                    systemImage: "calendar.badge.checkmark",
                    description: Text("Las ventanas estimadas aparecen marcadas durante todos sus días posibles.")
                )
                .frame(minHeight: 150)
            } else {
                ForEach(dayEvents) { event in
                    eventCard(event, asset: asset(for: event, in: radar))
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func calendarCard(_ events: [MarketEvent]) -> some View {
        SiloxCard {
            VStack(spacing: 12) {
                SiloxGlassEffectGroup(spacing: 10) {
                    HStack {
                        Button { moveMonth(-1) } label: {
                            Image(systemName: "chevron.left")
                                .frame(width: 34, height: 34)
                                .siloxInteractiveGlass(cornerRadius: 17)
                        }
                        .accessibilityLabel("Mes anterior")
                        Spacer()
                        Text(displayedMonth.formatted(.dateTime.month(.wide).year())).font(.headline)
                        Spacer()
                        Button { moveMonth(1) } label: {
                            Image(systemName: "chevron.right")
                                .frame(width: 34, height: 34)
                                .siloxInteractiveGlass(cornerRadius: 17)
                        }
                        .accessibilityLabel("Mes siguiente")
                    }
                    .buttonStyle(.plain)
                }

                if dynamicTypeSize.isAccessibilitySize {
                    accessibilityCalendar(events)
                } else {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 4), count: 7), spacing: 8) {
                        ForEach(weekdaySymbols, id: \.self) { symbol in
                            Text(symbol).font(.caption2.weight(.semibold)).foregroundStyle(SiloxColors.textSecondary)
                        }
                        ForEach(Array(monthDays.enumerated()), id: \.offset) { _, date in
                            if let date { dayCell(date, events: events) }
                            else { Color.clear.frame(height: 38) }
                        }
                    }
                }

                HStack(spacing: 10) {
                    legend("Confirmado", color: SiloxColors.accentSecondary)
                    legend("Estimado", color: SiloxColors.warning)
                    legend("Especulativo", color: SiloxColors.warning)
                    Spacer(minLength: 0)
                }
            }
        }
    }

    private func accessibilityCalendar(_ events: [MarketEvent]) -> some View {
        let monthEvents = events.filter { Calendar.current.isDate($0.startsAt, equalTo: displayedMonth, toGranularity: .month) }
        return VStack(alignment: .leading, spacing: 8) {
            if monthEvents.isEmpty {
                Text("No hay eventos este mes").foregroundStyle(SiloxColors.textSecondary)
            } else {
                ForEach(monthEvents) { event in
                    Button {
                        selectedDate = Calendar.current.startOfDay(for: event.startsAt)
                    } label: {
                        HStack(alignment: .top) {
                            Text(event.startsAt.formatted(.dateTime.day().month(.abbreviated)))
                                .font(.headline)
                            Text(event.title)
                                .multilineTextAlignment(.leading)
                            Spacer(minLength: 0)
                        }
                    }
                    .buttonStyle(.plain)
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
                    ForEach(dayEvents.prefix(3)) { event in
                        Circle().fill(eventColor(event)).frame(width: 4, height: 4)
                    }
                }
                .frame(height: 4)
            }
            .frame(maxWidth: .infinity, minHeight: 38)
            .foregroundStyle(isSelected ? SiloxColors.textOnAccent : SiloxColors.textPrimary)
            .background(isSelected ? SiloxColors.accent : Color.clear, in: RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(date.formatted(date: .long, time: .omitted)), \(dayEvents.count) eventos")
    }

    private func eventCard(_ event: MarketEvent, asset: Asset?) -> some View {
        let certainty = certaintyLabel(event)
        return ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: 12) {
                eventMark(event, asset: asset)
                eventDescription(event, certainty: certainty)
            }
            VStack(alignment: .leading, spacing: 12) {
                eventMark(event, asset: asset)
                eventDescription(event, certainty: certainty)
            }
        }
        .padding(14)
        .background(SiloxColors.backgroundSecondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(
                    eventColor(event).opacity(event.certainty == "speculative" ? 0.45 : 0.12),
                    style: StrokeStyle(lineWidth: 0.8, dash: event.certainty == "speculative" ? [5, 4] : [])
                )
        }
    }

    @ViewBuilder private func eventMark(_ event: MarketEvent, asset: Asset?) -> some View {
        if let asset { SiloxAssetMark(asset: asset, size: 40) }
        else {
            Image(systemName: eventIcon(event))
                .foregroundStyle(eventColor(event))
                .frame(width: 44, height: 44)
                .background(eventColor(event).opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
        }
    }

    private func eventDescription(_ event: MarketEvent, certainty: String) -> some View {
        HStack(alignment: .top, spacing: 0) {
            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 6) {
                    if let ticker = event.ticker {
                        Text(ticker.split(separator: ".").first.map(String.init) ?? ticker)
                            .font(.caption2.bold())
                    }
                    Text(certainty)
                        .font(.system(size: 9, weight: .semibold))
                        .padding(.horizontal, 7)
                        .padding(.vertical, 3)
                        .foregroundStyle(eventColor(event))
                        .background(eventColor(event).opacity(0.12), in: Capsule())
                    if event.impact == "high" {
                        Label("ALTO IMPACTO", systemImage: "exclamationmark.triangle.fill")
                            .font(.system(size: 8, weight: .bold))
                            .foregroundStyle(SiloxColors.warning)
                    }
                }
                Text(event.title).font(.subheadline.weight(.semibold))
                Text(eventWindow(event)).font(.caption).foregroundStyle(SiloxColors.textSecondary)
                if let description = event.description, !description.isEmpty {
                    Text(description).font(.caption).foregroundStyle(SiloxColors.textSecondary).lineLimit(3)
                }
                if let sourceURL = event.sourceURL {
                    Link(destination: sourceURL) {
                        Label("Fuente: \(event.sourceName ?? "Abrir")", systemImage: "arrow.up.right")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(SiloxColors.accent)
                    }
                }
            }
            Spacer(minLength: 0)
        }
    }

    private func newsSection(_ radar: RadarResponse) -> some View {
        Group {
            if !radar.news.isEmpty {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Noticias vigiladas").font(.headline)
                    Text("Estas fuentes alimentan la detección de nuevos catalizadores.")
                        .font(.caption).foregroundStyle(SiloxColors.textSecondary)
                    ForEach(radar.news.prefix(10)) { item in
                        Link(destination: item.url) {
                            HStack(alignment: .top, spacing: 10) {
                                if let asset = asset(ticker: item.ticker, in: radar) {
                                    SiloxAssetMark(asset: asset, size: 34)
                                } else {
                                    Image(systemName: "newspaper").foregroundStyle(SiloxColors.accent).frame(width: 34, height: 34)
                                }
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(item.title)
                                        .font(.subheadline.weight(.medium))
                                        .foregroundStyle(SiloxColors.textPrimary)
                                        .multilineTextAlignment(.leading)
                                    Text("\(item.source) · \(item.publishedAt.formatted(.relative(presentation: .named)))")
                                        .font(.caption).foregroundStyle(SiloxColors.textSecondary)
                                }
                            }
                        }
                        if item.id != radar.news.prefix(10).last?.id { Divider().padding(.leading, 44) }
                    }
                }
                .padding(16)
                .background(SiloxColors.backgroundSecondary, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
        }
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
        let target = Calendar.current.startOfDay(for: date)
        return events.filter { event in
            let start = Calendar.current.startOfDay(for: event.startsAt)
            let end = Calendar.current.startOfDay(for: event.endsAt ?? event.startsAt)
            return target >= start && target <= end
        }
    }

    private func asset(for event: MarketEvent, in radar: RadarResponse) -> Asset? {
        if let assetId = event.assetId, let match = radar.assets?.first(where: { $0.id == assetId }) { return match }
        return asset(ticker: event.ticker, in: radar)
    }

    private func asset(ticker: String?, in radar: RadarResponse) -> Asset? {
        guard let ticker else { return nil }
        return radar.assets?.first { asset in
            guard let assetTicker = asset.ticker else { return false }
            return assetTicker.caseInsensitiveCompare(ticker) == .orderedSame
        }
    }

    private func eventColor(_ event: MarketEvent) -> Color {
        switch event.certainty {
        case "confirmed": SiloxColors.accentSecondary
        case "scheduled": SiloxColors.accent
        case "estimated": SiloxColors.warning
        case "speculative": SiloxColors.warning
        case "manual": SiloxColors.accentSecondary
        default: SiloxColors.textSecondary
        }
    }

    private func certaintyLabel(_ event: MarketEvent) -> String {
        switch event.certainty {
        case "confirmed": "Confirmado"
        case "scheduled": "Programado"
        case "estimated": "Estimado"
        case "speculative": "Especulativo"
        case "manual": "Manual"
        default: "Informativo"
        }
    }

    private func eventIcon(_ event: MarketEvent) -> String {
        switch event.kind {
        case "EARNINGS": "chart.bar.fill"
        case "DIVIDEND", "EX_DIVIDEND": "banknote.fill"
        case "CATALYST": "sparkles"
        default: "calendar"
        }
    }

    private func eventWindow(_ event: MarketEvent) -> String {
        guard let end = event.endsAt, !Calendar.current.isDate(end, inSameDayAs: event.startsAt) else {
            return event.startsAt.formatted(date: .long, time: .omitted)
        }
        if Calendar.current.component(.month, from: event.startsAt) == Calendar.current.component(.month, from: end) {
            return "Del \(Calendar.current.component(.day, from: event.startsAt)) al \(end.formatted(.dateTime.day().month(.wide).year()))"
        }
        return "\(event.startsAt.formatted(date: .abbreviated, time: .omitted)) – \(end.formatted(date: .abbreviated, time: .omitted))"
    }

    private func legend(_ title: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(title).font(.caption2).foregroundStyle(SiloxColors.textSecondary)
        }
    }

    private func monthStart(_ date: Date) -> Date {
        Calendar.current.date(from: Calendar.current.dateComponents([.year, .month], from: date)) ?? date
    }

    private func moveMonth(_ amount: Int) {
        displayedMonth = Calendar.current.date(byAdding: .month, value: amount, to: displayedMonth) ?? displayedMonth
    }
}
