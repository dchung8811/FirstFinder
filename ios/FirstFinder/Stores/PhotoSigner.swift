import Foundation
import Observation
import UIKit

// Signs photo paths in batches and remembers the answers in memory for as
// long as they're good. The web's fetchSignedPhotoUrls does the same through
// one createSignedUrls call per batch; the difference is that the web keeps
// signed URLs in browser storage, and the phone keeps nothing on disk.
//
// Many SignedPhoto views ask at once as a grid scrolls in, so requests are
// collected for a moment and sent together rather than one call per photo.
@MainActor
@Observable
final class PhotoSigner {
    enum State: Equatable {
        case pending
        case signed(URL)
        // Could not be signed. The view hides the image rather than showing a
        // broken one.
        case failed
    }

    private struct Entry {
        var url: URL
        var expires: Date
    }

    private var signed: [String: Entry] = [:]
    private var failed: Set<String> = []
    private var queued: Set<String> = []
    private var flushTask: Task<Void, Never>?
    private var generation = 0
    @ObservationIgnored private var store: (any CollectionStore)?

    // Re-sign a little before the hour is up, so a URL never expires while
    // its image is still loading.
    private let refreshMargin: TimeInterval = 300

    func attach(_ store: any CollectionStore) {
        self.store = store
        reset()
    }

    func reset() {
        generation += 1
        signed = [:]
        failed = []
        queued = []
        flushTask?.cancel()
        flushTask = nil
    }

    func state(for path: String, now: Date = Date()) -> State {
        if let entry = signed[path], entry.expires.timeIntervalSince(now) > refreshMargin {
            return .signed(entry.url)
        }
        if failed.contains(path) { return .failed }
        return .pending
    }

    func request(_ paths: [String]) {
        let now = Date()
        let needed = paths.filter { path in
            if case .pending = state(for: path, now: now) { return !queued.contains(path) }
            return false
        }
        guard !needed.isEmpty else { return }
        queued.formUnion(needed)
        guard flushTask == nil else { return }
        let started = generation
        flushTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(40))
            await self?.flush(generation: started)
        }
    }

    // "Try again" after a failure: forget the failure and ask once more.
    func retry(_ path: String) {
        failed.subtract([path])
        request([path])
    }

    private func flush(generation started: Int) async {
        guard let store else { return }
        let batch = Array(queued)
        queued = []
        flushTask = nil
        let result = await store.signPhotoURLs(paths: batch)
        // A mode switch or sign-out while this was in flight makes the answer
        // stale; drop it.
        guard started == generation else { return }
        let expires = Date().addingTimeInterval(TimeInterval(PhotoSigning.ttlSeconds))
        for path in batch {
            if let url = result[path] {
                signed[path] = Entry(url: url, expires: expires)
                failed.subtract([path])
            } else {
                failed.formUnion([path])
            }
        }
    }
}

// Fetches image bytes over an ephemeral session and keeps decoded images in
// an NSCache, which lives in memory and is emptied under memory pressure.
// Nothing touches the disk cache: these are photos of people's receipts.
actor ImageLoader {
    static let shared = ImageLoader()

    private let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: configuration)
    }()

    private let cache = NSCache<NSString, UIImage>()

    func image(for url: URL, cacheKey: String) async -> UIImage? {
        if let cached = cache.object(forKey: cacheKey as NSString) { return cached }
        guard let (data, response) = try? await session.data(from: url),
              (response as? HTTPURLResponse)?.statusCode ?? 0 < 400,
              let image = UIImage(data: data)
        else { return nil }
        cache.setObject(image, forKey: cacheKey as NSString)
        return image
    }

    func clear() {
        cache.removeAllObjects()
    }
}
