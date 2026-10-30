import Foundation

// Port of src/utils/dashboard.js: bucketing and filtering for the dashboard.
// applyFilters reports how many items it dropped for having no date, because
// silently excluding them would make the totals look wrong for no visible
// reason.
enum DashboardLogic {
    static let monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    struct Bucket: Hashable, Identifiable {
        var key: String
        var count: Int
        var amount: Decimal

        var id: String { key }
    }

    struct Range: Hashable, Identifiable {
        var key: String
        var label: String
        var months: Int?
        var yearToDate = false

        var id: String { key }
    }

    static let ranges = [
        Range(key: "all", label: "All time", months: nil),
        Range(key: "12m", label: "Last 12 months", months: 12),
        Range(key: "3m", label: "Last 3 months", months: 3),
        Range(key: "ytd", label: "This year", months: nil, yearToDate: true),
    ]

    static func monthLabel(_ key: String) -> String {
        let parts = key.split(separator: "-")
        guard parts.count >= 2, let month = Int(parts[1]), (1...12).contains(month) else { return key }
        return "\(monthNames[month - 1]) \(parts[0].suffix(2))"
    }

    // The /^\d{4}-\d{2}/ test the web uses for "has a usable date".
    static func isDated(_ value: String) -> Bool {
        value.range(of: #"^\d{4}-\d{2}"#, options: .regularExpression) != nil
    }

    // Buckets items by month, filling in the months where nothing happened:
    // collapsing them would turn an 18-month gap into a single tick.
    static func monthlyBuckets(_ items: [Item], date: (Item) -> String, amount: (Item) -> Decimal?) -> [Bucket] {
        let rows = items
            .filter { isDated(date($0)) }
            .map { (key: String(date($0).prefix(7)), amount: Format.toNumber(amount($0))) }
        guard let first = rows.map(\.key).min(), let last = rows.map(\.key).max() else { return [] }

        let start = first.split(separator: "-").compactMap { Int($0) }
        let end = last.split(separator: "-").compactMap { Int($0) }
        guard start.count == 2, end.count == 2 else { return [] }
        var (year, month) = (start[0], start[1])
        var buckets: [Bucket] = []
        while (year < end[0] || (year == end[0] && month <= end[1])) && buckets.count < 360 {
            buckets.append(Bucket(key: String(format: "%d-%02d", year, month), count: 0, amount: 0))
            month += 1
            if month > 12 { month = 1; year += 1 }
        }
        var index: [String: Int] = [:]
        for (offset, bucket) in buckets.enumerated() { index[bucket.key] = offset }
        for row in rows {
            guard let offset = index[row.key] else { continue }
            buckets[offset].count += 1
            buckets[offset].amount += row.amount
        }
        return buckets
    }

    // A sold item belongs to the period it sold in; anything still held to the
    // period it was acquired.
    static func dateFor(_ item: Item) -> String {
        item.status == "Sold" ? item.soldDate : item.purchaseDate
    }

    // As dashboardRangeStart: "last N months" is now with the month moved back
    // N, rolling over the way JavaScript's setMonth does (May 31 minus three
    // months is March 3, not February 28), and "this year" is local midnight
    // on January 1.
    static func rangeStart(_ key: String, now: Date = Date(), calendar: Calendar = .current) -> Date? {
        guard let range = ranges.first(where: { $0.key == key }), range.months != nil || range.yearToDate else { return nil }
        var parts = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second, .nanosecond], from: now)
        if range.yearToDate {
            return calendar.date(from: DateComponents(year: parts.year, month: 1, day: 1))
        }
        parts.month = (parts.month ?? 1) - (range.months ?? 0)
        return calendar.date(from: parts)
    }

    // new Date("YYYY-MM-DD") is UTC midnight; new Date("YYYY-MM") is the 1st.
    static func parseDay(_ value: String) -> Date? {
        let digits = value.prefix(10).split(separator: "-").compactMap { Int($0) }
        guard digits.count >= 2 else { return nil }
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        return utc.date(from: DateComponents(year: digits[0], month: digits[1], day: digits.count > 2 ? digits[2] : 1))
    }

    static func applyFilters(_ inventory: [Item], category: String, rangeKey: String, now: Date = Date()) -> (visible: [Item], undatedExcluded: Int) {
        let byCategory = category.isEmpty ? inventory : inventory.filter { $0.category == category }
        guard let start = rangeStart(rangeKey, now: now) else { return (byCategory, 0) }
        var undated = 0
        let visible = byCategory.filter { item in
            let raw = dateFor(item)
            guard isDated(raw), let day = parseDay(raw) else {
                undated += 1
                return false
            }
            return day >= start
        }
        return (visible, undated)
    }

    static func hasFindDate(_ item: Item) -> Bool {
        isDated(item.purchaseDate)
    }

    // Newest find first, by when it was bought, ties broken by which was
    // catalogued last. Sold and undated items are left out.
    static func recentFinds(_ inventory: [Item], limit: Int) -> [Item] {
        let iso = ISO8601DateFormatter()
        let isoFractional = ISO8601DateFormatter()
        isoFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        func saved(_ item: Item) -> Date { iso.date(from: item.savedAt) ?? isoFractional.date(from: item.savedAt) ?? .distantPast }

        return Array(
            inventory
                .filter { $0.status != "Sold" && hasFindDate($0) }
                .sorted { a, b in
                    let left = parseDay(a.purchaseDate) ?? .distantPast
                    let right = parseDay(b.purchaseDate) ?? .distantPast
                    if left != right { return left > right }
                    return saved(a) > saved(b)
                }
                .prefix(limit)
        )
    }

    // niceScaleMax from the chart: a round top for the y axis.
    static func niceScaleMax(_ value: Double, integerOnly: Bool) -> Double {
        if value <= 0 { return integerOnly ? 2 : 1 }
        if integerOnly { return max(2, (value / 2).rounded(.up) * 2) }
        let magnitude = pow(10, floor(log10(value)))
        let step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].first { $0 * magnitude >= value } ?? 10
        return step * magnitude
    }
}
