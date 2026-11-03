import SwiftUI

// The public pages. Features and Contribute are data-driven and drawn here.
// About, Roadmap, Privacy and Terms are long hand-written pages; the phone
// opens the live site's own copy of each, so the wording -- the legal pages
// especially -- can never drift from what the web says.
struct PublicPage: View {
    let view: AppView

    var body: some View {
        switch view {
        case .features: FeaturesPage()
        case .contribute: ContributePage()
        case .about, .roadmap, .privacy, .terms: WebPage(route: .sitePage(path: view.path, title: view.title))
        default: ScreenPlaceholder(view: view)
        }
    }
}

// FeaturesPage: everything FirstFinder does, newest first, by month.
struct FeaturesPage: View {
    struct Entry: Decodable, Hashable {
        var date: String
        var title: String
        var description: String
        var guide: String?
    }

    static let entries: [Entry] = {
        struct File: Decodable { var features: [Entry] }
        guard let url = Bundle.main.url(forResource: "Features", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(File.self, from: data)
        else { return [] }
        return file.features
    }()

    // groupFeaturesByMonth and formatFeatureDate from src/utils/features.js,
    // in UTC like the web's.
    static func groups(_ entries: [Entry]) -> [(key: String, label: String, entries: [Entry])] {
        var groups: [(key: String, label: String, entries: [Entry])] = []
        for entry in entries.sorted(by: { $0.date > $1.date }) {
            let key = String(entry.date.prefix(7))
            if groups.last?.key == key {
                groups[groups.count - 1].entries.append(entry)
            } else {
                groups.append((key, format(entry.date, "MMMM yyyy"), [entry]))
            }
        }
        return groups
    }

    static func format(_ day: String, _ pattern: String) -> String {
        let parser = DateFormatter()
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.timeZone = TimeZone(identifier: "UTC")
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: day) else { return day }
        let out = DateFormatter()
        out.locale = Locale(identifier: "en_US")
        out.timeZone = TimeZone(identifier: "UTC")
        out.dateFormat = pattern
        return out.string(from: date)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("FEATURES").font(.ledger(12, relativeTo: .caption)).tracking(2.4).foregroundStyle(Theme.adaptive(0x655644, dark: 0xd8c7ad))
                    .padding(.horizontal, 14).padding(.vertical, 7)
                    .background(Theme.surfaceWarm, in: Capsule())
                    .overlay(Capsule().strokeBorder(Theme.adaptive(0xd9c9b0, dark: 0x665746)))
                Text("Everything FirstFinder does.").font(.display(36, relativeTo: .largeTitle).weight(.semibold))
                Text("Newest first, dated by the day each one went live. For what's coming next, see the Roadmap.")
                    .foregroundStyle(Theme.brown)
                ForEach(Self.groups(Self.entries), id: \.key) { group in
                    Text(group.label.uppercased()).font(.ledger(12, relativeTo: .caption)).tracking(2.4).foregroundStyle(Theme.brownMuted)
                        .padding(.top, 18)
                    ForEach(group.entries, id: \.self) { entry in
                        VStack(alignment: .leading, spacing: 8) {
                            HStack(alignment: .firstTextBaseline) {
                                Text(entry.title).font(.display(20, relativeTo: .title3).weight(.semibold))
                                Spacer(minLength: 8)
                                Text(Self.format(entry.date, "MMM d, yyyy")).font(.ledger(12, relativeTo: .caption)).foregroundStyle(Theme.brownMuted)
                            }
                            Text(entry.description).foregroundStyle(Theme.brown)
                            if let guide = entry.guide {
                                NavigationLink(value: WebRoute.featureGuide(slug: guide)) {
                                    Text("See how it works →").font(.subheadline.weight(.semibold)).underline().foregroundStyle(Theme.green)
                                }
                            }
                        }
                        .padding(18)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.adaptive(0xfbf5e9, dark: 0x123f38), in: RoundedRectangle(cornerRadius: 24))
                        .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(Theme.border))
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
        }
        .background(Theme.page)
        .navigationTitle(AppView.features.title)
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: WebRoute.self) { WebPage(route: $0) }
    }
}

// ContributePage: open source, read straight from GitHub through the site's
// public /api/contribute.
struct ContributePage: View {
    struct Payload: Decodable {
        struct Repo: Decodable { var stars: Int?; var forks: Int?; var lastPushedAt: String? }
        struct Issue: Decodable, Hashable { var number: Int; var title: String; var url: String; var labels: [String]?; var assigned: Bool? }
        var ok: Bool?
        var repo: Repo?
        var goodFirstIssues: [Issue]?
        var helpWanted: [Issue]?
    }

    @Environment(AppModel.self) private var app
    @Environment(\.openURL) private var openURL
    @State private var payload: Payload?
    @State private var loading = true

    static let repoURL = URL(string: "https://github.com/dchung8811/FirstFinder")!
    static let contributingURL = URL(string: "https://github.com/dchung8811/FirstFinder/blob/main/CONTRIBUTING.md")!

    static func labelSearch(_ label: String) -> URL {
        URL(string: "https://github.com/dchung8811/FirstFinder/issues?q=" + ItemsLogic.encodeURIComponent("is:issue is:open label:\"\(label)\""))!
    }

    var body: some View {
        let failed = !loading && payload?.ok != true
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Label("OPEN SOURCE", systemImage: "chevron.left.forwardslash.chevron.right")
                    .font(.ledger(12, relativeTo: .caption)).tracking(2.4).foregroundStyle(Theme.adaptive(0x655644, dark: 0xd8c7ad))
                    .padding(.horizontal, 14).padding(.vertical, 7)
                    .background(Theme.surfaceWarm, in: Capsule())
                    .overlay(Capsule().strokeBorder(Theme.adaptive(0xd9c9b0, dark: 0x665746)))
                Text("FirstFinder is yours to build on.").font(.display(36, relativeTo: .largeTitle).weight(.semibold))
                Text("Every line of this app is public, and free to read, run, fork, and improve. It's built and paid for by one collector, which means the fastest way to get the feature you want is often to help build it.")
                    .foregroundStyle(Theme.brown)
                FlowLayout(spacing: 10) {
                    Button { openURL(Self.repoURL) } label: { Label("View the source", systemImage: "chevron.left.forwardslash.chevron.right") }
                        .buttonStyle(.ffPrimary)
                    Button { openURL(Self.contributingURL) } label: { Label("Contributing guide", systemImage: "arrow.right") }
                        .buttonStyle(.ffSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let repo = payload?.repo {
                    HStack(spacing: 14) {
                        Label("\(repo.stars ?? 0) star\(repo.stars == 1 ? "" : "s")", systemImage: "star")
                        Label("\(repo.forks ?? 0) fork\(repo.forks == 1 ? "" : "s")", systemImage: "arrow.triangle.branch")
                        if let pushed = repo.lastPushedAt {
                            Text("Last commit \(AdminDashboard.relativeTime(AdminDashboard.date(pushed), now: Date()))")
                        }
                    }
                    .font(.ledger(12, relativeTo: .caption))
                    .foregroundStyle(Theme.brownMuted)
                }

                SectionHeading("Ready for someone to pick up").padding(.top, 12)
                Text("Read straight from GitHub, so this is what's genuinely open right now.").font(.subheadline).foregroundStyle(Theme.brown)
                issueList("Good first issues", "Small, self-contained, and safe to get wrong the first time.", label: "good first issue", issues: payload?.goodFirstIssues ?? [], failed: failed)
                issueList("Help wanted", "Bigger pieces that are scoped and waiting on someone with time.", label: "help wanted", issues: payload?.helpWanted ?? [], failed: failed)

                Card(padding: 20) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Run it on your own machine").font(.display(22, relativeTo: .title3).weight(.semibold))
                        Text("FirstFinder is released under the GNU AGPL v3. Use it, study it, change it, run your own copy for your own shelf — all fine. The one condition: if you run a modified version as a service other people can reach, you have to publish your changes too.")
                            .font(.subheadline).foregroundStyle(Theme.brown)
                    }
                }
                Card(padding: 20) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Not a coder?").font(.display(22, relativeTo: .title3).weight(.semibold))
                        Text("Telling us what's broken or missing is a contribution too.").font(.subheadline).foregroundStyle(Theme.brown)
                        if app.profile != nil {
                            Button("Send feedback") { app.selectedTab = .more; app.pendingMoreRoute = .feedback }.buttonStyle(.ffSecondary)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
        }
        .background(Theme.page)
        .navigationTitle(AppView.contribute.title)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if let data = try? await app.store.getSiteJSON(path: "/api/v1/contribute", authorized: false) {
                payload = try? JSONDecoder().decode(Payload.self, from: data)
            }
            loading = false
        }
    }

    private func issueList(_ heading: String, _ blurb: String, label: String, issues: [Payload.Issue], failed: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(heading).font(.display(22, relativeTo: .title3).weight(.semibold))
                Spacer()
                if !loading, !failed { Text("\(issues.count) open").font(.ledger(12, relativeTo: .caption)).foregroundStyle(Theme.brownMuted) }
            }
            Text(blurb).font(.subheadline).foregroundStyle(Theme.brownSoft)
            if loading {
                dashed("Checking GitHub…")
            } else if failed {
                Button { openURL(Self.labelSearch(label)) } label: { dashed("Couldn't reach GitHub just now. See the list on GitHub.") }.buttonStyle(.plain)
            } else if issues.isEmpty {
                dashed("Nothing open under this label right now. That's a good sign, not a closed door — pick anything from the roadmap, or open an issue with what you'd like to build.")
            } else {
                ForEach(issues, id: \.number) { issue in
                    Button { if let url = URL(string: issue.url) { openURL(url) } } label: {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(spacing: 8) {
                                Text("#\(issue.number)").font(.ledger(12, relativeTo: .caption)).foregroundStyle(Theme.brownMuted)
                                if issue.assigned == true { Chip(text: "Taken") }
                            }
                            Text(issue.title).font(.headline).foregroundStyle(Theme.ink).multilineTextAlignment(.leading)
                            if let labels = issue.labels, !labels.isEmpty {
                                FlowLayout(spacing: 6) { ForEach(labels, id: \.self) { Chip(text: $0, tone: .tint) } }
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                        }
                        .padding(14)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.borderSoft))
                    }
                    .buttonStyle(.plain)
                }
                Button("ALL ON GITHUB →") { openURL(Self.labelSearch(label)) }
                    .font(.ledger(12, relativeTo: .caption)).tracking(1.8).foregroundStyle(Theme.adaptive(0x655644, dark: 0xd8c7ad))
            }
        }
        .padding(18)
        .background(Theme.adaptive(0xfbf5e9, dark: 0x123f38), in: RoundedRectangle(cornerRadius: 28))
        .overlay(RoundedRectangle(cornerRadius: 28).strokeBorder(Theme.border))
    }

    private func dashed(_ text: String) -> some View {
        Text(text).font(.subheadline).foregroundStyle(Theme.brown).padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Theme.borderSoft, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
    }
}
