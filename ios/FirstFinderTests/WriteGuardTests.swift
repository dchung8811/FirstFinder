import Foundation
import XCTest
@testable import FirstFinder

// The app writes to a collector's real collection, and Row Level Security is
// the only thing on the server standing between one account and another. So
// the app keeps its own writing narrow, and these tests hold it there by
// reading every source file under ios/:
//
//   - Only Stores/LiveStore.swift may write, and only to the tables, storage
//     bucket and database functions the app needs.
//   - Every call to the site goes to /api/v1, the addresses that stay stable
//     for installed builds (see src/utils/apiV1Wiring.test.js on the web).
//   - The service role key, which bypasses Row Level Security, appears nowhere
//     in any form.
//
// This file is the one place the forbidden spellings may appear, so it skips
// itself. Everything else -- app code, other tests, config -- is scanned.
final class WriteGuardTests: XCTestCase {
    private static let iosRoot = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent()
        .deletingLastPathComponent()

    private static let thisFile = URL(fileURLWithPath: #filePath).lastPathComponent
    private static let writer = "LiveStore.swift"

    // Calls that write, or that list storage. Allowed in LiveStore only.
    private static let writeCalls = [
        ".insert(", ".update(", ".upsert(", ".delete(", ".upload(", ".remove(", ".move(", ".list(", ".rpc(",
    ]

    // Never, anywhere: storage moves, and auth calls that change an account's
    // email or password or send mail. Sign-up and reset come with their own
    // narrower rules when the app gains them.
    private static let forbiddenEverywhere = [
        ".move(", ".signUp(", ".updateUser(", ".resetPasswordForEmail(",
    ]

    // Server-side only: the spending routes call these with the service role.
    private static let forbiddenFunctions = ["claim_identify_call", "claim_scan_call"]

    private static let allowedTables: Set<String> = [
        "inventory_items", "wishlist_items", "shared_collections", "feedback", "book_catalog", "site_banner",
    ]

    private static let allowedFunctions: Set<String> = ["search_book_catalog", "queue_book_suggestion"]

    func testOnlyLiveStoreWritesAndOnlyWhereItShould() throws {
        var failures: [String] = []

        for file in try Self.files(withExtensions: ["swift"]) {
            let text = try String(contentsOf: file, encoding: .utf8)
            let name = Self.relative(file)
            let isWriter = file.lastPathComponent == Self.writer

            for (index, line) in text.components(separatedBy: .newlines).enumerated() {
                let at = "\(name):\(index + 1)"

                if !isWriter {
                    for call in Self.writeCalls where line.contains(call) {
                        failures.append("\(at) uses \(call) outside \(Self.writer)")
                    }
                }
                for call in Self.forbiddenEverywhere + Self.forbiddenFunctions where line.contains(call) {
                    failures.append("\(at) uses \(call)")
                }

                // Google sign-in, in the writer only: a second door into auth
                // elsewhere would be one this test doesn't watch.
                if line.contains(".signInWithOAuth("), !isWriter {
                    failures.append("\(at) starts an OAuth sign-in outside \(Self.writer)")
                }
                if line.contains(".signInWithOAuth("), !line.contains("provider: .google") {
                    failures.append("\(at) starts an OAuth sign-in with a provider other than Google")
                }

                for match in Self.matches(#"\.rpc\(\s*"?([^",)\s]*)"#, in: line) where !Self.allowedFunctions.contains(match) {
                    failures.append("\(at) calls rpc \(match.isEmpty ? "(non-literal)" : match)")
                }

                // Tables by literal name only, from the list. The photo
                // bucket is the one non-literal .from( allowed.
                for match in Self.matches(#"\.from\(\s*([^)]*)\)"#, in: line) {
                    let argument = match.trimmingCharacters(in: .whitespaces)
                    if argument == "PhotoSigning.bucket" { continue }
                    let table = argument.trimmingCharacters(in: CharacterSet(charactersIn: "\""))
                    if !argument.hasPrefix("\"") || !Self.allowedTables.contains(table) {
                        failures.append("\(at) uses table \(argument), which is not on the list")
                    }
                }

                // GETs anywhere; a POST only from the writer.
                for method in Self.matches(#"httpMethod\s*=\s*"?([A-Za-z]*)"#, in: line) {
                    if method == "GET" { continue }
                    if method == "POST", isWriter { continue }
                    failures.append("\(at) sets httpMethod to \(method.isEmpty ? "a non-literal" : method)")
                }

                // Every site path through the stable addresses.
                for path in Self.matches(#""(/api/[A-Za-z0-9/_-]*)"#, in: line) where !path.hasPrefix("/api/v1/") {
                    failures.append("\(at) calls \(path); use /api/v1")
                }
            }
        }

        XCTAssertTrue(failures.isEmpty, "Write paths outside the rules in ios/:\n" + failures.joined(separator: "\n"))
    }

    // Only LiveStore talks to Supabase. Another file importing it would be a
    // second door the rules above don't cover.
    func testOnlyLiveStoreImportsSupabase() throws {
        let modules = ["Supabase", "Auth", "PostgREST", "Storage", "Realtime", "Functions"]
        var offenders: [String] = []
        for file in try Self.files(withExtensions: ["swift"]) where file.lastPathComponent != Self.writer {
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
        XCTAssertEqual(Self.matches(#"\.rpc\(\s*"?([^",)\s]*)"#, in: #"client.rpc("claim_identify_call", params: p)"#), ["claim_identify_call"])
        XCTAssertEqual(Self.matches(#"\.from\(\s*([^)]*)\)"#, in: #"client.from("login_events").select()"#), [#""login_events""#])
        XCTAssertEqual(Self.matches(#"httpMethod\s*=\s*"?([A-Za-z]*)"#, in: #"request.httpMethod = "DELETE""#), ["DELETE"])
        XCTAssertEqual(Self.matches(#""(/api/[A-Za-z0-9/_-]*)"#, in: #"getSiteJSON(path: "/api/admin/stats")"#), ["/api/admin/stats"])
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
            throw NSError(domain: "WriteGuard", code: 1, userInfo: [NSLocalizedDescriptionKey: "Can't read \(iosRoot.path)"])
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
