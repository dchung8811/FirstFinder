import Foundation

// Port of src/utils/constants.js: the vocabularies the whole app agrees on.
// Changing one on the web means changing it here; ConstantsTests pins them.
enum Vocab {
    // "Wishlist" is deliberately not a status: wants are their own table.
    static let statuses = ["Owned", "Researching", "For sale", "Sold"]
    static let quickCategories = ["Book", "Sports memorabilia", "Trading card", "Comic", "Magazine & periodical", "Record", "Art", "Posters & ephemera", "Toy", "Other"]
    // Categories whose credit is a person who wrote the thing, so they show
    // the Author field. Every value must be one of quickCategories.
    static let authoredCategories = ["Book", "Comic"]
    static let conditionOptions = ["Near Fine/Fine", "Very Good/Good", "Fair", "Poor"]
    static let bookEditionOptions = ["First", "Second", "Third", "Fourth", "Fifth", "Other"]
    static let bookPrintingOptions = ["First", "Second", "Third", "Fourth", "Fifth", "Other"]
    static let itemPhotoPrompts = ["Front", "Back", "Details", "Condition", "Signature/markings"]
    static let receiptPhotoPrompts = ["Receipt", "Invoice", "Order confirmation", "Auction record"]

    static let csvItemFields = ["name", "category", "author", "maker", "edition", "bookGenre", "bookEdition", "bookPrinting", "status", "condition", "purchaseDate", "source", "purchasePrice", "estimatedValue", "soldPrice", "soldDate", "notes"]
    static let csvHeaders = ["ref"] + csvItemFields + ["delete"]

    // sampleItems, as the web's "Load sample" button fills them in.
    static let sampleItems: [Item] = [
        Item(
            id: "", name: "The Gunslinger", category: "Book", author: "Stephen King", maker: "Donald M. Grant",
            status: "Owned", purchaseDate: "2026-05-12", source: "Used bookstore", purchasePrice: 45,
            estimatedValue: 850, notes: "Need to confirm jacket state. Receipt saved."
        ),
        Item(
            id: "", name: "Beloved", category: "Book", author: "Toni Morrison", maker: "Alfred A. Knopf",
            status: "Researching", purchaseDate: "2026-05-08", source: "Estate sale", purchasePrice: 30,
            estimatedValue: 300, notes: "Need signature verification before listing."
        ),
        Item(
            id: "", name: "Vintage Phillies Program", category: "Sports memorabilia", maker: "Philadelphia Phillies",
            edition: "1970s program", status: "Owned", purchaseDate: "2026-04-28", source: "Flea market",
            purchasePrice: 12, estimatedValue: 40, notes: "Good condition, minor corner wear."
        ),
    ]
}
