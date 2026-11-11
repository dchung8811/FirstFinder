import Foundation

// Sign-up, password reset and the email links that finish them, as rules the
// screens and the store share. Pure, so each is tested.
enum AuthFlow {
    // Where every email link returns: <bundle ID>://auth-callback, the URL
    // scheme Info.plist registers. It must be on the Supabase Redirect URLs
    // list exactly -- a path or a query added to it is refused -- so a link
    // can't say which flow it came from.
    static let callbackURL = callbackURL(bundleID: Bundle.main.bundleIdentifier)

    static func callbackURL(bundleID: String?) -> URL {
        URL(string: "\(bundleID ?? "app.firstfinder")://auth-callback")!
    }

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

    // The sign-in card's steps, as on the web: the email first, then log in
    // or create an account, with a reset link one tap from the password.
    //
    // Nothing looks the email up to choose between .password and .create.
    // That lookup would tell anyone whether an address has a FirstFinder
    // account, so the email always leads to .password, which offers account
    // creation in plain view, and the collector -- who knows -- picks.
    enum Step: Equatable { case email, password, create, forgot }

    // Only the shape is checked here. Whether an account exists is
    // deliberately never asked.
    static func emailProblem(_ email: String) -> String? {
        let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return "Enter your email address first." }
        let parts = trimmed.split(separator: "@", omittingEmptySubsequences: false)
        guard parts.count == 2, !parts[0].isEmpty, parts[1].contains("."), !parts[1].hasPrefix("."), !parts[1].hasSuffix("."),
              !trimmed.contains(where: \.isWhitespace)
        else { return "Enter a full email address, like name@example.com." }
        return nil
    }

    // Google and Apple sit on the first step only: they need no email, and
    // the later steps are about the one already typed. iOS has no way to
    // carry the email-updates box through them, so they don't sit beside it.
    static func showsSocialButtons(_ step: Step) -> Bool { step == .email }

    // Back from a reset goes to the password if there's an email to use it with.
    static func stepBackFromReset(email: String) -> Step {
        email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? .email : .password
    }

    // Every sign-up outcome that isn't a live session continues at the
    // password: a confirmed account logs in there, and so does an email that
    // turned out to have one already.
    static func stepAfterSignUp(_ outcome: SignUpOutcome) -> Step? {
        switch outcome {
        case .signedIn: nil
        case .confirmEmail, .alreadyRegistered: .password
        }
    }

    // LiveStore's words for a wrong password or an unknown email -- Supabase
    // can't tell the two apart, on purpose -- so the card can offer the
    // create-account step beside it.
    static let wrongPasswordMessage = "That email and password don't match an account."

    static let alreadyRegisteredMessage = "You already have an account with this email. Enter your password to log in."

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
