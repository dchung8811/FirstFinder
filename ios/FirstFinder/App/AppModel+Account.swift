import Foundation

// Feedback and the account page's saves, as the web's FeedbackPage and
// MyAccountPage make them.
extension AppModel {
    // The row first, then any photos under <user>/feedback/<id>/, then the
    // server is asked to triage it and file an issue. That last call isn't
    // awaited into the collector's success: filing is our problem, and the
    // feedback is safely stored either way.
    @discardableResult
    func sendFeedback(_ description: String, photos: [Photo]) async -> Bool {
        let text = description.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            toasts.push("Add a description before sending feedback.", tone: .error)
            return false
        }
        guard let userId = profile?.id else {
            toasts.push("Please log in before sending feedback.", tone: .error)
            return false
        }
        guard isOnline else {
            toasts.push(Self.offlineSaveMessage, tone: .error)
            return false
        }
        isSaving = true
        defer { isSaving = false }

        var row: FeedbackRow
        do {
            row = try await store.insertFeedback(["user_id": .string(userId), "description": .string(text)])
        } catch {
            toasts.push(error.localizedDescription, tone: .error)
            return false
        }

        var failures: [String] = []
        if !photos.isEmpty {
            let result = await upload(photos, folder: "feedback/\(row.id)", kind: "feedback")
            failures = result.failures
            if (try? await store.updateFeedback(id: row.id, ["photos": Writes.photoRecords(result.uploaded), "updated_at": Writes.timestamp(Date())])) != nil {
                row.photos = PhotoColumn(records: result.uploaded.map { .init(path: $0.path, name: $0.name) })
            }
        }

        took(feedback: row)
        let store = store
        let body = (try? JSONEncoder().encode(["id": row.id])) ?? Data()
        Task { _ = try? await store.postSiteJSON(path: "/api/v1/feedback-intake", body: body) }

        if failures.isEmpty {
            toasts.push("Thanks — your feedback was sent.", tone: .success)
        } else {
            toasts.push("Feedback sent, but some photos failed to upload: \(failures.joined(separator: ", ")).", tone: .warning)
        }
        return true
    }

    func saveName(_ name: String) async {
        guard isOnline else { return toasts.push(Self.offlineSaveMessage, tone: .error) }
        isSaving = true
        defer { isSaving = false }
        do {
            took(profile: try await store.updateUserMetadata(["full_name": .string(name.trimmingCharacters(in: .whitespaces))]))
            toasts.push("Name updated.", tone: .success)
        } catch {
            toasts.push(error.localizedDescription, tone: .error)
        }
    }

    // Saves on the tap, like a switch: turning this off has to be at least as
    // easy as turning it on was. The time is recorded alongside, as the web's
    // emailUpdatesMetadata does.
    func setEmailUpdates(_ subscribed: Bool) async {
        guard isOnline else { return toasts.push(Self.offlineSaveMessage, tone: .error) }
        isSaving = true
        defer { isSaving = false }
        do {
            took(profile: try await store.updateUserMetadata([
                "email_updates": .bool(subscribed),
                "email_updates_changed_at": Writes.timestamp(Date()),
            ]))
            toasts.push(subscribed ? "You'll get the occasional update email." : "No more update emails.", tone: .success)
        } catch {
            toasts.push(error.localizedDescription, tone: .error)
        }
    }

    // The server deletes the login, every row and every stored photo. Then
    // this phone forgets it all and signs out. Apple requires this be possible
    // from inside the app.
    @discardableResult
    func deleteAccount() async -> Bool {
        guard isOnline else {
            toasts.push("Could not reach the server to delete your account. Please try again.", tone: .error)
            return false
        }
        isSaving = true
        defer { isSaving = false }
        do {
            _ = try await store.postSiteJSON(path: "/api/v1/delete-account", body: Data("{}".utf8))
        } catch StoreError.notSignedIn {
            toasts.push("Please log in again before deleting your account.", tone: .error)
            return false
        } catch {
            toasts.push(error.localizedDescription.isEmpty ? "Could not delete your account. Please try again." : error.localizedDescription, tone: .error)
            return false
        }
        await signOut()
        selectedTab = .dashboard
        return true
    }
}
