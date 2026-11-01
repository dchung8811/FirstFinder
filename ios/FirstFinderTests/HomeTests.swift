import SwiftUI
import UIKit
import XCTest
@testable import FirstFinder

// Ported from src/utils/shelfDrift.test.js.
final class ShelfDriftTests: XCTestCase {
    func testKeepsAnOffsetInsideOneSpanToTheLeft() {
        XCTAssertEqual(ShelfDrift.wrap(-250, span: 1000), -250)
        XCTAssertEqual(ShelfDrift.wrap(-1250, span: 1000), -250)
        XCTAssertEqual(ShelfDrift.wrap(-3250, span: 1000), -250)
    }

    func testWrapsAStripDraggedToTheRightBackOntoItsHalves() {
        XCTAssertEqual(ShelfDrift.wrap(250, span: 1000), -750)
        XCTAssertEqual(ShelfDrift.wrap(2250, span: 1000), -750)
    }

    func testTreatsZeroAsTheIdenticalFrameAWholeSpanOver() {
        XCTAssertEqual(ShelfDrift.wrap(0, span: 1000), -1000)
    }

    func testDoesNotProduceNaNBeforeTheStripHasBeenMeasured() {
        XCTAssertEqual(ShelfDrift.wrap(-250, span: 0), 0)
        XCTAssertEqual(ShelfDrift.wrap(.nan, span: 1000), 0)
    }

    private let span = 10000.0

    func testCruisesAtTheCruiseSpeedWhenNobodyHasTouchedIt() {
        let next = ShelfDrift.step(.init(offset: -100, velocity: -50), cruise: -50, dt: 1, span: span)
        XCTAssertEqual(next.velocity, -50)
        XCTAssertEqual(next.offset, -150, accuracy: 0.01)
    }

    func testEasesAFlingBackTowardTheCruiseInsteadOfStopping() {
        var state = ShelfDrift.State(offset: -5000, velocity: -3000)
        for _ in 0..<600 { state = ShelfDrift.step(state, cruise: -50, dt: 1.0 / 60, span: span) }
        XCTAssertEqual(state.velocity, -50, accuracy: 0.05)
    }

    func testTurnsAFlingToTheRightBackIntoTheLeftwardCruise() {
        var state = ShelfDrift.State(offset: -5000, velocity: 2000)
        for _ in 0..<600 { state = ShelfDrift.step(state, cruise: -50, dt: 1.0 / 60, span: span) }
        XCTAssertEqual(state.velocity, -50, accuracy: 0.05)
    }

    func testMovesAsFarInOneSlowFrameAsInManyQuickOnes() {
        let once = ShelfDrift.step(.init(offset: -5000, velocity: -2000), cruise: -50, dt: 0.5, span: span)
        var many = ShelfDrift.State(offset: -5000, velocity: -2000)
        for _ in 0..<50 { many = ShelfDrift.step(many, cruise: -50, dt: 0.01, span: span) }
        XCTAssertEqual(once.offset, many.offset, accuracy: 1e-6)
        XCTAssertEqual(once.velocity, many.velocity, accuracy: 1e-6)
    }

    func testCarriesAFlingFurtherThanTheCruiseAloneWould() {
        let flung = ShelfDrift.step(.init(offset: -5000, velocity: -2000), cruise: -50, dt: 1, span: span)
        let cruising = ShelfDrift.step(.init(offset: -5000, velocity: -50), cruise: -50, dt: 1, span: span)
        XCTAssertLessThan(flung.offset, cruising.offset)
        XCTAssertLessThan(cruising.offset - flung.offset, 1950 * ShelfDrift.settleSeconds)
    }

    func testStandsStillOnAZeroLengthFrame() {
        XCTAssertEqual(ShelfDrift.step(.init(offset: -100, velocity: -2000), cruise: -50, dt: 0, span: span), .init(offset: -100, velocity: -2000))
    }

    func testMeasuresTheSpeedOfTheLastStretchOfTheDrag() {
        let samples: [ShelfDrift.Sample] = [.init(t: 0, x: 0), .init(t: 900, x: 10), .init(t: 950, x: 60), .init(t: 1000, x: 110)]
        XCTAssertEqual(ShelfDrift.releaseVelocity(samples, releasedAt: 1000), 1000, accuracy: 0.01)
    }

    func testIsNegativeForADragToTheLeft() {
        XCTAssertEqual(ShelfDrift.releaseVelocity([.init(t: 0, x: 300), .init(t: 50, x: 200)], releasedAt: 50), -2000, accuracy: 0.01)
    }

    func testIsZeroWhenThePointerHeldStillBeforeLettingGo() {
        XCTAssertEqual(ShelfDrift.releaseVelocity([.init(t: 0, x: 0), .init(t: 50, x: 200)], releasedAt: 400), 0)
    }

    func testIsZeroWithTooFewSamplesToTell() {
        XCTAssertEqual(ShelfDrift.releaseVelocity([], releasedAt: 0), 0)
        XCTAssertEqual(ShelfDrift.releaseVelocity([.init(t: 0, x: 0)], releasedAt: 10), 0)
    }

    func testCapsAFlickThatWouldBlurTheCovers() {
        XCTAssertEqual(ShelfDrift.releaseVelocity([.init(t: 0, x: 0), .init(t: 10, x: 500)], releasedAt: 10), ShelfDrift.maxFling)
        XCTAssertEqual(ShelfDrift.releaseVelocity([.init(t: 0, x: 500), .init(t: 10, x: 0)], releasedAt: 10), -ShelfDrift.maxFling)
    }
}

// Ported from the interleaveShelfCovers and collectionMonogram tests in
// src/utils/explore.test.js, plus the jacket and credit helpers.
final class ExploreLogicTests: XCTestCase {
    private func shelf(_ slug: String, _ ids: [String]) -> FeaturedShelf {
        FeaturedShelf(slug: slug, title: "Shelf \(slug)", itemCount: ids.count, covers: ids.map { .init(id: $0) })
    }

    func testDealsOneCoverFromEachShelfInTurnCarryingItsShelfAlong() {
        let dealt = ExploreLogic.interleave([shelf("a", ["a1", "a2", "a3"]), shelf("b", ["b1"]), shelf("c", ["c1", "c2"])])
        XCTAssertEqual(dealt.map(\.cover.id), ["a1", "b1", "c1", "a2", "c2", "a3"])
        XCTAssertEqual(dealt[1].shelfSlug, "b")
        XCTAssertEqual(dealt[1].shelfTitle, "Shelf b")
    }

    func testNoShelvesMeansNoCovers() {
        XCTAssertEqual(ExploreLogic.interleave([]), [])
    }

    func testMonogramUsesInitialsFromTheTitle() {
        XCTAssertEqual(ExploreLogic.monogram("Sam Rivera's collection"), "SR")
        XCTAssertEqual(ExploreLogic.monogram("Steinbeck"), "ST")
        XCTAssertEqual(ExploreLogic.monogram(""), "FF")
        XCTAssertEqual(ExploreLogic.monogram("My Collection!"), "MC")
    }

    // The same hash as jacketTone on the web, computed there for these ids:
    // a book keeps its jacket colour between /explore and the phone.
    func testJacketToneMatchesTheWebHash() {
        func webHash(_ id: String) -> Int {
            var hash: UInt64 = 0
            for unit in id.utf16 { hash = (hash * 31 + UInt64(unit)) & 0xffff_ffff }
            return Int(hash % 4)
        }
        for id in ["s1-2", "00000000-0000-4000-8000-000000000101", "a", "Ω-unicode"] {
            XCTAssertEqual(ExploreLogic.jacketToneIndex(id), webHash(id), id)
        }
    }

    func testCreditShowsTheAuthorOnlyWhereTheCategoryHasOne() {
        XCTAssertEqual(ExploreLogic.credit(category: "Book", author: "Mara Ellery", maker: "Hollow Oak"), "Mara Ellery · Hollow Oak")
        XCTAssertEqual(ExploreLogic.credit(category: "Record", author: "Left over", maker: "Low Tide"), "Low Tide")
        XCTAssertEqual(ExploreLogic.credit(category: "Book", author: " ", maker: nil), "")
    }

    func testCoversOpenOnTheirShelf() {
        XCTAssertEqual(ExploreLogic.publicItemPath(slug: "lantern", itemId: "x1"), "/c/lantern#item-x1")
        XCTAssertEqual(WebRoute.sharedItem(slug: "lantern", itemId: "x1").path, "/c/lantern#item-x1")
    }

    func testTheSampleShelvesDecode() throws {
        let response = try JSONDecoder().decode(FeaturedShelvesResponse.self, from: Data(SampleData.featuredShelvesJSON.utf8))
        XCTAssertEqual(response.shelves.count, 3)
        XCTAssertGreaterThanOrEqual(ExploreLogic.interleave(response.shelves).count, ShelfDrift.minToMove)
    }

    func testTheLogoIsBundled() {
        XCTAssertNotNil(UIImage(named: "LogoMark"), "the current mark from public/firstfinder-mark-exact.png")
    }
}
