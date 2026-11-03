import Foundation
import Observation
import UIKit

// Photos a collector has picked or taken but not saved yet. They wait here,
// in memory, under a "local/..." path that SignedPhoto knows to draw from these
// bytes, until the item they belong to is saved and they're uploaded -- or the
// draft is thrown away and they're forgotten. Nothing here touches the disk.
@MainActor
@Observable
final class PendingPhotos {
    static let prefix = "local/"

    private(set) var bytes: [String: Data] = [:]

    func store(_ data: Data, name: String) -> Photo {
        let path = Self.prefix + UUID().uuidString.lowercased() + "-" + name
        bytes[path] = data
        return Photo(path: path, name: name)
    }

    func forget(_ paths: [String]) {
        for path in paths { bytes[path] = nil }
    }

    func forgetAll() {
        bytes = [:]
    }

    static func isPending(_ photo: Photo) -> Bool {
        photo.path.hasPrefix(prefix)
    }
}

// compressImage on the web: the long edge down to 1,600px, JPEG at 0.82,
// which keeps a phone photo near 200-400 KB instead of several MB. The
// original is kept if it can't be decoded or if compressing doesn't help.
enum PhotoCompression {
    static func jpeg(_ data: Data, maxDimension: CGFloat = 1600, quality: CGFloat = 0.82) -> Data {
        guard let image = UIImage(data: data), image.size.width > 0, image.size.height > 0 else { return data }
        let scale = min(1, maxDimension / max(image.size.width, image.size.height))
        let size = CGSize(width: max(1, (image.size.width * scale).rounded()), height: max(1, (image.size.height * scale).rounded()))
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        // Drawing also bakes in the orientation, so an upright photo stays
        // upright once its EXIF is gone.
        let resized = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        guard let compressed = resized.jpegData(compressionQuality: quality), compressed.count < data.count else { return data }
        return compressed
    }
}
