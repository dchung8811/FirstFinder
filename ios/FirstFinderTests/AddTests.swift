import XCTest
@testable import FirstFinder

// Ported from src/utils/scanFill.test.js.
final class ScanFillTests: XCTestCase {
    func testReadsTheLowestNumberOnALine() {
        XCTAssertEqual(ScanFill.printingFromNumberLine("10 9 8 7 6 5 4 3 2 1"), 1)
        XCTAssertEqual(ScanFill.printingFromNumberLine("10 9 8 7 6 5 4 3"), 3)
        XCTAssertEqual(ScanFill.printingFromNumberLine("1 3 5 7 9 10 8 6 4 2"), 1)
        XCTAssertEqual(ScanFill.printingFromNumberLine("2 3 4 5 6 7 8 9 10"), 2)
    }

    func testIgnoresYearCodesAndPrinterCodes() {
        XCTAssertEqual(ScanFill.printingFromNumberLine("81 82 83 84 85 10 9 8 7 6 5 4 3 2"), 2)
        XCTAssertEqual(ScanFill.printingFromNumberLine("05 06 07 08 RRD 10 9 8 7 6 5 4"), 4)
        XCTAssertEqual(ScanFill.printingFromNumberLine("BVG 10 9 8 7 6 5 4 3 2 1"), 1)
        XCTAssertEqual(ScanFill.printingFromNumberLine("Q-FF 5 4 3 2"), 2)
    }

    func testRefusesASingleNumberOrAYear() {
        XCTAssertNil(ScanFill.printingFromNumberLine("7"))
        XCTAssertNil(ScanFill.printingFromNumberLine(""))
        XCTAssertNil(ScanFill.printingFromNumberLine("A B C D E"))
        XCTAssertNil(ScanFill.printingFromNumberLine("© 1982"))
    }

    func testPrintingStatements() {
        XCTAssertEqual(ScanFill.printingFromStatement("Second printing, May 1962"), 2)
        XCTAssertEqual(ScanFill.printingFromStatement("FIRST PRINTING"), 1)
        XCTAssertEqual(ScanFill.printingFromStatement("7th printing"), 7)
        XCTAssertNil(ScanFill.printingFromStatement("First Edition"))
    }

    func testEditionStatements() {
        XCTAssertEqual(ScanFill.editionFromStatement("First Edition"), "First")
        XCTAssertEqual(ScanFill.editionFromStatement("FIRST AMERICAN EDITION"), "First")
        XCTAssertEqual(ScanFill.editionFromStatement("First U.S. Edition"), "First")
        XCTAssertEqual(ScanFill.editionFromStatement("Second Edition"), "Second")
        XCTAssertEqual(ScanFill.editionFromStatement("First printing"), "First")
        XCTAssertEqual(ScanFill.editionFromStatement("Book Club Edition"), "Other")
        XCTAssertEqual(ScanFill.editionFromStatement("First Edition — Book Club"), "Other")
        XCTAssertEqual(ScanFill.editionFromStatement("Revised edition"), "Other")
        XCTAssertEqual(ScanFill.editionFromStatement(""), "")
        XCTAssertEqual(ScanFill.editionFromStatement("Printed in the USA"), "")
    }

    func testPrintingLabels() {
        XCTAssertEqual(ScanFill.printingLabel(1), "First")
        XCTAssertEqual(ScanFill.printingLabel(5), "Fifth")
        XCTAssertEqual(ScanFill.printingLabel(6), "Other")
        XCTAssertEqual(ScanFill.printingLabel(0), "")
    }

    func testReadingEditionAndPrinting() {
        let first = ScanFill.readEditionAndPrinting(editionStatement: "First Edition", printingStatement: "", numberLine: "10 9 8 7 6 5 4 3 2 1", publisher: "")
        XCTAssertEqual([first.bookEdition, first.bookPrinting], ["First", "First"])
        XCTAssertTrue(first.reasons.joined(separator: " ").contains("lowest number on the number line is 1"))

        let seventh = ScanFill.readEditionAndPrinting(editionStatement: "", printingStatement: "", numberLine: "10 9 8 7", publisher: "")
        XCTAssertEqual(seventh.bookPrinting, "Other")
        XCTAssertTrue(seventh.reasons.joined(separator: " ").contains("is 7, so this is the seventh printing"))

        let words = ScanFill.readEditionAndPrinting(editionStatement: "", printingStatement: "Second printing", numberLine: "10 9 8 7 6 5 4 3 2 1", publisher: "")
        XCTAssertEqual(words.bookPrinting, "Second")
    }

    func testRandomHouseFirstPrintingsStartAtTwo() {
        let randomHouse = ScanFill.readEditionAndPrinting(editionStatement: "First Edition", printingStatement: "", numberLine: "9 8 7 6 5 4 3 2", publisher: "Random House")
        XCTAssertEqual(randomHouse.bookPrinting, "First")
        XCTAssertEqual(ScanFill.readEditionAndPrinting(editionStatement: "First Edition", printingStatement: "", numberLine: "9 8 7 6 5 4 3 2", publisher: "Knopf").bookPrinting, "Second")
        XCTAssertEqual(ScanFill.readEditionAndPrinting(editionStatement: "", printingStatement: "", numberLine: "9 8 7 6 5 4 3 2", publisher: "Random House").bookPrinting, "Second")
    }

    func testLeavesThePrintingBlankWhenThereIsNoLine() {
        let read = ScanFill.readEditionAndPrinting(editionStatement: "First Edition", printingStatement: "", numberLine: "", publisher: "")
        XCTAssertEqual([read.bookEdition, read.bookPrinting], ["First", ""])
        XCTAssertTrue(read.reasons.joined().contains("confirm"))
    }

    func testMergeFillsOnlyWhatIsEmpty() {
        var item = Item.empty()
        item.name = "Typed by hand"
        let (merged, filled) = ScanFill.merge(item, fields: ["name": "Scanned", "author": "Mara Ellery", "category": "Comic"])
        XCTAssertEqual(merged.name, "Typed by hand")
        XCTAssertEqual(merged.author, "Mara Ellery")
        XCTAssertEqual(merged.category, "Book", "category only moves while there's no name")
        XCTAssertEqual(filled, ["author"])
    }

    func testABooksAuthorAndPublisherGoToTheirOwnFields() {
        let (fields, _) = ScanFill.fields(from: .init(category: "Book", title: "Dune", author: "Frank Herbert", publisher: "Chilton"))
        XCTAssertEqual(fields["author"], "Frank Herbert")
        XCTAssertEqual(fields["maker"], "Chilton")
        let (record, _) = ScanFill.fields(from: .init(category: "Record", title: "LP", author: "Band", publisher: ""))
        XCTAssertEqual(record["maker"], "Band")
        XCTAssertNil(record["author"])
    }
}

// Ported from src/utils/csv.test.js.
final class CsvTests: XCTestCase {
    private let existing = [
        Item(id: "a", referenceNumber: 1, name: "Dune"),
        Item(id: "b", referenceNumber: 2, name: "Emma"),
    ]

    func testParsesQuotedFieldsAndCRLF() {
        let rows = Csv.parseRows("name,notes\r\n\"Dune, 1st\",\"He said \"\"hi\"\"\"\r\n\r\n")
        XCTAssertEqual(rows, [["name", "notes"], ["Dune, 1st", "He said \"hi\""]])
    }

    func testRoundTripsAnExport() {
        let text = Csv.export([Item(id: "a", referenceNumber: 7, name: "A, B", estimatedValue: nil)])
        XCTAssertTrue(text.hasPrefix(Vocab.csvHeaders.joined(separator: ",")))
        XCTAssertTrue(text.contains("FF-0007,\"A, B\""))
    }

    func testSortsAFileIntoAddsUpdatesDeletesAndSkips() {
        let csv = """
        ref,name,status,delete
        ,New one,Owned,
        FF-0001,Dune renamed,Sold,
        FF-0002,,,yes
        FF-0099,Ghost,,
        ,No ref delete,,yes
        """
        let batch = Csv.parseBatch(csv, existing: existing)
        XCTAssertNil(batch.error)
        XCTAssertEqual(batch.creates.map(\.name), ["New one"])
        XCTAssertEqual(batch.updates.first?.fields["name"], "Dune renamed")
        XCTAssertEqual(batch.deletes.map(\.id), ["b"])
        XCTAssertEqual(batch.rejected.map(\.line), [5, 6])
    }

    func testRefusesAFileThatNamesAReferenceTwice() {
        let batch = Csv.parseBatch("ref,name\nFF-0001,a\n1,b", existing: existing)
        XCTAssertEqual(batch.error, "FF-0001 appears on both line 2 and line 3. Each reference can only appear once per file, so nothing was changed.")
        XCTAssertTrue(batch.creates.isEmpty && batch.updates.isEmpty)
    }

    func testNeedsANameOrRefColumn() {
        XCTAssertNotNil(Csv.parseBatch("title,author\nDune,Herbert", existing: []).error)
        XCTAssertEqual(Csv.parseBatch("name", existing: []).error, "That file has no data rows.")
    }

    func testSanitizesVocabularies() {
        let fields = Csv.sanitize(["status": "Wishlist", "condition": "Mint", "bookEdition": "First"], presentHeaders: ["status", "condition", "bookEdition"])
        XCTAssertEqual(fields["status"], "Researching")
        XCTAssertEqual(fields["condition"], "")
        XCTAssertEqual(fields["bookEdition"], "First")
    }

    func testABlankEstimateInACsvIsNil() {
        let batch = Csv.parseBatch("name,estimatedValue,purchasePrice\nDune,,", existing: [])
        XCTAssertNil(batch.creates.first?.estimatedValue)
    }
}

final class BookSearchTests: XCTestCase {
    func testTheBundledGuidesLoad() {
        XCTAssertFalse(BookSearch.works.isEmpty)
    }

    func testGuidesComeFirstAndDuplicatesMerge() {
        let guides = BookSearch.searchGuides("dune")
        XCTAssertEqual(guides.first?.title, "Dune")
        let merged = BookSearch.merge(guides: guides, catalog: [BookCatalogRow(id: "x", title: "Dune", author: "Frank Herbert", publisher: "Chilton", firstPublishedYear: 1965)])
        XCTAssertEqual(merged.filter { $0.title == "Dune" }.count, 1)
        XCTAssertEqual(merged.first?.tier, .guide)
    }

    func testNeedsThreeLetters() {
        XCTAssertTrue(BookSearch.searchGuides("du").isEmpty)
    }

    func testComparableTitleIgnoresArticlesAndBrackets() {
        XCTAssertEqual(BookSearch.comparableTitle("The Gunslinger [Signed] (Dark Tower #1)"), "gunslinger")
    }

    func testApplyingASuggestionAssumesAFirstUnlessSet() {
        var item = Item.empty()
        item.bookPrinting = "Second"
        let next = BookSearch.apply(.init(key: "k", tier: .catalog, title: "Dune", author: "Frank Herbert", publisher: "Chilton", year: 1965), to: item)
        XCTAssertEqual([next.name, next.author, next.maker, next.bookEdition, next.bookPrinting], ["Dune", "Frank Herbert", "Chilton", "First", "Second"])
    }
}

@MainActor
final class FakeAITests: XCTestCase {
    func testAnIdentificationNeverPrefillsWhatYouPaidOrTheEstimate() {
        let draft = IdentifyDraft(result: FakeAI.sampleIdentification(photoCount: 1), photos: [])
        XCTAssertEqual(draft.form.paidText, "")
        XCTAssertEqual(draft.form.valueText, "")
        XCTAssertNil(draft.form.built().estimatedValue)
        XCTAssertNotNil(draft.valueRange)
    }

    func testARecheckKeepsWhatTheCollectorTyped() {
        var draft = IdentifyDraft(result: FakeAI.sampleIdentification(photoCount: 1), photos: [])
        draft.form.paidText = "40"
        draft.form.item.source = "Book fair"
        draft.apply(FakeAI.sampleIdentification(photoCount: 3))
        XCTAssertEqual(draft.form.paidText, "40")
        XCTAssertEqual(draft.form.item.source, "Book fair")
        XCTAssertEqual(draft.form.item.bookEdition, "First")
    }

    func testFailuresUseTheRoutesWords() async {
        let ai = FakeAI()
        ai.outcome = .notABook
        do {
            _ = try await ai.identify(photoCount: 1)
            XCTFail("expected a failure")
        } catch let failure as FakeAI.Failure {
            XCTAssertEqual(failure.message, "That doesn't look like a book or printed collectible. Try a photo of the cover.")
        } catch {
            XCTFail("\(error)")
        }
    }

    func testTheDailyCapQuotesMidnightUTC() {
        XCTAssertEqual(FakeAI.capMessage(2), "You've used your 2 photo identifications for today. The count resets at midnight UTC.")
    }
}
