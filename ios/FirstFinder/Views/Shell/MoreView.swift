import SwiftUI

// Everything the web's nav and footer offer that doesn't fit the tab bar.
struct MoreView: View {
    enum Destination: Hashable {
        case view(AppView)
        case web(WebRoute)
        case admin
        case developer
    }

    @Environment(AppModel.self) private var app
    @State private var path = NavigationPath()
    @State private var confirmingSignOut = false

    var body: some View {
        NavigationStack(path: $path) {
            List {
                Section {
                    row("Explore", "safari", .web(.explore))
                    row(AppView.insuranceExport.title, icon(for: .insuranceExport), .view(.insuranceExport))
                    row(AppView.feedback.title, icon(for: .feedback), .view(.feedback))
                    row(AppView.account.title, icon(for: .account), .view(.account))
                }
                Section("FirstFinder") {
                    ForEach([AppView.features, .roadmap, .about, .contribute]) { view in
                        row(view.title, icon(for: view), .view(view))
                    }
                    row("Book guides", "books.vertical", .web(.bookGuides))
                    row(AppView.privacy.title, icon(for: .privacy), .view(.privacy))
                    row(AppView.terms.title, icon(for: .terms), .view(.terms))
                }
                Section {
                    // Shown only when the site says this account is an admin.
                    // The admin routes check again on every request; hiding
                    // the row is a convenience, not the gate.
                    if app.isAdmin {
                        row("Admin", "gauge.with.dots.needle.33percent", .admin)
                    }
                    row("Developer", "wrench.and.screwdriver", .developer)
                }
                Section {
                    Button("Sign out", role: .destructive) { confirmingSignOut = true }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.page)
            .navigationTitle("More")
            // Solid like the pages it opens; see-through, the collapsed
            // title sat on top of the rows scrolling under it.
            .solidNavigationBar()
            .navigationDestination(for: Destination.self) { destination in
                Group {
                    switch destination {
                    case .view(let view): MoreDestination(view: view)
                    case .web(let route): WebPage(route: route)
                    case .admin: AdminDashboard()
                    case .developer: DeveloperView()
                    }
                }
                .solidNavigationBar()
            }
            // Another tab asked for a page that lives under More.
            .onChange(of: app.pendingMoreRoute, initial: true) { _, route in
                guard let route else { return }
                path = NavigationPath()
                path.append(Destination.view(route))
                app.pendingMoreRoute = nil
            }
            .onChange(of: app.pendingWebRoute, initial: true) { _, route in
                guard let route else { return }
                path = NavigationPath()
                path.append(Destination.web(route))
                app.pendingWebRoute = nil
            }
            .confirmationDialog("Sign out of FirstFinder on this phone?", isPresented: $confirmingSignOut, titleVisibility: .visible) {
                Button("Sign out", role: .destructive) { Task { await app.signOut() } }
            } message: {
                Text("Local changes are discarded. You stay signed in on the website.")
            }
        }
    }

    private func row(_ title: String, _ systemImage: String, _ destination: Destination) -> some View {
        NavigationLink(value: destination) {
            Label(title, systemImage: systemImage)
        }
    }

    static func icon(for view: AppView) -> String {
        switch view {
        case .dashboard: "chart.bar"
        case .inventory: "books.vertical"
        case .wishlist: "heart"
        case .addItems, .tutorial: "plus.circle"
        case .identify: "sparkle.magnifyingglass"
        case .insuranceExport: "doc.text"
        case .feedback: "bubble.left.and.text.bubble.right"
        case .account: "person.crop.circle"
        case .about: "info.circle"
        case .roadmap: "map"
        case .features: "star"
        case .contribute: "hammer"
        case .privacy: "lock.shield"
        case .terms: "doc.plaintext"
        case .home: "house"
        case .login, .signup, .resetPassword: "key"
        }
    }

    private func icon(for view: AppView) -> String { Self.icon(for: view) }
}

// The pages More opens, by the web's view name.
struct MoreDestination: View {
    let view: AppView

    var body: some View {
        switch view {
        case .insuranceExport: InsuranceExportPage()
        case .feedback: FeedbackPage()
        case .account: MyAccountPage()
        default: PublicPage(view: view)
        }
    }
}
