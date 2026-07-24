import XCTest
@testable import Silox

final class ReadCacheTests: XCTestCase {
    func testRoundTrip() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let cache = ReadCache(directory: directory)
        await cache.setOwner("user-a")
        let value = MoneyValue(amount: "10.50", currency: "EUR")

        await cache.save(value, key: "money")
        let loaded = await cache.load(MoneyValue.self, key: "money")

        XCTAssertEqual(loaded?.value, value)
        XCTAssertNotNil(loaded?.savedAt)
    }

    func testClearAllRemovesFinancialSnapshots() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let cache = ReadCache(directory: directory)
        await cache.setOwner("user-a")
        await cache.save(MoneyValue(amount: "99", currency: "EUR"), key: "portfolio-v1")

        await cache.clearAll()

        let loaded = await cache.load(MoneyValue.self, key: "portfolio-v1")
        XCTAssertNil(loaded)
    }

    func testSchemaVersionInvalidatesOldSnapshot() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let firstVersion = ReadCache(directory: directory, schemaVersion: 1)
        await firstVersion.setOwner("user-a")
        await firstVersion.save(MoneyValue(amount: "99", currency: "EUR"), key: "portfolio")

        let secondVersion = ReadCache(directory: directory, schemaVersion: 2)
        await secondVersion.setOwner("user-a")
        let loaded = await secondVersion.load(MoneyValue.self, key: "portfolio")

        XCTAssertNil(loaded)
    }

    func testZeroMaxAgeTreatsSnapshotAsExpired() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let cache = ReadCache(directory: directory)
        await cache.setOwner("user-a")
        await cache.save(MoneyValue(amount: "99", currency: "EUR"), key: "portfolio")

        try await Task.sleep(for: .milliseconds(5))
        let loaded = await cache.load(MoneyValue.self, key: "portfolio", maxAge: 0)

        XCTAssertNil(loaded)
    }

    func testRemoveEvictsMemoryAndDiskCopies() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let cache = ReadCache(directory: directory)
        await cache.setOwner("user-a")
        await cache.save(MoneyValue(amount: "42", currency: "EUR"), key: "portfolio-v1")
        let beforeRemoval = await cache.load(MoneyValue.self, key: "portfolio-v1")
        XCTAssertNotNil(beforeRemoval)

        await cache.remove("portfolio-v1")

        let afterRemoval = await cache.load(MoneyValue.self, key: "portfolio-v1")
        XCTAssertNil(afterRemoval)
    }

    func testFreshnessPolicy() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let cache = ReadCache(directory: directory)
        await cache.setOwner("user-a")
        await cache.save(MoneyValue(amount: "10", currency: "EUR"), key: "money")
        let cached = await cache.load(MoneyValue.self, key: "money")
        let loaded = try XCTUnwrap(cached)

        XCTAssertTrue(loaded.isFresh(for: 30, now: loaded.savedAt.addingTimeInterval(29)))
        XCTAssertFalse(loaded.isFresh(for: 30, now: loaded.savedAt.addingTimeInterval(31)))
    }

    func testSnapshotsNeverCrossAuthenticatedOwners() async throws {
        let directory = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        let cache = ReadCache(directory: directory)
        await cache.setOwner("user-a")
        await cache.save(MoneyValue(amount: "99", currency: "EUR"), key: "portfolio-v1")

        await cache.setOwner("user-b")
        let otherUserSnapshot = await cache.load(MoneyValue.self, key: "portfolio-v1")
        XCTAssertNil(otherUserSnapshot)

        await cache.setOwner("user-a")
        let ownerSnapshot = await cache.load(MoneyValue.self, key: "portfolio-v1")
        XCTAssertEqual(ownerSnapshot?.value, MoneyValue(amount: "99", currency: "EUR"))
    }
}
