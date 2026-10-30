import Foundation

// Port of src/utils/csv.js: the collection's CSV -- template, export, and the
// import parser that sorts a file into adds, updates, deletes and skips
// before anything is applied.
enum Csv {
    static func escape(_ value: String) -> String {
        guard value.contains(where: { $0 == "," || $0 == "\"" || $0 == "\n" }) else { return value }
        return "\"" + value.replacingOccurrences(of: "\"", with: "\"\"") + "\""
    }

    static let templateRows: [[String]] = [
        ["", "The Gunslinger", "Book", "Stephen King", "Donald M. Grant", "", "Fantasy", "First", "First", "Owned", "Near Fine/Fine", "2026-05-12", "Used bookstore", "45", "850", "", "", "Need to confirm jacket state", ""],
        ["", "Vintage Phillies Program", "Sports memorabilia", "", "Philadelphia Phillies", "1970s program", "", "", "", "Sold", "Very Good/Good", "2026-04-28", "Flea market", "12", "", "40", "2026-06-01", "Minor corner wear. Sold at a local card show.", ""],
    ]

    static func template() -> String {
        ([Vocab.csvHeaders] + templateRows).map { $0.map(escape).joined(separator: ",") }.joined(separator: "\n")
    }

    // The value of an item field as the web's CSV writes it.
    static func value(_ item: Item, _ field: String) -> String {
        switch field {
        case "name": item.name
        case "category": item.category
        case "author": item.author
        case "maker": item.maker
        case "edition": item.edition
        case "bookGenre": item.bookGenre
        case "bookEdition": item.bookEdition
        case "bookPrinting": item.bookPrinting
        case "status": item.status
        case "condition": item.condition
        case "purchaseDate": item.purchaseDate
        case "source": item.source
        case "purchasePrice": Format.amountText(item.purchasePrice)
        case "estimatedValue": Format.amountText(item.estimatedValue)
        case "soldPrice": Format.amountText(item.soldPrice)
        case "soldDate": item.soldDate
        case "notes": item.notes
        default: ""
        }
    }

    static func export(_ items: [Item]) -> String {
        let rows = items.map { item in [Format.reference(item.referenceNumber)] + Vocab.csvItemFields.map { value(item, $0) } + [""] }
        return ([Vocab.csvHeaders] + rows).map { $0.map(escape).joined(separator: ",") }.joined(separator: "\n")
    }

    // parseCsvRows: quoted fields, doubled quotes, CRLF, blank rows dropped.
    static func parseRows(_ text: String) -> [[String]] {
        var rows: [[String]] = []
        var row: [String] = []
        var field = ""
        var inQuotes = false
        let characters = Array(text.unicodeScalars)
        var index = 0
        while index < characters.count {
            let char = characters[index]
            let next = index + 1 < characters.count ? characters[index + 1] : nil
            if inQuotes {
                if char == "\"", next == "\"" { field.unicodeScalars.append("\""); index += 1 }
                else if char == "\"" { inQuotes = false }
                else { field.unicodeScalars.append(char) }
            } else if char == "\"" {
                inQuotes = true
            } else if char == "," {
                row.append(field.trimmingCharacters(in: .whitespaces)); field = ""
            } else if char == "\n" || char == "\r" {
                if char == "\r", next == "\n" { index += 1 }
                row.append(field.trimmingCharacters(in: .whitespaces)); field = ""
                rows.append(row); row = []
            } else {
                field.unicodeScalars.append(char)
            }
            index += 1
        }
        if !field.isEmpty || !row.isEmpty {
            row.append(field.trimmingCharacters(in: .whitespaces))
            rows.append(row)
        }
        return rows.filter { $0.contains { !$0.isEmpty } }
    }

    static func sanitize(_ row: [String: String], presentHeaders: [String]) -> [String: String] {
        var fields: [String: String] = [:]
        for field in Vocab.csvItemFields where presentHeaders.contains(field) { fields[field] = row[field] ?? "" }
        if let status = fields["status"] {
            fields["status"] = status == "Wishlist" ? "Researching" : (Vocab.statuses.contains(status) ? status : "Owned")
        }
        if let condition = fields["condition"] { fields["condition"] = Vocab.conditionOptions.contains(condition) ? condition : "" }
        if let edition = fields["bookEdition"] { fields["bookEdition"] = Vocab.bookEditionOptions.contains(edition) ? edition : "" }
        if let printing = fields["bookPrinting"] { fields["bookPrinting"] = Vocab.bookPrintingOptions.contains(printing) ? printing : "" }
        return fields
    }

    struct Rejected: Hashable { var line: Int; var reference: String; var reason: String }
    struct Update { var existing: Item; var fields: [String: String] }

    struct Batch {
        var creates: [Item] = []
        var updates: [Update] = []
        var deletes: [Item] = []
        var rejected: [Rejected] = []
        var error: String?
    }

    // An item from a CSV row's fields (makeSavedItem over emptyItem).
    static func item(from fields: [String: String]) -> Item {
        var item = Item.empty()
        item.name = fields["name"] ?? ""
        item.category = fields["category"].flatMap { $0.isEmpty ? nil : $0 } ?? "Book"
        item.author = fields["author"] ?? ""
        item.maker = fields["maker"] ?? ""
        item.edition = fields["edition"] ?? ""
        item.bookGenre = fields["bookGenre"] ?? ""
        item.bookEdition = fields["bookEdition"] ?? ""
        item.bookPrinting = fields["bookPrinting"] ?? ""
        item.status = fields["status"].flatMap { $0.isEmpty ? nil : $0 } ?? "Owned"
        item.condition = fields["condition"] ?? ""
        item.purchaseDate = fields["purchaseDate"] ?? ""
        item.source = fields["source"] ?? ""
        item.purchasePrice = Format.optionalAmount(fields["purchasePrice"] ?? "")
        item.estimatedValue = Format.optionalAmount(fields["estimatedValue"] ?? "")
        item.soldPrice = Format.optionalAmount(fields["soldPrice"] ?? "")
        item.soldDate = fields["soldDate"] ?? ""
        item.notes = fields["notes"] ?? ""
        return item
    }

    static func parseBatch(_ text: String, existing: [Item]) -> Batch {
        let rows = parseRows(text)
        guard rows.count >= 2 else { return Batch(error: "That file has no data rows.") }
        let headers = rows[0].map { $0.trimmingCharacters(in: .whitespaces) }
        let lower = headers.map { $0.lowercased() }
        guard lower.contains("name") || lower.contains("ref") else {
            return Batch(error: "Couldn't find a \"name\" or \"ref\" column. Use the downloaded template so columns match: \(Vocab.csvHeaders.joined(separator: ", ")).")
        }

        var byReference: [Int: Item] = [:]
        for item in existing { if let reference = item.referenceNumber { byReference[reference] = item } }

        var batch = Batch()
        var seen: [Int: Int] = [:]
        for index in 1..<rows.count {
            let values = rows[index]
            var row: [String: String] = [:]
            for (position, header) in headers.enumerated() { row[header] = position < values.count ? values[position] : "" }
            let line = index + 1
            let reference = Format.parseReference(row["ref"])
            let isDelete = Vocab.csvDeleteTokens.contains((row["delete"] ?? "").trimmingCharacters(in: .whitespaces).lowercased())

            if let reference {
                if let first = seen[reference] {
                    return Batch(error: "\(Format.reference(reference)) appears on both line \(first) and line \(line). Each reference can only appear once per file, so nothing was changed.")
                }
                seen[reference] = line
            }
            if isDelete, reference == nil {
                batch.rejected.append(.init(line: line, reference: "", reason: "Marked for deletion but has no reference number, so there's no way to tell which item you meant."))
                continue
            }
            if let reference {
                guard let match = byReference[reference] else {
                    batch.rejected.append(.init(line: line, reference: Format.reference(reference), reason: "No item in your collection has this reference number."))
                    continue
                }
                if isDelete { batch.deletes.append(match) } else { batch.updates.append(.init(existing: match, fields: sanitize(row, presentHeaders: headers))) }
                continue
            }
            let fields = sanitize(row, presentHeaders: headers)
            if (fields["name"] ?? "").trimmingCharacters(in: .whitespaces).isEmpty { continue }
            batch.creates.append(item(from: fields))
        }

        if batch.creates.count + batch.updates.count + batch.deletes.count == 0 {
            batch.error = batch.rejected.isEmpty ? "No rows in that file had anything to add, change, or remove." : "No rows could be applied. See the details below."
            batch.creates = []
            batch.updates = []
            batch.deletes = []
        }
        return batch
    }
}
