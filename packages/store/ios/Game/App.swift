import UIKit
import WebKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene:windowScene)
        window.rootViewController = GameController()
        window.makeKeyAndVisible()
        self.window = window
    }
}

final class GameController: UIViewController, WKNavigationDelegate {
    private let server = LocalGameServer()
    private let store = IslandStore()
    private var game: WKWebView!
    private let startupStatus = IslandStartupStatus(frame: .zero)
    private var startupNavigation = 0
    private var startupCheck: DispatchWorkItem?
    private var retriedEmptyPage = false
    override func viewDidLoad() {
        super.viewDidLoad()
        #if DEBUG
        if StoreTourCapture.requested != nil { UIApplication.shared.isIdleTimerDisabled = true }
        #endif
        view.backgroundColor = UIColor(red:0.15,green:0.27,blue:0.23,alpha:1)
        let config = WKWebViewConfiguration()
        config.applicationNameForUserAgent = "PixelCivilizationOffline/1 PixelCivilizationStore/Apple"
        config.preferences.isTextInteractionEnabled = true
        config.userContentController.addScriptMessageHandler(store,contentWorld:.page,name:"pixelBilling")
        game = WKWebView(frame:.zero,configuration:config)
        game.isOpaque = true
        game.backgroundColor = view.backgroundColor
        game.navigationDelegate = self
        game.allowsBackForwardNavigationGestures = true
        game.scrollView.contentInsetAdjustmentBehavior = .never
        game.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(game)
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([game.topAnchor.constraint(equalTo:safe.topAnchor),game.bottomAnchor.constraint(equalTo:safe.bottomAnchor),
                                     game.leadingAnchor.constraint(equalTo:safe.leadingAnchor),game.trailingAnchor.constraint(equalTo:safe.trailingAnchor)])
        view.addSubview(startupStatus)
        startupStatus.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            startupStatus.centerXAnchor.constraint(equalTo: safe.centerXAnchor),
            startupStatus.centerYAnchor.constraint(equalTo: safe.centerYAnchor),
            startupStatus.widthAnchor.constraint(lessThanOrEqualTo: safe.widthAnchor, constant: -28)
        ])
        store.controller = self
        store.changed = { [weak self] in self?.game.evaluateJavaScript("dispatchEvent(new Event('pixel-store-purchases-updated'))") }
        store.observe()
        server.start { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure:
                self.startupStatus.finish()
                let alert = UIAlertController(title:"The island could not open",message:"Close and reopen Pixel Civilization to restart the local game.",preferredStyle:.alert)
                alert.addAction(UIAlertAction(title:"OK",style:.default)); self.present(alert,animated:true)
            case .success:
                let props: [HTTPCookiePropertyKey:Any] = [.name:"pixelLocal",.value:self.server.cookieValue,.domain:"127.0.0.1",.path:"/",
                    .init(rawValue:"HttpOnly"):"TRUE",.init(rawValue:"SameSite"):"Strict"]
                guard let cookie = HTTPCookie(properties:props) else { return }
                self.game.configuration.websiteDataStore.httpCookieStore.setCookie(cookie) {
                    var start = LocalGameServer.origin
                    #if DEBUG
                    if let scene = StoreTourCapture.requested, let route = StoreTourCapture.routes[scene],
                       let target = URL(string:route, relativeTo:start) { start = target }
                    #endif
                    self.game.load(URLRequest(url:start))
                }
            }
        }
    }
    #if DEBUG
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard StoreTourCapture.requested != nil, !startupStatus.isHidden, !startupStatus.bounds.isEmpty,
              let cache = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return }
        let image = UIGraphicsImageRenderer(bounds: startupStatus.bounds).image { context in
            startupStatus.layer.render(in: context.cgContext)
        }
        try? image.pngData()?.write(to: cache.appendingPathComponent("PixelStoreLaunchStatus.png"), options: .atomic)
    }
    #endif
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if url.scheme == "http" && url.host == "127.0.0.1" && url.port == 42871 && !url.path.hasPrefix("/api/") {
            decisionHandler(.allow);return
        }
        if url.absoluteString == "about:blank" { decisionHandler(.allow);return }
        if url.scheme == "https" && action.navigationType == .linkActivated { UIApplication.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        startupCheck?.cancel()
        startupNavigation += 1
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        #if DEBUG
        if let scene = StoreTourCapture.requested { StoreTourCapture.waitForScene(in:webView, scene:scene, launchStatus:startupStatus) }
        #endif
        guard let page = webView.url, page.host == "127.0.0.1", ["", "/", "/index.html"].contains(page.path) else {
            startupStatus.finish()
            return
        }
        startupStatus.show(reopening: retriedEmptyPage)
        watchStartup(webView, navigation: startupNavigation, deadline: Date().addingTimeInterval(45))
    }

    private func watchStartup(_ web: WKWebView, navigation: Int, deadline: Date) {
        // React mounts the account screen or the island in #root. Neither may
        // be reloaded by the recovery timer after it has appeared.
        let check = DispatchWorkItem { [weak self, weak web] in
            guard let self, let web, self.startupNavigation == navigation else { return }
            web.evaluateJavaScript("document.querySelector('#root')?.childElementCount ?? -1") { value, _ in
                guard self.startupNavigation == navigation else { return }
                if let count = value as? Int, count > 0 {
                    self.startupStatus.finish()
                    return
                }
                if Date() < deadline {
                    self.watchStartup(web, navigation: navigation, deadline: deadline)
                } else if self.view.window != nil {
                    if value as? Int == 0 && !self.retriedEmptyPage {
                        self.retriedEmptyPage = true
                        self.startupStatus.show(reopening: true)
                        web.reload()
                    } else if self.presentedViewController == nil {
                        let prompt = UIAlertController(title: "Your island is still opening", message: "You can reopen the game using the island saved on this device.", preferredStyle: .alert)
                        prompt.addAction(UIAlertAction(title: "Reopen island", style: .default) { _ in web.reload() })
                        prompt.addAction(UIAlertAction(title: "Keep waiting", style: .cancel) { _ in
                            self.watchStartup(web, navigation: navigation, deadline: Date().addingTimeInterval(45))
                        })
                        self.present(prompt, animated: true)
                    }
                }
            }
        }
        startupCheck = check
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: check)
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}
