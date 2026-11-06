import SwiftUI

// The form behind "Report this page".
struct ReportPageSheet: View {
    let page: ContentReports.PageRef

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss
    @State private var reason: ContentReports.Reason?
    @State private var details = ""
    @State private var sending = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ForEach(ContentReports.reasons) { option in
                        Button {
                            reason = option
                        } label: {
                            HStack {
                                Text(option.label).foregroundStyle(Theme.ink)
                                Spacer()
                                if reason == option {
                                    Image(systemName: "checkmark").foregroundStyle(Theme.green)
                                }
                            }
                        }
                        .accessibilityAddTraits(reason == option ? .isSelected : [])
                    }
                } header: {
                    Text("What's wrong with it?")
                }
                Section {
                    TextField("Anything that helps us find it (optional)", text: $details, axis: .vertical)
                        .lineLimit(3...6)
                        .onChange(of: details) { _, text in
                            if text.count > ContentReports.detailsMax { details = String(text.prefix(ContentReports.detailsMax)) }
                        }
                } footer: {
                    Text("The owner isn't told who reported their page. We review reports and remove anything that breaks our Terms.")
                }
            }
            .navigationTitle("Report this page")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") { send() }
                        .disabled(reason == nil || sending)
                }
            }
        }
    }

    private func send() {
        guard let reason else { return }
        sending = true
        Task {
            defer { sending = false }
            if await app.report(page, reason: reason, details: details) { dismiss() }
        }
    }
}

// Stands in for a page whose owner this person has blocked.
struct BlockedPageCard: View {
    let block: ContentReports.Block?

    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "hand.raised").font(.title).foregroundStyle(Theme.brownMuted)
            Text("You blocked this collector").font(.headline).foregroundStyle(Theme.ink)
            Text("Their pages stay hidden from you on Explore and the home page.")
                .font(.subheadline).foregroundStyle(Theme.brown).multilineTextAlignment(.center)
            if let block {
                Button("Unblock") { Task { await app.unblock(block) } }.buttonStyle(.ffSecondary)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page)
    }
}

// In My Account, so a block can be undone without finding the page again -- which
// may no longer be possible, with the page hidden.
struct BlockedCollectorsCard: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        Card(padding: 22) {
            VStack(alignment: .leading, spacing: 10) {
                Text("Blocked collectors").font(.headline)
                if app.blocks.isEmpty {
                    Text("Nobody. To block someone, open their shared collection and use the menu at the top of the page.")
                        .font(.subheadline).foregroundStyle(Theme.brown)
                } else {
                    ForEach(app.blocks) { block in
                        HStack {
                            Text(block.title).font(.subheadline).foregroundStyle(Theme.ink)
                            Spacer()
                            Button("Unblock") { Task { await app.unblock(block) } }
                                .font(.subheadline.weight(.medium))
                        }
                    }
                }
            }
        }
    }
}
