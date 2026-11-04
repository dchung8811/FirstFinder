import AVFoundation
import SwiftUI
import UIKit

@main
struct FirstFinderApp: App {
    @State private var app: AppModel
    @AppStorage(Appearance.storageKey) private var appearance = Appearance.system.rawValue

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
                .onChange(of: appearance, initial: true) { _, raw in apply(Appearance.stored(raw)) }
        }
    }

    // Set on the window rather than with preferredColorScheme: going back to
    // System through preferredColorScheme(nil) doesn't always let go of the
    // last choice until the app restarts. The window's override does, and
    // Theme's adaptive colors and every sheet follow it.
    private func apply(_ appearance: Appearance) {
        let style: UIUserInterfaceStyle = switch appearance {
        case .system: .unspecified
        case .light: .light
        case .dark: .dark
        }
        for scene in UIApplication.shared.connectedScenes {
            guard let windowScene = scene as? UIWindowScene else { continue }
            for window in windowScene.windows { window.overrideUserInterfaceStyle = style }
        }
    }
}
