import SwiftUI

// The admin dashboard from app/admin/AdminDashboard.jsx. Every figure,
// including the server's CPU, memory and disk checks, is computed by the
// site's /api/admin/stats from the service role it holds; the phone only
// reads the result with the admin's own session, and shows only totals.
// Saving the banner is the one thing the web page writes, and on the phone it
// only changes the preview.
struct AdminDashboard: View {
    @Environment(AppModel.self) private var app
    @State private var stats: [String: Any] = [:]
    @State private var error = ""
    @State private var loading = true
    @State private var fetchedAt: Date?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Admin").font(.display(36, relativeTo: .largeTitle).weight(.semibold))
                if loading, stats.isEmpty {
                    LoadingState(label: "Loading platform metrics…")
                } else if !error.isEmpty, stats.isEmpty {
                    ErrorState(message: error) { await load() }
                } else {
                    content
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
        }
        .background(Theme.page)
        .navigationTitle("Admin")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await load() }
        // Every 60 seconds while the screen is open, like the web's poll.
        .task {
            while !Task.isCancelled {
                await load()
                try? await Task.sleep(for: .seconds(60))
            }
        }
    }

    private func value(_ path: String) -> Any? {
        path.split(separator: ".").reduce(stats as Any?) { node, key in (node as? [String: Any])?[String(key)] }
    }

    private func number(_ path: String) -> String {
        switch value(path) {
        case let number as NSNumber: number.stringValue
        case let text as String: text
        default: "0"
        }
    }

    @ViewBuilder private var content: some View {
        TimelineView(.periodic(from: .now, by: 10)) { context in
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Updated \(Self.relativeTime(fetchedAt, now: context.date))").font(.subheadline.weight(.medium))
                    Text("Refreshes every 60s while this screen is open.").font(.caption).foregroundStyle(Theme.brownMuted)
                }
                Spacer()
                StatusChip(status: value("status") as? String ?? "ok")
                Button("Refresh") { Task { await load() } }.buttonStyle(.ffPrimary)
            }
            .padding(14)
            .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.adaptive(0xe6d9c4, dark: 0x665746)))
        }
        if !error.isEmpty {
            Text("Last refresh failed: \(error). Showing the previous numbers.").font(.subheadline).foregroundStyle(Theme.errorInk)
        }

        AdminSection(title: "Site banner", note: "An announcement across the top of the app, with an optional link to one of its pages.") {
            BannerPanel()
        }

        let excluded = (value("excludedAccounts") as? NSNumber)?.intValue ?? 1
        AdminSection(title: "The platform, without you", note: "Every figure below excludes \(excluded == 1 ? "your own account" : "\(excluded) admin accounts"), so it answers what other people are doing. The full total is underneath each one.") {
            Metric(label: "Collectibles", value: number("metrics.items.excluding_admins"), total: number("metrics.items.total"), hint: "\(number("metrics.items.new_30d")) added in 30 days")
            Metric(label: "Collectors with items", value: number("metrics.items.collectors"), hint: "of \(number("metrics.users.excluding_admins")) signed-up accounts")
            Metric(label: "New users (30d)", value: number("metrics.users.new_30d"), hint: "\(number("metrics.users.new_7d")) in the last 7 days")
            Metric(label: "Signed up, never returned", value: number("metrics.users.never_returned"), hint: "One sign-in ever")
        }

        AdminSection(title: "Activity", note: "Active users come from Supabase's last-sign-in timestamp, which has history behind it. Login counts come from our own table and only count forward from the day it was added.") {
            Metric(label: "Active (7d)", value: number("metrics.users.active_7d"), hint: "Signed in at least once")
            Metric(label: "Active (30d)", value: number("metrics.users.active_30d"))
            let since = value("metrics.logins.tracked_since") as? String
            Metric(label: "Logins (7d)", value: number("metrics.logins.d7"), hint: since.map { "Tracked since \(WishlistLogic.accountDate($0))" } ?? "No logins recorded yet")
            Metric(label: "Shared pages live", value: number("metrics.shares.published"), hint: "\(number("metrics.shares.started_not_published")) set up but left off")
        }

        AdminSection(title: "Support and cost", note: "Photo identification is the only feature here billed per call, which is why it is on this page.") {
            Metric(label: "Identify calls today", value: number("metrics.identify.calls_today"))
            Metric(label: "Identify calls (30d)", value: number("metrics.identify.calls_30d"))
            let errored = (value("metrics.feedback.errored") as? NSNumber)?.intValue ?? 0
            Metric(label: "Feedback", value: number("metrics.feedback.total"), hint: "\(number("metrics.feedback.filed_to_github")) filed as issues\(errored > 0 ? ", \(errored) failed" : "")")
            let stars = (value("github.repo.stars") as? NSNumber)?.intValue ?? 0
            Metric(
                label: "Open issues + PRs",
                value: value("github.repo") == nil ? "--" : number("github.repo.openIssuesAndPrs"),
                hint: value("github.repo") == nil ? "GitHub unavailable" : "\(stars) \(stars == 1 ? "star" : "stars") · pushed \(Self.relativeTime(Self.date(value("github.repo.lastPushedAt") as? String), now: Date()))"
            )
        }

        VStack(alignment: .leading, spacing: 10) {
            SectionHeading("Limits")
            Text("What is close to a wall on the \(value("plan") as? String ?? "free") plan, and what to do about it — including the server's CPU, memory and disk. Egress is not shown; check it in the Supabase usage page.")
                .font(.subheadline).foregroundStyle(Theme.brown)
            let checks = value("checks") as? [[String: Any]] ?? []
            if checks.isEmpty { Text("No limit checks available.").font(.subheadline).foregroundStyle(Theme.brown) }
            ForEach(Array(checks.enumerated()), id: \.offset) { _, check in CheckRow(check: check) }
        }
        .padding(.top, 8)
    }

    private func load() async {
        guard let data = try? await fetch() else { return }
        if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            stats = object
            fetchedAt = Date()
            error = ""
        }
        loading = false
    }

    private func fetch() async throws -> Data {
        do {
            return try await app.store.getSiteJSON(path: "/api/v1/admin/stats", authorized: true)
        } catch {
            self.error = error.localizedDescription
            loading = false
            throw error
        }
    }

    static func date(_ iso: String?) -> Date? {
        guard let iso else { return nil }
        let plain = ISO8601DateFormatter()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return plain.date(from: iso) ?? fractional.date(from: iso)
    }

    // relativeTime from the web's dashboard.
    static func relativeTime(_ date: Date?, now: Date) -> String {
        guard let date else { return "never" }
        let seconds = max(0, Int(now.timeIntervalSince(date).rounded()))
        if seconds < 10 { return "just now" }
        if seconds < 60 { return "\(seconds)s ago" }
        let minutes = Int((Double(seconds) / 60).rounded())
        if minutes < 60 { return "\(minutes)m ago" }
        let hours = Int((Double(minutes) / 60).rounded())
        if hours < 24 { return "\(hours)h ago" }
        return "\(Int((Double(hours) / 24).rounded()))d ago"
    }

    // formatPercent from src/utils/platformLimits.js.
    static func percent(_ ratio: Double) -> String {
        guard ratio.isFinite else { return "--" }
        let percent = ratio * 100
        if percent > 0, percent < 1 { return "<1%" }
        return "\(Int(percent.rounded()))%"
    }
}

private struct AdminSection<Content: View>: View {
    let title: String
    let note: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeading(title)
            Text(note).font(.subheadline).foregroundStyle(Theme.brown)
            content
        }
        .padding(.top, 8)
    }
}

private struct Metric: View {
    let label: String
    let value: String
    var total: String?
    var hint: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label.uppercased()).font(.caption.weight(.medium)).tracking(1.4).foregroundStyle(Theme.brownMuted)
            Text(value).font(.ledger(28, relativeTo: .title).weight(.semibold)).foregroundStyle(Theme.ink)
            if let total { Text("\(total) including your account").font(.caption).foregroundStyle(Theme.brownMuted) }
            if let hint { Text(hint).font(.caption).foregroundStyle(Theme.brownMuted) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.adaptive(0xe6d9c4, dark: 0x665746)))
        .accessibilityElement(children: .combine)
    }
}

// The check palette the web's admin page uses for ok / watch / act.
struct StatusChip: View {
    let status: String

    static func style(_ status: String) -> (chip: UInt32, ink: UInt32, bar: UInt32, label: String) {
        switch status {
        case "watch": (0xf8ecd5, 0x8a6320, 0xc99a3c, "Watch")
        case "act": (0xf7e0dc, 0x8f3524, 0xb8492f, "Act")
        default: (0xe4efe9, 0x1c5c4a, 0x2f7d63, "OK")
        }
    }

    var body: some View {
        let style = Self.style(status)
        Text(style.label.uppercased())
            .font(.caption.weight(.semibold))
            .tracking(0.8)
            .padding(.horizontal, 10).padding(.vertical, 4)
            .foregroundStyle(Theme.adaptive(style.ink, dark: style.ink))
            .background(Theme.adaptive(style.chip, dark: style.chip), in: Capsule())
    }
}

private struct CheckRow: View {
    let check: [String: Any]

    var body: some View {
        let status = check["status"] as? String ?? "ok"
        let style = StatusChip.style(status)
        let ratio = (check["ratio"] as? NSNumber)?.doubleValue
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(check["label"] as? String ?? "").font(.subheadline.weight(.medium))
                Spacer()
                StatusChip(status: status)
            }
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(check["value"] ?? "")").font(.ledger(17, relativeTo: .headline).weight(.semibold))
                if let ratio { Text(AdminDashboard.percent(ratio)).font(.subheadline).foregroundStyle(Theme.brownMuted) }
            }
            if let ratio {
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.adaptive(0xefe4d2, dark: 0x3f352a))
                        Capsule().fill(Color(UIColor(hex: style.bar))).frame(width: proxy.size.width * min(1, max(0.02, ratio)))
                    }
                }
                .frame(height: 6)
            }
            if let detail = check["detail"] as? String, !detail.isEmpty {
                Text(detail).font(.caption).foregroundStyle(Theme.brownMuted)
            }
            if let action = check["action"] as? String, !action.isEmpty {
                (Text("Do this: ").fontWeight(.semibold) + Text(action))
                    .font(.caption)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.page, in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(16)
        .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.adaptive(0xe6d9c4, dark: 0x665746)))
        .accessibilityElement(children: .combine)
    }
}

// BannerPanel: read live, edited locally. On the web, saving re-shows the
// banner to everyone who dismissed it; on the phone it only updates the
// preview, and the prototype says so.
private struct BannerPanel: View {
    @Environment(AppModel.self) private var app
    @State private var draft = SiteBanner()
    @State private var loaded = false
    @State private var note = ""

    private static let destinations: [(view: String, label: String, signedIn: Bool)] = [
        ("features", "Features", false), ("explore", "Explore", false), ("roadmap", "Roadmap", false), ("about", "About", false),
        ("contribute", "Contribute", false), ("dashboard", "Dashboard", true), ("addItems", "Add Items", true),
        ("wishlist", "Wishlist", true), ("account", "My Account", true),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if !loaded {
                Text("Loading the banner…").font(.subheadline).foregroundStyle(Theme.brown)
            } else {
                Toggle(isOn: $draft.enabled) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Show the banner").font(.subheadline.weight(.medium))
                        Text("To everyone, signed in or not, at the top of every page in the app.").font(.caption).foregroundStyle(Theme.brownMuted)
                    }
                }
                .tint(Theme.green)
                Text("Message").font(.subheadline.weight(.medium))
                TextField("", text: Binding(get: { draft.message }, set: { draft.message = String($0.prefix(160)) }), axis: .vertical)
                    .lineLimit(2...4)
                    .padding(10)
                    .background(Theme.field, in: RoundedRectangle(cornerRadius: 12))
                    .overlay(RoundedRectangle(cornerRadius: 12).strokeBorder(Theme.fieldBorder))
                Text("\(draft.message.count)/160").font(.caption).foregroundStyle(Theme.brownMuted).frame(maxWidth: .infinity, alignment: .trailing)
                Field(label: "Link text", text: Binding(get: { draft.linkLabel }, set: { draft.linkLabel = String($0.prefix(40)) }), placeholder: "Optional")
                Picker("Link goes to", selection: $draft.linkView) {
                    Text("No link").tag("")
                    ForEach(Self.destinations, id: \.view) { Text($0.label + ($0.signedIn ? " (signed-in only)" : "")).tag($0.view) }
                }
                if !draft.message.trimmingCharacters(in: .whitespaces).isEmpty {
                    Text("PREVIEW").font(.caption).tracking(1.4).foregroundStyle(Theme.brownMuted)
                    HStack {
                        Text(draft.message)
                        if !draft.linkView.isEmpty, !draft.linkLabel.isEmpty { Text("\(draft.linkLabel) →").fontWeight(.semibold).underline() }
                    }
                    .font(.subheadline)
                    .foregroundStyle(Theme.adaptive(0xfff7ea, dark: 0xfff7ea))
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.adaptive(0x123f38, dark: 0x123f38), in: RoundedRectangle(cornerRadius: 12))
                }
                Button("Save banner") { note = "Disabled in the prototype. The live banner is unchanged." }
                    .buttonStyle(.ffPrimary)
                if !note.isEmpty { Text(note).font(.subheadline).foregroundStyle(Theme.warningInk) }
                Text("Saving shows the banner again to anyone who closed the previous one.").font(.caption).foregroundStyle(Theme.brownMuted)
            }
        }
        .padding(16)
        .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.adaptive(0xe6d9c4, dark: 0x665746)))
        .task {
            struct Response: Decodable {
                struct Banner: Decodable { var enabled: Bool?; var message: String?; var linkLabel: String?; var linkView: String?; var updatedAt: String? }
                var banner: Banner
            }
            if let data = try? await app.store.getSiteJSON(path: "/api/v1/admin/banner", authorized: true),
               let response = try? JSONDecoder().decode(Response.self, from: data) {
                let banner = response.banner
                draft = SiteBanner(enabled: banner.enabled ?? false, message: banner.message ?? "", linkLabel: banner.linkLabel ?? "", linkView: banner.linkView ?? "", updatedAt: banner.updatedAt)
            } else {
                draft = app.siteBanner
            }
            loaded = true
        }
    }
}
