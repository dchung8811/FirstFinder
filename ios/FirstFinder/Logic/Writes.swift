import Foundation

// The bodies of every write the app sends, built the way app/InventoryApp.jsx
// builds them: the same columns, the same nulls, the same sale-field rules.
// Pure, so each one is tested against what the web would send.
enum Writes {
    static func timestamp(_ now: Date) -> JSONValue {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return .string(formatter.string(from: now))
    }

    // MARK: Items

    // toDbItem: the insert for a new item.
    static func itemInsert(_ write: InventoryWrite) -> RowPayload {
        [
            "user_id": .string(write.userId),
            "reference_number": .integer(write.referenceNumber),
            "name": .string(write.name),
            "category": .string(write.category),
            "author": .string(write.author),
            "maker": .string(write.maker),
            "edition": .string(write.edition),
            "book_genre": .string(write.bookGenre),
            "book_edition": .string(write.bookEdition),
            "book_printing": .string(write.bookPrinting),
            "status": .string(write.status),
            "condition": .string(write.condition),
            "previous_status": .text(write.previousStatus),
            "sold_price": .amount(write.soldPrice),
            "sold_date": .text(write.soldDate),
            "purchase_date": .text(write.purchaseDate),
            "source": .string(write.source),
            "purchase_price": .number(write.purchasePrice),
            "estimated_value": .amount(write.estimatedValue),
            "notes": .string(write.notes),
            "item_photo_count": .int(write.itemPhotoCount),
            "receipt_photo_count": .int(write.receiptPhotoCount),
        ]
    }

    static func photoRecords(_ photos: [Photo]) -> JSONValue {
        .array(photos.map { .object(["path": .string($0.path), "name": .string($0.name)]) })
    }

    // After a new item's photos upload: link them to the row.
    static func photoLink(itemPhotos: [Photo], receiptPhotos: [Photo], now: Date = Date()) -> RowPayload {
        [
            "item_photos": photoRecords(itemPhotos),
            "receipt_photos": photoRecords(receiptPhotos),
            "item_photo_count": .int(itemPhotos.count),
            "receipt_photo_count": .int(receiptPhotos.count),
            "updated_at": timestamp(now),
        ]
    }

    // updateInventoryItem: the edit form's whole-item save. Status can move
    // into or out of Sold here, so the sale columns follow whichever status
    // the save ends on.
    static func itemUpdate(draft: Item, current: Item, itemPhotos: [Photo], receiptPhotos: [Photo], now: Date = Date()) -> RowPayload {
        let isNowSold = draft.status == "Sold"
        let wasAlreadySold = current.status == "Sold"
        let previousStatus: String? = !isNowSold
            ? nil
            : wasAlreadySold ? nonEmpty(current.previousStatus) ?? "Owned" : nonEmpty(current.status) ?? "Owned"

        return [
            "name": .string(draft.name),
            "category": .string(nonEmpty(draft.category) ?? "Other"),
            "author": .string(draft.author),
            "maker": .string(draft.maker),
            "edition": .string(Mapping.storedEdition(draft)),
            "book_genre": .string(draft.bookGenre),
            "book_edition": .string(draft.bookEdition),
            "book_printing": .string(draft.bookPrinting),
            "status": .string(nonEmpty(draft.status) ?? "Owned"),
            "condition": .string(draft.condition),
            "previous_status": .text(previousStatus),
            "sold_price": .amount(isNowSold ? draft.soldPrice : nil),
            "sold_date": .text(isNowSold ? nonEmpty(draft.soldDate) : nil),
            "purchase_date": .text(nonEmpty(draft.purchaseDate)),
            "source": .string(draft.source),
            // toNumber on the web: a blank purchase price is saved as 0 paid.
            "purchase_price": .number(draft.purchasePrice ?? 0),
            "estimated_value": .amount(draft.estimatedValue),
            "notes": .string(draft.notes),
            "hidden_from_share": .bool(draft.hiddenFromShare),
            "item_photos": photoRecords(itemPhotos),
            "receipt_photos": photoRecords(receiptPhotos),
            "item_photo_count": .int(itemPhotos.count),
            "receipt_photo_count": .int(receiptPhotos.count),
            "updated_at": timestamp(now),
        ]
    }

    // markSold. previous_status remembers what the item was before the sale
    // (never "Sold" itself) so Restore can put it back there.
    static func markSold(current: Item, soldPrice: String, soldDate: String, condition: String, now: Date = Date()) -> RowPayload {
        let statusToRestore = current.status != "Sold" ? current.status : nonEmpty(current.previousStatus) ?? "Owned"
        return [
            "status": .string("Sold"),
            "previous_status": .string(statusToRestore),
            "sold_price": .amount(Format.optionalAmount(soldPrice)),
            "sold_date": .text(nonEmpty(soldDate)),
            "condition": .string(nonEmpty(condition) ?? current.condition),
            "updated_at": timestamp(now),
        ]
    }

    // restoreSold: back to the status before the sale, not always "Owned".
    static func restore(current: Item, now: Date = Date()) -> (payload: RowPayload, status: String) {
        let restored = nonEmpty(current.previousStatus) ?? "Owned"
        return ([
            "status": .string(restored),
            "previous_status": .null,
            "sold_price": .null,
            "sold_date": .null,
            "updated_at": timestamp(now),
        ], restored)
    }

    // csvUpdateRow, minus id and user_id: the records view's inline edits and
    // an import's updates. Only the columns named in `fields` are written, so
    // an inline edit can't clobber a field changed on another device.
    static func fieldUpdate(current: Item, fields: [String: String], now: Date = Date()) -> RowPayload {
        var row: RowPayload = ["updated_at": timestamp(now)]
        let columns: [String: String] = [
            "name": "name", "category": "category", "author": "author", "maker": "maker", "edition": "edition",
            "bookGenre": "book_genre", "bookEdition": "book_edition", "bookPrinting": "book_printing",
            "status": "status", "condition": "condition", "source": "source", "notes": "notes",
        ]
        for (field, column) in columns {
            if let value = fields[field] { row[column] = .string(value) }
        }

        var merged = current
        if let value = fields["category"] { merged.category = value }
        if let value = fields["edition"] { merged.edition = value }
        if let value = fields["status"] { merged.status = value }
        if let value = fields["soldPrice"] { merged.soldPrice = Format.optionalAmount(value) }
        if let value = fields["soldDate"] { merged.soldDate = value }

        if fields["edition"] != nil || fields["category"] != nil {
            row["edition"] = .string(Mapping.storedEdition(merged))
        }
        if let value = fields["purchaseDate"] { row["purchase_date"] = .text(nonEmpty(value)) }
        if let value = fields["purchasePrice"] { row["purchase_price"] = .number(Format.toNumber(value)) }
        if let value = fields["estimatedValue"] { row["estimated_value"] = .amount(Format.optionalAmount(value)) }

        if fields["status"] != nil || fields["soldPrice"] != nil || fields["soldDate"] != nil {
            let isNowSold = merged.status == "Sold"
            let wasSold = current.status == "Sold"
            let previous: String? = !isNowSold
                ? nil
                : wasSold ? nonEmpty(current.previousStatus) ?? "Owned" : nonEmpty(current.status) ?? "Owned"
            row["previous_status"] = .text(previous)
            row["sold_price"] = .amount(isNowSold ? merged.soldPrice : nil)
            row["sold_date"] = .text(isNowSold ? nonEmpty(merged.soldDate) : nil)
        }
        return row
    }

    // MARK: Wishlist and sharing

    // toDbWant.
    static func want(_ write: WantWrite, now: Date = Date()) -> RowPayload {
        [
            "user_id": .string(write.userId),
            "name": .string(write.name),
            "maker": .string(write.maker),
            "category": .string(write.category),
            "wanted_edition": .string(write.wantedEdition),
            "wanted_printing": .string(write.wantedPrinting),
            "publisher": .string(write.publisher),
            "min_condition": .string(write.minCondition),
            "jacket_requirement": .string(write.jacketRequirement),
            "signature_requirement": .string(write.signatureRequirement),
            "max_price": .amount(write.maxPrice),
            "preferred_source": .string(write.preferredSource),
            "priority": .string(write.priority),
            // A uuid foreign key: blank has to be null, never "".
            "upgrade_for_item_id": .text(write.upgradeForItemId),
            "notes": .string(write.notes),
            "hidden_from_share": .bool(write.hiddenFromShare),
            "updated_at": timestamp(now),
        ]
    }

    // toDbShareRow.
    static func share(_ write: ShareWrite, now: Date = Date()) -> RowPayload {
        [
            "user_id": .string(write.userId),
            "slug": .string(write.slug),
            "visibility": .string(write.visibility),
            "title": .string(write.title),
            "blurb": .string(write.blurb),
            "show_estimated_value": .bool(write.showEstimatedValue),
            "show_prices": .bool(write.showPrices),
            "show_provenance": .bool(write.showProvenance),
            "show_notes": .bool(write.showNotes),
            "show_sold": .bool(write.showSold),
            "show_wishlist": .bool(write.showWishlist),
            "show_on_explore": .bool(write.showOnExplore),
            "explore_item_ids": .array(write.exploreItemIds.map(JSONValue.string)),
            "updated_at": timestamp(now),
        ]
    }

    // MARK: Photos

    // uploadPhotoList's object name: user/item/kind-time-random-name. The
    // folder is the owner's id because the storage policies key on it, and
    // the name is never reused because a stored photo is cached for a year.
    static func photoPath(userId: String, itemId: String, kind: String, name: String, now: Date = Date(), random: String = randomSuffix()) -> String {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-")
        let safe = String(String.UnicodeScalarView((name.isEmpty ? "photo" : name).unicodeScalars.map { allowed.contains($0) ? $0 : "_" }))
        let millis = Int64((now.timeIntervalSince1970 * 1000).rounded(.down))
        return "\(userId)/\(itemId)/\(kind)-\(millis)-\(random)-\(String(safe.suffix(60)))"
    }

    static func randomSuffix() -> String {
        let alphabet = Array("abcdefghijklmnopqrstuvwxyz0123456789")
        return String((0..<6).map { _ in alphabet.randomElement()! })
    }

    private static func nonEmpty(_ value: String) -> String? {
        value.isEmpty ? nil : value
    }

    private static func nonEmpty(_ value: String?) -> String? {
        guard let value, !value.isEmpty else { return nil }
        return value
    }
}

// src/utils/retryWrite.js and writeErrors.js: which failed writes are worth
// another attempt, and what to tell the collector when one fails for good.
enum WriteRetry {
    // The web's delays: the stall this was built for lasted over five seconds.
    static let delays: [Duration] = [.seconds(1), .seconds(3), .seconds(8)]

    // Connection trouble (08), out of resources (53), timeouts (57) -- or no
    // code at all, which means it failed before Postgres had an opinion: a
    // gateway 502/504, a dropped connection. Anything else is the database
    // refusing this statement, and it will refuse it again.
    static func isRetryable(code: String?) -> Bool {
        let trimmed = (code ?? "").trimmingCharacters(in: .whitespaces)
        if trimmed.isEmpty { return true }
        return ["08", "53", "57"].contains(String(trimmed.prefix(2)))
    }

    // Runs `attempt` until it succeeds or the delays run out. Safe only for
    // idempotent writes: an UPDATE by primary key, never an insert.
    static func run<T: Sendable>(
        delays: [Duration] = WriteRetry.delays,
        sleep: @Sendable (Duration) async -> Void = { try? await Task.sleep(for: $0) },
        _ attempt: @Sendable () async throws -> T
    ) async throws -> T {
        var index = 0
        while true {
            do {
                return try await attempt()
            } catch let error as StoreError {
                guard index < delays.count, case .write(_, let code) = error, isRetryable(code: code) else { throw error }
                await sleep(delays[index])
                index += 1
            }
        }
    }

    // PostgREST's "expected one row, got another number". Every write filters
    // by an id the collector can see, so zero rows back means Row Level
    // Security stopped it -- almost always a session that has ended.
    static let noRowWrittenCode = "PGRST116"
    static let signedOutMessage = "You've been signed out, so this didn't save. Sign in again, then make the change again."

    static func describe(message: String, code: String?) -> String {
        if code == noRowWrittenCode { return signedOutMessage }
        return message.isEmpty ? "Something went wrong saving that. Please try again." : message
    }
}
