import Foundation
import Network
import Observation

// The one object every screen reads from. It owns whichever store is active
// (Live or Sample) and the last rows each fetch or save returned -- in memory
// only. A save changes these rows only once the store has accepted it, and
// then to the row the store sent back, as the web does.
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
    private var liveStore: LiveStore?

    let pendingPhotos = PendingPhotos()
    let toasts = ToastCenter()
    // Set when a password-reset link signs the collector in: the app then
    // asks for the new password before anything else.
    var choosingNewPassword = false

    // Sample mode's AI; live mode calls the site (AppModel+AI.swift).
    let fakeAI = FakeAI()
    // What /api/v1/identify-budget last said is left today. nil until asked.
    var identifyAllowance: PhotoAI.Allowance?
    let network = NetworkMonitor()
    let photos: PhotoSigner

    // Which tab is showing, and an item a screen asked the collection to show
    // (a recent find tapped on the dashboard). Shared so any screen can send
    // the reader to another.
    var selectedTab: AppTab = .dashboard
    var focusItemId: String?
    // A page another tab asked More to open (the collection's "Export for
    // insurance" lives under More on the phone).
    var pendingMoreRoute: AppView?
    // A page the signed-out stack was asked to open (the site banner's link).
    var pendingSignedOutView: AppView?
    var pendingWebRoute: WebRoute?

    // Where the site banner's link goes: bannerDestination's views, mapped
    // onto the phone's tabs and stacks.
    func followBannerLink(_ view: String) {
        if view == "explore" {
            if profile != nil { selectedTab = .more }
            pendingWebRoute = .explore
            return
        }
        guard let target = AppView(rawValue: view) else { return }
        if profile == nil {
            pendingSignedOutView = target
            return
        }
        switch target {
        case .dashboard: selectedTab = .dashboard
        case .addItems: selectedTab = .add
        case .wishlist: selectedTab = .wishlist
        case .inventory: selectedTab = .collection
        default:
            selectedTab = .more
            pendingMoreRoute = target
        }
    }

    private(set) var auth: AuthState = .unknown
    private(set) var isAdmin = false

    // What the store last returned. Never written to disk.
    private(set) var inventoryRows: [InventoryRow] = []
    private(set) var wishlistRows: [WishlistRow] = []
    private(set) var shareRowLive: SharedCollectionRow?
    private(set) var feedbackRows: [FeedbackRow] = []
    private(set) var bannerRow: SiteBannerRow?
    // The home page's strip. nil while loading; [] hides the section, which
    // is also what a failed fetch does -- as on the web.
    private(set) var featuredShelves: [FeaturedShelf]?

    private(set) var inventoryLoad: Load = .idle
    private(set) var wishlistLoad: Load = .idle
    private(set) var shareLoad: Load = .idle
    private(set) var feedbackLoad: Load = .idle
    private(set) var lastSyncedAt: Date?

    // True while a save is on its way, so a screen can disable its Save
    // button rather than let a second tap send the same write twice.
    var isSaving = false

    // Developer switches.
    var forceOffline = false
    var dismissedBannerId: String?

    private var authTask: Task<Void, Never>?

    init(config: Result<AppConfig, AppConfig.Problem> = AppConfig.load()) {
        self.config = config
        if case .success(let ready) = config {
            let live = LiveStore(config: ready)
            liveStore = live
            store = live
            dataMode = .live
        } else {
            store = sampleStore
            dataMode = .sample
        }
        photos = PhotoSigner()
        // Launch arguments for review and screenshots, e.g.
        //   xcrun simctl launch booted app.firstfinder.prototype -FFDataMode Sample -FFSampleSignedIn NO
        // They arrive in the arguments domain of UserDefaults, which is never
        // written to disk.
        let arguments = UserDefaults.standard
        if arguments.string(forKey: "FFDataMode") == DataMode.sample.rawValue {
            store = sampleStore
            dataMode = .sample
        }
        if arguments.object(forKey: "FFSampleSignedIn") != nil {
            sampleStore.setSignedIn(arguments.bool(forKey: "FFSampleSignedIn"))
        }
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
        inventoryRows.map { Mapping.fromDbItem($0) }
    }

    var wishlist: [Want] {
        wishlistRows.map(Mapping.fromDbWant)
    }

    var shareSettings: ShareSettings? {
        shareRowLive.map(Mapping.fromDbShareSettings)
    }

    var feedback: [FeedbackRow] {
        feedbackRows
    }

    var siteBanner: SiteBanner {
        Mapping.fromDbBanner(bannerRow)
    }

    var showsSiteBanner: Bool {
        Mapping.shouldShowBanner(siteBanner, dismissedId: dismissedBannerId)
    }

    func openItem(_ id: String) {
        focusItemId = id
        selectedTab = .collection
    }

    // MARK: Taking in what a save returned

    // The actions (AppModel+Actions.swift, Wishlist.swift) call these with the
    // row the store sent back, so the screen shows what was actually stored.

    func took(item row: InventoryRow) {
        if let index = inventoryRows.firstIndex(where: { $0.id == row.id }) {
            inventoryRows[index] = row
        } else {
            inventoryRows = [row] + inventoryRows
        }
    }

    func dropped(itemId: String) {
        inventoryRows.removeAll { $0.id == itemId }
    }

    func took(want row: WishlistRow) {
        if let index = wishlistRows.firstIndex(where: { $0.id == row.id }) {
            wishlistRows[index] = row
        } else {
            wishlistRows = [row] + wishlistRows
        }
    }

    func dropped(wantId: String) {
        wishlistRows.removeAll { $0.id == wantId }
    }

    func took(share row: SharedCollectionRow) {
        shareRowLive = row
    }

    func took(feedback row: FeedbackRow) {
        feedbackRows = [row] + feedbackRows
    }

    func took(profile next: UserProfile) {
        if case .signedIn = auth { auth = .signedIn(next) }
    }

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

    func signInWithGoogle() async throws {
        let profile = try await store.signInWithGoogle()
        await becomeSignedIn(profile)
    }

    func signOut() async {
        await store.signOut()
        becomeSignedOut()
    }

    func becomeSignedIn(_ profile: UserProfile) async {
        auth = .signedIn(profile)
        await refreshAll()
        await checkAdmin()
    }

    private func becomeSignedOut() {
        auth = .signedOut
        isAdmin = false
        clearRows()
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
        pendingPhotos.forgetAll()
    }

    // Live <-> Sample. Every row, signed URL and unsaved photo from the old
    // store goes with the switch.
    func switchMode(to mode: DataMode) async {
        guard mode != dataMode else { return }
        if mode == .live, liveStore == nil { return }
        if mode == .sample { sampleStore.setSignedIn(profile != nil) }
        dataMode = mode
        store = mode == .live ? liveStore! : sampleStore
        photos.attach(store)
        clearRows()
        featuredShelves = nil
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

    // The book-name field's catalog suggestions. A failed search just offers
    // fewer suggestions, as on the web.
    func searchBookCatalog(_ query: String) async -> [BookCatalogRow] {
        guard isOnline else { return [] }
        return (try? await store.searchBookCatalog(query: query, limit: BookSearch.maxSuggestions)) ?? []
    }

    func loadBanner() async {
        guard isOnline else { return }
        // Like the web: a banner that fails to load is simply not shown.
        if let row = try? await store.fetchSiteBanner() { bannerRow = row }
    }

    func loadFeaturedShelves(force: Bool = false) async {
        if featuredShelves != nil, !force { return }
        guard isOnline else {
            if featuredShelves == nil { featuredShelves = [] }
            return
        }
        do {
            let data = try await store.getSiteJSON(path: "/api/v1/featured-shelves", authorized: false)
            featuredShelves = try JSONDecoder().decode(FeaturedShelvesResponse.self, from: data).shelves
        } catch {
            featuredShelves = []
        }
    }

    private func checkAdmin() async {
        struct Access: Decodable { let admin: Bool }
        guard let data = try? await store.getSiteJSON(path: "/api/v1/admin/access", authorized: true),
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

enum AppTab: Hashable { case dashboard, collection, add, wishlist, more }

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
