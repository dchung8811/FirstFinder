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
    @State private var state = WebState()

    var body: some View {
        ZStack {
            if let url {
                WebViewRepresentable(url: url, state: state)
                    .opacity(state.failed == nil ? 1 : 0)
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
                        .accessibilityLabel("Share link")
                }
            }
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
}

private struct WebViewRepresentable: UIViewRepresentable {
    let url: URL
    let state: WebState

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
        configuration.userContentController.addUserScript(Self.hideSiteChrome)
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true
        context.coordinator.observe(view)
        view.load(URLRequest(url: url))
        context.coordinator.loadedToken = state.reloadToken
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {
        if context.coordinator.loadedToken != state.reloadToken {
            context.coordinator.loadedToken = state.reloadToken
            view.load(URLRequest(url: url))
        }
    }

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate {
        let state: WebState
        var loadedToken: UUID?
        private var progressObservation: NSKeyValueObservation?

        init(state: WebState) {
            self.state = state
        }

        func observe(_ view: WKWebView) {
            progressObservation = view.observe(\.estimatedProgress) { [weak self] view, _ in
                let progress = view.estimatedProgress
                Task { @MainActor in self?.state.progress = progress }
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
