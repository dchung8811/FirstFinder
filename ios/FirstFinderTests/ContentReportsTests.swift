import Foundation
import XCTest
@testable import FirstFinder

final class ContentReportsTests: XCTestCase {
    private let slug = "abcdefghijkmnopqrstuvw"
    private let itemId = "11111111-2222-4333-8444-555555555555"

    private func object(_ data: Data) throws -> [String: String] {
        try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: String])
    }

    func testFindsTheSharedPageInAnAddress() {
        XCTAssertEqual(ContentReports.pageRef(from: URL(string: "https://firstfinder.app/c/\(slug)")),
                       .init(slug: slug, itemId: nil))
        XCTAssertEqual(ContentReports.pageRef(from: URL(string: "https://firstfinder.app/c/\(slug)#item-\(itemId)")),
                       .init(slug: slug, itemId: itemId))
    }

    func testOtherPagesHaveNothingToReport() {
        for address in ["https://firstfinder.app/explore", "https://firstfinder.app/books", "https://firstfinder.app/c/short", "https://firstfinder.app/c/\(slug)/more"] {
            XCTAssertNil(ContentReports.pageRef(from: URL(string: address)), address)
        }
        XCTAssertNil(ContentReports.pageRef(from: nil))
    }

    func testIgnoresAFragmentThatIsNotAnItem() {
        XCTAssertNil(ContentReports.pageRef(from: URL(string: "https://firstfinder.app/c/\(slug)#item-nope"))?.itemId)
        XCTAssertNil(ContentReports.pageRef(from: URL(string: "https://firstfinder.app/c/\(slug)#top"))?.itemId)
    }

    func testAReportSendsWhatTheRouteExpects() throws {
        let reason = ContentReports.reasons[0]
        let body = try object(ContentReports.reportBody(page: .init(slug: slug, itemId: itemId), reason: reason, details: "  ads \n"))
        XCTAssertEqual(body, ["slug": slug, "reason": "spam", "details": "ads", "itemId": itemId])
    }

    func testAReportLeavesOutAnItemItDoesNotHaveAndCapsTheDetails() throws {
        let body = try object(ContentReports.reportBody(page: .init(slug: slug), reason: ContentReports.reasons[0], details: String(repeating: "x", count: 1500)))
        XCTAssertNil(body["itemId"])
        XCTAssertEqual(body["details"]?.count, ContentReports.detailsMax)
    }

    func testBlockAndUnblockBodies() throws {
        XCTAssertEqual(try object(ContentReports.blockBody(slug: slug)), ["action": "block", "slug": slug])
        XCTAssertEqual(try object(ContentReports.unblockBody(id: "b1")), ["action": "unblock", "id": "b1"])
    }

    func testDecodesABlockWhoseLinkWasWithheld() throws {
        let blocks = try ContentReports.decodeBlocks(Data(#"{"blocks":[{"id":"b1","slug":null,"title":"A collector"}]}"#.utf8))
        XCTAssertEqual(blocks, [.init(id: "b1", slug: nil, title: "A collector")])
    }

    func testABlockedShelfLeavesTheHomePage() {
        let shelf = FeaturedShelf(slug: slug, title: "Shelf", blurb: nil, itemCount: 1, covers: [])
        let other = FeaturedShelf(slug: "other", title: "Other", blurb: nil, itemCount: 1, covers: [])
        XCTAssertEqual(ContentReports.visibleShelves([shelf, other], blocked: [slug]).map(\.slug), ["other"])
    }

    func testTheHidingScriptNamesEachShelfAndNothingElse() throws {
        XCTAssertNil(ContentReports.hidingScript(blocked: []))
        let script = try XCTUnwrap(ContentReports.hidingScript(blocked: [slug]))
        XCTAssertTrue(script.contains(#"a[href^="/c/\#(slug)"]"#))
    }

    func testAnUnexpectedSlugNeverReachesTheScript() {
        XCTAssertNil(ContentReports.hidingScript(blocked: ["x'; alert(1); '"]))
    }

    func testTheEmailGoesToSupportAndCarriesThePage() throws {
        let url = try XCTUnwrap(ContentReports.emailURL(pageURL: URL(string: "https://firstfinder.app/c/\(slug)")))
        XCTAssertEqual(url.scheme, "mailto")
        XCTAssertTrue(url.absoluteString.contains(ContentReports.supportEmail))
        XCTAssertTrue(url.absoluteString.contains(slug))
    }

    // Every way into a shared page goes through WebPage, so that's where the
    // report and block menu has to stay.
    func testTheSharedPageOffersReportAndBlock() throws {
        let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
        let text = try String(contentsOf: root.appending(path: "FirstFinder/Views/Common/WebPage.swift"), encoding: .utf8)
        XCTAssertTrue(text.contains("Report this page"))
        XCTAssertTrue(text.contains("Block this collector"))
    }
}
