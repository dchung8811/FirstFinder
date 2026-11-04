import AVFoundation
import SwiftUI

@main
struct FirstFinderApp: App {
    @State private var app: AppModel

    init() {
        // The shared URL cache writes responses to disk by default. Nothing
        // this app fetches should outlive the process, so it gets none.
        URLCache.shared = URLCache(memoryCapacity: 16 * 1024 * 1024, diskCapacity: 0, directory: nil)
        // The home page's demo video plays muted; ambient keeps it from
        // stopping whatever else the phone is playing.
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
        _app = State(initialValue: AppModel())
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app)
                .task { await app.start() }
                // Confirmation and reset links from email come back here.
                .onOpenURL { url in Task { await app.openAuthLink(url) } }
        }
    }
}
