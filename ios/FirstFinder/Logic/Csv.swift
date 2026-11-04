import Foundation

// The export half of src/utils/csv.js: the collection as a CSV, for the
// insurance page. The app has no CSV import -- bulk editing a collection
// through a spreadsheet is a desk job, and stays on the web.
enum Csv {
    static func escape(_ value: String) -> String {
        guard value.contains(where: { $0 == "," || $0 == "\"" || $0 == "\n" }) else { return value }
        return "\"" + value.replacingOccurrences(of: "\"", with: "\"\"") + "\""
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
}
