import XCTest
@testable import FirstFinder

// Ported from src/utils/format.test.js.
final class FormatTests: XCTestCase {
    func testToNumberReadsAPlainNumber() {
        XCTAssertEqual(Format.toNumber("42"), 42)
        XCTAssertEqual(Format.toNumber(Decimal(42)), 42)
        XCTAssertEqual(Format.toNumber("12.50"), Decimal(string: "12.5"))
    }

    func testToNumberStripsCurrencyFormattingAUserPastedIn() {
        XCTAssertEqual(Format.toNumber("$1,200"), 1200)
        XCTAssertEqual(Format.toNumber("$1,200.75"), Decimal(string: "1200.75"))
    }

    func testToNumberKeepsNegatives() {
        XCTAssertEqual(Format.toNumber("-50"), -50)
    }

    // Every total sums toNumber() output, so anything unparseable lands on 0.
    func testToNumberFallsBackToZero() {
        XCTAssertEqual(Format.toNumber(""), 0)
        XCTAssertEqual(Format.toNumber(nil as String?), 0)
        XCTAssertEqual(Format.toNumber(nil as Decimal?), 0)
        XCTAssertEqual(Format.toNumber("not a price"), 0)
    }

    // parseFloat reads the longest valid prefix; the port must too.
    func testToNumberReadsOnlyTheValidPrefixLikeParseFloat() {
        XCTAssertEqual(Format.toNumber("1.2.3"), Decimal(string: "1.2"))
        XCTAssertEqual(Format.toNumber("1-2"), 1)
        XCTAssertEqual(Format.toNumber("-"), 0)
        XCTAssertEqual(Format.toNumber(".5"), Decimal(string: "0.5"))
    }

    func testHasValueTreatsZeroAsARealValue() {
        XCTAssertTrue(Format.hasValue(Decimal(0)))
        XCTAssertTrue(Format.hasValue("0"))
    }

    func testHasValueTreatsBlankAndMissingAsAbsent() {
        XCTAssertFalse(Format.hasValue(""))
        XCTAssertFalse(Format.hasValue(nil as String?))
        XCTAssertFalse(Format.hasValue(nil as Decimal?))
    }

    func testFormatCurrencyRendersWholeDollars() {
        XCTAssertEqual(Format.currency(Decimal(1234)), "$1,234")
        XCTAssertEqual(Format.currency(""), "$0")
        XCTAssertEqual(Format.currency(nil as Decimal?), "$0")
    }

    // Intl.NumberFormat rounds half away from zero; NumberFormatter's default
    // is banker's rounding. $2.50 must read $3, as it does on the web.
    func testFormatCurrencyRoundsHalvesLikeTheWeb() {
        XCTAssertEqual(Format.currency(Decimal(string: "2.5")), "$3")
        XCTAssertEqual(Format.currency(Decimal(string: "3.5")), "$4")
        XCTAssertEqual(Format.currency(Decimal(string: "1234.49")), "$1,234")
    }

    func testReferenceRendersAsFF0001() {
        XCTAssertEqual(Format.reference(1), "FF-0001")
        XCTAssertEqual(Format.reference(4267), "FF-4267")
        XCTAssertEqual(Format.reference(12345), "FF-12345")
    }

    func testReferenceRendersNothingWhenUnset() {
        XCTAssertEqual(Format.reference(nil), "")
    }

    func testParseReferenceReadsWhateverASpreadsheetProduced() {
        XCTAssertEqual(Format.parseReference("FF-0042"), 42)
        XCTAssertEqual(Format.parseReference("42"), 42)
        XCTAssertEqual(Format.parseReference("  FF-0007  "), 7)
        XCTAssertEqual(Format.parseReference("ff-0007"), 7)
    }

    func testParseReferenceReturnsNilWhenThereIsNoNumber() {
        XCTAssertNil(Format.parseReference(""))
        XCTAssertNil(Format.parseReference(nil))
        XCTAssertNil(Format.parseReference("none"))
    }

    func testReferenceSurvivesARoundTrip() {
        XCTAssertEqual(Format.parseReference(Format.reference(931)), 931)
    }

    func testTodayIsoIsABareUTCDate() {
        XCTAssertNotNil(Format.todayIso().range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression))
        // 23:30 in New York on Oct 29 is already Oct 30 in UTC, as toISOString says.
        let lateEvening = ISO8601DateFormatter().date(from: "2026-10-30T03:30:00Z")!
        XCTAssertEqual(Format.todayIso(now: lateEvening), "2026-10-30")
    }

    func testAmountTextAndOptionalAmountKeepNilApartFromZero() {
        XCTAssertEqual(Format.amountText(nil), "")
        XCTAssertEqual(Format.amountText(0), "0")
        XCTAssertNil(Format.optionalAmount(""))
        XCTAssertEqual(Format.optionalAmount("0"), 0)
    }
}
