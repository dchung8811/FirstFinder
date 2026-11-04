import Foundation
import Supabase

// The only file in the app that imports Supabase, and the only way the app
// reaches the live database. What it may do is short and fixed:
//
//   read   inventory_items, wishlist_items, shared_collections (own row),
//          feedback (own rows), site_banner; the search_book_catalog function;
//          batched signed URLs on the item-photos bucket
//   write  inventory_items, wishlist_items, shared_collections, feedback --
//          the collector's own rows, which Row Level Security enforces; photos
//          under the collector's own folder in item-photos; their own auth
//          metadata (name, email preference); queue_book_suggestion
//   call   the site's /api/v1 routes, with the collector's own token
//
// WriteGuardTests holds every file in ios/ to that list: only this file may
// write, only to these tables and functions, never with the service role key.
//
// Nothing read here is written to disk by this file. The URLSession is
// ephemeral (no cookie store, no disk cache); the auth session lives in the
// Keychain, where supabase-swift keeps it.
final class LiveStore: CollectionStore, @unchecked Sendable {
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
    static let oauthRedirect = AuthFlow.callbackURL

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

    func signInWithApple(idToken: String, nonce: String) async throws -> UserProfile {
        do {
            let session = try await client.auth.signInWithIdToken(
                credentials: OpenIDConnectCredentials(provider: .apple, idToken: idToken, nonce: nonce)
            )
            return Self.profile(from: session.user)
        } catch {
            throw StoreError.failed(Self.describeAuthError(error))
        }
    }

    func createAccount(email: String, password: String, emailUpdates: Bool) async throws -> AuthFlow.SignUpOutcome {
        // Only written when ticked, as on the web: an account that said
        // nothing carries no record of having said no either.
        let data: [String: AnyJSON]? = emailUpdates
            ? ["email_updates": .bool(true), "email_updates_changed_at": .string(ISO8601DateFormatter().string(from: Date()))]
            : nil
        let response: AuthResponse
        do {
            response = try await client.auth.signUp(email: email, password: password, data: data, redirectTo: AuthFlow.callbackURL)
        } catch {
            throw StoreError.failed(Self.describeAuthError(error))
        }
        if let session = response.session { return .signedIn(Self.profile(from: session.user)) }
        if response.user.identities?.isEmpty == true { return .alreadyRegistered }
        return .confirmEmail
    }

    func sendPasswordReset(email: String) async throws {
        do {
            try await client.auth.resetPasswordForEmail(email, redirectTo: AuthFlow.callbackURL)
        } catch {
            throw StoreError.failed(Self.describeAuthError(error))
        }
    }

    func completeAuthLink(_ url: URL) async throws -> (profile: UserProfile, isRecovery: Bool) {
        do {
            let session = try await client.auth.session(from: url)
            return (Self.profile(from: session.user), AuthFlow.isRecovery(recoverySentAt: session.user.recoverySentAt))
        } catch {
            throw StoreError.failed(AuthFlow.linkFailedMessage)
        }
    }

    func setPassword(_ password: String) async throws {
        do {
            _ = try await client.auth.update(user: UserAttributes(password: password))
        } catch {
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

    func postSiteJSON(path: String, body: Data) async throws -> Data {
        guard let url = URL(string: path, relativeTo: siteURL) else { throw StoreError.failed("Bad path \(path)") }
        guard let token = await accessToken() else { throw StoreError.notSignedIn }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = body
        // A photo identification searches the web before it answers, which
        // can outlast the default 60 seconds.
        request.timeoutInterval = 300
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
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

    // MARK: Writes

    func maxReferenceNumber(userId: String) async throws -> Int {
        struct Row: Decodable, Sendable { let reference_number: Int? }
        let rows: [Row] = try await write {
            try await self.client.from("inventory_items")
                .select("reference_number")
                .eq("user_id", value: userId)
                .not("reference_number", operator: .is, value: "null")
                .order("reference_number", ascending: false)
                .limit(1)
                .execute()
                .value
        }
        return rows.first?.reference_number ?? 0
    }

    func insertItems(_ payloads: [RowPayload]) async throws -> [InventoryRow] {
        try await write {
            try await self.client.from("inventory_items").insert(payloads).select().execute().value
        }
    }

    func updateItem(id: String, _ payload: RowPayload) async throws -> InventoryRow {
        try await write {
            try await self.client.from("inventory_items").update(payload).eq("id", value: id).select().single().execute().value
        }
    }

    func deleteItem(id: String) async throws {
        try await write {
            _ = try await self.client.from("inventory_items").delete().eq("id", value: id).execute()
        }
    }

    func uploadPhoto(path: String, jpeg: Data) async throws {
        try await write {
            // upsert off: a path is never reused, and writing over one should
            // fail rather than replace. A year's cache-control, as the web
            // sets, because the object at a path never changes.
            _ = try await self.client.storage.from(PhotoSigning.bucket)
                .upload(path, data: jpeg, options: FileOptions(cacheControl: "31536000", contentType: "image/jpeg", upsert: false))
        }
    }

    func removePhotos(paths: [String]) async throws {
        guard !paths.isEmpty else { return }
        try await write {
            _ = try await self.client.storage.from(PhotoSigning.bucket).remove(paths: paths)
        }
    }

    func listItemPhotoPaths(userId: String, itemId: String) async -> [String]? {
        let prefix = "\(userId)/\(itemId)"
        let pageSize = 100
        var paths: [String] = []
        // Paged to the end: one page would be a silent ceiling that looks
        // exactly like success.
        var offset = 0
        while true {
            guard let page = try? await client.storage.from(PhotoSigning.bucket)
                .list(path: prefix, options: SearchOptions(limit: pageSize, offset: offset))
            else { return nil }
            // Folder entries have no id; only files are removable.
            paths += page.filter { $0.id != nil }.map { "\(prefix)/\($0.name)" }
            if page.count < pageSize { return paths }
            offset += pageSize
        }
    }

    func queueBookSuggestion(title: String, author: String) async {
        struct Params: Encodable, Sendable {
            let p_title: String
            let p_author: String
        }
        // Best effort, like the web's: a suggestion that doesn't land costs
        // nothing but a catalog entry.
        _ = try? await client.rpc("queue_book_suggestion", params: Params(p_title: title, p_author: author)).execute()
    }

    func insertWant(_ payload: RowPayload) async throws -> WishlistRow {
        try await write {
            try await self.client.from("wishlist_items").insert(payload).select().single().execute().value
        }
    }

    func updateWant(id: String, _ payload: RowPayload) async throws -> WishlistRow {
        try await write {
            try await self.client.from("wishlist_items").update(payload).eq("id", value: id).select().single().execute().value
        }
    }

    func deleteWant(id: String) async throws {
        try await write {
            _ = try await self.client.from("wishlist_items").delete().eq("id", value: id).execute()
        }
    }

    func upsertShareSettings(_ payload: RowPayload) async throws -> SharedCollectionRow {
        try await write {
            try await self.client.from("shared_collections").upsert(payload, onConflict: "user_id").select().single().execute().value
        }
    }

    func insertFeedback(_ payload: RowPayload) async throws -> FeedbackRow {
        try await write {
            try await self.client.from("feedback").insert(payload).select(FeedbackRow.selectColumns).single().execute().value
        }
    }

    func updateFeedback(id: String, _ payload: RowPayload) async throws {
        try await write {
            _ = try await self.client.from("feedback").update(payload).eq("id", value: id).execute()
        }
    }

    func updateUserMetadata(_ data: [String: JSONValue]) async throws -> UserProfile {
        try await write {
            let user = try await self.client.auth.update(user: UserAttributes(data: data.mapValues(Self.anyJSON)))
            return Self.profile(from: user)
        }
    }

    // MARK: Helpers

    // Every write goes through here, so a refusal always reaches the app as
    // StoreError.write with the database's own code -- which is what
    // WriteRetry decides on -- and being offline stays .offline.
    private func write<T: Sendable>(_ body: @Sendable () async throws -> T) async throws -> T {
        do {
            return try await body()
        } catch let error as PostgrestError {
            throw StoreError.write(error.message, code: error.code)
        } catch let error as StorageError {
            throw StoreError.write(error.message, code: nil)
        } catch let error as URLError where [.notConnectedToInternet, .dataNotAllowed].contains(error.code) {
            throw StoreError.offline
        } catch {
            throw StoreError.write(error.localizedDescription, code: nil)
        }
    }

    private static func anyJSON(_ value: JSONValue) -> AnyJSON {
        switch value {
        case .null: .null
        case .bool(let value): .bool(value)
        case .int(let value): .integer(value)
        case .number(let value): .double(NSDecimalNumber(decimal: value).doubleValue)
        case .string(let value): .string(value)
        case .array(let values): .array(values.map(anyJSON))
        case .object(let values): .object(values.mapValues(anyJSON))
        }
    }

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
