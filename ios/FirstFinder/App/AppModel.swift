import Foundation
import Network
import Observation

// The one object every screen reads from. It owns whichever store is active
// (Live or Sample), the overlay on top of it, and the last rows each fetch
// returned -- in memory only. "Offline" means exactly that: the last
// successful fetch, still on screen, with the offline banner over it.
@MainActor
@Observable
final class AppModel {
    enum AuthState: Equatable {
        case unknown
        case signedOut
        case signedIn(UserProfile)
    }

    enum Load: Equatable {
        case idle
        case loading
        case loaded(Date)
        case failed(String)

        var isLoading: Bool { self == .loading }
    }

    let config: Result<AppConfig, AppConfig.Problem>
    private(set) var dataMode: DataMode
    private(set) var store: any CollectionStore
    let sampleStore = SampleStore()
    private var liveStore: LiveReadStore?

    private(set) var overlay = LocalOverlay()
    let toasts = ToastCenter()
    let network = NetworkMonitor()
    let photos: PhotoSigner

    private(set) var auth: AuthState = .unknown
    private(set) var isAdmin = false

    // What the store last returned. Never written to disk.
    private(set) var inventoryRows: [InventoryRow] = []
    private(set) var wishlistRows: [WishlistRow] = []
    private(set) var shareRowLive: SharedCollectionRow?
    private(set) var feedbackRows: [FeedbackRow] = []
    private(set) var bannerRow: SiteBannerRow?

    private(set) var inventoryLoad: Load = .idle
    private(set) var wishlistLoad: Load = .idle
    private(set) var shareLoad: Load = .idle
    private(set) var feedbackLoad: Load = .idle
    private(set) var lastSyncedAt: Date?

    // Developer switches.
    var forceOffline = false
    var dismissedBannerId: String?

    private var authTask: Task<Void, Never>?

    init(config: Result<AppConfig, AppConfig.Problem> = AppConfig.load()) {
        self.config = config
        if case .success(let ready) = config {
            let live = LiveReadStore(config: ready)
            liveStore = live
            store = live
            dataMode = .live
        } else {
            store = sampleStore
            dataMode = .sample
        }
        photos = PhotoSigner()
        photos.attach(store)
        network.start()
    }

    var isLiveAvailable: Bool { liveStore != nil }
    var isOnline: Bool { network.isOnline && !forceOffline }

    var profile: UserProfile? {
        if case .signedIn(let profile) = auth { return profile }
        return nil
    }

    // MARK: What the screens read

    var inventory: [Item] {
        overlay.mergedInventory(inventoryRows).map { Mapping.fromDbItem($0) }
    }

    var wishlist: [Want] {
        overlay.mergedWishlist(wishlistRows).map(Mapping.fromDbWant)
    }

    var shareSettings: ShareSettings? {
        overlay.mergedShare(shareRowLive).map(Mapping.fromDbShareSettings)
    }

    var feedback: [FeedbackRow] {
        overlay.mergedFeedback(feedbackRows)
    }

    var siteBanner: SiteBanner {
        Mapping.fromDbBanner(bannerRow)
    }

    var showsSiteBanner: Bool {
        Mapping.shouldShowBanner(siteBanner, dismissedId: dismissedBannerId)
    }

    // Counts stay nil until their fetch has landed, as on the web:
    // "My Collection (0)" while loading reads as an empty collection.
    var inventoryCount: Int? {
        if case .loaded = inventoryLoad { return inventory.count }
        return nil
    }

    var wishlistCount: Int? {
        if case .loaded = wishlistLoad { return wishlist.count }
        return nil
    }

    func isLocal(itemId: String) -> Bool { overlay.isLocal(itemId: itemId) }
    func isLocal(wantId: String) -> Bool { overlay.isLocal(wantId: wantId) }

    // MARK: Lifecycle

    func start() async {
        listenForAuth()
        if let profile = await store.restoreSession() {
            await becomeSignedIn(profile)
        } else {
            auth = .signedOut
        }
        await loadBanner()
    }

    private func listenForAuth() {
        authTask?.cancel()
        let events = store.authEvents()
        authTask = Task { [weak self] in
            for await event in events {
                guard let self else { return }
                switch event {
                case .signedIn(let profile):
                    if self.profile?.id != profile.id { await self.becomeSignedIn(profile) }
                case .refreshed(let profile):
                    // A refreshed token changes nothing a screen shows; it
                    // must not reload or navigate. Keep the profile current.
                    if case .signedIn = self.auth { self.auth = .signedIn(profile) }
                case .signedOut:
                    self.becomeSignedOut()
                }
            }
        }
    }

    func signIn(email: String, password: String) async throws {
        let profile = try await store.signIn(email: email, password: password)
        await becomeSignedIn(profile)
    }

    func signOut() async {
        await store.signOut()
        becomeSignedOut()
    }

    private func becomeSignedIn(_ profile: UserProfile) async {
        auth = .signedIn(profile)
        await refreshAll()
        await checkAdmin()
    }

    private func becomeSignedOut() {
        auth = .signedOut
        isAdmin = false
        clearRows()
        overlay.revertAll()
    }

    private func clearRows() {
        inventoryRows = []
        wishlistRows = []
        shareRowLive = nil
        feedbackRows = []
        inventoryLoad = .idle
        wishlistLoad = .idle
        shareLoad = .idle
        feedbackLoad = .idle
        lastSyncedAt = nil
        photos.reset()
    }

    // Live <-> Sample. The overlay belongs to the data it sits on, so it goes
    // with the switch; so does every row and signed URL from the old store.
    func switchMode(to mode: DataMode) async {
        guard mode != dataMode else { return }
        if mode == .live, liveStore == nil { return }
        dataMode = mode
        store = mode == .live ? liveStore! : sampleStore
        photos.attach(store)
        clearRows()
        overlay.revertAll()
        auth = .unknown
        isAdmin = false
        await start()
    }

    func setSampleScenario(_ scenario: SampleStore.Scenario) async {
        sampleStore.scenario = scenario
        if dataMode == .sample, profile != nil { await refreshAll() }
    }

    // MARK: Fetching

    func refreshAll() async {
        guard let userId = profile?.id else { return }
        async let a: Void = refreshInventory(userId: userId)
        async let b: Void = refreshWishlist(userId: userId)
        async let c: Void = refreshShare(userId: userId)
        async let d: Void = refreshFeedback(userId: userId)
        async let e: Void = loadBanner()
        _ = await (a, b, c, d, e)
    }

    func refreshInventory(userId: String? = nil) async {
        guard let userId = userId ?? profile?.id else { return }
        guard isOnline else { return markOffline(&inventoryLoad) }
        if case .loaded = inventoryLoad {} else { inventoryLoad = .loading }
        do {
            inventoryRows = try await store.fetchInventory(userId: userId)
            let now = Date()
            inventoryLoad = .loaded(now)
            lastSyncedAt = now
        } catch {
            fail(&inventoryLoad, error)
        }
    }

    func refreshWishlist(userId: String? = nil) async {
        guard let userId = userId ?? profile?.id else { return }
        guard isOnline else { return markOffline(&wishlistLoad) }
        if case .loaded = wishlistLoad {} else { wishlistLoad = .loading }
        do {
            wishlistRows = try await store.fetchWishlist(userId: userId)
            wishlistLoad = .loaded(Date())
        } catch {
            fail(&wishlistLoad, error)
        }
    }

    func refreshShare(userId: String? = nil) async {
        guard let userId = userId ?? profile?.id else { return }
        guard isOnline else { return markOffline(&shareLoad) }
        if case .loaded = shareLoad {} else { shareLoad = .loading }
        do {
            shareRowLive = try await store.fetchShareSettings(userId: userId)
            shareLoad = .loaded(Date())
        } catch {
            fail(&shareLoad, error)
        }
    }

    func refreshFeedback(userId: String? = nil) async {
        guard let userId = userId ?? profile?.id else { return }
        guard isOnline else { return markOffline(&feedbackLoad) }
        if case .loaded = feedbackLoad {} else { feedbackLoad = .loading }
        do {
            feedbackRows = try await store.fetchFeedback(userId: userId)
            feedbackLoad = .loaded(Date())
        } catch {
            fail(&feedbackLoad, error)
        }
    }

    func loadBanner() async {
        guard isOnline else { return }
        // Like the web: a banner that fails to load is simply not shown.
        if let row = try? await store.fetchSiteBanner() { bannerRow = row }
    }

    private func checkAdmin() async {
        struct Access: Decodable { let admin: Bool }
        guard let data = try? await store.getSiteJSON(path: "/api/admin/access", authorized: true),
              let access = try? JSONDecoder().decode(Access.self, from: data)
        else { return }
        isAdmin = access.admin
    }

    // An offline refresh keeps whatever was loaded; only a screen that never
    // loaded anything shows the offline error.
    private func markOffline(_ load: inout Load) {
        if case .loaded = load { return }
        load = .failed(StoreError.offline.localizedDescription)
    }

    private func fail(_ load: inout Load, _ error: any Error) {
        if case .loaded = load, (error as? StoreError) == .offline { return }
        load = .failed(error.localizedDescription)
    }
}

// NWPathMonitor, observed. The web's equivalent is navigator.onLine.
@MainActor
@Observable
final class NetworkMonitor {
    private(set) var isOnline = true
    private let monitor = NWPathMonitor()

    func start() {
        monitor.pathUpdateHandler = { [weak self] path in
            let online = path.status == .satisfied
            Task { @MainActor in self?.isOnline = online }
        }
        monitor.start(queue: DispatchQueue(label: "app.firstfinder.prototype.network"))
    }
}

// ToastStack's model: the web's pushToast(message, tone).
@MainActor
@Observable
final class ToastCenter {
    struct Toast: Identifiable, Equatable {
        enum Tone { case success, warning, error, info }
        let id = UUID()
        let message: String
        let tone: Tone
    }

    private(set) var toasts: [Toast] = []

    func push(_ message: String, tone: Toast.Tone = .success) {
        let toast = Toast(message: message, tone: tone)
        toasts = (toasts + [toast]).suffix(4)
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(tone == .error ? 7 : 4))
            self?.dismiss(toast.id)
        }
    }

    func dismiss(_ id: UUID) {
        toasts.removeAll { $0.id == id }
    }
}
