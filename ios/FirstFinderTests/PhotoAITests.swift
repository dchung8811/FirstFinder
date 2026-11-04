import Foundation
import XCTest
@testable import FirstFinder

// The phone's reading of /api/v1/identify-book, scan-book and identify-budget,
// against bodies shaped exactly as those routes send them.
final class PhotoAITests: XCTestCase {
    private func data(_ json: String) -> Data { Data(json.utf8) }

    func testAnIdentificationDecodesWithItsAllowance() throws {
        let (result, allowance) = try PhotoAI.decodeIdentify(data(#"""
        {"result":{"isBook":true,"title":"Lonesome Dove","author":"Larry McMurtry","category":"Book","genre":"Western",
        "edition":"First","printing":"First","editionRationale":"Number line ends in 1.","condition":"Very Good/Good",
        "estimatedValueLow":300,"estimatedValueHigh":550,"firstEditionFirstPrintingValueLow":0,"firstEditionFirstPrintingValueHigh":0,
        "summary":"S","conditionNotes":"C","confidence":"medium",
        "comparables":[{"source":"eBay","url":"https://www.ebay.com/itm/1","price":420,"saleType":"sold","date":"2026-09-01","editionMatch":"exact match"}],
        "citations":[{"url":"https://example.org/guide","title":"Guide"}]},
        "remaining":1,"dailyLimit":2}
        """#))
        XCTAssertEqual(result.title, "Lonesome Dove")
        XCTAssertEqual(result.edition, "First")
        XCTAssertEqual(result.comparables.first?.saleType, "sold")
        XCTAssertEqual(result.citations.first?.title, "Guide")
        XCTAssertEqual(allowance, PhotoAI.Allowance(used: 1, dailyLimit: 2, remaining: 1))
        // A zero first-edition range means "not applicable", not "worth $0".
        XCTAssertNil(ItemsLogic.valueRange(low: result.firstEditionLow, high: result.firstEditionHigh))
    }

    // A source the collector can't open is no evidence at all.
    func testComparablesWithoutAUsableLinkAreDropped() throws {
        let (result, _) = try PhotoAI.decodeIdentify(data(#"""
        {"result":{"title":"X","comparables":[
          {"source":"a","url":"not a url","price":1,"saleType":"sold","date":"","editionMatch":""},
          {"source":"b","url":"javascript:alert(1)","price":1,"saleType":"sold","date":"","editionMatch":""},
          {"source":"c","url":"https://abebooks.com/x","price":1,"saleType":"active_listing","date":"","editionMatch":""}]}}
        """#))
        XCTAssertEqual(result.comparables.map(\.source), ["c"])
    }

    func testAMalformedIdentificationIsAFailureNotACrash() {
        XCTAssertThrowsError(try PhotoAI.decodeIdentify(data("{}"))) { error in
            XCTAssertEqual(error as? PhotoAI.Failure, PhotoAI.Failure(message: "Couldn't read the identification result. Please try again."))
        }
    }

    func testAScanDecodes() throws {
        let scan = try PhotoAI.decodeScan(data(#"""
        {"result":{"isPrintedItem":true,"category":"Book","title":"Dune","author":"Frank Herbert","publisher":"Chilton",
        "publicationYear":"1965","editionStatement":"FIRST EDITION","printingStatement":"","numberLine":"","isbn":""},
        "remaining":null,"dailyLimit":null}
        """#))
        XCTAssertEqual(scan.publisher, "Chilton")
        XCTAssertEqual(scan.editionStatement, "FIRST EDITION")
    }

    func testTheAllowanceDecodes() {
        let allowance = PhotoAI.decodeAllowance(data(#"""
        {"identify":{"used":1,"dailyLimit":2,"remaining":1,"resetsAt":"2026-11-04T00:00:00.000Z"},
         "scan":{"used":0,"dailyLimit":null,"remaining":null,"resetsAt":"2026-11-04T00:00:00.000Z"}}
        """#))
        XCTAssertEqual(allowance, PhotoAI.Allowance(used: 1, dailyLimit: 2, remaining: 1))
    }

    // The body the web sends: {"images": ["data:image/jpeg;base64,..."]}.
    func testTheRequestBodyIsDataURLs() throws {
        let body = try XCTUnwrap(JSONSerialization.jsonObject(with: PhotoAI.requestBody([Data([1, 2, 3])])) as? [String: [String]])
        XCTAssertEqual(body["images"], ["data:image/jpeg;base64,AQID"])
    }
}
