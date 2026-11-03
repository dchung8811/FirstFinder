import UIKit
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
final class PendingPhotosTests: XCTestCase {
    func testAPickedPhotoWaitsInMemoryUntilForgotten() {
        let pending = PendingPhotos()
        let photo = pending.store(Data([1, 2, 3]), name: "a.jpg")
        XCTAssertTrue(PendingPhotos.isPending(photo))
        XCTAssertEqual(pending.bytes[photo.path], Data([1, 2, 3]))
        pending.forget([photo.path])
        XCTAssertTrue(pending.bytes.isEmpty)
    }

    func testAStoredPhotoIsNotPending() {
        XCTAssertFalse(PendingPhotos.isPending(Photo(path: "user/item/item-1-abc-a.jpg", name: "a.jpg")))
    }

    // compressImage: the long edge down to 1,600px, and smaller than it was.
    func testCompressionShrinksALargePhoto() throws {
        let size = CGSize(width: 4000, height: 3000)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let original = UIGraphicsImageRenderer(size: size, format: format).pngData { context in
            for x in stride(from: 0, to: 4000, by: 50) {
                UIColor(hue: CGFloat(x) / 4000, saturation: 0.7, brightness: 0.8, alpha: 1).setFill()
                context.fill(CGRect(x: x, y: 0, width: 50, height: 3000))
            }
        }
        let compressed = PhotoCompression.jpeg(original)
        let image = try XCTUnwrap(UIImage(data: compressed))
        XCTAssertLessThan(compressed.count, original.count)
        XCTAssertEqual(max(image.size.width, image.size.height), 1600)
    }

    func testCompressionKeepsBytesItCantDecode() {
        let junk = Data([0, 1, 2, 3])
        XCTAssertEqual(PhotoCompression.jpeg(junk), junk)
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
