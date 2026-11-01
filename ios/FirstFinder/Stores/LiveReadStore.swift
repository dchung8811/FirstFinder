import Foundation
import Supabase

// The only file in the prototype that imports Supabase, and the only way the
// app reaches the live database. It exposes reads and nothing else:
//
//   select on inventory_items, wishlist_items, shared_collections (own row),
//   feedback (own rows), site_banner; the search_book_catalog function; and
//   batched signed URLs on the item-photos bucket.
//
// Row Level Security would let this account change its own rows, so the
// read-only rule is the app's, not the database's. ReadOnlyGuardTests scans
// every source file in ios/ for anything that could write and fails the
// build's tests if it finds one.
//
// Nothing read here is written to disk. The URLSession is ephemeral (no
// cookie store, no disk cache), and the only thing persisted is the auth
// session, which supabase-swift keeps in the Keychain.
final class LiveReadStore: CollectionStore, @unchecked Sendable {
    // @unchecked: every stored property is a let of a Sendable type.

    nonisolated let mode: DataMode = .live

    private let client: SupabaseClient
    private let session: URLSession
    private let siteURL: URL

    init(config: AppConfig) {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        session = URLSession(configuration: configuration)
        siteURL = config.siteURL

        client = SupabaseClient(
            supabaseURL: config.supabaseURL,
            supabaseKey: config.anonKey,
            options: SupabaseClientOptions(
                auth: .init(
                    storage: KeychainLocalStorage(service: "app.firstfinder.prototype.auth"),
                    // Emit the stored session straight away instead of waiting
                    // on a refresh. A refresh that fails offline then leaves
                    // the collector signed in with their last data, not on the
                    // login form.
                    emitLocalSessionAsInitialSession: true
                ),
                global: .init(session: session)
            )
        )
    }

    // MARK: Auth

    func restoreSession() async -> UserProfile? {
        client.auth.currentSession.map { Self.profile(from: $0.user) }
    }

    func authEvents() -> AsyncStream<AuthEvent> {
        let auth = client.auth
        return AsyncStream { continuation in
            let task = Task {
                for await (event, session) in auth.authStateChanges {
                    switch event {
                    case .signedIn, .initialSession, .userUpdated:
                        if let session { continuation.yield(.signedIn(Self.profile(from: session.user))) }
                    case .tokenRefreshed:
                        if let session { continuation.yield(.refreshed(Self.profile(from: session.user))) }
                    case .signedOut:
                        continuation.yield(.signedOut)
                    default:
                        break
                    }
                }
                continuation.finish()
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    func signIn(email: String, password: String) async throws -> UserProfile {
        do {
            // Fires the existing login_events trigger server-side. That row is
            // the one write this app causes, and it's the database's doing.
            let session = try await client.auth.signIn(email: email, password: password)
            return Self.profile(from: session.user)
        } catch {
            throw StoreError.failed(Self.describeAuthError(error))
        }
    }

    // Where Google sends the collector back. Must be listed under Redirect
    // URLs in the Supabase dashboard (Authentication → URL Configuration).
    static let oauthRedirect = URL(string: "app.firstfinder.prototype://auth-callback")!

    func signInWithGoogle() async throws -> UserProfile {
        do {
            let session = try await client.auth.signInWithOAuth(provider: .google, redirectTo: Self.oauthRedirect) { webSession in
                // An ephemeral sheet keeps no Google cookies on the phone
                // afterwards, in keeping with storing nothing but the session.
                webSession.prefersEphemeralWebBrowserSession = true
            }
            return Self.profile(from: session.user)
        } catch {
            if (error as NSError).domain == "com.apple.AuthenticationServices.WebAuthenticationSession", (error as NSError).code == 1 {
                throw StoreError.failed("Sign-in was cancelled or failed. Try again.")
            }
            throw StoreError.failed(Self.describeAuthError(error))
        }
    }

    func signOut() async {
        // Local scope: end this phone's session only. The default (global)
        // would also sign the collector out of the website on every device.
        try? await client.auth.signOut(scope: .local)
    }

    func accessToken() async -> String? {
        try? await client.auth.session.accessToken
    }

    // MARK: Reads

    func fetchInventory(userId: String) async throws -> [InventoryRow] {
        try await run {
            try await self.client.from("inventory_items")
                .select()
                .eq("user_id", value: userId)
                .order("created_at", ascending: false)
                .execute()
                .value
        }
    }

    func fetchWishlist(userId: String) async throws -> [WishlistRow] {
        try await run {
            try await self.client.from("wishlist_items")
                .select()
                .eq("user_id", value: userId)
                .order("created_at", ascending: false)
                .execute()
                .value
        }
    }

    func fetchShareSettings(userId: String) async throws -> SharedCollectionRow? {
        let rows: [SharedCollectionRow] = try await run {
            try await self.client.from("shared_collections")
                .select()
                .eq("user_id", value: userId)
                .limit(1)
                .execute()
                .value
        }
        return rows.first
    }

    func fetchFeedback(userId: String) async throws -> [FeedbackRow] {
        try await run {
            try await self.client.from("feedback")
                .select(FeedbackRow.selectColumns)
                .eq("user_id", value: userId)
                .order("created_at", ascending: false)
                .execute()
                .value
        }
    }

    func fetchSiteBanner() async throws -> SiteBannerRow? {
        let rows: [SiteBannerRow] = try await run {
            try await self.client.from("site_banner")
                .select(SiteBannerRow.selectColumns)
                .eq("id", value: 1)
                .limit(1)
                .execute()
                .value
        }
        return rows.first
    }

    func searchBookCatalog(query: String, limit: Int) async throws -> [BookCatalogRow] {
        struct Params: Encodable, Sendable {
            let p_query: String
            let p_limit: Int
        }
        return try await run {
            try await self.client.rpc("search_book_catalog", params: Params(p_query: query, p_limit: limit))
                .execute()
                .value
        }
    }

    func signPhotoURLs(paths: [String]) async -> [String: URL] {
        var signed: [String: URL] = [:]
        let unique = Array(Set(paths.filter { !$0.isEmpty }))

        for start in stride(from: 0, to: unique.count, by: PhotoSigning.batchLimit) {
            let batch = Array(unique[start..<min(start + PhotoSigning.batchLimit, unique.count)])
            do {
                let results = try await client.storage.from(PhotoSigning.bucket)
                    .createSignedURLs(paths: batch, expiresIn: PhotoSigning.ttlSeconds)
                for result in results {
                    if case .success(let path, let url) = result { signed[path] = url }
                }
            } catch {
                // A failed batch hides its photos; it never fails the screen.
                continue
            }
        }
        return signed
    }

    func getSiteJSON(path: String, authorized: Bool) async throws -> Data {
        guard let url = URL(string: path, relativeTo: siteURL) else { throw StoreError.failed("Bad path \(path)") }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.cachePolicy = .reloadIgnoringLocalCacheData
        if authorized {
            guard let token = await accessToken() else { throw StoreError.notSignedIn }
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        do {
            let (data, response) = try await session.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            guard (200..<300).contains(status) else {
                let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["error"] as? String
                throw StoreError.failed(message ?? "The site answered \(status).")
            }
            return data
        } catch let error as StoreError {
            throw error
        } catch {
            throw Self.translate(error)
        }
    }

    // MARK: Helpers

    private func run<T: Sendable>(_ body: @Sendable () async throws -> T) async throws -> T {
        do {
            return try await body()
        } catch {
            throw Self.translate(error)
        }
    }

    private static func translate(_ error: any Error) -> StoreError {
        if let urlError = error as? URLError,
           [.notConnectedToInternet, .networkConnectionLost, .dataNotAllowed, .timedOut].contains(urlError.code) {
            return .offline
        }
        return .failed(error.localizedDescription)
    }

    private static func describeAuthError(_ error: any Error) -> String {
        if case .offline = translate(error) { return "You're offline. Connect to sign in." }
        let text = error.localizedDescription
        if text.localizedCaseInsensitiveContains("invalid login credentials") {
            return "That email and password don't match an account."
        }
        if text.localizedCaseInsensitiveContains("email not confirmed") {
            return "Confirm your email first. The link is in your inbox."
        }
        return text
    }

    private static func profile(from user: User) -> UserProfile {
        UserProfile(
            id: user.id.uuidString.lowercased(),
            email: user.email ?? "",
            fullName: user.userMetadata["full_name"]?.stringValue ?? "",
            createdAt: user.createdAt,
            emailUpdates: user.userMetadata["email_updates"]?.boolValue ?? false
        )
    }
}
