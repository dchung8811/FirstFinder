import Foundation

// Port of src/utils/appNav.js: every view the web app has, its address and its
// title. The prototype's screen list is this enum; a view added on the web
// shows up as a missing case here, and AppNavTests pins the two together.
enum AppView: String, CaseIterable, Identifiable, Hashable, Sendable {
    case home, dashboard, inventory, wishlist, addItems, tutorial, identify, insuranceExport
    case feedback, account, about, roadmap, features, contribute, privacy, terms
    case login, signup, resetPassword

    var id: String { rawValue }

    // VIEW_PATHS
    var path: String {
        switch self {
        case .home: "/"
        case .dashboard: "/dashboard"
        case .inventory: "/collection"
        case .wishlist: "/wishlist"
        case .addItems: "/add"
        case .tutorial: "/add-manually"
        case .identify: "/identify"
        case .insuranceExport: "/insurance-report"
        case .feedback: "/feedback"
        case .account: "/account"
        case .about: "/about"
        case .roadmap: "/roadmap"
        case .features: "/features"
        case .contribute: "/contribute"
        case .privacy: "/privacy"
        case .terms: "/terms"
        case .login: "/login"
        case .signup: "/signup"
        case .resetPassword: "/reset-password"
        }
    }

    // VIEW_TITLES. Home has none on the web; it keeps the full site title.
    var title: String {
        switch self {
        case .home: "FirstFinder"
        case .dashboard: "Dashboard"
        case .inventory: "My Collection"
        case .wishlist: "Wishlist"
        case .addItems: "Add Items"
        case .tutorial: "Add an item"
        case .identify: "Review identification"
        case .insuranceExport: "Insurance report"
        case .feedback: "Feedback"
        case .account: "My Account"
        case .about: "About"
        case .roadmap: "Roadmap"
        case .features: "Features"
        case .contribute: "Contribute"
        case .privacy: "Privacy Policy"
        case .terms: "Terms of Service"
        case .login: "Log in"
        case .signup: "Sign up"
        case .resetPassword: "Reset password"
        }
    }

    static let privateViews: Set<AppView> = [.dashboard, .inventory, .wishlist, .addItems, .tutorial, .identify, .insuranceExport, .feedback, .account]
    static let publicViews: Set<AppView> = [.about, .roadmap, .features, .contribute, .privacy, .terms]
    static let signedOutOnlyViews: Set<AppView> = [.home, .login, .signup]

    static func forPath(_ pathname: String) -> AppView? {
        var path = pathname.isEmpty ? "/" : pathname
        while path.count > 1, path.hasSuffix("/") { path = String(path.dropLast()) }
        return allCases.first { $0.path == path }
    }

    // landingView: where a request for a view actually lands.
    static func landing(_ requested: AppView?, isLoggedIn: Bool) -> AppView {
        if requested == .identify { return isLoggedIn ? .addItems : .login }
        if isLoggedIn {
            if let requested, privateViews.contains(requested) || publicViews.contains(requested) { return requested }
            return .dashboard
        }
        if let requested, publicViews.contains(requested) || signedOutOnlyViews.contains(requested) { return requested }
        if let requested, privateViews.contains(requested) || requested == .resetPassword { return .login }
        return .home
    }
}

// Pages that are web routes outside the app shell. The prototype opens these
// on the live site in a web view rather than rebuilding them, because the web
// reads them on the server with the service role, which a phone must never
// hold.
enum WebRoute: Hashable, Identifiable, Sendable {
    case explore
    case sharedCollection(slug: String)
    case bookGuides
    case featureGuide(slug: String)

    var id: String { path }

    var path: String {
        switch self {
        case .explore: "/explore"
        case .sharedCollection(let slug): "/c/\(slug)"
        case .bookGuides: "/books"
        case .featureGuide(let slug): "/features/\(slug)"
        }
    }

    var title: String {
        switch self {
        case .explore: "Explore"
        case .sharedCollection: "Shared collection"
        case .bookGuides: "Book guides"
        case .featureGuide: "Feature guide"
        }
    }
}
