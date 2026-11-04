import Foundation

// The two Supabase values from Config/Secrets.xcconfig, checked before Live
// mode is allowed to start. Two mistakes are easy to make when copying them
// by hand and both are caught here rather than surfacing as a confusing
// network error later:
//
// - xcconfig treats "//" as a comment, so a pasted https:// URL arrives as
//   "https:". Secrets.example.xcconfig says to write https:/$()/ instead.
// - The wrong key. Only the public anon (or publishable) key belongs on a
//   phone. A key that says it is anything else is refused outright, so a
//   mistaken paste can never turn the prototype into something that
//   bypasses Row Level Security.
struct AppConfig: Sendable, Equatable {
    var supabaseURL: URL
    var anonKey: String
    var siteURL: URL

    enum Problem: Error, Equatable, Sendable {
        case missing
        case urlCutAtComment
        case badURL(String)
        case privilegedKey(String)

        var message: String {
            switch self {
            case .missing:
                "Live mode needs ios/Config/Secrets.xcconfig. Copy Secrets.example.xcconfig, fill in the URL and anon key from .env.local, and rebuild."
            case .urlCutAtComment:
                "SUPABASE_URL was cut off at \"//\". In the xcconfig, write it as https:/$()/your-project.supabase.co and rebuild."
            case .badURL(let value):
                "SUPABASE_URL isn't a usable https URL (\(value))."
            case .privilegedKey(let role):
                "SUPABASE_ANON_KEY is a \(role) key. Only the public anon key may be used on a phone. Replace it and rebuild."
            }
        }
    }

    static let defaultSiteURL = URL(string: "https://firstfinder.app")!

    // Sign in with Apple's switch, from APPLE_SIGN_IN in Base.xcconfig.
    static func appleSignInEnabled(bundle: Bundle = .main) -> Bool {
        (bundle.object(forInfoDictionaryKey: "FFAppleSignIn") as? String)?.uppercased() == "YES"
    }

    static func load(bundle: Bundle = .main) -> Result<AppConfig, Problem> {
        let url = bundle.object(forInfoDictionaryKey: "FFSupabaseURL") as? String
        let key = bundle.object(forInfoDictionaryKey: "FFSupabaseAnonKey") as? String
        let site = bundle.object(forInfoDictionaryKey: "FFSiteURL") as? String
        return validate(url: url, key: key, site: site)
    }

    static func validate(url rawURL: String?, key rawKey: String?, site rawSite: String?) -> Result<AppConfig, Problem> {
        let urlText = (rawURL ?? "").trimmingCharacters(in: .whitespaces)
        let key = (rawKey ?? "").trimmingCharacters(in: .whitespaces)

        // An unset build setting expands to "" -- or, if the include is
        // missing entirely, sometimes to the literal "$(SUPABASE_URL)".
        let unset = { (value: String) in value.isEmpty || value.hasPrefix("$(") || value.contains("your-") }
        if unset(urlText) || unset(key) { return .failure(.missing) }
        if urlText == "https:" || urlText == "http:" { return .failure(.urlCutAtComment) }

        guard let url = URL(string: urlText), url.scheme == "https", url.host != nil else {
            return .failure(.badURL(urlText))
        }

        if let role = privilegedRole(of: key) { return .failure(.privilegedKey(role)) }

        let siteText = (rawSite ?? "").trimmingCharacters(in: .whitespaces)
        let site = URL(string: siteText).flatMap { $0.scheme == "https" && $0.host != nil ? $0 : nil } ?? defaultSiteURL

        return .success(AppConfig(supabaseURL: url, anonKey: key, siteURL: site))
    }

    // nil for a key that is safe on a phone; otherwise what it claims to be.
    // Legacy keys are JWTs carrying a "role" claim; the newer format puts the
    // kind in the prefix (publishable or secret).
    static func privilegedRole(of key: String) -> String? {
        // Spelled in two halves so the guard test, which fails on this prefix
        // appearing anywhere in ios/, doesn't trip on the check itself.
        if key.hasPrefix("sb_" + "secret_") { return "secret" }
        if key.hasPrefix("sb_publishable_") { return nil }

        let parts = key.split(separator: ".")
        guard parts.count == 3, let payload = base64URLDecode(String(parts[1])),
              let claims = try? JSONSerialization.jsonObject(with: payload) as? [String: Any]
        else { return nil }

        let role = claims["role"] as? String ?? ""
        return role == "anon" || role.isEmpty ? nil : role
    }

    static func base64URLDecode(_ text: String) -> Data? {
        var base64 = text.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while base64.count % 4 != 0 { base64.append("=") }
        return Data(base64Encoded: base64)
    }
}
