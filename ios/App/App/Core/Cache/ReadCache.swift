import Foundation

actor ReadCache {
    struct Cached<Value: Codable>: Codable {
        let savedAt: Date
        let value: Value
    }

    private let directory: URL
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    init(directory: URL? = nil) {
        self.directory = directory ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appending(path: "SiloxReadCache", directoryHint: .isDirectory)
    }

    func load<Value: Codable & Sendable>(_ type: Value.Type, key: String) -> Cached<Value>? {
        guard let data = try? Data(contentsOf: url(for: key)) else { return nil }
        return try? decoder.decode(Cached<Value>.self, from: data)
    }

    func save<Value: Codable & Sendable>(_ value: Value, key: String) {
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        guard let data = try? encoder.encode(Cached(savedAt: Date(), value: value)) else { return }
        try? data.write(to: url(for: key), options: .atomic)
    }

    nonisolated func clearAll() {
        try? FileManager.default.removeItem(at: directory)
    }

    private func url(for key: String) -> URL {
        let safe = key.replacingOccurrences(of: "/", with: "-")
        return directory.appending(path: safe).appendingPathExtension("json")
    }
}
