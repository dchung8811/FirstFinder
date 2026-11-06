import Foundation
import XCTest
@testable import FirstFinder

// What the App Store submission promises about photos and OpenAI, held here
// because no other test would notice it quietly going away.
final class StoreRulesTests: XCTestCase {
    private static let iosRoot = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()

    private func source(_ path: String) throws -> String {
        try String(contentsOf: Self.iosRoot.appending(path: path), encoding: .utf8)
    }

    private func freshDefaults(_ name: String = #function) -> UserDefaults {
        let defaults = UserDefaults(suiteName: "StoreRulesTests.\(name)")!
        defaults.removePersistentDomain(forName: "StoreRulesTests.\(name)")
        return defaults
    }

    func testNobodyHasAgreedUntilTheySay() {
        XCTAssertFalse(AIPhotoConsent.isGranted(userId: "a", in: freshDefaults()))
    }

    func testAgreeingCountsForThatAccountOnly() {
        let defaults = freshDefaults()
        AIPhotoConsent.grant(userId: "a", in: defaults)
        XCTAssertTrue(AIPhotoConsent.isGranted(userId: "a", in: defaults))
        XCTAssertFalse(AIPhotoConsent.isGranted(userId: "b", in: defaults))
    }

    func testNoAccountCanNeverAgree() {
        let defaults = freshDefaults()
        AIPhotoConsent.grant(userId: nil, in: defaults)
        XCTAssertFalse(AIPhotoConsent.isGranted(userId: nil, in: defaults))
    }

    func testDeletingAnAccountForgetsItsAnswer() {
        let defaults = freshDefaults()
        AIPhotoConsent.grant(userId: "a", in: defaults)
        AIPhotoConsent.forget(userId: "a", in: defaults)
        XCTAssertFalse(AIPhotoConsent.isGranted(userId: "a", in: defaults))
    }

    func testTheQuestionNamesWhoGetsThePhotos() {
        XCTAssertTrue(AIPhotoConsent.title.contains("OpenAI"))
        XCTAssertTrue(AIPhotoConsent.message.contains("OpenAI"))
    }

    // The prompt is only a courtesy if the send itself doesn't check.
    func testPhotosCannotLeaveWithoutTheCheck() throws {
        let text = try source("FirstFinder/App/AppModel+AI.swift")
        let send = try XCTUnwrap(text.range(of: "private func postPhotos"))
        let body = text[send.lowerBound...]
        let check = try XCTUnwrap(body.range(of: "hasAIPhotoConsent"))
        let post = try XCTUnwrap(body.range(of: "store.postSiteJSON"))
        XCTAssertLessThan(check.lowerBound, post.lowerBound)
    }

    func testBothPhotoButtonsAskFirst() throws {
        let text = try source("FirstFinder/Views/Add/AddItemsPage.swift")
        XCTAssertTrue(text.contains("PhotoPickerButton(maxCount: 3, sendsToAI: true, onPicked: scan)"))
        XCTAssertTrue(text.contains("PhotoPickerButton(maxCount: 1, sendsToAI: true, onPicked: identify)"))
    }
}
