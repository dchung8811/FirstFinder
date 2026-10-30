import XCTest
@testable import FirstFinder

// The config check, the overlay and the sample data: the pieces the read-only
// promise and the review rest on.
final class AppConfigTests: XCTestCase {
    private func jwt(role: String) -> String {
        func encode(_ json: String) -> String {
            Data(json.utf8).base64EncodedString()
                .replacingOccurrences(of: "+", with: "-")
                .replacingOccurrences(of: "/", with: "_")
                .replacingOccurrences(of: "=", with: "")
        }
        return encode(#"{"alg":"HS256"}"#) + "." + encode(#"{"role":"\#(role)","iss":"supabase"}"#) + ".sig"
    }

    func testAcceptsAnAnonKey() {
        let result = AppConfig.validate(url: "https://abc.supabase.co", key: jwt(role: "anon"), site: "https://firstfinder.app")
        XCTAssertEqual(try? result.get().supabaseURL.host, "abc.supabase.co")
    }

    func testAcceptsAPublishableKey() {
        XCTAssertNotNil(try? AppConfig.validate(url: "https://abc.supabase.co", key: "sb_publishable_xyz", site: nil).get())
    }

    func testRefusesAKeyWithAnyOtherRole() {
        let result = AppConfig.validate(url: "https://abc.supabase.co", key: jwt(role: "authenticated_admin"), site: nil)
        guard case .failure(.privilegedKey) = result else { return XCTFail("accepted a privileged key") }
    }

    func testRefusesANewStyleSecretKey() {
        let result = AppConfig.validate(url: "https://abc.supabase.co", key: "sb_" + "secret_abc", site: nil)
        guard case .failure(.privilegedKey) = result else { return XCTFail("accepted a secret key") }
    }

    func testExplainsAURLCutOffByTheXcconfigComment() {
        XCTAssertEqual(AppConfig.validate(url: "https:", key: jwt(role: "anon"), site: nil), .failure(.urlCutAtComment))
    }

    func testTreatsUnsetOrTemplateValuesAsMissing() {
        XCTAssertEqual(AppConfig.validate(url: "", key: "", site: nil), .failure(.missing))
        XCTAssertEqual(AppConfig.validate(url: "$(SUPABASE_URL)", key: "x", site: nil), .failure(.missing))
        XCTAssertEqual(AppConfig.validate(url: "https://your-project-ref.supabase.co", key: "your-anon-key-here", site: nil), .failure(.missing))
    }
}

@MainActor
final class LocalOverlayTests: XCTestCase {
    private func row(_ id: String, name: String, created: String) -> InventoryRow {
        InventoryRow(id: id, userId: "u", name: name, createdAt: created)
    }

    func testAnEditReplacesTheLiveRowInPlace() {
        let overlay = LocalOverlay()
        let live = [row("1", name: "A", created: "2026-02"), row("2", name: "B", created: "2026-01")]
        overlay.saveItem(row("2", name: "B edited", created: "2026-01"), isNew: false, summary: "Edited B")
        XCTAssertEqual(overlay.mergedInventory(live).map(\.name), ["A", "B edited"])
        XCTAssertTrue(overlay.isLocal(itemId: "2"))
        XCTAssertFalse(overlay.isLocal(itemId: "1"))
    }

    func testANewItemComesFirst() {
        let overlay = LocalOverlay()
        overlay.saveItem(row("new", name: "New", created: "2026-10"), isNew: true, summary: "Added New")
        XCTAssertEqual(overlay.mergedInventory([row("1", name: "A", created: "2026-02")]).map(\.id), ["new", "1"])
    }

    func testDeletingALiveItemHidesItButDeletingALocalOneForgetsIt() {
        let overlay = LocalOverlay()
        let live = [row("1", name: "A", created: "2026-02")]
        overlay.discardItem(id: "1", summary: "Deleted A")
        XCTAssertEqual(overlay.mergedInventory(live), [])
        XCTAssertEqual(overlay.changes.count, 1)

        overlay.saveItem(row("new", name: "New", created: "2026-10"), isNew: true, summary: "Added New")
        overlay.discardItem(id: "new", summary: "Deleted New")
        XCTAssertEqual(overlay.mergedInventory(live), [])
        XCTAssertEqual(overlay.changes.count, 1, "deleting a local-only item should leave no trace")
    }

    func testRevertPutsAnItemBackAsTheStoreReadIt() {
        let overlay = LocalOverlay()
        let live = [row("1", name: "A", created: "2026-02")]
        overlay.saveItem(row("1", name: "A edited", created: "2026-02"), isNew: false, summary: "Edited A")
        overlay.discardItem(id: "1", summary: "Deleted A")
        overlay.revert(.item("1"))
        XCTAssertEqual(overlay.mergedInventory(live).map(\.name), ["A"])
        XCTAssertTrue(overlay.isEmpty)
    }

    func testRevertAllEmptiesEverything() {
        let overlay = LocalOverlay()
        overlay.saveItem(row("1", name: "A", created: "2026"), isNew: true, summary: "Added")
        overlay.setAccountToggle("explore", to: true, summary: "Explore on")
        _ = overlay.storePhoto(Data([1, 2, 3]), name: "a.jpg")
        overlay.revertAll()
        XCTAssertTrue(overlay.isEmpty)
        XCTAssertTrue(overlay.localPhotos.isEmpty)
        XCTAssertEqual(overlay.accountToggle("explore", live: false), false)
    }
}

final class SampleDataTests: XCTestCase {
    private let items = SampleData.inventory().map { Mapping.fromDbItem($0) }

    func testCoversEveryCategoryAndStatus() {
        XCTAssertEqual(Set(items.map(\.category)), Set(Vocab.quickCategories))
        XCTAssertEqual(Set(items.map(\.status)), Set(Vocab.statuses))
    }

    func testIncludesTheEdgeCasesTheScreensMustHandle() {
        XCTAssertTrue(items.contains { $0.estimatedValue == nil }, "an item with no estimate")
        XCTAssertTrue(items.contains { $0.estimatedValue == 0 }, "an item estimated at zero")
        XCTAssertTrue(items.contains { $0.purchaseDate.isEmpty }, "an undated item")
        XCTAssertTrue(items.contains { $0.status == "Sold" && $0.soldPrice == nil }, "a sale with no price")
        XCTAssertTrue(items.contains { $0.status == "Sold" && $0.previousStatus == "For sale" }, "a sold item to restore to For sale")
        XCTAssertTrue(items.contains { $0.itemPhotos.contains { $0.path.contains(SampleData.unsignablePathMarker) } }, "a photo that fails to sign")
        XCTAssertGreaterThanOrEqual(items.count, 28)
    }

    func testStartsWithTheWebsSampleItems() {
        for sample in Vocab.sampleItems {
            XCTAssertTrue(items.contains { $0.name == sample.name && $0.estimatedValue == sample.estimatedValue }, sample.name)
        }
    }

    func testReferenceNumbersAreUnique() {
        let numbers = items.compactMap(\.referenceNumber)
        XCTAssertEqual(Set(numbers).count, items.count)
    }

    func testWishlistCoversEveryPriorityAndAFoundWant() {
        let wants = SampleData.wishlist().map(Mapping.fromDbWant)
        XCTAssertEqual(Set(wants.map(\.priority)), ["grail", "hunting", "someday"])
        XCTAssertTrue(wants.contains { !$0.foundAt.isEmpty })
        XCTAssertTrue(wants.contains { !$0.upgradeForItemId.isEmpty })
    }
}

// Ported from src/utils/appNav.test.js: where a request for a view lands.
final class AppNavTests: XCTestCase {
    func testEveryViewHasAPathAndThePathsAreUnique() {
        XCTAssertEqual(Set(AppView.allCases.map(\.path)).count, AppView.allCases.count)
    }

    func testPathsMatchTheWeb() {
        XCTAssertEqual(AppView.inventory.path, "/collection")
        XCTAssertEqual(AppView.insuranceExport.path, "/insurance-report")
        XCTAssertEqual(AppView.tutorial.path, "/add-manually")
        XCTAssertEqual(AppView.forPath("/collection/"), .inventory)
        XCTAssertNil(AppView.forPath("/explore"))
    }

    func testIdentifyCannotBeOpenedCold() {
        XCTAssertEqual(AppView.landing(.identify, isLoggedIn: true), .addItems)
        XCTAssertEqual(AppView.landing(.identify, isLoggedIn: false), .login)
    }

    func testSignedOutPrivateViewsGoToLogin() {
        XCTAssertEqual(AppView.landing(.dashboard, isLoggedIn: false), .login)
        XCTAssertEqual(AppView.landing(.resetPassword, isLoggedIn: false), .login)
        XCTAssertEqual(AppView.landing(.about, isLoggedIn: false), .about)
        XCTAssertEqual(AppView.landing(nil, isLoggedIn: false), .home)
    }

    func testSignedInLoginGoesToTheDashboard() {
        XCTAssertEqual(AppView.landing(.login, isLoggedIn: true), .dashboard)
        XCTAssertEqual(AppView.landing(.wishlist, isLoggedIn: true), .wishlist)
    }
}
