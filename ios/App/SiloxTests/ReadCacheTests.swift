import XCTest
@testable import Silox

final class ReadCacheTests: XCTestCase {
    func testRoundTrip() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let cache = ReadCache(directory: directory)
        let value = MoneyValue(amount: "10.50", currency: "EUR")

        await cache.save(value, key: "money")
        let loaded = await cache.load(MoneyValue.self, key: "money")

        XCTAssertEqual(loaded?.value, value)
        XCTAssertNotNil(loaded?.savedAt)
    }

    func testClearAllRemovesFinancialSnapshots() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let cache = ReadCache(directory: directory)
        await cache.save(MoneyValue(amount: "99", currency: "EUR"), key: "portfolio-v1")

        cache.clearAll()

        let loaded = await cache.load(MoneyValue.self, key: "portfolio-v1")
        XCTAssertNil(loaded)
    }

    func testSchemaVersionInvalidatesOldSnapshot() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let firstVersion = ReadCache(directory: directory, schemaVersion: 1)
        await firstVersion.save(MoneyValue(amount: "99", currency: "EUR"), key: "portfolio")

        let secondVersion = ReadCache(directory: directory, schemaVersion: 2)
        let loaded = await secondVersion.load(MoneyValue.self, key: "portfolio")

        XCTAssertNil(loaded)
    }

    func testZeroMaxAgeTreatsSnapshotAsExpired() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let cache = ReadCache(directory: directory)
        await cache.save(MoneyValue(amount: "99", currency: "EUR"), key: "portfolio")

        try await Task.sleep(for: .milliseconds(5))
        let loaded = await cache.load(MoneyValue.self, key: "portfolio", maxAge: 0)

        XCTAssertNil(loaded)
    }
}
