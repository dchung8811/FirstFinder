import Foundation

// What a screen can ask of the data layer. Two stores implement it: the live
// one, which reads and writes the real database, and the sample one, which
// does both in memory for demos and App Store screenshots. Views only ever see
// AppModel, which holds one of them, so no view can tell -- or needs to know --
// which it has.
//
// Writes take the bodies Writes.swift builds, so what reaches the database is
// exactly what the web would have sent. Every write acts on the signed-in
// collector's own rows; Row Level Security refuses anything else.

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
    // A write the database refused or never answered. The code is Postgres's
    // SQLSTATE or PostgREST's own (PGRST116), nil when there was no answer at
    // all -- WriteRetry decides from it whether another attempt is worth it.
    case write(String, code: String?)

    var errorDescription: String? {
        switch self {
        case .notConfigured(let detail): detail
        case .offline: "You're offline. Showing what was last loaded."
        case .notSignedIn: "Sign in to see your collection."
        case .failed(let message): message
        case .write(let message, let code): WriteRetry.describe(message: message, code: code)
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
    // Google, through the system's sign-in sheet -- the web's "Continue with
    // Google". For an account that exists it only signs in; like the web's
    // button, a Google account Supabase has never seen would get a new one.
    func signInWithGoogle() async throws -> UserProfile
    // Native Sign in with Apple: the identity token Apple handed the app, and
    // the raw nonce whose hash went into that request.
    func signInWithApple(idToken: String, nonce: String) async throws -> UserProfile
    func createAccount(email: String, password: String, emailUpdates: Bool) async throws -> AuthFlow.SignUpOutcome
    func sendPasswordReset(email: String) async throws
    // An email link that opened the app: signs in, and says whether it was a
    // password reset so the app can ask for the new password.
    func completeAuthLink(_ url: URL) async throws -> (profile: UserProfile, isRecovery: Bool)
    func setPassword(_ password: String) async throws
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

    // A signed-in POST to the site: feedback filing and account deletion.
    func postSiteJSON(path: String, body: Data) async throws -> Data

    // MARK: Writes

    // The highest reference number in use, read from the database rather than
    // from memory, so two devices adding at once collide on the unique index
    // instead of quietly sharing a number.
    func maxReferenceNumber(userId: String) async throws -> Int

    func insertItems(_ payloads: [RowPayload]) async throws -> [InventoryRow]
    func updateItem(id: String, _ payload: RowPayload) async throws -> InventoryRow
    func deleteItem(id: String) async throws

    // Photos. Upload never overwrites: each path is new, see Writes.photoPath.
    func uploadPhoto(path: String, jpeg: Data) async throws
    func removePhotos(paths: [String]) async throws
    // Everything stored under an item's folder, which can be more than its row
    // lists. nil when the listing itself failed.
    func listItemPhotoPaths(userId: String, itemId: String) async -> [String]?

    // Fire-and-forget: suggests a title for the shared book catalog.
    func queueBookSuggestion(title: String, author: String) async

    func insertWant(_ payload: RowPayload) async throws -> WishlistRow
    func updateWant(id: String, _ payload: RowPayload) async throws -> WishlistRow
    func deleteWant(id: String) async throws

    func upsertShareSettings(_ payload: RowPayload) async throws -> SharedCollectionRow

    // Feedback photos go through uploadPhoto, under <user>/feedback/<id>/,
    // then onto the row with updateFeedback -- the web's arrangement.
    func insertFeedback(_ payload: RowPayload) async throws -> FeedbackRow
    func updateFeedback(id: String, _ payload: RowPayload) async throws

    // Account metadata on the auth user (full_name, email_updates).
    func updateUserMetadata(_ data: [String: JSONValue]) async throws -> UserProfile
}

// The prototype's own rule for how long a signed photo URL lives. The web
// signs for seven days and caches the result in browser storage; the phone
// keeps nothing on disk, so it signs for an hour and re-signs when it needs to.
enum PhotoSigning {
    static let bucket = "item-photos"
    static let ttlSeconds = 3600
    static let batchLimit = 100
}
