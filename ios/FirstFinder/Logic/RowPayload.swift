import Foundation

// The body of a write: the columns to set, by their snake_case names, exactly
// as the web's supabase-js calls send them.
//
// Not the Codable row types, because those drop a nil field on encode, and the
// web's writes depend on sending an explicit null: restoring an item sets
// previous_status, sold_price and sold_date to null, and an item with no
// estimate stores estimated_value null, never 0. A payload says "null" when it
// means null.
enum JSONValue: Encodable, Hashable, Sendable {
    case null
    case bool(Bool)
    case int(Int)
    case number(Decimal)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    // nil becomes an explicit null rather than a missing key.
    static func text(_ value: String?) -> JSONValue { value.map(JSONValue.string) ?? .null }
    static func amount(_ value: Decimal?) -> JSONValue { value.map(JSONValue.number) ?? .null }
    static func integer(_ value: Int?) -> JSONValue { value.map(JSONValue.int) ?? .null }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let value): try container.encode(value)
        case .int(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .string(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }
}

typealias RowPayload = [String: JSONValue]
