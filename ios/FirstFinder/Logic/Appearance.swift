import Foundation

// Light or dark, chosen in More → Appearance. System -- follow the phone --
// is the default, so a collector who never opens the setting gets what every
// other app on their phone does. The choice is a per-device preference kept
// in UserDefaults; it isn't about the collection, so it stays on the phone
// through sign-out and is never sent anywhere.
enum Appearance: String, CaseIterable, Identifiable, Sendable {
    case system, light, dark

    static let storageKey = "appearance"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .system: "System"
        case .light: "Light"
        case .dark: "Dark"
        }
    }

    // Whatever was stored, or System for nothing or something unknown.
    static func stored(_ raw: String?) -> Appearance {
        raw.flatMap(Appearance.init(rawValue:)) ?? .system
    }
}
