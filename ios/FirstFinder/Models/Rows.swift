import Foundation

// The database rows the prototype reads, field for field with
// supabase/schema.sql. These are the snake_case shape PostgREST returns; the
// screens never see them directly, only the camelCase models Mapping.swift
// builds from them, exactly as the web reads through src/utils/mapping.js.
//
// Money columns are Decimal? throughout. Postgres returns null for "no
// estimate yet", and that null has to survive all the way to the totals.

struct InventoryRow: Codable, Hashable, Sendable {
    var id: String
    var userId: String
    var referenceNumber: Int?
    var name: String?
    var category: String?
    var author: String?
    var maker: String?
    var edition: String?
    var bookGenre: String?
    var bookEdition: String?
    var bookPrinting: String?
    var status: String?
    var condition: String?
    var purchaseDate: String?
    var source: String?
    var purchasePrice: Decimal?
    var estimatedValue: Decimal?
    var previousStatus: String?
    var soldPrice: Decimal?
    var soldDate: String?
    var notes: String?
    var hiddenFromShare: Bool?
    var itemPhotos: PhotoColumn
    var receiptPhotos: PhotoColumn
    var itemPhotoCount: Int?
    var receiptPhotoCount: Int?
    var createdAt: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case referenceNumber = "reference_number"
        case name, category, author, maker, edition
        case bookGenre = "book_genre"
        case bookEdition = "book_edition"
        case bookPrinting = "book_printing"
        case status, condition
        case purchaseDate = "purchase_date"
        case source
        case purchasePrice = "purchase_price"
        case estimatedValue = "estimated_value"
        case previousStatus = "previous_status"
        case soldPrice = "sold_price"
        case soldDate = "sold_date"
        case notes
        case hiddenFromShare = "hidden_from_share"
        case itemPhotos = "item_photos"
        case receiptPhotos = "receipt_photos"
        case itemPhotoCount = "item_photo_count"
        case receiptPhotoCount = "receipt_photo_count"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    init(
        id: String, userId: String, referenceNumber: Int? = nil, name: String? = nil, category: String? = nil,
        author: String? = nil, maker: String? = nil, edition: String? = nil, bookGenre: String? = nil,
        bookEdition: String? = nil, bookPrinting: String? = nil, status: String? = nil, condition: String? = nil,
        purchaseDate: String? = nil, source: String? = nil, purchasePrice: Decimal? = nil,
        estimatedValue: Decimal? = nil, previousStatus: String? = nil, soldPrice: Decimal? = nil,
        soldDate: String? = nil, notes: String? = nil, hiddenFromShare: Bool? = nil,
        itemPhotos: PhotoColumn = PhotoColumn(), receiptPhotos: PhotoColumn = PhotoColumn(),
        itemPhotoCount: Int? = nil, receiptPhotoCount: Int? = nil, createdAt: String? = nil, updatedAt: String? = nil
    ) {
        self.id = id
        self.userId = userId
        self.referenceNumber = referenceNumber
        self.name = name
        self.category = category
        self.author = author
        self.maker = maker
        self.edition = edition
        self.bookGenre = bookGenre
        self.bookEdition = bookEdition
        self.bookPrinting = bookPrinting
        self.status = status
        self.condition = condition
        self.purchaseDate = purchaseDate
        self.source = source
        self.purchasePrice = purchasePrice
        self.estimatedValue = estimatedValue
        self.previousStatus = previousStatus
        self.soldPrice = soldPrice
        self.soldDate = soldDate
        self.notes = notes
        self.hiddenFromShare = hiddenFromShare
        self.itemPhotos = itemPhotos
        self.receiptPhotos = receiptPhotos
        self.itemPhotoCount = itemPhotoCount
        self.receiptPhotoCount = receiptPhotoCount
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    init(from decoder: any Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        userId = try c.decode(String.self, forKey: .userId)
        referenceNumber = try c.decodeIfPresent(Int.self, forKey: .referenceNumber)
        name = try c.decodeIfPresent(String.self, forKey: .name)
        category = try c.decodeIfPresent(String.self, forKey: .category)
        author = try c.decodeIfPresent(String.self, forKey: .author)
        maker = try c.decodeIfPresent(String.self, forKey: .maker)
        edition = try c.decodeIfPresent(String.self, forKey: .edition)
        bookGenre = try c.decodeIfPresent(String.self, forKey: .bookGenre)
        bookEdition = try c.decodeIfPresent(String.self, forKey: .bookEdition)
        bookPrinting = try c.decodeIfPresent(String.self, forKey: .bookPrinting)
        status = try c.decodeIfPresent(String.self, forKey: .status)
        condition = try c.decodeIfPresent(String.self, forKey: .condition)
        purchaseDate = try c.decodeIfPresent(String.self, forKey: .purchaseDate)
        source = try c.decodeIfPresent(String.self, forKey: .source)
        purchasePrice = try c.decodeIfPresent(Decimal.self, forKey: .purchasePrice)
        estimatedValue = try c.decodeIfPresent(Decimal.self, forKey: .estimatedValue)
        previousStatus = try c.decodeIfPresent(String.self, forKey: .previousStatus)
        soldPrice = try c.decodeIfPresent(Decimal.self, forKey: .soldPrice)
        soldDate = try c.decodeIfPresent(String.self, forKey: .soldDate)
        notes = try c.decodeIfPresent(String.self, forKey: .notes)
        hiddenFromShare = try c.decodeIfPresent(Bool.self, forKey: .hiddenFromShare)
        itemPhotos = (try? c.decodeIfPresent(PhotoColumn.self, forKey: .itemPhotos)) ?? PhotoColumn()
        receiptPhotos = (try? c.decodeIfPresent(PhotoColumn.self, forKey: .receiptPhotos)) ?? PhotoColumn()
        itemPhotoCount = try c.decodeIfPresent(Int.self, forKey: .itemPhotoCount)
        receiptPhotoCount = try c.decodeIfPresent(Int.self, forKey: .receiptPhotoCount)
        createdAt = try c.decodeIfPresent(String.self, forKey: .createdAt)
        updatedAt = try c.decodeIfPresent(String.self, forKey: .updatedAt)
    }
}

// The item_photos / receipt_photos jsonb columns. jsonb is not typed, so a
// column holding something other than an array, or an array with a null or a
// record missing its path, has to decode rather than fail the whole row --
// fromDbPhotoList on the web tolerates the same things.
struct PhotoColumn: Codable, Hashable, Sendable {
    struct Record: Codable, Hashable, Sendable {
        var path: String?
        var name: String?
    }

    var records: [Record]

    init(records: [Record] = []) {
        self.records = records
    }

    init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        guard let elements = try? container.decode([Lenient<Record>].self) else {
            records = []
            return
        }
        records = elements.compactMap(\.value)
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(records)
    }
}

// Decodes to nil instead of throwing, so one malformed element can't take the
// rest of an array down with it.
struct Lenient<Value: Decodable & Sendable>: Decodable, Sendable {
    let value: Value?

    init(from decoder: any Decoder) throws {
        value = try? Value(from: decoder)
    }
}

struct WishlistRow: Codable, Hashable, Sendable {
    var id: String
    var userId: String
    var name: String?
    var maker: String?
    var category: String?
    var wantedEdition: String?
    var wantedPrinting: String?
    var publisher: String?
    var minCondition: String?
    var jacketRequirement: String?
    var signatureRequirement: String?
    var maxPrice: Decimal?
    var preferredSource: String?
    var priority: String?
    var upgradeForItemId: String?
    var notes: String?
    var hiddenFromShare: Bool?
    var foundAt: String?
    var foundItemId: String?
    var createdAt: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case name, maker, category
        case wantedEdition = "wanted_edition"
        case wantedPrinting = "wanted_printing"
        case publisher
        case minCondition = "min_condition"
        case jacketRequirement = "jacket_requirement"
        case signatureRequirement = "signature_requirement"
        case maxPrice = "max_price"
        case preferredSource = "preferred_source"
        case priority
        case upgradeForItemId = "upgrade_for_item_id"
        case notes
        case hiddenFromShare = "hidden_from_share"
        case foundAt = "found_at"
        case foundItemId = "found_item_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct SharedCollectionRow: Codable, Hashable, Sendable {
    var userId: String
    var slug: String?
    var visibility: String?
    var title: String?
    var blurb: String?
    var showEstimatedValue: Bool?
    var showPrices: Bool?
    var showProvenance: Bool?
    var showNotes: Bool?
    var showSold: Bool?
    var showWishlist: Bool?
    var showOnExplore: Bool?
    var exploreItemIds: [String]?
    var firstPublishedAt: String?
    var createdAt: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case slug, visibility, title, blurb
        case showEstimatedValue = "show_estimated_value"
        case showPrices = "show_prices"
        case showProvenance = "show_provenance"
        case showNotes = "show_notes"
        case showSold = "show_sold"
        case showWishlist = "show_wishlist"
        case showOnExplore = "show_on_explore"
        case exploreItemIds = "explore_item_ids"
        case firstPublishedAt = "first_published_at"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

// Only the columns a collector's own feedback screen has any business showing.
// The triage columns are the maintainer's, and the select names these
// explicitly rather than "*" so they never reach the phone.
struct FeedbackRow: Codable, Hashable, Sendable {
    var id: String
    var userId: String
    var description: String
    var photos: PhotoColumn
    var status: String?
    var createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case description, photos, status
        case createdAt = "created_at"
    }

    static let selectColumns = "id, user_id, description, photos, status, created_at"
}

// One row of search_book_catalog's result set.
struct BookCatalogRow: Codable, Hashable, Sendable {
    var id: String
    var title: String
    var author: String?
    var publisher: String?
    var firstPublishedYear: Int?
    var coverId: String?
    var source: String?

    enum CodingKeys: String, CodingKey {
        case id, title, author, publisher
        case firstPublishedYear = "first_published_year"
        case coverId = "cover_id"
        case source
    }
}

struct SiteBannerRow: Codable, Hashable, Sendable {
    var enabled: Bool?
    var message: String?
    var linkLabel: String?
    var linkView: String?
    var updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case enabled, message
        case linkLabel = "link_label"
        case linkView = "link_view"
        case updatedAt = "updated_at"
    }

    // The same columns the web selects.
    static let selectColumns = "enabled, message, link_label, link_view, updated_at"
}
