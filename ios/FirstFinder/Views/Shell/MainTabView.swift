import SwiftUI

// Signed in: Dashboard · Collection · Add (center) · Wishlist · More. The web's
// nav bar holds more than a phone's tab bar can, so the rest of it lives in
// More, in the web's order.
struct MainTabView: View {
    enum Tab: Hashable { case dashboard, collection, add, wishlist, more }

    @Environment(AppModel.self) private var app
    @State private var selection: Tab = .dashboard

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack { ScreenPlaceholder(view: .dashboard) }
                .tabItem { Label("Dashboard", systemImage: "chart.bar") }
                .tag(Tab.dashboard)

            NavigationStack { ScreenPlaceholder(view: .inventory) }
                .tabItem { Label(countLabel("Collection", app.inventoryCount), systemImage: "books.vertical") }
                .tag(Tab.collection)

            NavigationStack { ScreenPlaceholder(view: .addItems) }
                .tabItem { Label("Add", systemImage: "plus.circle.fill") }
                .tag(Tab.add)

            NavigationStack { ScreenPlaceholder(view: .wishlist) }
                .tabItem { Label(countLabel("Wishlist", app.wishlistCount), systemImage: "heart") }
                .tag(Tab.wishlist)

            MoreView()
                .tabItem { Label("More", systemImage: "ellipsis.circle") }
                .tag(Tab.more)
        }
    }

    // The count only once its fetch has landed; never "(0)" while loading.
    private func countLabel(_ title: String, _ count: Int?) -> String {
        guard let count else { return title }
        return "\(title) (\(count))"
    }
}
