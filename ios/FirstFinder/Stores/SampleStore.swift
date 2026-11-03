import Foundation

// The in-memory store behind Sample mode. It answers every read from
// SampleData, keeps every write in memory, never touches the network, and can
// be told to come back empty or to fail, so the empty and error states of
// every screen can be reviewed without touching a real account. Writes build
// rows the way the database would -- the payload merged over the old row --
// so sample mode shows what a real save would.
final class SampleStore: CollectionStore, @unchecked Sendable {
    // @unchecked: the mutable state is guarded by `lock`.

    enum Scenario: String, CaseIterable, Identifiable, Sendable {
        case full = "Full collection"
        case empty = "Nothing catalogued"
        case failing = "Every read fails"

        var id: String { rawValue }
    }

    nonisolated let mode: DataMode = .sample

    // The scheme SignedPhoto recognises and draws as a placeholder cover.
    static let photoScheme = "ffsample"

    private let lock = NSLock()
    private var _scenario: Scenario = .full
    private var _signedIn = true
    private var continuations: [UUID: AsyncStream<AuthEvent>.Continuation] = [:]
    private var data = Rows(scenario: .full)
    private var profile = SampleData.profile

    // What sample mode holds right now: the seed for the scenario, plus every
    // write made since. Memory only, like everything else here.
    private struct Rows {
        var inventory: [InventoryRow]
        var wishlist: [WishlistRow]
        var share: SharedCollectionRow?
        var feedback: [FeedbackRow]

        init(scenario: Scenario) {
            let full = scenario == .full
            inventory = full ? SampleData.inventory() : []
            wishlist = full ? SampleData.wishlist() : []
            share = full ? SampleData.shareSettings() : nil
            feedback = full ? SampleData.feedback() : []
        }
    }

    // Changing the scenario starts its data over.
    var scenario: Scenario {
        get { lock.withLock { _scenario } }
        set { lock.withLock { _scenario = newValue; data = Rows(scenario: newValue) } }
    }

    // Long enough to see each loading state, short enough not to annoy.
    private let latency: Duration = .milliseconds(450)

    // MARK: Auth

    func restoreSession() async -> UserProfile? {
        lock.withLock { _signedIn ? profile : nil }
    }

    func authEvents() -> AsyncStream<AuthEvent> {
        AsyncStream { continuation in
            let id = UUID()
            lock.withLock { continuations[id] = continuation }
            continuation.onTermination = { [weak self] _ in
                guard let self else { return }
                self.lock.withLock { self.continuations[id] = nil }
            }
        }
    }

    func signIn(email: String, password: String) async throws -> UserProfile {
        try await Task.sleep(for: latency)
        guard !email.isEmpty, !password.isEmpty else {
            throw StoreError.failed("Enter an email and a password. In Sample mode, any will do.")
        }
        let signedIn = lock.withLock { _signedIn = true; return profile }
        broadcast(.signedIn(signedIn))
        return signedIn
    }

    func signInWithGoogle() async throws -> UserProfile {
        try await Task.sleep(for: latency)
        let signedIn = lock.withLock { _signedIn = true; return profile }
        broadcast(.signedIn(signedIn))
        return signedIn
    }

    func signOut() async {
        lock.withLock { _signedIn = false }
        broadcast(.signedOut)
    }

    // Switching to Sample keeps whoever was looking signed in or out as they
    // were, so the signed-out pages can be reviewed on sample data too.
    func setSignedIn(_ signedIn: Bool) {
        lock.withLock { _signedIn = signedIn }
    }

    func accessToken() async -> String? {
        lock.withLock { _signedIn } ? "sample-token" : nil
    }

    private func broadcast(_ event: AuthEvent) {
        let targets = lock.withLock { Array(continuations.values) }
        targets.forEach { $0.yield(event) }
    }

    // MARK: Reads

    func fetchInventory(userId: String) async throws -> [InventoryRow] {
        try await read { $0.inventory }
    }

    func fetchWishlist(userId: String) async throws -> [WishlistRow] {
        try await read { $0.wishlist }
    }

    func fetchShareSettings(userId: String) async throws -> SharedCollectionRow? {
        try await read { $0.share }
    }

    func fetchFeedback(userId: String) async throws -> [FeedbackRow] {
        try await read { $0.feedback }
    }

    func fetchSiteBanner() async throws -> SiteBannerRow? {
        try await answer(SampleData.banner(), empty: nil)
    }

    func searchBookCatalog(query: String, limit: Int) async throws -> [BookCatalogRow] {
        let needle = query.lowercased()
        let matches = SampleData.catalog().filter {
            $0.title.lowercased().contains(needle) || ($0.author ?? "").lowercased().contains(needle)
        }
        return try await answer(Array(matches.prefix(limit)), empty: [])
    }

    func signPhotoURLs(paths: [String]) async -> [String: URL] {
        try? await Task.sleep(for: .milliseconds(150))
        if scenario == .failing { return [:] }
        var signed: [String: URL] = [:]
        for path in paths where !path.contains(SampleData.unsignablePathMarker) {
            var components = URLComponents()
            components.scheme = Self.photoScheme
            components.host = "photo"
            components.path = "/" + path
            if let url = components.url { signed[path] = url }
        }
        return signed
    }

    func getSiteJSON(path: String, authorized: Bool) async throws -> Data {
        try await Task.sleep(for: latency)
        if scenario == .failing { throw StoreError.failed("Sample mode is set to fail every read.") }
        guard let json = SampleSiteJSON.response(for: path) else {
            throw StoreError.failed("Sample mode has no canned answer for \(path).")
        }
        return Data(json.utf8)
    }

    func postSiteJSON(path: String, body: Data) async throws -> Data {
        try await Task.sleep(for: latency)
        if scenario == .failing { throw StoreError.failed("Sample mode is set to fail every write.") }
        return Data(#"{"ok":true}"#.utf8)
    }

    // MARK: Writes

    func maxReferenceNumber(userId: String) async throws -> Int {
        try await read { $0.inventory.compactMap(\.referenceNumber).max() ?? 0 }
    }

    func insertItems(_ payloads: [RowPayload]) async throws -> [InventoryRow] {
        try await change { rows in
            let now = Self.now()
            let inserted: [InventoryRow] = try payloads.map {
                try Self.merge(nil as InventoryRow?, $0, extra: ["id": .string(Self.newId()), "created_at": .string(now), "updated_at": .string(now)])
            }
            rows.inventory = inserted.reversed() + rows.inventory
            return inserted
        }
    }

    func updateItem(id: String, _ payload: RowPayload) async throws -> InventoryRow {
        try await change { rows in
            guard let index = rows.inventory.firstIndex(where: { $0.id == id }) else { throw Self.noRow }
            let updated: InventoryRow = try Self.merge(rows.inventory[index], payload)
            rows.inventory[index] = updated
            return updated
        }
    }

    func deleteItem(id: String) async throws {
        try await change { $0.inventory.removeAll { $0.id == id } }
    }

    // Sample photos are drawn as placeholder covers, so the bytes aren't kept.
    func uploadPhoto(path: String, jpeg: Data) async throws {
        try await change { _ in }
    }

    func removePhotos(paths: [String]) async throws {}

    func listItemPhotoPaths(userId: String, itemId: String) async -> [String]? {
        lock.withLock {
            data.inventory.first { $0.id == itemId }.map { ($0.itemPhotos.records + $0.receiptPhotos.records).compactMap(\.path) } ?? []
        }
    }

    func queueBookSuggestion(title: String, author: String) async {}

    func insertWant(_ payload: RowPayload) async throws -> WishlistRow {
        try await change { rows in
            let now = Self.now()
            let want: WishlistRow = try Self.merge(nil as WishlistRow?, payload, extra: ["id": .string(Self.newId()), "created_at": .string(now)])
            rows.wishlist = [want] + rows.wishlist
            return want
        }
    }

    func updateWant(id: String, _ payload: RowPayload) async throws -> WishlistRow {
        try await change { rows in
            guard let index = rows.wishlist.firstIndex(where: { $0.id == id }) else { throw Self.noRow }
            let updated: WishlistRow = try Self.merge(rows.wishlist[index], payload)
            rows.wishlist[index] = updated
            return updated
        }
    }

    func deleteWant(id: String) async throws {
        try await change { $0.wishlist.removeAll { $0.id == id } }
    }

    func upsertShareSettings(_ payload: RowPayload) async throws -> SharedCollectionRow {
        try await change { rows in
            let saved: SharedCollectionRow = try Self.merge(rows.share, payload, extra: rows.share == nil ? ["created_at": .string(Self.now())] : [:])
            rows.share = saved
            return saved
        }
    }

    func insertFeedback(_ payload: RowPayload) async throws -> FeedbackRow {
        try await change { rows in
            let row: FeedbackRow = try Self.merge(nil as FeedbackRow?, payload, extra: ["id": .string(Self.newId()), "photos": .array([]), "status": .string("new"), "created_at": .string(Self.now())])
            rows.feedback = [row] + rows.feedback
            return row
        }
    }

    func updateFeedback(id: String, _ payload: RowPayload) async throws {
        try await change { rows in
            guard let index = rows.feedback.firstIndex(where: { $0.id == id }) else { throw Self.noRow }
            rows.feedback[index] = try Self.merge(rows.feedback[index], payload)
        }
    }

    func updateUserMetadata(_ metadata: [String: JSONValue]) async throws -> UserProfile {
        try await Task.sleep(for: latency)
        if scenario == .failing { throw StoreError.write("Sample mode is set to fail every write.", code: "XX000") }
        return lock.withLock {
            if case .string(let name) = metadata["full_name"] { profile.fullName = name }
            if case .bool(let updates) = metadata["email_updates"] { profile.emailUpdates = updates }
            return profile
        }
    }

    // MARK: Helpers

    private func read<T: Sendable>(_ pick: (Rows) -> T) async throws -> T {
        try await Task.sleep(for: latency)
        if scenario == .failing { throw StoreError.failed("Sample mode is set to fail every read.") }
        return lock.withLock { pick(data) }
    }

    // A refusal in "fail" mode carries a non-retryable code, so the app shows
    // the failure at once instead of retrying for twelve seconds.
    private func change<T: Sendable>(_ apply: (inout Rows) throws -> T) async throws -> T {
        try await Task.sleep(for: latency)
        if scenario == .failing { throw StoreError.write("Sample mode is set to fail every write.", code: "XX000") }
        return try lock.withLock { try apply(&data) }
    }

    private static let noRow = StoreError.write("No row matched.", code: WriteRetry.noRowWrittenCode)

    private static func newId() -> String { UUID().uuidString.lowercased() }

    private static func now() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: Date())
    }

    // The payload laid over the existing row's JSON, as Postgres would apply
    // an UPDATE's columns, then decoded back into the row type.
    private static func merge<Row: Codable>(_ base: Row?, _ payload: RowPayload, extra: RowPayload = [:]) throws -> Row {
        var object: [String: Any] = [:]
        if let base, let json = try JSONSerialization.jsonObject(with: JSONEncoder().encode(base)) as? [String: Any] {
            object = json
        }
        let patch = try JSONSerialization.jsonObject(with: JSONEncoder().encode(payload.merging(extra) { _, new in new })) as? [String: Any] ?? [:]
        object.merge(patch) { _, new in new }
        return try JSONDecoder().decode(Row.self, from: JSONSerialization.data(withJSONObject: object))
    }

    private func answer<T: Sendable>(_ full: T, empty: T) async throws -> T {
        try await Task.sleep(for: latency)
        switch scenario {
        case .full: return full
        case .empty: return empty
        case .failing: throw StoreError.failed("Sample mode is set to fail every read.")
        }
    }
}

// Canned answers for the public-site GETs. Each screen that reads one adds
// its fixture here when it is built.
enum SampleSiteJSON {
    static func response(for path: String) -> String? {
        switch path.split(separator: "?").first.map(String.init) ?? path {
        case "/api/v1/admin/access": #"{"admin":true}"#
        case "/api/v1/featured-shelves": SampleData.featuredShelvesJSON
        case "/api/v1/contribute": #"{"ok":true,"repo":{"stars":42,"forks":6,"openIssuesAndPrs":17,"lastPushedAt":"2026-09-06T21:00:00Z"},"goodFirstIssues":[{"number":101,"title":"Sample issue: tidy the empty state copy","url":"https://example.com/sample/101","labels":["good first issue"],"assigned":false}],"helpWanted":[{"number":102,"title":"Sample issue: a bigger, scoped piece","url":"https://example.com/sample/102","labels":["help wanted"],"assigned":true}]}"#
        case "/api/v1/admin/stats": SampleData.adminStatsJSON
        case "/api/v1/admin/banner": #"{"banner":{"enabled":true,"message":"Sample banner: the roadmap has three new items this month.","linkLabel":"See the roadmap","linkView":"roadmap","updatedAt":"2026-07-01T00:00:00Z"}}"#
        default: nil
        }
    }
}
