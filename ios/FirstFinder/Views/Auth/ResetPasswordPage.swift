import SwiftUI

// ResetPasswordPage: where the reset email's one-time link lands, to choose a
// new password. The prototype never sends that email, so this is reached from
// the signed-out menu and stops short of changing anything.
struct ResetPasswordPage: View {
    @State private var password = ""
    @State private var confirm = ""
    @State private var message: AuthMessage.Message?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeader(title: "Choose a new password", subtitle: "Pick a password of at least 8 characters. You'll stay signed in afterwards.")
                Card(padding: 22) {
                    VStack(alignment: .leading, spacing: 14) {
                        if let message { AuthMessage(message: message) { _ in } }
                        Field(label: "New password", text: $password, kind: .newPassword)
                        Field(label: "Confirm new password", text: $confirm, kind: .newPassword)
                        Button("Save new password") { save() }
                            .buttonStyle(FFButtonStyle(variant: .primary, fullWidth: true))
                            .padding(.top, 6)
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.page)
        .navigationTitle(AppView.resetPassword.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func save() {
        if password.count < 8 {
            message = .init(kind: .error, text: "Use a password of at least 8 characters.")
        } else if password != confirm {
            message = .init(kind: .error, text: "The passwords don't match.")
        } else {
            message = .init(kind: .info, text: "Changing a password is UI-only in the prototype. Nothing was changed.")
        }
    }
}
