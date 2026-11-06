import SwiftUI

// FeedbackPage: a description and optional photos, saved to the feedback
// table and then filed as an issue by the server, as on the web. What you've
// already sent is listed below.
struct FeedbackPage: View {
    @Environment(AppModel.self) private var app
    @State private var description = ""
    @State private var photos: [Photo] = []

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Send feedback.").font(.display(38, relativeTo: .largeTitle).weight(.semibold))
                Text("Found a bug or have an idea? Describe what happened and attach a screenshot or photo if it helps.")
                    .foregroundStyle(Theme.brown)
                Card(padding: 22) {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("What's going on?").font(.subheadline.weight(.medium)).foregroundStyle(Theme.brown)
                        TextField("Tell us what happened, what you expected, and any steps to reproduce it.", text: $description, axis: .vertical)
                            .lineLimit(6...12)
                            .padding(12)
                            .background(Theme.control, in: RoundedRectangle(cornerRadius: 16))
                            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.controlBorder))
                        PhotoUploader(title: "Attach photos (optional)", systemImage: "camera", photos: $photos)
                        Button(app.isSaving ? "Sending…" : "Send feedback", action: send)
                            .buttonStyle(FFButtonStyle(variant: .primary, fullWidth: true))
                            .disabled(app.isSaving)
                    }
                }
                Text("Prefer email? Reach us directly at thebookbarterer@gmail.com.")
                    .font(.subheadline).foregroundStyle(Theme.brown).frame(maxWidth: .infinity)

                if !app.feedback.isEmpty {
                    SectionHeading("What you've sent").padding(.top, 8)
                    ForEach(app.feedback, id: \.id) { row in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(WishlistLogic.accountDate(row.createdAt ?? "")).font(.caption).foregroundStyle(Theme.brownMuted)
                                if !row.photos.records.isEmpty { Chip(text: "\(row.photos.records.count) photo\(row.photos.records.count == 1 ? "" : "s")") }
                            }
                            Text(row.description).font(.subheadline)
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.border))
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.page)
        .navigationTitle(AppView.feedback.title)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func send() {
        Task {
            guard await app.sendFeedback(description, photos: photos) else { return }
            description = ""
            photos = []
        }
    }
}

// MyAccountPage: profile, member since, the first collectible, the email
// updates switch, sharing at a glance, and the danger zone.
struct MyAccountPage: View {
    @Environment(AppModel.self) private var app
    @Environment(\.openURL) private var openURL
    @State private var name = ""
    @State private var showingDelete = false

    var body: some View {
        let profile = app.profile
        let first = ItemsLogic.firstCollectible(app.inventory)
        let emailUpdates = profile?.emailUpdates ?? false
        let share = app.shareSettingsOrDefault

        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("My account.").font(.display(38, relativeTo: .largeTitle).weight(.semibold))
                Text("Your profile and account settings.").foregroundStyle(Theme.brown)

                Card(padding: 22) {
                    VStack(alignment: .leading, spacing: 16) {
                        labelled("Member since", WishlistLogic.accountDate(profile?.createdAt.map { ISO8601DateFormatter().string(from: $0) } ?? ""))
                        labelled("Email", profile?.email ?? "")
                        VStack(alignment: .leading, spacing: 2) {
                            Text("FIRST COLLECTIBLE LOADED").font(.caption).tracking(1.5).foregroundStyle(Theme.brownSoft)
                            if let first {
                                Text(first.name.isEmpty ? "Untitled item" : first.name).font(.headline)
                                Text(WishlistLogic.accountDate(first.savedAt)).font(.subheadline).foregroundStyle(Theme.brown)
                            } else {
                                Text("None yet").font(.headline).foregroundStyle(Theme.brownMuted)
                            }
                        }
                        Divider().overlay(Theme.borderSoft)
                        Field(label: "Name", text: $name)
                        Button(app.isSaving ? "Saving…" : "Save name") { Task { await app.saveName(name) } }
                            .buttonStyle(.ffPrimary)
                            .disabled(app.isSaving)
                        Divider().overlay(Theme.borderSoft)
                        Toggle(isOn: Binding(get: { emailUpdates }, set: { next in
                            Task { await app.setEmailUpdates(next) }
                        })) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Email me about new features").font(.subheadline.weight(.medium))
                                Text("Occasional updates about what's new in FirstFinder. Emails about your account itself, like password resets, come either way.")
                                    .font(.caption).foregroundStyle(Theme.brown)
                            }
                        }
                        .toggleStyle(CheckboxToggleStyle())
                        .disabled(app.isSaving)
                    }
                }

                // The two sharing switches people look for here. The full
                // settings are behind Share on the collection, as on the web.
                if let share {
                    Card(padding: 22) {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Your public page").font(.headline)
                            Toggle(isOn: Binding(get: { share.visibility != "off" }, set: { on in
                                var next = share
                                next.visibility = on ? (share.visibility == "off" ? "unlisted" : share.visibility) : "off"
                                Task { await app.saveShare(next) }
                            })) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Sharing").font(.subheadline.weight(.medium))
                                    Text(PublicCollection.visibilities.first { $0.value == share.visibility }?.label ?? "Off").font(.caption).foregroundStyle(Theme.brown)
                                }
                            }
                            .tint(Theme.green)
                            Toggle(isOn: Binding(get: { share.visibility == "listed" && share.showOnExplore }, set: { on in
                                var next = share
                                next.showOnExplore = on
                                Task { await app.saveShare(next) }
                            })) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Show on Explore").font(.subheadline.weight(.medium))
                                    Text(share.visibility == "listed" ? "Your shelf appears on FirstFinder's public Explore page." : "Only pages listed on search engines can appear on Explore.")
                                        .font(.caption).foregroundStyle(Theme.brown)
                                }
                            }
                            .tint(Theme.green)
                            .disabled(share.visibility != "listed")
                        }
                    }
                }

                Card(padding: 22) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Enjoying FirstFinder?").font(.headline)
                        Text("It's free and always will be — a passion project I pay for out of pocket. Any donation helps keep it that way.")
                            .font(.subheadline).foregroundStyle(Theme.brown)
                        Button { openURL(URL(string: "https://buymeacoffee.com/firstfinder")!) } label: {
                            Label("Buy me a coffee", systemImage: "heart")
                        }
                        .buttonStyle(.ffSecondary)
                    }
                }

                Card(padding: 22, background: Theme.errorSurface) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("DANGER ZONE").font(.subheadline).tracking(1.8).foregroundStyle(Theme.errorInk)
                        Text("Delete your account").font(.display(24, relativeTo: .title2).weight(.semibold))
                        Text("Permanently deletes your login, your entire collection, all saved photos, and any feedback you've sent. This can't be undone.")
                            .foregroundStyle(Theme.brown)
                        Button("Delete my account") { showingDelete = true }.buttonStyle(.ffDanger)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(Theme.page)
        .navigationTitle(AppView.account.title)
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { name = profile?.fullName ?? "" }
        .sheet(isPresented: $showingDelete) { DeleteAccountDialog() }
    }

    private func labelled(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label.uppercased()).font(.caption).tracking(1.5).foregroundStyle(Theme.brownSoft)
            Text(value).font(.headline)
        }
    }
}

// DeleteAccountDialog: type DELETE, then the server deletes the login, the
// collection, every photo and all feedback, and the phone signs out.
struct DeleteAccountDialog: View {
    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var confirmText = ""

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                Text("DELETE ACCOUNT").font(.subheadline).tracking(1.8).foregroundStyle(Theme.errorInk)
                Text("Are you sure?").font(.display(26, relativeTo: .title).weight(.semibold))
                Text("This permanently deletes your login, your entire collection, all saved photos, and any feedback you've sent. There is no way to undo this.")
                    .foregroundStyle(Theme.brown)
                Text("Type DELETE to confirm.").font(.subheadline.weight(.medium)).foregroundStyle(Theme.brown)
                TextField("DELETE", text: $confirmText)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .padding(12)
                    .background(Theme.control, in: RoundedRectangle(cornerRadius: 16))
                    .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.errorBorder))
                HStack {
                    Button("Cancel") { dismiss() }.buttonStyle(.ffSecondary).disabled(app.isSaving)
                    Spacer()
                    Button(app.isSaving ? "Deleting…" : "Permanently delete my account") {
                        Task { if await app.deleteAccount() { dismiss() } }
                    }
                    .buttonStyle(.ffDanger)
                    .disabled(app.isSaving || confirmText.trimmingCharacters(in: .whitespaces).uppercased() != "DELETE")
                }
                Spacer()
            }
            .padding(20)
            .background(Theme.page)
        }
        .presentationDetents([.medium, .large])
    }
}
