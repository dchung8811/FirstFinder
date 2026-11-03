import SwiftUI

// Shown only in Sample mode, so a demo -- or a reviewer passing the phone
// around -- can't mistake the sample shelf for someone's real collection.
// Live mode has no strip: it's simply the app.
struct SampleModeBanner: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        if app.dataMode == .sample {
            HStack(spacing: 8) {
                Image(systemName: "sparkles")
                    .accessibilityHidden(true)
                Text("Sample data — not a real collection")
                    .font(.caption.weight(.semibold))
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                Spacer(minLength: 4)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .foregroundStyle(Theme.adaptive(0xfff7ea, dark: 0xfff7ea))
            // Kept below the status bar: the page color shows behind the
            // clock, so the system's dark status text stays readable.
            .background(Theme.adaptive(0x0f332d, dark: 0x201a14), ignoresSafeAreaEdges: [])
            .accessibilityElement(children: .combine)
        }
    }
}

// OfflineBanner from the web: shown when there's no connection, with when the
// collection was last loaded.
struct OfflineBanner: View {
    @Environment(AppModel.self) private var app

    var body: some View {
        if !app.isOnline {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Image(systemName: "wifi.slash").accessibilityHidden(true)
                VStack(alignment: .leading, spacing: 2) {
                    Text("You're offline").font(.subheadline.weight(.semibold))
                    Text(syncedLine).font(.caption)
                }
                Spacer()
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .foregroundStyle(Theme.warningInk)
            .background(Theme.warningSurface)
            .accessibilityElement(children: .combine)
        }
    }

    private var syncedLine: String {
        guard let synced = app.lastSyncedAt else { return "Nothing has loaded yet on this launch." }
        return "Showing your collection as of \(synced.formatted(date: .omitted, time: .shortened)). Nothing is stored on the phone."
    }
}

// SiteBanner: the site-wide message the maintainer sets from /admin, read
// live from site_banner. Dismissing it is per launch; the web remembers the
// dismissal in browser storage, the prototype stores nothing.
struct SiteBannerView: View {
    @Environment(AppModel.self) private var app
    var onFollow: (String) -> Void = { _ in }

    var body: some View {
        if app.showsSiteBanner {
            let banner = app.siteBanner
            let cream = Theme.adaptive(0xfff7ea, dark: 0xfff7ea)
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(banner.message)
                    if !banner.linkLabel.isEmpty, !banner.linkView.isEmpty {
                        Button("\(banner.linkLabel) →") { onFollow(banner.linkView) }
                            .fontWeight(.semibold)
                            .underline()
                    }
                }
                .font(.subheadline)
                .frame(maxWidth: .infinity, alignment: .leading)
                Button {
                    app.dismissedBannerId = Mapping.bannerDismissalId(banner)
                } label: {
                    Image(systemName: "xmark").font(.footnote).padding(6)
                }
                .foregroundStyle(cream.opacity(0.7))
                .accessibilityLabel("Dismiss announcement")
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .foregroundStyle(cream)
            .background(Theme.adaptive(0x123f38, dark: 0x123f38))
            .overlay(alignment: .top) { Rectangle().fill(cream.opacity(0.12)).frame(height: 1) }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Announcement")
        }
    }
}

// ToastStack: success, warning and error toasts, stacked at the bottom.
struct ToastStack: View {
    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 8) {
            ForEach(app.toasts.toasts) { toast in
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: icon(toast.tone)).accessibilityHidden(true)
                    Text(toast.message).font(.subheadline).frame(maxWidth: .infinity, alignment: .leading)
                    Button {
                        app.toasts.dismiss(toast.id)
                    } label: {
                        Image(systemName: "xmark").font(.caption)
                    }
                    .accessibilityLabel("Dismiss")
                }
                .padding(14)
                .foregroundStyle(foreground(toast.tone))
                .background(background(toast.tone), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.border))
                .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
                .transition(reduceMotion ? .opacity : .push(from: .bottom))
                .accessibilityElement(children: .combine)
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .animation(reduceMotion ? nil : .spring(duration: 0.3), value: app.toasts.toasts)
    }

    private func icon(_ tone: ToastCenter.Toast.Tone) -> String {
        switch tone {
        case .success: "checkmark.circle"
        case .warning: "exclamationmark.circle"
        case .error: "xmark.octagon"
        case .info: "info.circle"
        }
    }

    private func foreground(_ tone: ToastCenter.Toast.Tone) -> Color {
        switch tone {
        case .success, .info: Theme.green
        case .warning: Theme.warningInk
        case .error: Theme.errorInk
        }
    }

    private func background(_ tone: ToastCenter.Toast.Tone) -> Color {
        switch tone {
        case .success, .info: Theme.surfaceRaised
        case .warning: Theme.warningSurface
        case .error: Theme.errorSurface
        }
    }
}

