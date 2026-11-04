import SwiftUI

// ResetPasswordPage: where a password-reset link lands. The link has already
// signed the collector in (AppModel.openAuthLink); this sets the new password
// on that session, with the web's checks and words.
struct ResetPasswordPage: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var password = ""
    @State private var confirm = ""
    @State private var message: AuthMessage.Message?
    @State private var saving = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeader(title: "Choose a new password", subtitle: "Pick a password of at least 8 characters. You'll stay signed in afterwards.")
                Card(padding: 22) {
                    VStack(alignment: .leading, spacing: 14) {
                        if let message { AuthMessage(message: message) { _ in } }
                        Field(label: "New password", text: $password, kind: .newPassword)
                        Field(label: "Confirm new password", text: $confirm, kind: .newPassword)
                        Button(saving ? "Saving..." : "Save new password") { Task { await save() } }
                            .buttonStyle(FFButtonStyle(variant: .primary, fullWidth: true))
                            .disabled(saving)
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

    private func save() async {
        if let problem = AuthFlow.passwordProblem(password, confirm: confirm) {
            message = .init(kind: .error, text: problem)
            return
        }
        // Reached without a reset link (the signed-out menu), there is no
        // session to change the password on.
        guard app.profile != nil else {
            message = .init(kind: .error, text: "Open the reset link from your email on this phone first, then choose your new password here.")
            return
        }
        saving = true
        defer { saving = false }
        do {
            try await app.setNewPassword(password)
            dismiss()
        } catch {
            message = .init(kind: .error, text: error.localizedDescription)
        }
    }
}
