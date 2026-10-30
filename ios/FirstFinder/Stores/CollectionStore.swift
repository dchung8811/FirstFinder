import Foundation

// What a screen can ask of the data layer. Two stores implement it: the live
// one, which reads the real database and can do nothing else, and the sample
// one, which answers from memory. Views only ever see AppModel, which holds
// one of them, so no view can tell -- or needs to know -- which it has.
//
// Every method here is a read. Writes do not go through a store at all: they
// land in LocalOverlay, in memory, and disappear when the app quits.

enum DataMode: String, CaseIterable, Sendable, Identifiable {
    case live = "Live"
    case sample = "Sample"

    var id: String { rawValue }
}

enum StoreError: LocalizedError, Equatable {
    case notConfigured(String)
    case offline
    case notSignedIn
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured(let detail): detail
        case .offline: "You're offline. Showing what was last loaded."
        case .notSignedIn: "Sign in to see your collection."
        case .failed(let message): message
        }
    }
}

enum AuthEvent: Sendable, Equatable {
    case signedIn(UserProfile)
    // Only an explicit sign-out or a session the server has actually revoked.
    // A refresh that failed because the network dropped is not one of these,
    // and must never send someone back to the login form.
    case signedOut
    case refreshed(UserProfile)
}

protocol CollectionStore: AnyObject, Sendable {
    nonisolated var mode: DataMode { get }

    // Auth
    func restoreSession() async -> UserProfile?
    func authEvents() -> AsyncStream<AuthEvent>
    func signIn(email: String, password: String) async throws -> UserProfile
    func signOut() async
    func accessToken() async -> String?

    // Reads, all scoped to the signed-in collector by RLS (live) or by
    // construction (sample).
    func fetchInventory(userId: String) async throws -> [InventoryRow]
    func fetchWishlist(userId: String) async throws -> [WishlistRow]
    func fetchShareSettings(userId: String) async throws -> SharedCollectionRow?
    func fetchFeedback(userId: String) async throws -> [FeedbackRow]
    func fetchSiteBanner() async throws -> SiteBannerRow?
    func searchBookCatalog(query: String, limit: Int) async throws -> [BookCatalogRow]

    // Signs the given photo paths in one batch. A path that could not be
    // signed is simply absent from the result, so the caller hides that image
    // rather than drawing a broken one.
    func signPhotoURLs(paths: [String]) async -> [String: URL]

    // GETs against the public site (featured shelves, contribute issues and,
    // for an admin, the admin routes). Sample mode answers these from canned
    // JSON.
    func getSiteJSON(path: String, authorized: Bool) async throws -> Data
}

// The prototype's own rule for how long a signed photo URL lives. The web
// signs for seven days and caches the result in browser storage; the phone
// keeps nothing on disk, so it signs for an hour and re-signs when it needs to.
enum PhotoSigning {
    static let bucket = "item-photos"
    static let ttlSeconds = 3600
    static let batchLimit = 100
}
