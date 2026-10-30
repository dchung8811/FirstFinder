import Foundation

// The Sample collection: the web's three sampleItems plus invented items that
// between them hit every category, every status, sold items (with and without
// a sale price), items with no estimate, items with no date, and a photo that
// fails to sign. Every name, maker, source and note is made up. Nothing here
// is a real person, collection or address, so sample-mode screenshots are
// safe to commit.
//
// Dates are fixed rather than relative to today, so a screenshot taken next
// month shows the same figures as one taken now.
enum SampleData {
    static let userId = "00000000-0000-4000-8000-000000000001"

    static let profile = UserProfile(
        id: userId,
        email: "sample.collector@example.com",
        fullName: "Sample Collector",
        createdAt: ISO8601DateFormatter().date(from: "2025-03-14T10:00:00Z"),
        emailUpdates: true
    )

    private struct Spec {
        var name: String
        var category: String
        var author = ""
        var maker = ""
        var edition = ""
        var genre = ""
        var bookEdition = ""
        var bookPrinting = ""
        var status = "Owned"
        var previousStatus: String?
        var condition = ""
        var date: String?
        var source = ""
        var paid: Decimal?
        var estimate: Decimal?
        var soldPrice: Decimal?
        var soldDate: String?
        var notes = ""
        var photos = 1
        var receipts = 0
        var hidden = false
    }

    private static let specs: [Spec] = [
        // The web's sampleItems, as constants.js has them.
        Spec(name: "The Gunslinger", category: "Book", author: "Stephen King", maker: "Donald M. Grant", status: "Owned", date: "2026-05-12", source: "Used bookstore", paid: 45, estimate: 850, notes: "Need to confirm jacket state. Receipt saved.", receipts: 1),
        Spec(name: "Beloved", category: "Book", author: "Toni Morrison", maker: "Alfred A. Knopf", status: "Researching", date: "2026-05-08", source: "Estate sale", paid: 30, estimate: 300, notes: "Need signature verification before listing."),
        Spec(name: "Vintage Phillies Program", category: "Sports memorabilia", maker: "Philadelphia Phillies", edition: "1970s program", status: "Owned", date: "2026-04-28", source: "Flea market", paid: 12, estimate: 40, notes: "Good condition, minor corner wear."),

        // Invented.
        Spec(name: "The Lantern Keeper's Almanac", category: "Book", author: "Mara Ellery", maker: "Hollow Oak Press", genre: "Fantasy", bookEdition: "First", bookPrinting: "First", condition: "Near Fine/Fine", date: "2026-03-02", source: "Book fair", paid: 120, estimate: 640, notes: "Number line ends in 1. Price-clipped jacket.", photos: 3, receipts: 1),
        Spec(name: "Salt Roads", category: "Book", author: "Idris Calloway", maker: "Westmere & Sons", genre: "Literary fiction", bookEdition: "First", bookPrinting: "Second", condition: "Very Good/Good", date: "2025-11-18", source: "Online auction", paid: 35, estimate: 90, photos: 2),
        Spec(name: "A Field Guide to Small Weather", category: "Book", author: "Petra Hune", maker: "Quillfeather", genre: "Nature", bookEdition: "Second", bookPrinting: "First", condition: "Fair", date: "2024-08-09", source: "Thrift store", paid: 4, estimate: nil, notes: "No estimate yet; haven't found a comparable copy."),
        Spec(name: "Night Ferry to Corran", category: "Book", author: "Odile Varga", maker: "Harrow House", genre: "Mystery", bookEdition: "First", bookPrinting: "First", status: "For sale", condition: "Very Good/Good", date: "2025-06-21", source: "Library sale", paid: 2, estimate: 180, notes: "Listed at the spring fair table."),
        Spec(name: "The Copper Orchard", category: "Book", author: "Lenna Ashgrove", maker: "Brightwater Books", genre: "Historical", bookEdition: "First", bookPrinting: "First", status: "Sold", previousStatus: "Owned", condition: "Near Fine/Fine", date: "2025-01-10", source: "Estate sale", paid: 60, estimate: 400, soldPrice: 425, soldDate: "2026-02-14", notes: "Sold to a dealer at the winter show."),
        Spec(name: "Undated Paperback Lot", category: "Book", author: "Various", maker: "Assorted", genre: "Science fiction", condition: "Fair", date: nil, source: "Garage sale", paid: 10, estimate: 25, notes: "No purchase date recorded.", photos: 0),

        Spec(name: "Captain Meridian #1", category: "Comic", author: "Theo Brandt", maker: "Starlit Comics", edition: "Newsstand", condition: "Very Good/Good", date: "2025-09-30", source: "Comic shop", paid: 85, estimate: 220, photos: 2),
        Spec(name: "Moth & Lantern #12", category: "Comic", author: "June Halloway", maker: "Paper Kite", edition: "Variant cover B", status: "Researching", condition: "Near Fine/Fine", date: "2026-01-19", source: "Convention", paid: 15, estimate: nil),
        Spec(name: "Harbor Patrol Annual 1983", category: "Comic", maker: "Tidewater Comics", edition: "Annual", status: "Sold", previousStatus: "For sale", condition: "Fair", date: "2024-05-03", source: "Flea market", paid: 6, estimate: 30, soldPrice: 28, soldDate: "2025-04-11"),

        Spec(name: "1962 Riverside Rockets Pennant", category: "Sports memorabilia", maker: "Riverside Rockets", edition: "Felt pennant", condition: "Very Good/Good", date: "2025-07-04", source: "Antique mall", paid: 40, estimate: 150, photos: 2),
        Spec(name: "Signed Practice Ball", category: "Sports memorabilia", maker: "Northfield Athletics", edition: "Team-signed", status: "Researching", date: "2026-06-01", source: "Charity auction", paid: 75, estimate: nil, notes: "Signatures unverified."),

        Spec(name: "Comet Card #47 Rookie", category: "Trading card", maker: "Starburst Cards", edition: "1989 series", condition: "Near Fine/Fine", date: "2025-12-02", source: "Card show", paid: 18, estimate: 65),
        Spec(name: "Woodland Creatures Set (complete)", category: "Trading card", maker: "Greenleaf Games", edition: "First print run", status: "For sale", date: "2024-11-15", source: "Online marketplace", paid: 55, estimate: 120, photos: 3),
        Spec(name: "Holographic Dragon Promo", category: "Trading card", maker: "Greenleaf Games", edition: "Promo", status: "Sold", previousStatus: "Researching", date: "2025-03-08", source: "Card show", paid: 20, estimate: 80, soldPrice: nil, soldDate: "2025-10-02", notes: "Traded, so no sale price recorded."),

        Spec(name: "The Weekly Courier, Moon Landing Issue", category: "Magazine & periodical", maker: "Courier Publishing", edition: "July 1969", condition: "Fair", date: "2025-02-27", source: "Estate sale", paid: 8, estimate: 45),
        Spec(name: "Gardenia Quarterly Vol. 3", category: "Magazine & periodical", maker: "Gardenia Press", edition: "Spring issue", date: nil, source: "Inherited", paid: nil, estimate: 15, notes: "Inherited, so no price paid and no date."),

        Spec(name: "Blue Hour Sessions LP", category: "Record", maker: "Low Tide Records", edition: "First pressing", condition: "Very Good/Good", date: "2025-08-16", source: "Record store", paid: 22, estimate: 70, photos: 2),
        Spec(name: "The Fernwood Five — Live", category: "Record", maker: "Cinder Label", edition: "Promo copy", status: "Sold", previousStatus: "Owned", date: "2024-09-12", source: "Record fair", paid: 15, estimate: 60, soldPrice: 75, soldDate: "2026-07-20"),

        Spec(name: "Harbor at Dusk (print 12/50)", category: "Art", maker: "R. Calder Studio", edition: "Numbered print", condition: "Near Fine/Fine", date: "2026-02-08", source: "Gallery", paid: 150, estimate: 300, photos: 2, receipts: 1, hidden: true),
        Spec(name: "Untitled Pencil Study", category: "Art", maker: "Unknown artist", status: "Researching", date: "2025-05-25", source: "Thrift store", paid: 3, estimate: nil),

        Spec(name: "Midsummer Fair Poster", category: "Posters & ephemera", maker: "County Fair Board", edition: "1974 poster", condition: "Fair", date: "2025-10-10", source: "Barn sale", paid: 5, estimate: 35),
        Spec(name: "Railway Timetable Booklet", category: "Posters & ephemera", maker: "Northern Line Rail", edition: "Winter 1951", date: "2024-12-20", source: "Antique mall", paid: 7, estimate: 0, notes: "Estimated at nothing -- a real zero, not a blank."),

        Spec(name: "Tin Rocket Wind-up", category: "Toy", maker: "Starlight Toy Co.", edition: "Boxed", condition: "Very Good/Good", date: "2026-04-03", source: "Toy show", paid: 90, estimate: 260, photos: 3),
        Spec(name: "Wooden Ark Play Set", category: "Toy", maker: "Hearthside", status: "For sale", date: "2025-04-17", source: "Estate sale", paid: 25, estimate: 55),

        Spec(name: "Brass Lighthouse Bookends", category: "Other", maker: "Unmarked", date: "2025-09-05", source: "Antique mall", paid: 30, estimate: 45),
        Spec(name: "Mystery Key Collection", category: "Other", maker: "Various", status: "Researching", date: nil, source: "Found in a desk", paid: 0, estimate: nil, notes: "No date, no estimate, paid nothing.", photos: 0),
    ]

    // The item whose cover is set up to fail signing, so the "hide a photo
    // that won't sign" path can be seen in sample mode.
    static let unsignablePathMarker = "unsignable"

    static func inventory() -> [InventoryRow] {
        specs.enumerated().map { index, spec in
            let id = String(format: "00000000-0000-4000-8000-%012d", index + 100)
            let created = spec.date.map { "\($0)T12:00:00+00:00" } ?? "2026-08-01T12:00:00+00:00"
            let photoNames = ["cover.jpg", "spine.jpg", "detail.jpg"]
            var itemPhotos = (0..<spec.photos).map { photoIndex in
                PhotoColumn.Record(path: "sample/\(id)/\(photoNames[photoIndex % photoNames.count])", name: photoNames[photoIndex % photoNames.count])
            }
            if spec.name == "Salt Roads" {
                itemPhotos = [PhotoColumn.Record(path: "sample/\(id)/\(unsignablePathMarker).jpg", name: "unsignable.jpg")] + itemPhotos
            }
            let receipts = (0..<spec.receipts).map { _ in
                PhotoColumn.Record(path: "sample/\(id)/receipt.jpg", name: "receipt.jpg")
            }
            return InventoryRow(
                id: id,
                userId: userId,
                referenceNumber: index + 1,
                name: spec.name,
                category: spec.category,
                author: spec.author,
                maker: spec.maker,
                edition: spec.category == "Book" ? "" : spec.edition,
                bookGenre: spec.genre,
                bookEdition: spec.bookEdition,
                bookPrinting: spec.bookPrinting,
                status: spec.status,
                condition: spec.condition,
                purchaseDate: spec.date,
                source: spec.source,
                purchasePrice: spec.paid,
                estimatedValue: spec.estimate,
                previousStatus: spec.previousStatus,
                soldPrice: spec.soldPrice,
                soldDate: spec.soldDate,
                notes: spec.notes,
                hiddenFromShare: spec.hidden,
                itemPhotos: PhotoColumn(records: itemPhotos),
                receiptPhotos: PhotoColumn(records: receipts),
                itemPhotoCount: itemPhotos.count,
                receiptPhotoCount: receipts.count,
                createdAt: created,
                updatedAt: created
            )
        }
        .sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
    }

    static func wishlist() -> [WishlistRow] {
        let items = inventory()
        let upgradeTarget = items.first { $0.name == "Salt Roads" }?.id
        let foundItem = items.first { $0.name == "Captain Meridian #1" }?.id
        func want(_ n: Int, _ name: String, maker: String, category: String = "Book", edition: String = "", printing: String = "", publisher: String = "", minCondition: String = "", jacket: String = "any", signature: String = "any", maxPrice: Decimal? = nil, source: String = "", priority: String, upgradeFor: String? = nil, notes: String = "", foundAt: String? = nil, foundItem: String? = nil, created: String) -> WishlistRow {
            WishlistRow(
                id: String(format: "00000000-0000-4000-8000-%012d", n + 900), userId: userId, name: name, maker: maker,
                category: category, wantedEdition: edition, wantedPrinting: printing, publisher: publisher,
                minCondition: minCondition, jacketRequirement: jacket, signatureRequirement: signature, maxPrice: maxPrice,
                preferredSource: source, priority: priority, upgradeForItemId: upgradeFor, notes: notes,
                hiddenFromShare: false, foundAt: foundAt, foundItemId: foundItem, createdAt: created, updatedAt: created
            )
        }
        return [
            want(1, "The Lantern Keeper's Return", maker: "Mara Ellery", edition: "First", printing: "First", publisher: "Hollow Oak Press", minCondition: "Very Good/Good", jacket: "required", signature: "signed", maxPrice: 900, source: "Book fair", priority: "grail", notes: "The sequel. Only 500 printed.", created: "2026-06-10T09:00:00+00:00"),
            want(2, "Salt Roads", maker: "Idris Calloway", edition: "First", printing: "First", publisher: "Westmere & Sons", minCondition: "Near Fine/Fine", jacket: "preferred", maxPrice: 150, priority: "hunting", upgradeFor: upgradeTarget, notes: "A true first printing to replace my second.", created: "2026-05-01T09:00:00+00:00"),
            want(3, "Harbor Patrol #1", maker: "Tidewater Comics", category: "Comic", minCondition: "Fair", jacket: "na", maxPrice: nil, priority: "someday", created: "2026-03-22T09:00:00+00:00"),
            want(4, "Blue Hour Sessions (test pressing)", maker: "Low Tide Records", category: "Record", jacket: "na", maxPrice: 200, source: "Record fair", priority: "hunting", created: "2026-02-02T09:00:00+00:00"),
            want(5, "Captain Meridian #1", maker: "Starlit Comics", category: "Comic", minCondition: "Very Good/Good", jacket: "na", maxPrice: 250, priority: "grail", foundAt: "2025-09-30T15:00:00+00:00", foundItem: foundItem, created: "2025-06-01T09:00:00+00:00"),
        ]
    }

    static func shareSettings() -> SharedCollectionRow {
        SharedCollectionRow(
            userId: userId, slug: "sample-collector", visibility: "unlisted", title: "A Sample Shelf",
            blurb: "Invented books, comics and oddities for trying the app.", showEstimatedValue: true, showPrices: false,
            showProvenance: true, showNotes: false, showSold: true, showWishlist: true, showOnExplore: false,
            exploreItemIds: [], firstPublishedAt: "2026-01-05T10:00:00+00:00", createdAt: "2026-01-05T10:00:00+00:00",
            updatedAt: "2026-06-01T10:00:00+00:00"
        )
    }

    static func feedback() -> [FeedbackRow] {
        [
            FeedbackRow(id: "00000000-0000-4000-8000-000000000801", userId: userId, description: "Could the dashboard show which items have no estimate yet?", photos: PhotoColumn(), status: "new", createdAt: "2026-07-02T18:20:00+00:00"),
            FeedbackRow(id: "00000000-0000-4000-8000-000000000802", userId: userId, description: "The number line on my scan was read as the second printing.", photos: PhotoColumn(records: [.init(path: "sample/feedback/scan.jpg", name: "scan.jpg")]), status: "new", createdAt: "2026-05-11T08:05:00+00:00"),
        ]
    }

    static func banner() -> SiteBannerRow {
        SiteBannerRow(enabled: true, message: "Sample banner: the roadmap has three new items this month.", linkLabel: "See the roadmap", linkView: "roadmap", updatedAt: "2026-07-01T00:00:00+00:00")
    }

    static func catalog() -> [BookCatalogRow] {
        [
            BookCatalogRow(id: "c1", title: "The Lantern Keeper's Almanac", author: "Mara Ellery", publisher: "Hollow Oak Press", firstPublishedYear: 1987, coverId: "", source: "sample"),
            BookCatalogRow(id: "c2", title: "The Lantern Keeper's Return", author: "Mara Ellery", publisher: "Hollow Oak Press", firstPublishedYear: 1991, coverId: "", source: "sample"),
            BookCatalogRow(id: "c3", title: "Salt Roads", author: "Idris Calloway", publisher: "Westmere & Sons", firstPublishedYear: 2003, coverId: "", source: "sample"),
            BookCatalogRow(id: "c4", title: "Night Ferry to Corran", author: "Odile Varga", publisher: "Harrow House", firstPublishedYear: 1978, coverId: "", source: "sample"),
            BookCatalogRow(id: "c5", title: "The Copper Orchard", author: "Lenna Ashgrove", publisher: "Brightwater Books", firstPublishedYear: 1999, coverId: "", source: "sample"),
        ]
    }
}

extension SampleData {
    // Three invented Explore shelves for the home page's strip. Some covers
    // have a (placeholder) photo and some don't, so both the photo and the
    // cloth-jacket look show up in sample mode.
    static let featuredShelvesJSON = #"""
    {"shelves":[
      {"slug":"lantern-shelf","title":"The Lantern Shelf","blurb":"Invented fantasy firsts.","itemCount":42,"covers":[
        {"id":"s1-1","name":"The Lantern Keeper's Almanac","author":"Mara Ellery","maker":"Hollow Oak Press","category":"Book","photoUrl":"ffsample://photo/shelf/s1-1"},
        {"id":"s1-2","name":"Salt Roads","author":"Idris Calloway","maker":"Westmere & Sons","category":"Book","photoUrl":null},
        {"id":"s1-3","name":"Night Ferry to Corran","author":"Odile Varga","maker":"Harrow House","category":"Book","photoUrl":"ffsample://photo/shelf/s1-3"},
        {"id":"s1-4","name":"The Copper Orchard","author":"Lenna Ashgrove","maker":"Brightwater Books","category":"Book","photoUrl":null},
        {"id":"s1-5","name":"A Field Guide to Small Weather","author":"Petra Hune","maker":"Quillfeather","category":"Book","photoUrl":null}
      ]},
      {"slug":"harbor-comics","title":"Harbor Comics","itemCount":17,"covers":[
        {"id":"s2-1","name":"Captain Meridian #1","author":"Theo Brandt","maker":"Starlit Comics","category":"Comic","photoUrl":"ffsample://photo/shelf/s2-1"},
        {"id":"s2-2","name":"Moth & Lantern #12","author":"June Halloway","maker":"Paper Kite","category":"Comic","photoUrl":null},
        {"id":"s2-3","name":"Harbor Patrol Annual 1983","maker":"Tidewater Comics","category":"Comic","photoUrl":null}
      ]},
      {"slug":"one-good-record","title":"One Good Record","itemCount":1,"covers":[
        {"id":"s3-1","name":"Blue Hour Sessions LP","maker":"Low Tide Records","category":"Record","photoUrl":null}
      ]}
    ]}
    """#
}

extension SampleData {
    // A canned /api/admin/stats reply with a check in each state, so every
    // look of the admin screen can be reviewed. Invented numbers.
    static let adminStatsJSON = #"""
    {"ok":true,"generatedAt":"2026-09-07T12:00:00Z","excludedAccounts":1,"plan":"free","status":"act",
     "metrics":{"items":{"excluding_admins":412,"total":641,"new_30d":38,"collectors":27},
                "users":{"excluding_admins":96,"new_30d":11,"new_7d":3,"never_returned":41,"active_7d":14,"active_30d":33},
                "logins":{"d7":52,"tracked_since":"2026-05-01T00:00:00Z"},
                "shares":{"published":9,"started_not_published":4},
                "identify":{"calls_today":5,"calls_30d":118},
                "feedback":{"total":23,"filed_to_github":19,"errored":1}},
     "github":{"repo":{"stars":42,"forks":6,"openIssuesAndPrs":17,"lastPushedAt":"2026-09-06T21:00:00Z"}},
     "checks":[
      {"key":"db","label":"Database size","status":"ok","value":"118 MB of 500 MB","ratio":0.236,"detail":"Free-plan allowance."},
      {"key":"storage","label":"Photo storage","status":"watch","value":"0.81 GB of 1 GB","ratio":0.81,"detail":"Photos are most of it.","action":"Plan the upgrade before it reaches 95%."},
      {"key":"memory","label":"Server memory","status":"act","value":"96% used","ratio":0.96,"detail":"Sustained, not a spike.","action":"Upgrade the compute size."},
      {"key":"github-token","label":"GitHub token","status":"ok","value":"Expires in 81 days","detail":"Fine-grained token."}
     ]}
    """#
}
