import Foundation

// The camelCase models the screens work with, mirroring what src/utils/mapping.js
// produces on the web. Text fields are non-optional strings ("" when the
// column was null), as on the web. Money is Decimal?: nil means "not
// entered", which is a different claim from zero, and nothing defaults it.

struct Photo: Hashable, Sendable, Identifiable {
    var id: String { path }
    var path: String
    var name: String
}

struct Item: Hashable, Sendable, Identifiable {
    var id: String
    var referenceNumber: Int?
    var name: String = ""
    var category: String = "Book"
    var author: String = ""
    var maker: String = ""
    var edition: String = ""
    var bookGenre: String = ""
    var bookEdition: String = ""
    var bookPrinting: String = ""
    var status: String = "Owned"
    var condition: String = ""
    var purchaseDate: String = ""
    var source: String = ""
    var purchasePrice: Decimal?
    var estimatedValue: Decimal?
    var previousStatus: String = ""
    var soldPrice: Decimal?
    var soldDate: String = ""
    var notes: String = ""
    var hiddenFromShare: Bool = false
    var itemPhotoCount: Int = 0
    var receiptPhotoCount: Int = 0
    var itemPhotos: [Photo] = []
    var receiptPhotos: [Photo] = []
    var savedAt: String = ""

    // A blank item, as emptyItem in src/utils/constants.js. The id is a
    // placeholder until the overlay saves it.
    static func empty() -> Item {
        Item(id: "")
    }
}

struct Want: Hashable, Sendable, Identifiable {
    var id: String
    var name: String = ""
    var maker: String = ""
    var category: String = "Book"
    var wantedEdition: String = ""
    var wantedPrinting: String = ""
    var publisher: String = ""
    var minCondition: String = ""
    var jacketRequirement: String = "any"
    var signatureRequirement: String = "any"
    // Same rule as estimatedValue: nil is "no ceiling set", not "would pay nothing".
    var maxPrice: Decimal?
    var preferredSource: String = ""
    var priority: String = "hunting"
    var upgradeForItemId: String = ""
    var notes: String = ""
    var hiddenFromShare: Bool = false
    var foundAt: String = ""
    var foundItemId: String = ""
    var createdAt: String = ""
    var updatedAt: String = ""
}

struct ShareSettings: Hashable, Sendable {
    var slug: String = ""
    var visibility: String = "off"
    var title: String = ""
    var blurb: String = ""
    var showEstimatedValue = false
    var showPrices = false
    var showProvenance = false
    var showNotes = false
    var showSold = false
    var showWishlist = false
    var showOnExplore = false
    var exploreItemIds: [String] = []
}

struct SiteBanner: Hashable, Sendable {
    var enabled = false
    var message = ""
    var linkLabel = ""
    var linkView = ""
    var updatedAt: String?
}

// The signed-in collector, as far as the screens need to know them. Built from
// the auth session, never from a table.
struct UserProfile: Hashable, Sendable {
    var id: String
    var email: String
    var fullName: String
    var createdAt: Date?
    var emailUpdates: Bool
}
