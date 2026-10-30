import Foundation

// Port of src/utils/format.js. toNumber is the one place typed text becomes
// arithmetic, so every total inherits its behaviour on blank and malformed
// input: anything unparseable is 0, never a crash or a NaN.

enum Format {
    // Reference numbers are stored as plain integers and shown as FF-0001.
    static func reference(_ number: Int?) -> String {
        guard let number else { return "" }
        let digits = String(number)
        return "FF-" + String(repeating: "0", count: max(0, 4 - digits.count)) + digits
    }

    static func parseReference(_ value: String?) -> Int? {
        let digits = (value ?? "").filter(\.isASCIIDigit)
        guard !digits.isEmpty else { return nil }
        return Int(digits)
    }

    // The UTC calendar date, as new Date().toISOString().slice(0, 10).
    static func todayIso(now: Date = Date()) -> String {
        isoDay.string(from: now)
    }

    // parseFloat(String(value).replace(/[^0-9.-]/g, "")), falling back to 0.
    // parseFloat reads the longest valid prefix, so "1.2.3" is 1.2 and "1-2"
    // is 1; that prefix rule is reproduced here rather than approximated.
    static func toNumber(_ value: String?) -> Decimal {
        let kept = (value ?? "").filter { $0.isASCIIDigit || $0 == "." || $0 == "-" }
        var prefix = ""
        var seenDot = false
        var seenDigit = false
        for (index, character) in kept.enumerated() {
            if character == "-" {
                if index == 0 { prefix.append(character); continue }
                break
            }
            if character == "." {
                if seenDot { break }
                seenDot = true
                prefix.append(character)
                continue
            }
            seenDigit = true
            prefix.append(character)
        }
        guard seenDigit else { return 0 }
        return Decimal(string: prefix, locale: Locale(identifier: "en_US_POSIX")) ?? 0
    }

    static func toNumber(_ value: Decimal?) -> Decimal {
        value ?? 0
    }

    // "$1,234": US dollars, whole dollars, rounded half away from zero as
    // Intl.NumberFormat does. NumberFormatter's default is banker's rounding,
    // which would put $0.50 estimates a dollar off the web's totals.
    static func currency(_ value: Decimal?) -> String {
        currencyFormatter.string(from: NSDecimalNumber(decimal: toNumber(value))) ?? "$0"
    }

    static func currency(_ value: String?) -> String {
        currency(toNumber(value))
    }

    // hasValue: blank and missing are absent; zero is a real value.
    static func hasValue(_ value: String?) -> Bool {
        guard let value else { return false }
        return !value.isEmpty
    }

    static func hasValue(_ value: Decimal?) -> Bool {
        value != nil
    }

    // A form field's text as an optional amount: blank is nil, anything else
    // goes through toNumber. This is the Swift side of the web's
    // `hasValue(x) ? toNumber(x) : null`.
    static func optionalAmount(_ text: String) -> Decimal? {
        hasValue(text) ? toNumber(text) : nil
    }

    // The reverse, for prefilling a field: nil is "", anything else its plain
    // digits, as String(row.estimated_value) on the web.
    static func amountText(_ value: Decimal?) -> String {
        guard let value else { return "" }
        return NSDecimalNumber(decimal: value).stringValue
    }

    // A date picked on the phone, as the YYYY-MM-DD the date columns hold.
    // The phone's own calendar day, not UTC: that's the day the collector picked.
    static func day(_ date: Date) -> String {
        localDay.string(from: date)
    }

    static func parseDay(_ value: String) -> Date? {
        localDay.date(from: String(value.prefix(10)))
    }

    private static let localDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let isoDay: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let currencyFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.locale = Locale(identifier: "en_US")
        formatter.numberStyle = .currency
        formatter.currencyCode = "USD"
        formatter.maximumFractionDigits = 0
        formatter.minimumFractionDigits = 0
        formatter.roundingMode = .halfUp
        return formatter
    }()
}

extension Character {
    var isASCIIDigit: Bool {
        ("0"..."9").contains(self)
    }
}
