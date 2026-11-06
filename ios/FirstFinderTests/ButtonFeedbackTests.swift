import Foundation
import XCTest
@testable import FirstFinder

// Issue #288: every button answers a press the same way, and a second tap can't
// send a save twice. How a press looks can only be judged on a phone, so what's
// held here is the wiring a later change could quietly undo.
@MainActor
final class ButtonFeedbackTests: XCTestCase {
    private static let viewsRoot = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()
        .appendingPathComponent("FirstFinder/Views")

    private func viewSources() throws -> [(name: String, text: String)] {
        let files = FileManager.default.enumerator(at: Self.viewsRoot, includingPropertiesForKeys: nil)
        var sources: [(String, String)] = []
        while let file = files?.nextObject() as? URL {
            guard file.pathExtension == "swift" else { continue }
            sources.append((file.lastPathComponent, try String(contentsOf: file, encoding: .utf8)))
        }
        XCTAssertFalse(sources.isEmpty, "found no views to read")
        return sources
    }

    // .plain has no press state at all, which is what this issue set out to end.
    func testNoButtonOptsOutIntoAStyleWithNoPressState() throws {
        for source in try viewSources() {
            XCTAssertFalse(source.text.contains(".buttonStyle(.plain)"), "\(source.name) uses .plain; use .ffPress")
        }
    }

    func testThePressStyleAndHapticsAreSetForTheWholeApp() throws {
        let root = try XCTUnwrap(try viewSources().first { $0.name == "RootView.swift" }).text
        XCTAssertTrue(root.contains(".buttonStyle(.ffPress)"))
        XCTAssertTrue(root.contains(".sensoryFeedback(.impact(weight: .light), trigger: app.isSaving)"))
    }

    func testASecondTapCannotAddTheSameItemTwice() async {
        let app = AppModel(config: .failure(.missing))
        await app.start()
        let before = app.inventory.count
        var item = Item(id: "")
        item.name = "A find"

        app.isSaving = true
        let refused = await app.addItem(item, itemPhotos: [], receiptPhotos: [])
        XCTAssertNil(refused)
        XCTAssertEqual(app.inventory.count, before)

        app.isSaving = false
        let added = await app.addItem(item, itemPhotos: [], receiptPhotos: [])
        XCTAssertNotNil(added)
        XCTAssertEqual(app.inventory.count, before + 1)
        XCTAssertFalse(app.isSaving)
    }

    func testRestoringSaysWhichItemAndLetsGoAfterwards() async throws {
        let app = AppModel(config: .failure(.missing))
        await app.start()
        let sold = try XCTUnwrap(app.soldInventory.first, "no sold sample item")

        app.isSaving = true
        let refused = await app.restoreSold(sold.id)
        XCTAssertNil(refused)
        app.isSaving = false

        let restored = await app.restoreSold(sold.id)
        XCTAssertNotNil(restored)
        XCTAssertNil(app.restoringItemId)
    }
}
