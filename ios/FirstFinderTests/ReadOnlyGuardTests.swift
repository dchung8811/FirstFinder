import Foundation
import XCTest
@testable import FirstFinder

// The prototype signs in to a real account and must never change it. Row
// Level Security would allow writes to the collector's own rows, so the
// database can't enforce this; these tests do, by reading every source file
// under ios/ and failing on anything that could write.
//
// This file is the one place the forbidden spellings may appear, so it skips
// itself. Everything else -- app code, other tests, config -- is scanned.
final class ReadOnlyGuardTests: XCTestCase {
    private static let iosRoot = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()

    private static let thisFile = URL(fileURLWithPath: #filePath).lastPathComponent

    // Supabase calls that write, plus their storage counterparts.
    private static let forbiddenCalls = [
        ".insert(", ".update(", ".upsert(", ".delete(",
        ".upload(", ".remove(", ".move(",
        // Auth calls that change an account or send mail.
        ".signUp(", ".updateUser(", ".resetPasswordForEmail(", ".signInWithOAuth(",
        // Storage listing: the web uses it to repair photo records, which then
        // writes. The prototype has no reason to list anything.
        ".list(",
    ]

    // The API routes that spend money, file issues or delete accounts.
    private static let forbiddenRoutes = [
        "/api/identify-book", "/api/scan-book", "/api/feedback-intake", "/api/delete-account",
    ]

    // Database functions that write. search_book_catalog is the only one the
    // prototype may call; this list is for a clearer failure message, and the
    // .rpc( rule below catches anything not on it either.
    private static let forbiddenFunctions = ["queue_book_suggestion", "claim_identify_call", "claim_scan_call"]

    private static let allowedTables: Set<String> = [
        "inventory_items", "wishlist_items", "shared_collections", "feedback", "book_catalog", "site_banner",
    ]

    func testNoSwiftSourceCanWrite() throws {
        var failures: [String] = []

        for file in try Self.files(withExtensions: ["swift"]) {
            let text = try String(contentsOf: file, encoding: .utf8)
            let name = Self.relative(file)

            for (index, line) in text.components(separatedBy: .newlines).enumerated() {
                let at = "\(name):\(index + 1)"

                for call in Self.forbiddenCalls + Self.forbiddenRoutes + Self.forbiddenFunctions where line.contains(call) {
                    failures.append("\(at) uses \(call)")
                }

                // Any .rpc( other than search_book_catalog.
                for match in Self.matches(#"\.rpc\(\s*"?([^",)\s]*)"#, in: line) where match != "search_book_catalog" {
                    failures.append("\(at) calls rpc \(match.isEmpty ? "(non-literal)" : match)")
                }

                // Tables: only the read list, and only by literal name. The
                // storage bucket is the one non-literal .from( allowed.
                for match in Self.matches(#"\.from\(\s*([^)]*)\)"#, in: line) {
                    let argument = match.trimmingCharacters(in: .whitespaces)
                    if argument == "PhotoSigning.bucket" { continue }
                    let table = argument.trimmingCharacters(in: CharacterSet(charactersIn: "\""))
                    if !argument.hasPrefix("\"") || !Self.allowedTables.contains(table) {
                        failures.append("\(at) reads from \(argument), which is not on the read list")
                    }
                }

                // Every HTTP request the prototype builds is a GET.
                for method in Self.matches(#"httpMethod\s*=\s*"?([A-Za-z]*)"#, in: line) where method != "GET" {
                    failures.append("\(at) sets httpMethod to \(method.isEmpty ? "a non-literal" : method)")
                }
            }
        }

        XCTAssertTrue(failures.isEmpty, "Write paths found in ios/:\n" + failures.joined(separator: "\n"))
    }

    // Only LiveReadStore talks to Supabase. Another file importing it would be
    // a second door the read list doesn't cover.
    func testOnlyLiveReadStoreImportsSupabase() throws {
        let modules = ["Supabase", "Auth", "PostgREST", "Storage", "Realtime", "Functions"]
        var offenders: [String] = []
        for file in try Self.files(withExtensions: ["swift"]) where file.lastPathComponent != "LiveReadStore.swift" {
            let text = try String(contentsOf: file, encoding: .utf8)
            for module in modules where text.contains("import \(module)\n") {
                offenders.append("\(Self.relative(file)) imports \(module)")
            }
        }
        XCTAssertTrue(offenders.isEmpty, offenders.joined(separator: "\n"))
    }

    // The service role key bypasses RLS entirely. It must not appear in ios/
    // in any form: by name, as a new-style secret key, or as a JWT whose role
    // claim says so. Secrets.xcconfig is scanned too, though git ignores it,
    // because that's exactly where a wrong paste would land.
    func testNoServiceRoleKeyAnywhere() throws {
        var failures: [String] = []
        let textExtensions = ["swift", "xcconfig", "plist", "json", "md", "txt", "pbxproj", "entitlements"]

        for file in try Self.files(withExtensions: textExtensions) {
            guard let text = try? String(contentsOf: file, encoding: .utf8) else { continue }
            let name = Self.relative(file)
            let lowered = text.lowercased()

            for marker in ["service_role", "servicerole", "service-role", "sb_secret_"] where lowered.contains(marker) {
                failures.append("\(name) mentions \(marker)")
            }
            for token in Self.matches(#"(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)"#, in: text) {
                if let role = AppConfig.privilegedRole(of: token) {
                    failures.append("\(name) contains a JWT with role \(role)")
                }
            }
        }

        XCTAssertTrue(failures.isEmpty, failures.joined(separator: "\n"))
    }

    // The guard is only worth having if it actually trips. Feed it the
    // spellings it must catch and check each one is seen.
    func testGuardRecognisesWhatItForbids() {
        XCTAssertEqual(Self.matches(#"\.rpc\(\s*"?([^",)\s]*)"#, in: #"client.rpc("queue_book_suggestion", params: p)"#), ["queue_book_suggestion"])
        XCTAssertEqual(Self.matches(#"\.rpc\(\s*"?([^",)\s]*)"#, in: #"client.rpc("search_book_catalog", params: p)"#), ["search_book_catalog"])
        XCTAssertEqual(Self.matches(#"\.from\(\s*([^)]*)\)"#, in: #"client.from("login_events").select()"#), [#""login_events""#])
        XCTAssertEqual(Self.matches(#"httpMethod\s*=\s*"?([A-Za-z]*)"#, in: #"request.httpMethod = "POST""#), ["POST"])
        XCTAssertNotNil(AppConfig.privilegedRole(of: Self.fakeJWT(role: "service_role")))
        XCTAssertNil(AppConfig.privilegedRole(of: Self.fakeJWT(role: "anon")))
    }

    // MARK: Helpers

    private static func files(withExtensions extensions: [String]) throws -> [URL] {
        let skippedDirectories: Set<String> = ["build", "DerivedData", "xcuserdata", ".build", "SourcePackages"]
        guard let enumerator = FileManager.default.enumerator(
            at: iosRoot,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            throw NSError(domain: "ReadOnlyGuard", code: 1, userInfo: [NSLocalizedDescriptionKey: "Can't read \(iosRoot.path)"])
        }

        var found: [URL] = []
        for case let url as URL in enumerator {
            if skippedDirectories.contains(url.lastPathComponent) {
                enumerator.skipDescendants()
                continue
            }
            guard extensions.contains(url.pathExtension), url.lastPathComponent != thisFile else { continue }
            found.append(url)
        }
        XCTAssertFalse(found.isEmpty, "The guard found no files to scan under \(iosRoot.path)")
        return found
    }

    private static func relative(_ url: URL) -> String {
        String(url.path.dropFirst(iosRoot.path.count + 1))
    }

    private static func matches(_ pattern: String, in line: String) -> [String] {
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }
        let range = NSRange(line.startIndex..., in: line)
        return regex.matches(in: line, range: range).compactMap { match in
            Range(match.range(at: 1), in: line).map { String(line[$0]) }
        }
    }

    private static func fakeJWT(role: String) -> String {
        func encode(_ json: String) -> String {
            Data(json.utf8).base64EncodedString()
                .replacingOccurrences(of: "+", with: "-")
                .replacingOccurrences(of: "/", with: "_")
                .replacingOccurrences(of: "=", with: "")
        }
        return encode(#"{"alg":"HS256"}"#) + "." + encode(#"{"role":"\#(role)"}"#) + ".signature"
    }
}
