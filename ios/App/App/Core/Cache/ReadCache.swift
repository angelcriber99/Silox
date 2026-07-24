import CryptoKit
import Foundation
import os

actor ReadCache {
    struct Cached<Value: Codable & Sendable>: Codable, Sendable {
        let savedAt: Date
        let value: Value
    }

    private struct Envelope<Value: Codable & Sendable>: Codable, Sendable {
        let schemaVersion: Int
        let payload: Cached<Value>
    }

    private let directory: URL
    private let schemaVersion: Int
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let logger = Logger(subsystem: "com.angelcriber.silox", category: "ReadCache")
    private var memory: [String: Data] = [:]
    private var ownerNamespace: String?

    init(directory: URL? = nil, schemaVersion: Int = 2) {
        self.directory = directory ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appending(path: "SiloxReadCache", directoryHint: .isDirectory)
        self.schemaVersion = schemaVersion
    }

    /// Cache entries are only available after an authenticated session has
    /// selected its owner. This prevents a previous account's snapshots from
    /// being rendered while another account is being restored.
    func setOwner(_ userID: String?) {
        memory.removeAll(keepingCapacity: false)
        ownerNamespace = userID.map { digest($0) }
    }

    func load<Value: Codable & Sendable>(
        _ type: Value.Type,
        key: String,
        maxAge: TimeInterval? = nil
    ) -> Cached<Value>? {
        guard let scopedKey = scopedKey(for: key) else { return nil }
        let data: Data
        if let memoryData = memory[scopedKey] {
            data = memoryData
        } else if let diskData = try? Data(contentsOf: url(for: scopedKey)) {
            data = diskData
            memory[scopedKey] = diskData
        } else {
            logger.debug("cache_miss key=\(key, privacy: .public)")
            return nil
        }
        guard let envelope = try? decoder.decode(Envelope<Value>.self, from: data),
              envelope.schemaVersion == schemaVersion else {
            logger.notice("cache_invalidated key=\(key, privacy: .public) schema=\(self.schemaVersion)")
            memory.removeValue(forKey: scopedKey)
            try? FileManager.default.removeItem(at: url(for: scopedKey))
            return nil
        }
        if let maxAge, Date().timeIntervalSince(envelope.payload.savedAt) > maxAge {
            logger.debug("cache_expired key=\(key, privacy: .public)")
            return nil
        }
        logger.debug("cache_hit key=\(key, privacy: .public)")
        return envelope.payload
    }

    func save<Value: Codable & Sendable>(_ value: Value, key: String) {
        guard let scopedKey = scopedKey(for: key) else { return }
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let payload = Cached(savedAt: Date(), value: value)
        guard let data = try? encoder.encode(Envelope(schemaVersion: schemaVersion, payload: payload)) else { return }
        memory[scopedKey] = data
        try? data.write(to: url(for: scopedKey), options: .atomic)
        logger.debug("cache_saved key=\(key, privacy: .public)")
    }

    func remove(_ key: String) {
        guard let scopedKey = scopedKey(for: key) else { return }
        memory.removeValue(forKey: scopedKey)
        try? FileManager.default.removeItem(at: url(for: scopedKey))
    }

    func clearAll() {
        memory.removeAll(keepingCapacity: false)
        try? FileManager.default.removeItem(at: directory)
    }

    private func url(for key: String) -> URL {
        let safe = key.replacingOccurrences(of: "/", with: "-")
        return directory.appending(path: safe).appendingPathExtension("json")
    }

    private func scopedKey(for key: String) -> String? {
        ownerNamespace.map { "\($0)-\(key)" }
    }

    private func digest(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

extension ReadCache.Cached {
    func isFresh(for maxAge: TimeInterval, now: Date = .now) -> Bool {
        now.timeIntervalSince(savedAt) <= maxAge
    }
}

/// Coalesces concurrent refreshes so preload, pull-to-refresh and a visible tab
/// never issue the same network request at the same time.
actor SingleFlight<Value: Sendable> {
    private var inFlight: Task<Value, Error>?

    func run(_ operation: @escaping @Sendable () async throws -> Value) async throws -> Value {
        if let inFlight { return try await inFlight.value }

        let task = Task { try await operation() }
        inFlight = task
        do {
            let value = try await task.value
            inFlight = nil
            return value
        } catch {
            inFlight = nil
            throw error
        }
    }
}
