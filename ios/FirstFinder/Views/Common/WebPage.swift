import SwiftUI
import WebKit

// The pages the web builds on its server with the service role -- Explore,
// /c/<slug>, the book guides -- open on the live site, inside native chrome.
// Rebuilding them would mean holding a key no phone may hold.
//
// The web view uses a non-persistent data store: no cookies, cache or local
// storage are written to disk, and all of it is gone when the view closes.
struct WebPage: View {
    let route: WebRoute
    @Environment(AppModel.self) private var app
    @Environment(\.openURL) private var openURL
    @State private var state = WebState()
    @State private var reporting: ContentReports.PageRef?
    @State private var confirmingBlock: ContentReports.PageRef?
    @State private var askingToLogIn = false

    // The shared page on screen, if one is. Someone's own page has nothing to
    // report, and the server would refuse it anyway.
    private var sharedPage: ContentReports.PageRef? {
        guard let page = ContentReports.pageRef(from: state.currentURL ?? url),
              page.slug != app.shareSettings?.slug
        else { return nil }
        return page
    }

    private var blockedOnScreen: Bool {
        sharedPage.map { app.blockedSlugs.contains($0.slug) } ?? false
    }

    var body: some View {
        ZStack {
            if let url {
                WebViewRepresentable(url: url, state: state, blockedSlugs: app.blockedSlugs)
                    .opacity(state.failed == nil && !blockedOnScreen ? 1 : 0)
            }
            if blockedOnScreen {
                BlockedPageCard(block: app.blocks.first { $0.slug == sharedPage?.slug })
            }
            if let failure = state.failed {
                ScrollView {
                    ErrorState(title: "Couldn't open \(route.title)", message: failure) {
                        state.failed = nil
                        state.reloadToken = UUID()
                    }
                    .padding(16)
                }
            } else if state.loading {
                VStack {
                    ProgressView(value: state.progress).tint(Theme.green)
                    Spacer()
                }
            }
        }
        .background(Theme.page)
        .navigationTitle(route.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let url {
                ToolbarItem(placement: .topBarTrailing) {
                    ShareLink(item: url) { Image(systemName: "square.and.arrow.up") }
                        .buttonStyle(.automatic)
                        .accessibilityLabel("Share link")
                }
            }
            if let page = sharedPage, !blockedOnScreen {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Report this page", systemImage: "flag") {
                            if app.profile == nil { askingToLogIn = true } else { reporting = page }
                        }
                        Button("Block this collector", systemImage: "hand.raised", role: .destructive) {
                            if app.profile == nil { askingToLogIn = true } else { confirmingBlock = page }
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel("Report or block")
                }
            }
        }
        .sheet(item: $reporting) { page in
            ReportPageSheet(page: page)
        }
        .confirmationDialog(
            "Block this collector?",
            isPresented: Binding(get: { confirmingBlock != nil }, set: { if !$0 { confirmingBlock = nil } }),
            titleVisibility: .visible,
            presenting: confirmingBlock
        ) { page in
            Button("Block", role: .destructive) { Task { await app.block(slug: page.slug) } }
        } message: { _ in
            Text("Their pages will be hidden from you on Explore and the home page. We're told too, so we can check the page. They aren't told it was you.")
        }
        .alert("Log in to report or block", isPresented: $askingToLogIn) {
            if let email = ContentReports.emailURL(pageURL: state.currentURL ?? url) {
                Button("Email us instead") { openURL(email) }
            }
            Button("OK", role: .cancel) {}
        } message: {
            Text("Reports and blocks belong to an account. Without one, you can email us about this page.")
        }
        .overlay(alignment: .top) {
            if !app.isOnline {
                Text("You're offline. This page needs a connection.")
                    .font(.caption)
                    .padding(8)
                    .frame(maxWidth: .infinity)
                    .background(Theme.warningSurface)
                    .foregroundStyle(Theme.warningInk)
            }
        }
    }

    private var url: URL? {
        let site = (try? app.config.get().siteURL) ?? AppConfig.defaultSiteURL
        return URL(string: route.path, relativeTo: site)?.absoluteURL
    }
}

@MainActor
@Observable
final class WebState {
    var loading = true
    var progress = 0.0
    var failed: String?
    var reloadToken = UUID()
    // Where the page has got to, which is not where it started once a link on
    // Explore has been followed.
    var currentURL: URL?
}

private struct WebViewRepresentable: UIViewRepresentable {
    let url: URL
    let state: WebState
    let blockedSlugs: Set<String>

    func makeCoordinator() -> Coordinator { Coordinator(state: state) }

    // The site's own nav bar and announcement banner, hidden: the phone
    // already draws both above the page, and the nav's "Log in" would start a
    // second sign-in inside a web view that forgets it on close. Both carry
    // the web's print:hidden class -- the site's own marker for "app chrome,
    // not page" -- and the banner is its one Announcement region. Headers a
    // page draws for itself (/c/<slug>, the book guides) are left alone.
    private static let hideSiteChrome = WKUserScript(
        source: """
        (function () {
          var style = document.createElement('style');
          style.textContent = 'nav.print\\\\:hidden, [role="region"][aria-label="Announcement"] { display: none !important; }';
          document.documentElement.appendChild(style);
        })();
        """,
        injectionTime: .atDocumentStart,
        forMainFrameOnly: true
    )

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        Self.installScripts(on: configuration.userContentController, blockedSlugs: blockedSlugs)
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true
        context.coordinator.observe(view)
        view.load(URLRequest(url: url))
        context.coordinator.loadedToken = state.reloadToken
        context.coordinator.appliedBlocks = blockedSlugs
        return view
    }

    private static func installScripts(on controller: WKUserContentController, blockedSlugs: Set<String>) {
        controller.removeAllUserScripts()
        controller.addUserScript(hideSiteChrome)
        if let source = ContentReports.hidingScript(blocked: blockedSlugs) {
            controller.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        if context.coordinator.loadedToken != state.reloadToken {
            context.coordinator.loadedToken = state.reloadToken
            view.load(URLRequest(url: url))
        }
        // A block has to show at once, on the page already open behind this one.
        if context.coordinator.appliedBlocks != blockedSlugs {
            context.coordinator.appliedBlocks = blockedSlugs
            Self.installScripts(on: view.configuration.userContentController, blockedSlugs: blockedSlugs)
            view.reload()
        }
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        let state: WebState
        var loadedToken: UUID?
        var appliedBlocks: Set<String> = []
        private var progressObservation: NSKeyValueObservation?
        private var urlObservation: NSKeyValueObservation?

        init(state: WebState) {
            self.state = state
        }

        func observe(_ view: WKWebView) {
            progressObservation = view.observe(\.estimatedProgress) { [weak self] view, _ in
                let progress = view.estimatedProgress
                Task { @MainActor in self?.state.progress = progress }
            }
            // Observed rather than read when a load finishes: links on these
            // pages move around without a full navigation.
            urlObservation = view.observe(\.url) { [weak self] view, _ in
                let url = view.url
                Task { @MainActor in self?.state.currentURL = url }
            }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            state.loading = true
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            state.loading = false
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: any Error) {
            state.loading = false
            state.failed = error.localizedDescription
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) {
            state.loading = false
            state.failed = error.localizedDescription
        }
    }
}
