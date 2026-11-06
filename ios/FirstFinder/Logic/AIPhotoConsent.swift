import Foundation

// Snap a picture and Research a photo send the collector's photos to OpenAI.
// App Review guideline 5.1.2(i) asks for clear disclosure and explicit
// permission before personal data reaches a third-party AI, and a line in the
// privacy policy is neither. A photo of a book can catch a receipt with a home
// address on it, so the question names OpenAI and says so.
//
// Kept per account rather than per phone: one person's yes doesn't speak for
// whoever signs in next. It is a yes to these two features, each of which only
// sends when pressed, so there is nothing running in the background to revoke.
enum AIPhotoConsent {
    static let title = "Send photos to OpenAI?"
    static let message = "Snap a picture and Research a photo send the photos you choose to OpenAI, an AI service, which reads them and suggests details for you to check. Nothing is sent until you use one of these, and only those photos go. Leave out anything personal, like a receipt with your address."

    static func isGranted(userId: String?, in defaults: UserDefaults = .standard) -> Bool {
        guard let userId else { return false }
        return defaults.bool(forKey: key(userId))
    }

    static func grant(userId: String?, in defaults: UserDefaults = .standard) {
        guard let userId else { return }
        defaults.set(true, forKey: key(userId))
    }

    static func forget(userId: String?, in defaults: UserDefaults = .standard) {
        guard let userId else { return }
        defaults.removeObject(forKey: key(userId))
    }

    private static func key(_ userId: String) -> String { "aiPhotoConsent.\(userId)" }
}
