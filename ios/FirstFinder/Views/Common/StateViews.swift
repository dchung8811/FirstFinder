import SwiftUI

// The loading, empty and error states every screen needs. One look for each,
// so a reviewer learns them once.

struct LoadingState: View {
    var label = "Loading…"

    var body: some View {
        VStack(spacing: 12) {
            ProgressView().tint(Theme.green)
            Text(label).font(.subheadline).foregroundStyle(Theme.brown)
        }
        .frame(maxWidth: .infinity, minHeight: 200)
        .accessibilityElement(children: .combine)
    }
}

struct ErrorState: View {
    var title = "Couldn't load this"
    let message: String
    var retry: (() async -> Void)?

    var body: some View {
        Card(background: Theme.errorSurface) {
            VStack(alignment: .leading, spacing: 10) {
                Label(title, systemImage: "exclamationmark.triangle")
                    .font(.headline)
                    .foregroundStyle(Theme.errorInk)
                Text(message).font(.subheadline).foregroundStyle(Theme.brown)
                if let retry {
                    Button("Try again") { Task { await retry() } }
                        .buttonStyle(.ffSecondary)
                }
            }
        }
    }
}

// The web keeps two empty states apart and so does the prototype: "nothing
// catalogued yet" asks you to add something, "nothing matches" asks you to
// loosen the filters. Collapsing them tells a collector with 200 items that
// their collection is empty.
struct EmptyState: View {
    let systemImage: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        Card {
            VStack(spacing: 12) {
                Image(systemName: systemImage)
                    .font(.system(size: 34, weight: .light))
                    .foregroundStyle(Theme.green)
                    .accessibilityHidden(true)
                Text(title).font(.display(22)).foregroundStyle(Theme.ink).multilineTextAlignment(.center)
                Text(message).font(.subheadline).foregroundStyle(Theme.brown).multilineTextAlignment(.center)
                if let actionTitle, let action {
                    Button(actionTitle, action: action).buttonStyle(.ffPrimary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
        }
    }
}

// The page title block most web views open with: eyebrow, Fraunces heading,
// a line of description.
struct PageHeader: View {
    var eyebrow: String?
    let title: String
    var subtitle: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if let eyebrow { Eyebrow(eyebrow) }
            Text(title)
                .font(.display(32, relativeTo: .largeTitle).weight(.semibold))
                .foregroundStyle(Theme.ink)
                .accessibilityAddTraits(.isHeader)
            if let subtitle {
                Text(subtitle).font(.subheadline).foregroundStyle(Theme.brown)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// A screen that a later step of the build fills in. It says so plainly rather
// than pretending to be finished.
struct ScreenPlaceholder: View {
    let view: AppView
    var note = "This screen is built in a later step."

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeader(eyebrow: "Prototype", title: view.title, subtitle: note)
                Text(view.path)
                    .font(.ledger(13))
                    .foregroundStyle(Theme.brownSoft)
            }
            .padding(16)
        }
        .background(Theme.page)
        .navigationTitle(view.title)
        .navigationBarTitleDisplayMode(.inline)
    }
}
