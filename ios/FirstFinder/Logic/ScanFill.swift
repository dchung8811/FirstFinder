import Foundation

// Port of src/utils/scanFill.js: turns what the scanner read off a cover and
// copyright page into item fields, and reads the printing from the number
// line. Pure, like the web's, so it's tested without a scanner.
enum ScanFill {
    static let ordinalWords = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"]
    static let printingLabels = ["First", "Second", "Third", "Fourth", "Fifth"]

    struct ScanResult: Hashable, Sendable {
        var category = ""
        var title = ""
        var author = ""
        var publisher = ""
        var editionStatement = ""
        var printingStatement = ""
        var numberLine = ""
        var publicationYear = ""
        var isbn = ""
    }

    static func printingLabel(_ number: Int) -> String {
        guard number >= 1 else { return "" }
        return number <= printingLabels.count ? printingLabels[number - 1] : "Other"
    }

    static func ordinal(_ number: Int) -> String {
        if number >= 1, number <= ordinalWords.count { return ordinalWords[number - 1] }
        let tens = number % 100
        let suffix = (11...13).contains(tens) ? "th" : [1: "st", 2: "nd", 3: "rd"][number % 10] ?? "th"
        return "\(number)\(suffix)"
    }

    private static func matches(_ pattern: String, in text: String) -> [[String]] {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        return regex.matches(in: text, range: NSRange(text.startIndex..., in: text)).map { match in
            (0..<match.numberOfRanges).map { index in
                Range(match.range(at: index), in: text).map { String(text[$0]) } ?? ""
            }
        }
    }

    // The lowest of the printing numbers, or nil when there aren't at least
    // two to call it a number line. Two-digit tokens with a leading zero are
    // years, not printings.
    static func printingFromNumberLine(_ numberLine: String) -> Int? {
        let printings = matches(#"\b\d{1,2}\b"#, in: numberLine)
            .map { $0[0] }
            .filter { !($0.count == 2 && $0.hasPrefix("0")) }
            .compactMap(Int.init)
            .filter { (1...30).contains($0) }
        guard printings.count >= 2 else { return nil }
        return printings.min()
    }

    static func printingFromStatement(_ statement: String) -> Int? {
        let text = statement.lowercased()
        if let word = matches("\\b(\(ordinalWords.joined(separator: "|")))\\s+printing\\b", in: text).first {
            return (ordinalWords.firstIndex(of: word[1]) ?? 0) + 1
        }
        if let numeral = matches(#"\b(\d{1,2})(?:st|nd|rd|th)\s+printing\b"#, in: text).first {
            return Int(numeral[1])
        }
        return nil
    }

    static func editionFromStatement(_ statement: String) -> String {
        let text = statement.lowercased()
        guard !text.trimmingCharacters(in: .whitespaces).isEmpty else { return "" }
        if !matches(#"book\s*club"#, in: text).isEmpty { return "Other" }
        let five = ordinalWords.prefix(5).joined(separator: "|")
        if let word = matches("\\b(\(five))\\b(?:\\s+[a-z.]+)?\\s+edition\\b", in: text).first,
           let index = ordinalWords.firstIndex(of: word[1]) {
            return printingLabels[index]
        }
        if !matches(#"\bfirst\s+printing\b"#, in: text).isEmpty { return "First" }
        if !matches(#"\bedition\b"#, in: text).isEmpty { return "Other" }
        return ""
    }

    static func readEditionAndPrinting(editionStatement: String, printingStatement: String, numberLine: String, publisher: String) -> (bookEdition: String, bookPrinting: String, reasons: [String]) {
        var reasons: [String] = []
        let bookEdition = editionFromStatement(editionStatement)
        if !bookEdition.isEmpty { reasons.append("The copyright page says \"\(editionStatement.trimmingCharacters(in: .whitespaces))\".") }

        if let stated = printingFromStatement(printingStatement) ?? printingFromStatement(editionStatement) {
            reasons.append("It states the \(ordinal(stated)) printing in words.")
            return (bookEdition.isEmpty ? (stated == 1 ? "First" : "") : bookEdition, printingLabel(stated), reasons)
        }

        guard let lowest = printingFromNumberLine(numberLine) else {
            let line = numberLine.trimmingCharacters(in: .whitespaces)
            if !line.isEmpty {
                reasons.append("Couldn't read a printing from the number line \"\(line)\". Check it against the book.")
            } else if bookEdition == "First" {
                reasons.append("No number line was found, so the printing is left for you to confirm. Some publishers kept the edition statement on later printings.")
            }
            return (bookEdition, "", reasons)
        }

        if lowest == 2, bookEdition == "First", publisher.range(of: #"random\s+house"#, options: [.regularExpression, .caseInsensitive]) != nil {
            reasons.append("The number line starts at 2, which on a Random House book stating \"First Edition\" is a first printing. Random House dropped the statement on later printings.")
            return (bookEdition, "First", reasons)
        }

        reasons.append("The lowest number on the number line is \(lowest), so this is the \(ordinal(lowest)) printing.")
        return (bookEdition, printingLabel(lowest), reasons)
    }

    // scanResultToFields: only non-empty fields, keyed by item field name.
    static func fields(from result: ScanResult) -> (fields: [String: String], reasons: [String]) {
        let category = Vocab.quickCategories.contains(result.category) ? result.category : "Book"
        let title = result.title.trimmingCharacters(in: .whitespaces)
        let author = result.author.trimmingCharacters(in: .whitespaces)
        let publisher = result.publisher.trimmingCharacters(in: .whitespaces)
        var fields = ["category": category, "name": title]
        if Vocab.authoredCategories.contains(category) {
            fields["author"] = author
            fields["maker"] = publisher
        } else {
            fields["maker"] = publisher.isEmpty ? author : publisher
        }
        var reasons: [String] = []
        if category == "Book" {
            let read = readEditionAndPrinting(editionStatement: result.editionStatement, printingStatement: result.printingStatement, numberLine: result.numberLine, publisher: publisher)
            fields["bookEdition"] = read.bookEdition
            fields["bookPrinting"] = read.bookPrinting
            reasons = read.reasons
        }
        return (fields.filter { !$0.value.isEmpty }, reasons)
    }

    nonisolated(unsafe) static let fieldPaths: [String: WritableKeyPath<Item, String>] = [
        "name": \.name, "author": \.author, "maker": \.maker, "bookEdition": \.bookEdition, "bookPrinting": \.bookPrinting,
    ]

    // mergeScanIntoItem: fills only what's empty, so a scan never overwrites
    // what the collector typed. Category moves only while there's no name.
    static func merge(_ item: Item, fields: [String: String]) -> (item: Item, filled: [String]) {
        var next = item
        var filled: [String] = []
        for key in fields.keys.sorted() {
            guard let value = fields[key] else { continue }
            if key == "category" {
                if item.name.trimmingCharacters(in: .whitespaces).isEmpty, value != item.category {
                    next.category = value
                    filled.append(key)
                }
                continue
            }
            guard let path = fieldPaths[key] else { continue }
            if item[keyPath: path].trimmingCharacters(in: .whitespaces).isEmpty {
                next[keyPath: path] = value
                filled.append(key)
            }
        }
        return (next, filled)
    }
}
