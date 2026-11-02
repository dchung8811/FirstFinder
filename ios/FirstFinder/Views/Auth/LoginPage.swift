import SwiftUI

// LoginPage from app/InventoryApp.jsx: one page with three modes (log in,
// create account, forgot password), the same copy as authModeCopy on the web.
//
// Email and Google log-in are wired; both sign in to an existing account and
// change nothing about it. Sign-up and the reset email would create an
// account or send mail, so in the prototype they validate and stop. Apple is
// drawn but not set up, as it isn't configured for the site either.
struct LoginPage: View {
    enum Mode: String { case signin, signup, forgot }

    @State var mode: Mode = .signin
    @Environment(AppModel.self) private var app
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var emailUpdates = false
    @State private var message: AuthMessage.Message?
    @State private var loading = false
    var onViewTerms: () -> Void = {}
    var onViewPrivacy: () -> Void = {}

    private struct Copy {
        let heading, sub, formTitle, formSub, submit, submitting: String
    }

    private var copy: Copy {
        switch mode {
        case .signin:
            Copy(heading: "Log in to your collection.", sub: "Use your email and password, or continue with Google, to get back to your collection.", formTitle: "Log in", formSub: "Enter the email and password you signed up with.", submit: "Log in", submitting: "Logging in...")
        case .signup:
            Copy(heading: "Start your collection.", sub: "Create a free account to track item photos, receipts, what you paid, and what it's worth now.", formTitle: "Create your account", formSub: "Sign up with your email and a password of at least 8 characters.", submit: "Create account", submitting: "Creating account...")
        case .forgot:
            Copy(heading: "Reset your password.", sub: "Enter your account email and we'll send you a link to choose a new password.", formTitle: "Forgot your password?", formSub: "We'll email you a secure link to reset it.", submit: "Send reset link", submitting: "Sending...")
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 12) {
                    Text(copy.heading)
                        .font(.display(36, relativeTo: .largeTitle).weight(.semibold))
                        .foregroundStyle(Theme.ink)
                        .accessibilityAddTraits(.isHeader)
                    Text(copy.sub).font(.body).foregroundStyle(Theme.brown)
                }

                Card(padding: 22) {
                    VStack(alignment: .leading, spacing: 0) {
                        if mode != .forgot {
                            AuthModeTabs(mode: mode) { switchMode($0) }
                                .padding(.bottom, 22)
                        }
                        Text(copy.formTitle).font(.display(24, relativeTo: .title2).weight(.semibold)).foregroundStyle(Theme.ink)
                        Text(copy.formSub).foregroundStyle(Theme.brown).padding(.top, 8)
                        if let message {
                            AuthMessage(message: message) { switchMode($0) }.padding(.top, 16)
                        }
                        VStack(spacing: 14) {
                            Field(label: "Email", text: $email, kind: .email)
                            if mode != .forgot {
                                Field(label: "Password", text: $password, kind: mode == .signup ? .newPassword : .password)
                            }
                            if mode == .signup {
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

                        if mode != .forgot {
                            OrDivider().padding(.vertical, 22)
                            VStack(spacing: 12) {
                                SocialAuthButton(systemImage: "g.circle", title: "Continue with Google") { Task { await google() } }
                                SocialAuthButton(systemImage: "apple.logo", title: "Continue with Apple") { notSetUp("Apple") }
                            }
                        }

                        Group {
                            if mode == .signin {
                                AuthLink("Forgot your password?") { switchMode(.forgot) }
                            } else if mode == .forgot {
                                HStack(spacing: 4) {
                                    Text("Remembered it?")
                                    AuthLink("Back to log in") { switchMode(.signin) }
                                }
                            }
                        }
                        .font(.subheadline)
                        .foregroundStyle(Theme.brown)
                        .padding(.top, 20)

                        if mode != .forgot {
                            AuthTermsNotice(
                                action: mode == .signup ? "Creating an account, or continuing with Google" : "Continuing with Google",
                                onViewTerms: onViewTerms,
                                onViewPrivacy: onViewPrivacy
                            )
                            .padding(.top, 14)
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.page)
        .navigationTitle(mode == .signup ? AppView.signup.title : mode == .forgot ? AppView.resetPassword.title : AppView.login.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    // Keeps the email across the switch but drops the passwords, as the web does.
    private func switchMode(_ next: Mode) {
        guard next != mode else { return }
        mode = next
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

    private func notSetUp(_ provider: String) {
        message = .init(kind: .error, text: "\(provider) sign-in is not set up in the prototype. Use your email and password.")
    }

    private func submit() async {
        let trimmed = email.trimmingCharacters(in: .whitespaces)
        switch mode {
        case .signin:
            guard !trimmed.isEmpty, !password.isEmpty else {
                message = .init(kind: .error, text: "Enter your email and password.")
                return
            }
            loading = true
            defer { loading = false }
            do {
                try await app.signIn(email: trimmed, password: password)
            } catch {
                message = .init(kind: .error, text: error.localizedDescription)
            }
        case .signup:
            if trimmed.isEmpty || password.isEmpty {
                message = .init(kind: .error, text: "Enter an email and a password.")
            } else if password.count < 8 {
                message = .init(kind: .error, text: "Use a password of at least 8 characters.")
            } else if password != confirmPassword {
                message = .init(kind: .error, text: "The passwords don't match.")
            } else {
                message = .init(kind: .info, text: "Sign-up is UI-only in the prototype. No account was created.", action: (.signin, "Log in instead"))
            }
        case .forgot:
            if trimmed.isEmpty {
                message = .init(kind: .error, text: "Enter your account email.")
            } else {
                message = .init(kind: .info, text: "Password reset is UI-only in the prototype. No email was sent.")
            }
        }
    }
}

struct AuthModeTabs: View {
    let mode: LoginPage.Mode
    let onChange: (LoginPage.Mode) -> Void

    var body: some View {
        HStack(spacing: 4) {
            tab(.signin, "Log in")
            tab(.signup, "Create account")
        }
        .padding(4)
        .background(Theme.adaptive(0xf3ece1, dark: 0x0f332d), in: Capsule())
        .overlay(Capsule().strokeBorder(Theme.borderSoft))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Log in or create an account")
    }

    private func tab(_ value: LoginPage.Mode, _ label: String) -> some View {
        Button {
            onChange(value)
        } label: {
            Text(label)
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity, minHeight: 40)
                .foregroundStyle(mode == value ? Theme.onAction : Theme.brown)
                .background(mode == value ? Theme.action : .clear, in: Capsule())
                // The whole half takes the tap, not just the word.
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(mode == value ? [.isSelected] : [])
    }
}

struct AuthMessage: View {
    struct Message: Equatable {
        enum Kind { case error, info }
        let kind: Kind
        let text: String
        var action: (LoginPage.Mode, String)?

        static func == (lhs: Message, rhs: Message) -> Bool { lhs.kind == rhs.kind && lhs.text == rhs.text }
    }

    let message: Message
    let onAction: (LoginPage.Mode) -> Void

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
        .buttonStyle(.plain)
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
                Button("Terms of Service", action: onViewTerms).underline()
                Button("Privacy Policy", action: onViewPrivacy).underline()
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
                .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border))
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
        .buttonStyle(.plain)
        .accessibilityAddTraits(configuration.isOn ? [.isSelected] : [])
    }
}
