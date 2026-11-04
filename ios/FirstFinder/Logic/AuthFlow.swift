import Foundation

// Sign-up, password reset and the email links that finish them, as rules the
// screens and the store share. Pure, so each is tested.
enum AuthFlow {
    // Where every email link returns: the one address on the Supabase
    // Redirect URLs list. Supabase accepts it exactly -- a path or a query
    // added to it is refused -- so a link can't say which flow it came from.
    static let callbackURL = URL(string: "app.firstfinder.prototype://auth-callback")!

    static func isCallback(_ url: URL) -> Bool {
        url.scheme == callbackURL.scheme && url.host() == callbackURL.host()
    }

    // How long a Supabase email link stays valid.
    static let linkLifetime: TimeInterval = 3600

    // A link opened within the hour after a reset email is that reset link.
    // The only other email link the app sends is a sign-up confirmation, and a
    // brand-new account has never had a reset email.
    static func isRecovery(recoverySentAt: Date?, now: Date = Date()) -> Bool {
        guard let recoverySentAt else { return false }
        let age = now.timeIntervalSince(recoverySentAt)
        return age >= -60 && age <= linkLifetime
    }

    // The web's checks and words, before anything is sent.
    static func passwordProblem(_ password: String, confirm: String) -> String? {
        if password.count < 8 { return "Password must be at least 8 characters." }
        if password != confirm { return "Passwords do not match." }
        return nil
    }

    enum SignUpOutcome: Equatable {
        // Email confirmation is off: the account is live and signed in.
        case signedIn(UserProfile)
        // The usual case: a confirmation link is on its way.
        case confirmEmail
        // Supabase answers a sign-up for a registered email with a user that
        // has no identities, rather than an error, so as not to reveal it.
        case alreadyRegistered
    }

    static func confirmationMessage(_ email: String) -> String {
        "Almost there — we sent a confirmation link to \(email). Open it on this phone to sign straight in, or open it anywhere and then log in here."
    }

    static func resetSentMessage(_ email: String) -> String {
        "If an account exists for \(email), a reset link is on its way. Open it on this phone to choose a new password."
    }

    static let linkFailedMessage = "That link has expired or was already used. Ask for a new one."
}
