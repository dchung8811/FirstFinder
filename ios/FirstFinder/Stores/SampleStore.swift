import Foundation

// The in-memory store behind Sample mode. It answers every read from
// SampleData, never touches the network, and can be told to come back empty
// or to fail, so the empty and error states of every screen can be reviewed
// without touching a real account.
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

    var scenario: Scenario {
        get { lock.withLock { _scenario } }
        set { lock.withLock { _scenario = newValue } }
    }

    // Long enough to see each loading state, short enough not to annoy.
    private let latency: Duration = .milliseconds(450)

    // MARK: Auth

    func restoreSession() async -> UserProfile? {
        lock.withLock { _signedIn } ? SampleData.profile : nil
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
        lock.withLock { _signedIn = true }
        broadcast(.signedIn(SampleData.profile))
        return SampleData.profile
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
        try await answer(SampleData.inventory(), empty: [])
    }

    func fetchWishlist(userId: String) async throws -> [WishlistRow] {
        try await answer(SampleData.wishlist(), empty: [])
    }

    func fetchShareSettings(userId: String) async throws -> SharedCollectionRow? {
        try await answer(SampleData.shareSettings(), empty: nil)
    }

    func fetchFeedback(userId: String) async throws -> [FeedbackRow] {
        try await answer(SampleData.feedback(), empty: [])
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
        case "/api/admin/access": #"{"admin":true}"#
        case "/api/featured-shelves": SampleData.featuredShelvesJSON
        case "/api/admin/stats": SampleData.adminStatsJSON
        case "/api/admin/banner": #"{"banner":{"enabled":true,"message":"Sample banner: the roadmap has three new items this month.","linkLabel":"See the roadmap","linkView":"roadmap","updatedAt":"2026-07-01T00:00:00Z"}}"#
        default: nil
        }
    }
}
