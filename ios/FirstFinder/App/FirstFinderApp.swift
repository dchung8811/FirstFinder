import SwiftUI

@main
struct FirstFinderApp: App {
    @State private var app: AppModel

    init() {
        // The shared URL cache writes responses to disk by default. Nothing
        // this app fetches should outlive the process, so it gets none.
        URLCache.shared = URLCache(memoryCapacity: 16 * 1024 * 1024, diskCapacity: 0, directory: nil)
        _app = State(initialValue: AppModel())
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .task { await app.start() }
        }
    }
}
