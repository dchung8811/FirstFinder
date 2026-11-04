import CryptoKit
import Foundation

// Creating an account, resetting a password, the email links that finish
// both, and Sign in with Apple.
extension AppModel {
    func createAccount(email: String, password: String, emailUpdates: Bool) async throws -> AuthFlow.SignUpOutcome {
        let outcome = try await store.createAccount(email: email, password: password, emailUpdates: emailUpdates)
        if case .signedIn(let profile) = outcome { await becomeSignedIn(profile) }
        return outcome
    }

    func sendPasswordReset(email: String) async throws {
        try await store.sendPasswordReset(email: email)
    }

    // A confirmation or reset link from an email, opened on this phone.
    func openAuthLink(_ url: URL) async {
        guard AuthFlow.isCallback(url) else { return }
        do {
            let (profile, isRecovery) = try await store.completeAuthLink(url)
            if isRecovery { choosingNewPassword = true }
            await becomeSignedIn(profile)
            if !isRecovery { toasts.push("You're signed in.", tone: .success) }
        } catch {
            toasts.push(error.localizedDescription, tone: .error)
        }
    }

    func setNewPassword(_ password: String) async throws {
        try await store.setPassword(password)
        choosingNewPassword = false
        toasts.push("Password updated. You're logged in and ready to go.", tone: .success)
    }

    func signInWithApple(idToken: String, nonce: String) async throws {
        await becomeSignedIn(try await store.signInWithApple(idToken: idToken, nonce: nonce))
    }
}

// Sign in with Apple's replay protection: the request carries the SHA-256 of
// a random nonce, and Supabase is given the nonce itself to check against
// the token Apple returns.
enum AppleNonce {
    static func make(length: Int = 32) -> String {
        let alphabet = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var generator = SystemRandomNumberGenerator()
        return String((0..<length).map { _ in alphabet.randomElement(using: &generator)! })
    }

    static func sha256(_ nonce: String) -> String {
        SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}
