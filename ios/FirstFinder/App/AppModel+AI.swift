import Foundation

// Research a photo and scan-to-fill, as the screens call them. Live mode sends
// the photos to the site's routes, which hold the model keys, the daily cap
// and every error message; Sample mode answers from FakeAI and spends nothing.
extension AppModel {
    var hasAIPhotoConsent: Bool { AIPhotoConsent.isGranted(userId: profile?.id) }

    func grantAIPhotoConsent() { AIPhotoConsent.grant(userId: profile?.id) }

    func identifyPhotos(_ photos: [Photo]) async throws -> PhotoAI.IdentifyResult {
        guard dataMode == .live else { return try await fakeAI.identify(photoCount: photos.count) }
        guard photos.count <= PhotoAI.maxIdentifyPhotos else {
            throw PhotoAI.Failure(message: "Please use at most \(PhotoAI.maxIdentifyPhotos) photos at a time.")
        }
        let data = try await postPhotos(photos, to: "/api/v1/identify-book")
        let (result, allowance) = try PhotoAI.decodeIdentify(data)
        if let allowance { identifyAllowance = allowance }
        return result
    }

    func scanPhotos(_ photos: [Photo]) async throws -> ScanFill.ScanResult {
        guard dataMode == .live else { return try await fakeAI.scan(photoCount: photos.count) }
        guard photos.count <= PhotoAI.maxScanPhotos else {
            throw PhotoAI.Failure(message: "Please scan at most \(PhotoAI.maxScanPhotos) photos at a time.")
        }
        return try PhotoAI.decodeScan(try await postPhotos(photos, to: "/api/v1/scan-book"))
    }

    // Today's identifications, asked before the camera opens rather than
    // learned by being refused. Advice only: the route enforces the real cap.
    func refreshAllowance() async {
        guard dataMode == .live else {
            identifyAllowance = PhotoAI.Allowance(used: FakeAI.dailyLimit - fakeAI.remainingToday, dailyLimit: FakeAI.dailyLimit, remaining: fakeAI.remainingToday)
            return
        }
        guard isOnline, profile != nil,
              let data = try? await store.getSiteJSON(path: "/api/v1/identify-budget", authorized: true)
        else { return }
        identifyAllowance = PhotoAI.decodeAllowance(data)
    }

    // The picked photos' bytes, compressed off the main thread and sent as
    // data URLs -- the body the web sends. A refusal comes back in the
    // server's own words.
    private func postPhotos(_ photos: [Photo], to path: String) async throws -> Data {
        // The buttons ask first; this is what makes the answer binding on any
        // path to here, including ones added later.
        guard hasAIPhotoConsent else { throw PhotoAI.Failure(message: "Photos go to OpenAI only with your permission. Tap the button again to choose.") }
        guard isOnline else { throw PhotoAI.Failure(message: "You're offline. This needs a connection.") }
        let originals = photos.compactMap { pendingPhotos.bytes[$0.path] }
        guard !originals.isEmpty else { throw PhotoAI.Failure(message: "No photo was included.") }
        let jpegs = await Task.detached(priority: .userInitiated) {
            originals.map { PhotoCompression.jpeg($0, maxDimension: PhotoAI.maxDimension, quality: PhotoAI.quality) }
        }.value
        do {
            return try await store.postSiteJSON(path: path, body: PhotoAI.requestBody(jpegs))
        } catch {
            // A refusal may be the cap; ask again so the count on screen is right.
            Task { await refreshAllowance() }
            throw PhotoAI.Failure(message: error.localizedDescription)
        }
    }
}
