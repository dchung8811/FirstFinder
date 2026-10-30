import Foundation

// Port of src/utils/wishlist.js. A want describes a copy nobody has yet --
// conditions, not facts -- so it keeps its own vocabulary and its own rules.
enum WishlistLogic {
    struct Option: Hashable, Identifiable {
        var value: String
        var label: String
        var detail = ""
        var short = ""
        var id: String { value }
    }

    static let priorityOptions = [
        Option(value: "grail", label: "Grail", detail: "The one you'd drop everything for."),
        Option(value: "hunting", label: "Actively hunting", detail: "Checking regularly, ready to buy the right copy."),
        Option(value: "someday", label: "Someday", detail: "On the list, no rush."),
    ]

    static let jacketOptions = [
        Option(value: "required", label: "Required", short: "Jacket required"),
        Option(value: "preferred", label: "Nice to have", short: "Jacket preferred"),
        Option(value: "any", label: "Don't mind"),
        Option(value: "na", label: "N/A"),
    ]

    static let signatureOptions = [
        Option(value: "any", label: "Any"),
        Option(value: "signed", label: "Signed", short: "Signed"),
        Option(value: "inscribed", label: "Inscribed", short: "Inscribed"),
        Option(value: "association", label: "Association copy", short: "Association copy"),
    ]

    static let priorityRank = ["grail": 0, "hunting": 1, "someday": 2]

    static func priorityLabel(_ priority: String) -> String {
        priorityOptions.first { $0.value == priority }?.label ?? "Actively hunting"
    }

    static func isSaveable(_ want: Want) -> Bool {
        !want.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    // Better-or-equal to the floor; an ungraded copy isn't a failure.
    static func meetsConditionFloor(_ condition: String, _ minCondition: String) -> Bool {
        guard !minCondition.isEmpty, let floor = Vocab.conditionOptions.firstIndex(of: minCondition) else { return true }
        guard let actual = Vocab.conditionOptions.firstIndex(of: condition) else { return true }
        return actual <= floor
    }

    struct CriteriaChip: Hashable { var text: String; var green: Bool }

    static func describeCriteria(_ want: Want) -> [CriteriaChip] {
        var chips: [CriteriaChip] = []
        let edition = [
            want.wantedEdition.isEmpty ? nil : ItemsLogic.withClarifyingWord(want.wantedEdition, "edition"),
            want.wantedPrinting.isEmpty ? nil : ItemsLogic.withClarifyingWord(want.wantedPrinting, "printing"),
        ].compactMap { $0 }.joined(separator: " · ")
        if !edition.isEmpty { chips.append(.init(text: edition, green: true)) }
        if !want.publisher.isEmpty { chips.append(.init(text: want.publisher, green: true)) }
        if let jacket = jacketOptions.first(where: { $0.value == want.jacketRequirement })?.short, !jacket.isEmpty {
            chips.append(.init(text: jacket, green: false))
        }
        if !want.minCondition.isEmpty { chips.append(.init(text: "\(want.minCondition) or better", green: false)) }
        if let signature = signatureOptions.first(where: { $0.value == want.signatureRequirement })?.short, !signature.isEmpty {
            chips.append(.init(text: signature, green: true))
        }
        return chips
    }

    // Grails first, newest first within a priority; unknown priorities count
    // as actively hunting rather than last.
    static func sort(_ wants: [Want]) -> [Want] {
        Array(wants.enumerated()).sorted { a, b in
            let rank = (priorityRank[a.element.priority] ?? 1) - (priorityRank[b.element.priority] ?? 1)
            if rank != 0 { return rank < 0 }
            if a.element.createdAt != b.element.createdAt { return a.element.createdAt > b.element.createdAt }
            return a.offset < b.offset
        }.map(\.element)
    }

    static func open(_ wants: [Want]) -> [Want] { wants.filter { $0.foundAt.isEmpty } }
    static func found(_ wants: [Want]) -> [Want] { wants.filter { !$0.foundAt.isEmpty } }

    struct Summary: Equatable {
        var openCount = 0
        var foundCount = 0
        var ceilingTotal: Decimal = 0
        var withCeiling = 0
        var grailCount = 0
        var upgradeCount = 0
    }

    static func summarize(_ wants: [Want]) -> Summary {
        let open = open(wants)
        return Summary(
            openCount: open.count,
            foundCount: found(wants).count,
            ceilingTotal: open.reduce(Decimal(0)) { $0 + ($1.maxPrice ?? 0) },
            withCeiling: open.filter { $0.maxPrice != nil }.count,
            grailCount: open.filter { $0.priority == "grail" }.count,
            upgradeCount: open.filter { !$0.upgradeForItemId.isEmpty }.count
        )
    }

    // Searches for the copy wanted, not the copy owned.
    static func searchLinks(_ want: Want) -> (abebooks: URL, ebay: URL)? {
        var parts = [want.name, want.maker]
        if !want.wantedEdition.isEmpty { parts.append(ItemsLogic.withClarifyingWord(want.wantedEdition, "edition")) }
        if !want.wantedPrinting.isEmpty { parts.append(ItemsLogic.withClarifyingWord(want.wantedPrinting, "printing")) }
        if !want.signatureRequirement.isEmpty, want.signatureRequirement != "any" { parts.append(want.signatureRequirement) }
        let query = parts.filter { !$0.isEmpty }.joined(separator: " ").trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return nil }
        let encoded = ItemsLogic.encodeURIComponent(query)
        guard let abe = URL(string: "https://www.abebooks.com/servlet/SearchResults?kn=\(encoded)"),
              let ebay = URL(string: "https://www.ebay.com/sch/i.html?_nkw=\(encoded)") else { return nil }
        return (abe, ebay)
    }

    struct Found: Equatable {
        var condition = ""
        var purchasePrice = ""
        var source = ""
        var purchaseDate = ""
    }

    // wantToItem: what the collector established carries across; the
    // criteria stay behind, and the floor is never taken as the condition.
    static func toItem(_ want: Want, found: Found = Found()) -> Item {
        let category = want.category.isEmpty ? "Book" : want.category
        let authored = ItemsLogic.usesAuthorField(category)
        var item = Item.empty()
        item.name = want.name
        item.author = authored ? want.maker : ""
        item.maker = authored ? "" : want.maker
        item.category = category
        item.bookEdition = want.category == "Book" ? want.wantedEdition : ""
        item.bookPrinting = want.category == "Book" ? want.wantedPrinting : ""
        item.status = "Owned"
        item.condition = found.condition
        item.purchaseDate = found.purchaseDate
        item.source = found.source.isEmpty ? want.preferredSource : found.source
        item.purchasePrice = Format.optionalAmount(found.purchasePrice)
        item.estimatedValue = nil
        item.notes = want.notes
        return item
    }

    struct Ceiling: Equatable { var ceiling: Decimal; var paid: Decimal; var difference: Decimal; var under: Bool }

    static func compareToCeiling(_ want: Want, paid: String) -> Ceiling? {
        guard let ceiling = want.maxPrice, Format.hasValue(paid) else { return nil }
        let amount = Format.toNumber(paid)
        let difference = ceiling - amount
        return Ceiling(ceiling: ceiling, paid: amount, difference: difference < 0 ? -difference : difference, under: difference >= 0)
    }

    // formatAccountDate: "July 2, 2026".
    static func accountDate(_ value: String) -> String {
        guard !value.isEmpty else { return "—" }
        let iso = ISO8601DateFormatter()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = iso.date(from: value) ?? fractional.date(from: value) ?? Format.parseDay(value) else { return "—" }
        return date.formatted(.dateTime.month(.wide).day().year().locale(Locale(identifier: "en_US")))
    }
}

extension AppModel {
    func saveWant(_ want: Want) {
        guard let userId = profile?.id else { return }
        let isNew = want.id.isEmpty
        let now = ISO8601DateFormatter().string(from: Date())
        let write = Mapping.toDbWant(want, userId: userId)
        let existing = isNew ? nil : overlay.mergedWishlist(wishlistRows).first { $0.id == want.id }
        let row = WishlistRow(
            id: isNew ? UUID().uuidString.lowercased() : want.id, userId: userId, name: write.name, maker: write.maker,
            category: write.category, wantedEdition: write.wantedEdition, wantedPrinting: write.wantedPrinting,
            publisher: write.publisher, minCondition: write.minCondition, jacketRequirement: write.jacketRequirement,
            signatureRequirement: write.signatureRequirement, maxPrice: write.maxPrice, preferredSource: write.preferredSource,
            priority: write.priority, upgradeForItemId: write.upgradeForItemId, notes: write.notes,
            hiddenFromShare: write.hiddenFromShare, foundAt: existing?.foundAt, foundItemId: existing?.foundItemId,
            createdAt: existing?.createdAt ?? now, updatedAt: now
        )
        overlay.saveWant(row, isNew: isNew, summary: isNew ? "Added \"\(want.name)\" to your wishlist" : "Edited \"\(want.name)\"")
        toasts.push(isNew ? "Added to your wishlist." : "Want updated.", tone: .success)
    }

    func removeWant(_ id: String) {
        let name = wishlist.first { $0.id == id }?.name ?? ""
        overlay.discardWant(id: id, summary: "Removed \"\(name)\" from your wishlist")
        toasts.push("Removed from your wishlist.", tone: .success)
    }

    // "I found it": the copy joins the collection, and the want is marked
    // found rather than deleted, so the hunt stays on record.
    func markWantFound(_ want: Want, found: WishlistLogic.Found, itemPhotos: [Photo], receiptPhotos: [Photo]) {
        guard let saved = addItem(WishlistLogic.toItem(want, found: found), itemPhotos: itemPhotos, receiptPhotos: receiptPhotos),
              var row = overlay.mergedWishlist(wishlistRows).first(where: { $0.id == want.id })
        else { return }
        let now = ISO8601DateFormatter().string(from: Date())
        row.foundAt = now
        row.foundItemId = saved.id
        row.updatedAt = now
        overlay.saveWant(row, isNew: false, summary: "Found \"\(want.name)\"")
        toasts.push("Saved to your collection.", tone: .success)
    }
}
