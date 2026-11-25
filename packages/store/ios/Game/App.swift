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
        store.controller = self
        store.changed = { [weak self] in self?.game.evaluateJavaScript("dispatchEvent(new Event('pixel-store-purchases-updated'))") }
        store.observe()
        server.start { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure:
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
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        #if DEBUG
        if let scene = StoreTourCapture.requested { StoreTourCapture.waitForScene(in:webView, scene:scene) }
        #endif
        guard let page = webView.url, page.host == "127.0.0.1", ["", "/", "/index.html"].contains(page.path) else { return }
        // A first launch can finish navigation while WebKit's storage service
        // is starting. Reload only an empty shell, never a mounted island.
        let check = DispatchWorkItem { [weak self, weak webView] in
            guard let self, let webView, webView.url == page else { return }
            webView.evaluateJavaScript("document.readyState === 'complete' && document.querySelector('#root')?.childElementCount === 0") { value, _ in
                guard value as? Bool == true, webView.url == page, self.view.window != nil else { return }
                if !self.retriedEmptyPage {
                    self.retriedEmptyPage = true
                    webView.reload()
                } else if self.presentedViewController == nil {
                    let prompt = UIAlertController(title: "Your island is still opening", message: "You can reopen the game using the island saved on this device.", preferredStyle: .alert)
                    prompt.addAction(UIAlertAction(title: "Reopen island", style: .default) { _ in webView.reload() })
                    prompt.addAction(UIAlertAction(title: "Keep waiting", style: .cancel))
                    self.present(prompt, animated: true)
                }
            }
        }
        startupCheck = check
        DispatchQueue.main.asyncAfter(deadline: .now() + 45, execute: check)
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}
