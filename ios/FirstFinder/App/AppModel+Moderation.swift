import Foundation

// Reporting and blocking. Live mode goes through the site's routes; Sample mode
// keeps blocks in memory and files nothing, so a demo can't reach the real queue.
extension AppModel {
    var blockedSlugs: Set<String> { Set(blocks.compactMap(\.slug)) }

    // What the home page draws. A block has to take effect the moment it's made,
    // without waiting for the shelves to reload.
    var visibleFeaturedShelves: [FeaturedShelf]? {
        featuredShelves.map { ContentReports.visibleShelves($0, blocked: blockedSlugs) }
    }

    func refreshBlocks() async {
        guard dataMode == .live, isOnline, profile != nil,
              let data = try? await store.getSiteJSON(path: "/api/v1/collection-blocks", authorized: true),
              let loaded = try? ContentReports.decodeBlocks(data)
        else { return }
        blocks = loaded
    }

    func report(_ page: ContentReports.PageRef, reason: ContentReports.Reason, details: String) async -> Bool {
        guard isOnline else {
            toasts.push("You're offline. Reporting needs a connection.", tone: .error)
            return false
        }
        do {
            if dataMode == .live {
                let body = try ContentReports.reportBody(page: page, reason: reason, details: details)
                _ = try await store.postSiteJSON(path: "/api/v1/report-collection", body: body)
            }
            toasts.push("Thanks. We'll review this page.", tone: .success)
            return true
        } catch {
            toasts.push(error.localizedDescription, tone: .error)
            return false
        }
    }

    func block(slug: String) async {
        guard isOnline else {
            toasts.push("You're offline. Blocking needs a connection.", tone: .error)
            return
        }
        do {
            if dataMode == .live {
                let body = try ContentReports.blockBody(slug: slug)
                blocks = try ContentReports.decodeBlocks(try await store.postSiteJSON(path: "/api/v1/collection-blocks", body: body))
            } else {
                blocks = [ContentReports.Block(id: UUID().uuidString, slug: slug, title: "A collector")] + blocks
            }
            toasts.push("Blocked. You won't see this collector's pages.", tone: .success)
        } catch {
            toasts.push(error.localizedDescription, tone: .error)
        }
    }

    func unblock(_ block: ContentReports.Block) async {
        guard isOnline else {
            toasts.push("You're offline. Unblocking needs a connection.", tone: .error)
            return
        }
        do {
            if dataMode == .live {
                let body = try ContentReports.unblockBody(id: block.id)
                blocks = try ContentReports.decodeBlocks(try await store.postSiteJSON(path: "/api/v1/collection-blocks", body: body))
            } else {
                blocks.removeAll { $0.id == block.id }
            }
            toasts.push("Unblocked.", tone: .success)
        } catch {
            toasts.push(error.localizedDescription, tone: .error)
        }
    }
}
