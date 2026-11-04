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

    func testOnlyTheAppsOwnCallbackIsHandled() {
        XCTAssertTrue(AuthFlow.isCallback(URL(string: "app.firstfinder.prototype://auth-callback?code=abc")!))
        XCTAssertFalse(AuthFlow.isCallback(URL(string: "app.firstfinder.prototype://somewhere-else")!))
        XCTAssertFalse(AuthFlow.isCallback(URL(string: "https://firstfinder.app/auth-callback")!))
    }

    func testPasswordChecksUseTheWebsWords() {
        XCTAssertEqual(AuthFlow.passwordProblem("short", confirm: "short"), "Password must be at least 8 characters.")
        XCTAssertEqual(AuthFlow.passwordProblem("longenough", confirm: "different"), "Passwords do not match.")
        XCTAssertNil(AuthFlow.passwordProblem("longenough", confirm: "longenough"))
    }

    func testTheAppleNonceHashIsSHA256Hex() {
        XCTAssertEqual(AppleNonce.sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
        XCTAssertEqual(AppleNonce.make().count, 32)
        XCTAssertNotEqual(AppleNonce.make(), AppleNonce.make())
    }

    func testAppleSignInIsOffUntilItsSwitchIsOn() {
        XCTAssertFalse(AppConfig.appleSignInEnabled())
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
