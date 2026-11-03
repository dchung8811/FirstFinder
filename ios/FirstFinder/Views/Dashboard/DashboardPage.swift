import Charts
import SwiftUI

// DashboardPage from app/InventoryApp.jsx. Opens on the collection itself --
// how much is here and how varied -- before any figure with a dollar sign.
// Every figure is computed by the same rules as the web (DashboardLogic and
// ItemsLogic are ports), so the two must agree for the same filters.
struct DashboardPage: View {
    @Environment(AppModel.self) private var app

    // Deliberately not persisted: the dashboard should open showing
    // everything, not a filter set weeks ago.
    @State private var category = ""
    @State private var rangeKey = "all"

    private var inventory: [Item] { app.inventory }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("Your collection.")
                    .font(.display(40, relativeTo: .largeTitle).weight(.semibold))
                    .foregroundStyle(Theme.ink)
                    .accessibilityAddTraits(.isHeader)
                content
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
        }
        .background(Theme.page)
        .refreshable { await app.refreshInventory() }
        .navigationTitle(AppView.dashboard.title)
        // The page's own heading says it; a bar repeating it is noise.
        .toolbar(.hidden, for: .navigationBar)
    }

    @ViewBuilder private var content: some View {
        if inventory.isEmpty {
            emptyOrLoading
        } else {
            populated
        }
    }

    // Both states share one card, so the swap reads as one surface settling.
    // Telling someone with forty books they have nothing catalogued while it
    // loads reads as data loss.
    @ViewBuilder private var emptyOrLoading: some View {
        if case .failed(let message) = app.inventoryLoad {
            ErrorState(title: "Couldn't load your collection", message: message) { await app.refreshInventory() }
                .padding(.top, 24)
        } else {
            let loading = app.inventoryLoad == .loading || app.inventoryLoad == .idle
            Card(padding: 28) {
                VStack(spacing: 14) {
                    Image(systemName: loading ? "receipt" : "camera")
                        .font(.system(size: 24))
                        .foregroundStyle(loading ? Theme.green : Theme.adaptive(0xfff7ea, dark: 0xfff7ea))
                        .frame(width: 56, height: 56)
                        .background(loading ? Theme.tint : Theme.adaptive(0x123f38, dark: 0x123f38), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .accessibilityHidden(true)
                    Text(loading ? "Just a sec…" : "Nothing catalogued yet")
                        .font(.display(24, relativeTo: .title2).weight(.semibold))
                        .foregroundStyle(Theme.ink)
                    Text(loading ? "Pulling your collection together." : "This page fills in as you add finds — what you have, what it's worth, and how the collection has grown.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(Theme.brown)
                    if !loading {
                        Button("Add your first find") { app.selectedTab = .add }
                            .buttonStyle(.ffPrimary)
                            .padding(.top, 6)
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.top, 24)
        }
    }

    // MARK: The populated dashboard

    private var categoryOptions: [String] {
        Array(Set(inventory.map(\.category).filter { !$0.isEmpty })).sorted()
    }

    private var populated: some View {
        let (visible, undatedExcluded) = DashboardLogic.applyFilters(inventory, category: category, rangeKey: rangeKey)
        let filtered = !category.isEmpty || rangeKey != "all"
        let sold = visible.filter { $0.status == "Sold" }
        let held = visible.filter { $0.status != "Sold" }
        let categoryCount = Set(held.map(\.category).filter { !$0.isEmpty }).count

        return VStack(alignment: .leading, spacing: 0) {
            Text(summary(held: held.count, categories: categoryCount, sold: sold.count))
                .font(.title3)
                .foregroundStyle(Theme.brown)
                .padding(.top, 14)

            HStack(spacing: 12) {
                Button("Browse all") { app.selectedTab = .collection }
                    .buttonStyle(.ffSecondary)
                Button("Add a find") { app.selectedTab = .add }
                    .buttonStyle(.ffPrimary)
            }
            .padding(.top, 18)

            filterBar(filtered: filtered).padding(.top, 24)

            // Everything below is scoped, so say so plainly. A filtered
            // figure read as a whole-collection total is how this misleads.
            if filtered {
                Text(scopeLine(count: visible.count, undatedExcluded: undatedExcluded))
                    .font(.subheadline)
                    .foregroundStyle(Theme.brown)
                    .padding(.top, 12)
            }

            if visible.isEmpty {
                EmptyState(
                    systemImage: "line.3.horizontal.decrease.circle",
                    title: "Nothing matches those filters",
                    message: "There is nothing in your collection for this combination. Widen the period or pick a different category.",
                    actionTitle: "Clear filters",
                    action: clearFilters
                )
                .padding(.top, 24)
            } else {
                RecentFinds(inventory: visible)
                worth(held: held, sold: sold)
                growth(visible: visible, sold: sold)
            }
        }
    }

    private func summary(held: Int, categories: Int, sold: Int) -> String {
        var text = "\(held) item\(held == 1 ? "" : "s")"
        if categories > 1 { text += " across \(categories) categories" }
        if sold > 0 { text += ", plus \(sold) you've since let go" }
        return text + "."
    }

    private func scopeLine(count: Int, undatedExcluded: Int) -> String {
        let rangeLabel = DashboardLogic.ranges.first { $0.key == rangeKey }?.label.lowercased() ?? ""
        var text = "Showing \(category.isEmpty ? "all categories" : category)"
        if rangeKey != "all" { text += ", \(rangeLabel)" }
        text += ". Every figure and chart below covers \(count) item\(count == 1 ? "" : "s")."
        if undatedExcluded > 0 {
            text += " \(undatedExcluded) item\(undatedExcluded == 1 ? " has" : "s have") no date and cannot be placed in a period."
        }
        return text
    }

    private func clearFilters() {
        category = ""
        rangeKey = "all"
    }

    private func filterBar(filtered: Bool) -> some View {
        Card(padding: 16) {
            VStack(alignment: .leading, spacing: 12) {
                FilterMenu(label: "Category", selection: $category, options: [("", "All categories")] + categoryOptions.map { ($0, $0) })
                FilterMenu(label: "Period", selection: $rangeKey, options: DashboardLogic.ranges.map { ($0.key, $0.label) })
                if filtered {
                    Button("Clear filters", action: clearFilters)
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.green)
                        .underline()
                }
            }
        }
    }

    // MARK: What it's worth

    private func worth(held: [Item], sold: [Item]) -> some View {
        // reduce on the web: an item becomes the top only when its figure is
        // above zero, so a collection of unappraised books has no "most
        // expensive" rather than an arbitrary one.
        let topHeld = held.reduce(nil as Item?) { best, item in
            Format.toNumber(item.estimatedValue) > Format.toNumber(best?.estimatedValue ?? 0) ? item : best
        }
        let topSold = sold.reduce(nil as Item?) { best, item in
            Format.toNumber(item.soldPrice) > Format.toNumber(best?.soldPrice ?? 0) ? item : best
        }
        let totalHeld = held.reduce(Decimal(0)) { sum, item in sum + (ItemsLogic.valueForTotals(item) ?? 0) }
        let unestimated = held.filter { ItemsLogic.valueForTotals($0) == nil }.count
        let totalSold = sold.reduce(Decimal(0)) { $0 + Format.toNumber($1.soldPrice) }

        return VStack(alignment: .leading, spacing: 16) {
            SectionHeading("What it's worth")
            StatTile(
                label: "Total value held",
                value: Format.currency(totalHeld),
                sublabel: "\(held.count) item\(held.count == 1 ? "" : "s")",
                // The web's tile says only the count; items without an
                // estimate are left out of the total, and the phone says so.
                footnote: unestimated > 0 ? "\(unestimated) without an estimate, not counted" : nil
            )
            StatTile(
                label: "Most expensive held",
                value: topHeld.map { Format.currency($0.estimatedValue) } ?? "—",
                sublabel: topHeld.map { $0.name.isEmpty ? "Untitled item" : $0.name } ?? (held.isEmpty ? "Nothing held" : "No estimates yet")
            )
            StatTile(label: "Total value sold", value: Format.currency(totalSold), sublabel: "\(sold.count) item\(sold.count == 1 ? "" : "s")")
            StatTile(
                label: "Most expensive sold",
                value: topSold.map { Format.currency($0.soldPrice) } ?? "—",
                sublabel: topSold.map { $0.name.isEmpty ? "Untitled item" : $0.name } ?? "Nothing sold yet"
            )
        }
        .padding(.top, 40)
    }

    // MARK: Charts

    private func growth(visible: [Item], sold: [Item]) -> some View {
        let acquisitions = DashboardLogic.monthlyBuckets(visible, date: \.purchaseDate, amount: \.purchasePrice)
        let sales = DashboardLogic.monthlyBuckets(sold, date: \.soldDate, amount: \.soldPrice)
        // The chart colors the web uses, unchanged.
        let green = Color(UIColor(hex: 0x2f7d6b))
        let amber = Color(UIColor(hex: 0xb07d2a))

        return VStack(alignment: .leading, spacing: 16) {
            SectionHeading("How it's grown").padding(.top, 40)
            TimeSeriesChart(title: "Items acquired", buckets: acquisitions, metric: .count, color: green)
            TimeSeriesChart(title: "Amount spent", buckets: acquisitions, metric: .amount, color: green)
            SectionHeading("Sales over time").padding(.top, 24)
            TimeSeriesChart(title: "Items sold", buckets: sales, metric: .count, color: amber)
            TimeSeriesChart(title: "Amount realized", buckets: sales, metric: .amount, color: amber)
        }
    }
}

struct SectionHeading: View {
    let text: String
    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .font(.display(24, relativeTo: .title2).weight(.semibold))
            .foregroundStyle(Theme.ink)
            .accessibilityAddTraits(.isHeader)
    }
}

// The web's labelled <select>, as a menu.
struct FilterMenu: View {
    let label: String
    @Binding var selection: String
    let options: [(value: String, label: String)]

    var body: some View {
        HStack(spacing: 10) {
            Text(label).font(.subheadline.weight(.medium)).foregroundStyle(Theme.brown)
            Menu {
                Picker(label, selection: $selection) {
                    ForEach(options, id: \.value) { option in
                        Text(option.label).tag(option.value)
                    }
                }
            } label: {
                HStack(spacing: 6) {
                    Text(options.first { $0.value == selection }?.label ?? "")
                        .lineLimit(1)
                    Image(systemName: "chevron.down").font(.caption)
                }
                .font(.subheadline)
                .foregroundStyle(Theme.ink)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Theme.surfaceRaised, in: Capsule())
                .overlay(Capsule().strokeBorder(Theme.border))
            }
            .accessibilityLabel("\(label): \(options.first { $0.value == selection }?.label ?? "")")
        }
    }
}

// StatTile: one figure, its label, and what it covers.
struct StatTile: View {
    let label: String
    let value: String
    var sublabel: String?
    var footnote: String?

    var body: some View {
        Card(padding: 22) {
            VStack(alignment: .leading, spacing: 6) {
                Text(label.uppercased()).font(.caption).tracking(1.8).foregroundStyle(Theme.brownSoft)
                Text(value)
                    .font(.ledger(30, relativeTo: .title).weight(.semibold))
                    .foregroundStyle(Theme.ink)
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
                if let sublabel {
                    Text(sublabel).font(.subheadline).foregroundStyle(Theme.brown).lineLimit(1)
                }
                if let footnote {
                    Text(footnote).font(.caption).foregroundStyle(Theme.brownMuted)
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(value)")
        .accessibilityValue([sublabel, footnote].compactMap { $0 }.joined(separator: ". "))
    }
}

// TimeSeriesChart: one measure over time, one series per chart. The ends and
// the peak are labelled, never every bar; a table view gives every figure.
struct TimeSeriesChart: View {
    enum Metric { case count, amount }

    let title: String
    let buckets: [DashboardLogic.Bucket]
    let metric: Metric
    let color: Color

    private func value(_ bucket: DashboardLogic.Bucket) -> Double {
        metric == .count ? Double(bucket.count) : NSDecimalNumber(decimal: bucket.amount).doubleValue
    }

    private func format(_ value: Double) -> String {
        metric == .count ? String(Int(value.rounded())) : Format.currency(Decimal(value))
    }

    var body: some View {
        let values = buckets.map(value)
        let peak = values.max() ?? 0
        Card(padding: 22) {
            VStack(alignment: .leading, spacing: 12) {
                Text(title).font(.headline).foregroundStyle(Theme.ink)
                if buckets.isEmpty || peak <= 0 {
                    Text("Nothing to chart yet.").font(.subheadline).foregroundStyle(Theme.brownMuted).padding(.top, 12)
                } else {
                    chart(values: values, peak: peak)
                    DisclosureGroup("Table view") {
                        VStack(spacing: 0) {
                            HStack {
                                Text("Month")
                                Spacer()
                                Text(metric == .count ? "Items" : "Amount")
                            }
                            .font(.caption)
                            .foregroundStyle(Theme.brownMuted)
                            .padding(.vertical, 4)
                            ForEach(buckets) { bucket in
                                Divider().overlay(Theme.borderSoft)
                                HStack {
                                    Text(DashboardLogic.monthLabel(bucket.key))
                                    Spacer()
                                    Text(format(value(bucket))).font(.ledger(12, relativeTo: .caption))
                                }
                                .font(.caption)
                                .padding(.vertical, 4)
                                .accessibilityElement(children: .combine)
                            }
                        }
                    }
                    .font(.caption)
                    .tint(Theme.brownMuted)
                }
            }
        }
    }

    private func chart(values: [Double], peak: Double) -> some View {
        let scaleMax = DashboardLogic.niceScaleMax(peak, integerOnly: metric == .count)
        let peakIndex = values.firstIndex(of: peak) ?? 0
        let labelled: Set<Int> = [0, buckets.count - 1, peakIndex]
        let keys = buckets.map(\.key)

        return Chart {
            ForEach(Array(buckets.enumerated()), id: \.element.key) { index, bucket in
                BarMark(x: .value("Month", bucket.key), y: .value(title, value(bucket)), width: .ratio(0.8))
                    .foregroundStyle(color)
                    .clipShape(UnevenRoundedRectangle(topLeadingRadius: 4, topTrailingRadius: 4))
                    .annotation(position: .top, spacing: 4) {
                        if index == peakIndex {
                            Text(format(value(bucket)))
                                .font(.caption2.weight(.semibold))
                                .foregroundStyle(Theme.ink)
                        }
                    }
                    .accessibilityLabel(DashboardLogic.monthLabel(bucket.key))
                    .accessibilityValue(format(value(bucket)))
            }
        }
        .chartYScale(domain: 0...scaleMax)
        .chartYAxis {
            AxisMarks(position: .leading, values: [0, scaleMax / 2, scaleMax]) { mark in
                AxisGridLine().foregroundStyle(Theme.borderSoft)
                AxisValueLabel {
                    if let number = mark.as(Double.self) {
                        Text(format(number)).font(.ledger(10, relativeTo: .caption2)).foregroundStyle(Theme.brownMuted)
                    }
                }
            }
        }
        .chartXAxis {
            // Charts sizes each label to one bar's slot, which cut the end
            // dates down to "N" and "…" on a busy chart. The ends hang inward
            // from their bars instead, and the peak's date gives way if it
            // would collide with one; the web's SVG simply lets them overlap.
            AxisMarks(values: labelled.sorted().map { keys[$0] }) { mark in
                let key = mark.as(String.self) ?? ""
                let isFirst = key == keys.first
                let isLast = key == keys.last && !isFirst
                AxisValueLabel(
                    anchor: isFirst ? .topLeading : isLast ? .topTrailing : .top,
                    collisionResolution: .greedy(priority: isFirst || isLast ? 1 : 0, minimumSpacing: 6)
                ) {
                    Text(DashboardLogic.monthLabel(key))
                        .font(.caption2)
                        .foregroundStyle(Theme.brownMuted)
                        .fixedSize()
                }
            }
        }
        .frame(height: 170)
        // Headroom for the peak's label when the peak is the top of the
        // scale, as the web leaves; otherwise it runs into the title.
        .padding(.top, 14)
        .accessibilityLabel(title)
    }
}

// RecentFinds: the twenty most recent finds, newest first. A book with no
// photo keeps its place behind a frame that says so.
struct RecentFinds: View {
    let inventory: [Item]
    @Environment(AppModel.self) private var app

    static let limit = 20

    var body: some View {
        let recent = DashboardLogic.recentFinds(inventory, limit: Self.limit)
        if !recent.isEmpty {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .firstTextBaseline) {
                    SectionHeading("Recent finds")
                    Spacer()
                    Button("See everything") { app.selectedTab = .collection }
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(Theme.green)
                        .underline()
                }
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(alignment: .top, spacing: 16) {
                        ForEach(recent) { item in
                            Button { app.openItem(item.id) } label: {
                                RecentFindCover(item: item)
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Show \"\(item.name.isEmpty ? "this item" : item.name)\" in your collection")
                        }
                    }
                }
            }
            .padding(.top, 32)
        }
    }
}

private struct RecentFindCover: View {
    let item: Item
    @Environment(AppModel.self) private var app

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            ZStack {
                Theme.pill
                if let photo = item.itemPhotos.first {
                    SignedPhoto(path: photo.path, missingLabel: "Photo didn't load")
                } else {
                    MissingPhotoLabel(text: "No photo")
                }
            }
            .frame(width: 128, height: 128 * 4 / 3)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            // Taps too, not just drawing: see CollectionCard's cover.
            .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).strokeBorder(Theme.border))
            .padding(.bottom, 6)
            Text(item.name.isEmpty ? "Untitled item" : item.name)
                .font(.subheadline.weight(.medium))
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
            let credit = ItemsLogic.credit(item)
            Text(credit.isEmpty ? "Unknown maker" : credit)
                .font(.caption)
                .foregroundStyle(Theme.brownSoft)
                .lineLimit(1)
        }
        .frame(width: 128, alignment: .leading)
    }
}

struct MissingPhotoLabel: View {
    let text: String

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "photo").font(.title3)
            Text(text).font(.caption2)
        }
        .foregroundStyle(Theme.brownMuted)
        .accessibilityElement(children: .combine)
    }
}
