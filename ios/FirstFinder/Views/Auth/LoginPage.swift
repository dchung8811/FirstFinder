import AuthenticationServices
import SwiftUI

// LoginPage from app/InventoryApp.jsx: one card, email first, then log in or
// create an account, with a reset link one tap from the password. The steps
// and their rules live in AuthFlow.Step; the copy matches authStepCopy on the
// web.
//
// Email, Google, sign-up and the reset email all work as they do on the web.
// The confirmation and reset links come back to the app (AuthFlow), so a
// collector who opens them on this phone lands signed in. Sign in with Apple
// waits on its switch in Base.xcconfig; see AppConfig.appleSignInEnabled.
struct LoginPage: View {
    @Environment(AppModel.self) private var app
    @State private var step: AuthFlow.Step = .email
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var emailUpdates = false
    @State private var message: AuthMessage.Message?
    @State private var loading = false
    var onViewTerms: () -> Void = {}
    var onViewPrivacy: () -> Void = {}

    private struct Copy {
        let title, sub, submit, submitting: String
    }

    private var copy: Copy {
        switch step {
        case .email:
            Copy(title: "Log in or sign up", sub: "Enter your email to get back to your collection, or to start a free one.", submit: "Continue", submitting: "Continuing...")
        case .password:
            Copy(title: "Enter your password", sub: "Log in with the password you chose for this email.", submit: "Log in", submitting: "Logging in...")
        case .create:
            Copy(title: "Create your account", sub: "Choose a password of at least 8 characters. Then track item photos, receipts, what you paid, and what it's worth now.", submit: "Create account", submitting: "Creating account...")
        case .forgot:
            Copy(title: "Reset your password", sub: "Enter your account email and we'll send you a link to choose a new password.", submit: "Send reset link", submitting: "Sending...")
        }
    }

    private var trimmedEmail: String { email.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        ScrollView {
            Card(padding: 22) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(copy.title)
                        .font(.display(30, relativeTo: .largeTitle).weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text(copy.sub).foregroundStyle(Theme.brown).padding(.top, 8)
                    if let message {
                        AuthMessage(message: message) { goTo($0) }.padding(.top, 16)
                    }

                    VStack(alignment: .leading, spacing: 14) {
                        if step == .password || step == .create {
                            settledEmail
                        } else {
                            Field(label: "Email", text: $email, kind: .email)
                        }

                        if step == .password {
                            Field(label: "Password", text: $password, kind: .password)
                            AuthLink("Forgot your password?") { goTo(.forgot) }.font(.subheadline)
                        }

                        if step == .create {
                            Field(label: "Password", text: $password, kind: .newPassword)
                            Field(label: "Confirm password", text: $confirmPassword, kind: .newPassword)
                            Toggle(isOn: $emailUpdates) {
                                Text("Email me now and then about new FirstFinder features. Optional, and you can turn it off anytime in My account.")
                                    .font(.subheadline).foregroundStyle(Theme.brown)
                            }
                            .toggleStyle(CheckboxToggleStyle())
                        }
                    }
                    .padding(.top, 20)

                    Button {
                        Task { await submit() }
                    } label: {
                        Text(loading ? copy.submitting : copy.submit)
                    }
                    .buttonStyle(FFButtonStyle(variant: .primary, fullWidth: true))
                    .disabled(loading)
                    .padding(.top, 22)

                    // No lookup decides between these two, so each says
                    // plainly how to reach the other.
                    Group {
                        switch step {
                        case .password:
                            HStack(spacing: 4) {
                                Text("New to FirstFinder?")
                                AuthLink("Create an account") { goTo(.create) }
                            }
                        case .create:
                            HStack(spacing: 4) {
                                Text("Already have an account?")
                                AuthLink("Log in") { goTo(.password) }
                            }
                        case .forgot:
                            HStack(spacing: 4) {
                                Text("Remembered it?")
                                AuthLink("Back to log in") { goTo(AuthFlow.stepBackFromReset(email: email)) }
                            }
                        case .email:
                            EmptyView()
                        }
                    }
                    .font(.subheadline)
                    .foregroundStyle(Theme.brown)
                    .padding(.top, 18)

                    if AuthFlow.showsSocialButtons(step) {
                        OrDivider().padding(.vertical, 22)
                        VStack(spacing: 12) {
                            SocialAuthButton(systemImage: "g.circle", title: "Continue with Google") { Task { await google() } }
                                .disabled(loading)
                            if AppConfig.appleSignInEnabled() {
                                AppleSignInButton { message = .init(kind: .error, text: $0) }
                            } else {
                                SocialAuthButton(systemImage: "apple.logo", title: "Continue with Apple") {
                                    message = .init(kind: .error, text: "Sign in with Apple isn't available yet. Use Google or your email.")
                                }
                            }
                        }
                    }

                    // Shown where an account can start: the social buttons on
                    // the first step, the email sign-up on the create step.
                    if step == .email || step == .create {
                        AuthTermsNotice(
                            action: step == .create ? "Creating an account" : "Continuing with Google or Apple",
                            onViewTerms: onViewTerms,
                            onViewPrivacy: onViewPrivacy
                        )
                        .padding(.top, 14)
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.page)
        .navigationTitle(step == .create ? AppView.signup.title : step == .forgot ? AppView.resetPassword.title : AppView.login.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    // The email, settled, with a way back to change it.
    private var settledEmail: some View {
        HStack(spacing: 12) {
            Text(trimmedEmail)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.green)
                .lineLimit(1)
                .truncationMode(.middle)
                .frame(maxWidth: .infinity, alignment: .leading)
            AuthLink("Change") { goTo(.email) }.font(.subheadline)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Theme.adaptive(0xf3ece1, dark: 0x0f332d), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.borderSoft))
        .accessibilityElement(children: .combine)
        // So Password AutoFill pairs the password with this account, as the
        // hidden username input does on the web.
        .background {
            TextField("", text: .constant(trimmedEmail))
                .textContentType(.username)
                .frame(width: 1, height: 1)
                .opacity(0)
                .accessibilityHidden(true)
                .allowsHitTesting(false)
        }
    }

    // Keeps the email -- the point of offering another step after an error is
    // not making someone type it again -- but drops the passwords, which
    // belong to one step or the other.
    private func goTo(_ next: AuthFlow.Step) {
        step = next
        message = nil
        password = ""
        confirmPassword = ""
    }

    private func google() async {
        loading = true
        defer { loading = false }
        do {
            try await app.signInWithGoogle()
        } catch {
            message = .init(kind: .error, text: error.localizedDescription)
        }
    }

    private func submit() async {
        let trimmed = trimmedEmail
        switch step {
        case .email:
            // Nothing is sent: see AuthFlow.Step for why the email isn't looked up.
            if let problem = AuthFlow.emailProblem(trimmed) {
                message = .init(kind: .error, text: problem)
                return
            }
            goTo(.password)
        case .password:
            guard !password.isEmpty else {
                message = .init(kind: .error, text: "Enter your password.")
                return
            }
            loading = true
            defer { loading = false }
            do {
                try await app.signIn(email: trimmed, password: password)
            } catch {
                let text = error.localizedDescription
                message = text == AuthFlow.wrongPasswordMessage
                    ? .init(kind: .error, text: "\(text) If you just signed up, confirm your email first.", action: (.create, "New to FirstFinder? Create an account with this email"))
                    : .init(kind: .error, text: text)
            }
        case .create:
            if let problem = AuthFlow.passwordProblem(password, confirm: confirmPassword) {
                message = .init(kind: .error, text: problem)
                return
            }
            loading = true
            defer { loading = false }
            do {
                let outcome = try await app.createAccount(email: trimmed, password: password, emailUpdates: emailUpdates)
                if let next = AuthFlow.stepAfterSignUp(outcome) { goTo(next) }
                switch outcome {
                case .signedIn:
                    break
                case .alreadyRegistered:
                    message = .init(kind: .info, text: AuthFlow.alreadyRegisteredMessage)
                case .confirmEmail:
                    message = .init(kind: .info, text: AuthFlow.confirmationMessage(trimmed))
                }
            } catch {
                message = .init(kind: .error, text: error.localizedDescription)
            }
        case .forgot:
            if let problem = AuthFlow.emailProblem(trimmed) {
                message = .init(kind: .error, text: problem)
                return
            }
            loading = true
            defer { loading = false }
            do {
                try await app.sendPasswordReset(email: trimmed)
                message = .init(kind: .info, text: AuthFlow.resetSentMessage(trimmed))
            } catch {
                message = .init(kind: .error, text: error.localizedDescription)
            }
        }
    }
}

struct AuthMessage: View {
    struct Message: Equatable {
        enum Kind { case error, info }
        let kind: Kind
        let text: String
        var action: (AuthFlow.Step, String)?

        static func == (lhs: Message, rhs: Message) -> Bool { lhs.kind == rhs.kind && lhs.text == rhs.text }
    }

    let message: Message
    let onAction: (AuthFlow.Step) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(message.text)
            if let action = message.action {
                Button(action.1) { onAction(action.0) }.font(.subheadline.weight(.semibold)).underline()
            }
        }
        .font(.subheadline)
        .foregroundStyle(message.kind == .error ? Theme.errorInk : Theme.green)
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(message.kind == .error ? Theme.errorSurface : Theme.tint, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
    }
}

// Apple's own button, as App Review expects it to look. The request carries
// the hash of a fresh nonce; Supabase is given the nonce itself.
struct AppleSignInButton: View {
    let onError: (String) -> Void
    @Environment(AppModel.self) private var app
    @Environment(\.colorScheme) private var colorScheme
    @State private var nonce = ""

    var body: some View {
        SignInWithAppleButton(.continue) { request in
            nonce = AppleNonce.make()
            request.requestedScopes = [.email, .fullName]
            request.nonce = AppleNonce.sha256(nonce)
        } onCompletion: { result in
            switch result {
            case .success(let authorization):
                guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                      let token = credential.identityToken.flatMap({ String(data: $0, encoding: .utf8) })
                else { return onError("Apple didn't send a sign-in token. Try again.") }
                Task {
                    do { try await app.signInWithApple(idToken: token, nonce: nonce) }
                    catch { onError(error.localizedDescription) }
                }
            case .failure(let error):
                // Closing Apple's sheet isn't an error worth showing.
                if (error as? ASAuthorizationError)?.code != .canceled { onError(error.localizedDescription) }
            }
        }
        .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
        .frame(height: 48)
        .clipShape(Capsule())
    }
}

struct SocialAuthButton: View {
    let systemImage: String
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(.body.weight(.semibold))
                .frame(maxWidth: .infinity, minHeight: 48)
                .foregroundStyle(Theme.green)
                .background(Theme.adaptive(0xffffff, dark: 0x0f332d), in: Capsule())
                .overlay(Capsule().strokeBorder(Theme.borderStrong))
        }
        .buttonStyle(.ffPress)
    }
}

struct AuthLink: View {
    let title: String
    let action: () -> Void

    init(_ title: String, action: @escaping () -> Void) {
        self.title = title
        self.action = action
    }

    var body: some View {
        Button(title, action: action)
            .fontWeight(.medium)
            .foregroundStyle(Theme.green)
            .underline()
    }
}

struct AuthTermsNotice: View {
    let action: String
    var onViewTerms: () -> Void
    var onViewPrivacy: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("\(action) means you agree to FirstFinder's Terms of Service and Privacy Policy, including the acceptable use rules and the acknowledgment that FirstFinder is a hobby project that may lose data or go away.")
            HStack(spacing: 14) {
                Button("Terms of Service", action: onViewTerms).underline().foregroundStyle(Theme.green)
                Button("Privacy Policy", action: onViewPrivacy).underline().foregroundStyle(Theme.green)
            }
        }
        .font(.caption)
        .foregroundStyle(Theme.brownSoft)
    }
}

struct OrDivider: View {
    var body: some View {
        HStack(spacing: 12) {
            Rectangle().fill(Theme.borderSoft).frame(height: 1)
            Text("OR").font(.caption).tracking(2).foregroundStyle(Theme.brownMuted)
            Rectangle().fill(Theme.borderSoft).frame(height: 1)
        }
        .accessibilityHidden(true)
    }
}

// Field from the web: a labelled, rounded input.
struct Field: View {
    enum Kind { case text, email, password, newPassword, number, decimal }

    let label: String
    @Binding var text: String
    var kind: Kind = .text
    var placeholder = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(label).font(.subheadline.weight(.medium)).foregroundStyle(Theme.brown)
            input
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .fieldInks()
                .background(Theme.field, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.fieldBorder))
                .accessibilityLabel(label)
        }
    }

    @ViewBuilder private var input: some View {
        switch kind {
        case .password, .newPassword:
            SecureField(placeholder, text: $text)
                .textContentType(kind == .password ? .password : .newPassword)
        case .email:
            TextField(placeholder, text: $text)
                .textContentType(.username)
                .keyboardType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        case .number:
            TextField(placeholder, text: $text).keyboardType(.numberPad)
        case .decimal:
            TextField(placeholder, text: $text).keyboardType(.decimalPad)
        case .text:
            TextField(placeholder, text: $text)
        }
    }
}

struct CheckboxToggleStyle: ToggleStyle {
    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: configuration.isOn ? "checkmark.square.fill" : "square")
                    .foregroundStyle(Theme.green)
                    .imageScale(.large)
                configuration.label
            }
        }
        .buttonStyle(.ffPress)
        .accessibilityAddTraits(configuration.isOn ? [.isSelected] : [])
    }
}
