import Foundation
import XCTest
@testable import FirstFinder

final class AuthFlowTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_793_000_000)

    func testAResetLinkIsOneOpenedWithinTheHourOfTheEmail() {
        XCTAssertTrue(AuthFlow.isRecovery(recoverySentAt: now.addingTimeInterval(-120), now: now))
        XCTAssertTrue(AuthFlow.isRecovery(recoverySentAt: now.addingTimeInterval(-3500), now: now))
    }

    // A new account's confirmation link: no reset email ever sent.
    func testAConfirmationLinkIsNotAReset() {
        XCTAssertFalse(AuthFlow.isRecovery(recoverySentAt: nil, now: now))
    }

    // An old reset email can't turn a later link into a reset: it has expired.
    func testAResetEmailOlderThanItsLinkDoesntCount() {
        XCTAssertFalse(AuthFlow.isRecovery(recoverySentAt: now.addingTimeInterval(-3700), now: now))
    }

    func testTheCallbackFollowsTheBundleID() {
        XCTAssertEqual(AuthFlow.callbackURL(bundleID: "app.firstfinder").absoluteString, "app.firstfinder://auth-callback")
        XCTAssertEqual(AuthFlow.callbackURL.scheme, Bundle.main.bundleIdentifier)
    }

    func testOnlyTheAppsOwnCallbackIsHandled() {
        let scheme = AuthFlow.callbackURL.scheme!
        XCTAssertTrue(AuthFlow.isCallback(URL(string: "\(scheme)://auth-callback?code=abc")!))
        XCTAssertFalse(AuthFlow.isCallback(URL(string: "\(scheme)://somewhere-else")!))
        XCTAssertFalse(AuthFlow.isCallback(URL(string: "app.firstfinder.other://auth-callback")!))
        XCTAssertFalse(AuthFlow.isCallback(URL(string: "https://firstfinder.app/auth-callback")!))
    }

    func testPasswordChecksUseTheWebsWords() {
        XCTAssertEqual(AuthFlow.passwordProblem("short", confirm: "short"), "Password must be at least 8 characters.")
        XCTAssertEqual(AuthFlow.passwordProblem("longenough", confirm: "different"), "Passwords do not match.")
        XCTAssertNil(AuthFlow.passwordProblem("longenough", confirm: "longenough"))
    }

    // Only the address's shape is checked before the password step.
    func testTheEmailStepChecksOnlyTheShape() {
        XCTAssertEqual(AuthFlow.emailProblem("   "), "Enter your email address first.")
        XCTAssertEqual(AuthFlow.emailProblem("collector"), "Enter a full email address, like name@example.com.")
        XCTAssertEqual(AuthFlow.emailProblem("collector@example"), "Enter a full email address, like name@example.com.")
        XCTAssertEqual(AuthFlow.emailProblem("@example.com"), "Enter a full email address, like name@example.com.")
        XCTAssertEqual(AuthFlow.emailProblem("a b@example.com"), "Enter a full email address, like name@example.com.")
        XCTAssertNil(AuthFlow.emailProblem("  collector@example.com "))
    }

    func testGoogleAndAppleSitOnTheFirstStepOnly() {
        XCTAssertTrue(AuthFlow.showsSocialButtons(.email))
        XCTAssertFalse(AuthFlow.showsSocialButtons(.password))
        XCTAssertFalse(AuthFlow.showsSocialButtons(.create))
        XCTAssertFalse(AuthFlow.showsSocialButtons(.forgot))
    }

    func testBackFromAResetReturnsToThePasswordWhenThereIsAnEmail() {
        XCTAssertEqual(AuthFlow.stepBackFromReset(email: "collector@example.com"), .password)
        XCTAssertEqual(AuthFlow.stepBackFromReset(email: " "), .email)
    }

    // A pending confirmation and an existing account both continue at the
    // password; a live session leaves the card.
    func testSignUpOutcomesContinueAtThePassword() {
        XCTAssertEqual(AuthFlow.stepAfterSignUp(.confirmEmail), .password)
        XCTAssertEqual(AuthFlow.stepAfterSignUp(.alreadyRegistered), .password)
        XCTAssertNil(AuthFlow.stepAfterSignUp(.signedIn(SampleData.profile)))
    }

    func testTheAppleNonceHashIsSHA256Hex() {
        XCTAssertEqual(AppleNonce.sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        XCTAssertEqual(AppleNonce.make().count, 32)
        XCTAssertNotEqual(AppleNonce.make(), AppleNonce.make())
    }

    // The App Store build offers Google sign-in, so App Review requires Sign
    // in with Apple beside it (guideline 4.8): on for app.firstfinder, off for
    // a contributor's own bundle ID, which Supabase doesn't know.
    func testAppleSignInIsOnExactlyForTheStoreBundleID() {
        XCTAssertEqual(AppConfig.appleSignInEnabled(), Bundle.main.bundleIdentifier == "app.firstfinder")
    }

    @MainActor
    func testSampleSignUpAsksForConfirmationAndCreatesNothing() async throws {
        let app = AppModel(config: .failure(.missing))
        app.sampleStore.setSignedIn(false)
        await app.start()
        let outcome = try await app.createAccount(email: "new@example.com", password: "longenough", emailUpdates: false)
        XCTAssertEqual(outcome, .confirmEmail)
        XCTAssertNil(app.profile)
    }
}
