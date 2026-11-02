import SwiftUI

// Signed in: Dashboard · Collection · Add (center) · Wishlist · More. The web's
// nav bar holds more than a phone's tab bar can, so the rest of it lives in
// More, in the web's order. Unlike the web's nav, the tabs carry no counts:
// "Collection (176)" crowded its neighbours in a five-tab bar.
struct MainTabView: View {
    typealias Tab = AppTab

    @Environment(AppModel.self) private var app

    var body: some View {
        @Bindable var app = app
        TabView(selection: $app.selectedTab) {
            NavigationStack { DashboardPage() }
                .tabItem { Label("Dashboard", systemImage: "chart.bar") }
                .tag(Tab.dashboard)

            NavigationStack { InventoryPage() }
                .tabItem { Label("Collection", systemImage: "books.vertical") }
                .tag(Tab.collection)

            AddItemsPage()
                .tabItem { Label("Add", systemImage: "plus.circle.fill") }
                .tag(Tab.add)

            NavigationStack { WishlistPage() }
                .tabItem { Label("Wishlist", systemImage: "heart") }
                .tag(Tab.wishlist)

            MoreView()
                .tabItem { Label("More", systemImage: "ellipsis.circle") }
                .tag(Tab.more)
        }
    }
}
