import SwiftUI

// HomePage from app/InventoryApp.jsx: the pitch to someone who hasn't started
// yet. Hero, the drifting strip of real shelves, the deep-green ledger
// section, the walkthrough video and the three steps -- in the web's order,
// with the web's copy.
struct HomePage: View {
    @Binding var path: NavigationPath
    @Environment(AppModel.self) private var app

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                hero
                ledger
                howItWorks
                HomeFooterLinks(path: $path)
            }
        }
        .background(Theme.page)
        .scrollContentBackground(.hidden)
        .task { await app.loadFeaturedShelves() }
        .refreshable { await app.loadFeaturedShelves(force: true) }
    }

    // MARK: Hero

    private var hero: some View {
        VStack(spacing: 0) {
            VStack(spacing: 24) {
                Text("All your favorite finds catalogued.")
                    .font(.display(46, relativeTo: .largeTitle).weight(.semibold))
                    .tracking(-0.8)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center)
                    .accessibilityAddTraits(.isHeader)
                Text("Photos, receipts, and any information you want to jot down on your favorite collectibles!")
                    .font(.title3)
                    .foregroundStyle(Theme.brown)
                    .multilineTextAlignment(.center)
                    .lineSpacing(6)
                VStack(spacing: 12) {
                    Button { path.append(AppView.signup) } label: {
                        HStack(spacing: 6) {
                            Text("Get Started")
                            Image(systemName: "chevron.right").font(.footnote.weight(.semibold))
                        }
                    }
                    .buttonStyle(.ffPrimary)
                    Button("Explore collections") { path.append(WebRoute.explore) }
                        .buttonStyle(.ffSecondary)
                }
                .padding(.top, 12)
            }
            .padding(.horizontal, 24)
            .padding(.top, 48)

            FeaturedShelvesView(shelves: app.featuredShelves) { path.append($0) }
                .padding(.top, 48)
                .padding(.bottom, 56)
        }
    }

    // MARK: Your ledger

    private var ledger: some View {
        let mist = Theme.adaptive(0xd8e6e2, dark: 0xd8e6e2)
        let cream = Theme.adaptive(0xfff7ea, dark: 0xfff7ea)
        return VStack(alignment: .leading, spacing: 0) {
            Label("Your ledger", systemImage: "receipt")
                .font(.caption.weight(.medium))
                .textCase(.uppercase)
                .tracking(1.5)
                .foregroundStyle(mist)
                .padding(.horizontal, 12)
                .padding(.vertical, 4)
                .background(cream.opacity(0.1), in: Capsule())
            Text("Every find gets its own record.")
                .font(.display(30, relativeTo: .title).weight(.semibold))
                .foregroundStyle(cream)
                .padding(.top, 20)
                .accessibilityAddTraits(.isHeader)
            Text("Photos of the item and its receipt, the edition and condition, where you found it, what you paid, and what it’s worth now — all on one page, so the proof is there when you need it.")
                .font(.body)
                .lineSpacing(6)
                .foregroundStyle(mist)
                .padding(.top, 16)
            // True by default: a collection page starts with visibility "off"
            // and prices hidden. Change that on the web, change this.
            Text("Your ledger stays private. Nothing goes on a public shelf until you share it, and prices stay hidden there unless you choose to show them.")
                .font(.body)
                .lineSpacing(6)
                .foregroundStyle(mist)
                .padding(.top, 16)
            Text("Built by a collector who kept losing receipts.")
                .font(.ledger(12, relativeTo: .caption))
                .foregroundStyle(Theme.adaptive(0xa9c4bd, dark: 0xa9c4bd))
                .padding(.top, 32)

            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(cream.opacity(0.25), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    .offset(x: -16, y: 32)
                    .accessibilityHidden(true)
                VStack(spacing: -4) {
                    SpecimenCard(
                        index: "001", kind: "Book · First edition", title: "The Gunslinger",
                        detail: "Donald M. Grant, 1982 · dust jacket, first printing points", paid: "$45", value: "$850",
                        chips: [.init(systemImage: "receipt", text: "Receipt saved", green: true), .init(systemImage: "camera", text: "5 photos", green: false)]
                    )
                    .rotationEffect(.degrees(-2))
                    .zIndex(1)
                    SpecimenCard(
                        index: "002", kind: "Sports · Program", title: "Phillies Program, 1970s",
                        detail: "Veterans Stadium era · minor corner wear", paid: "$12", value: "$40",
                        chips: [.init(systemImage: nil, text: "Found at a flea market", green: true), .init(systemImage: "camera", text: "2 photos", green: false)]
                    )
                    .rotationEffect(.degrees(2.5))
                    .padding(.leading, 24)
                    .zIndex(2)
                }
            }
            .padding(.top, 48)
            .padding(.horizontal, 8)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 64)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.adaptive(0x123f38, dark: 0x123f38))
        .overlay(alignment: .top) { Rectangle().fill(Theme.adaptive(0x0d2f2a, dark: 0x0d2f2a)).frame(height: 1) }
        .overlay(alignment: .bottom) { Rectangle().fill(Theme.adaptive(0x0d2f2a, dark: 0x0d2f2a)).frame(height: 1) }
    }

    // MARK: How it works

    private var howItWorks: some View {
        let site = (try? app.config.get().siteURL) ?? AppConfig.defaultSiteURL
        return VStack(spacing: 0) {
            Text("See it in 90 seconds.")
                .font(.display(30, relativeTo: .title).weight(.semibold))
                .foregroundStyle(Theme.ink)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)
            // A portrait iPhone recording, so the frame keeps its exact
            // 600:1304 shape and nothing is cropped off the edges.
            DemoVideoPlayer(
                videoURL: site.appending(path: "firstfinder-demo.mp4"),
                posterURL: site.appending(path: "firstfinder-demo-poster.jpg")
            )
            .aspectRatio(600.0 / 1304.0, contentMode: .fit)
            .frame(maxWidth: 300)
            .clipShape(RoundedRectangle(cornerRadius: 32, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 32, style: .continuous).strokeBorder(Theme.adaptive(0xd3c1a4, dark: 0x665746)))
            .shadow(color: .black.opacity(0.18), radius: 20, y: 10)
            .padding(.top, 32)

            VStack(spacing: 24) {
                HomeStep(number: "01", systemImage: "camera", title: "Snap it", text: "Photograph the item and the receipt the day it comes home. Proof beats memory.")
                HomeStep(number: "02", systemImage: "doc.text", title: "Log it", text: "Edition points, condition, where you found it, what you paid. Thirty seconds per item.")
                HomeStep(number: "03", systemImage: "dollarsign", title: "Track it", text: "See what your collection is worth today, and keep what something sold for if you ever let it go.")
            }
            .padding(.top, 48)

            Button { path.append(AppView.signup) } label: {
                HStack(spacing: 6) {
                    Text("Start your ledger")
                    Image(systemName: "chevron.right").font(.footnote.weight(.semibold))
                }
            }
            .buttonStyle(.ffPrimary)
            .padding(.top, 48)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 64)
        .frame(maxWidth: .infinity)
        .background(Theme.adaptive(0xfbf5e9, dark: 0x0f332d))
    }
}

// SpecimenCard and LedgerRow: an example ledger entry.
struct SpecimenCard: View {
    struct SpecimenChip: Hashable {
        var systemImage: String?
        var text: String
        var green: Bool
    }

    let index: String
    let kind: String
    let title: String
    let detail: String
    let paid: String
    let value: String
    let chips: [SpecimenChip]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text(kind.uppercased()).font(.ledger(11, relativeTo: .caption2)).tracking(2)
                Spacer()
                Text("No. \(index)").font(.ledger(11, relativeTo: .caption2))
            }
            .foregroundStyle(Theme.brownMuted)
            .padding(.bottom, 12)
            .overlay(alignment: .bottom) { Rectangle().fill(Theme.adaptive(0xe6d9c2, dark: 0x665746)).frame(height: 1) }

            Text(title)
                .font(.display(24, relativeTo: .title2).weight(.semibold))
                .foregroundStyle(Theme.ink)
                .padding(.top, 16)
            Text(detail).font(.subheadline).foregroundStyle(Theme.brown).padding(.top, 4)

            VStack(spacing: 8) {
                LedgerRow(label: "Paid", value: paid)
                LedgerRow(label: "Est. value", value: value, strong: true)
            }
            .padding(.top, 16)

            FlowLayout(spacing: 8) {
                ForEach(chips, id: \.self) { chip in
                    Chip(text: chip.text, tone: chip.green ? .tint : .neutral, systemImage: chip.systemImage)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.top, 16)
        }
        .padding(20)
        .frame(maxWidth: 384)
        .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.adaptive(0xd3c1a4, dark: 0x665746)))
        .shadow(color: Color(red: 48 / 255, green: 36 / 255, blue: 20 / 255).opacity(0.35), radius: 20, y: 18)
        .accessibilityElement(children: .combine)
    }
}

struct LedgerRow: View {
    let label: String
    let value: String
    var strong = false

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(label).font(.subheadline).foregroundStyle(Theme.brownSoft)
            Line()
                .stroke(Theme.adaptive(0xc9b591, dark: 0x7d6c5a), style: StrokeStyle(lineWidth: 1, dash: [1, 3]))
                .frame(height: 1)
            Text(value)
                .font(.ledger(14, relativeTo: .subheadline).weight(strong ? .medium : .regular))
                .foregroundStyle(strong ? Theme.green : Theme.adaptive(0x3d332a, dark: 0xfff7ea))
        }
    }

    private struct Line: Shape {
        func path(in rect: CGRect) -> Path {
            Path { path in
                path.addLines([CGPoint(x: rect.minX, y: rect.midY), CGPoint(x: rect.maxX, y: rect.midY)])
            }
        }
    }
}

private struct HomeStep: View {
    let number: String
    let systemImage: String
    let title: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Image(systemName: systemImage)
                    .font(.system(size: 18))
                    .foregroundStyle(Theme.adaptive(0xfff7ea, dark: 0xfff7ea))
                    .frame(width: 44, height: 44)
                    .background(Theme.adaptive(0x123f38, dark: 0x123f38), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .accessibilityHidden(true)
                Spacer()
                Text(number).font(.ledger(14, relativeTo: .footnote)).foregroundStyle(Theme.adaptive(0xb09a78, dark: 0xcdbb9d))
            }
            Text(title).font(.display(20, relativeTo: .title3).weight(.semibold)).foregroundStyle(Theme.ink).padding(.top, 20)
            Text(text).font(.subheadline).lineSpacing(4).foregroundStyle(Theme.brown).padding(.top, 8)
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.surfaceRaised, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.adaptive(0xddceb2, dark: 0x665746)))
        .accessibilityElement(children: .combine)
    }
}

// SiteFooter's links for someone signed out.
struct HomeFooterLinks: View {
    @Binding var path: NavigationPath

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Eyebrow("FirstFinder").padding(.bottom, 8)
            NavRow(title: "Explore", systemImage: "safari") { path.append(WebRoute.explore) }
            ForEach([AppView.features, .roadmap, .about, .contribute, .privacy, .terms]) { view in
                NavRow(title: view.title, systemImage: MoreView.icon(for: view)) { path.append(view) }
            }
            NavRow(title: "Book guides", systemImage: "books.vertical") { path.append(WebRoute.bookGuides) }
            NavRow(title: "Reset password", systemImage: "key") { path.append(AppView.resetPassword) }
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 32)
        .background(Theme.page)
    }
}
