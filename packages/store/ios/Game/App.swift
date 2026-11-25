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
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red:0.15,green:0.27,blue:0.23,alpha:1)
        let config = WKWebViewConfiguration()
        config.applicationNameForUserAgent = "PixelCivilizationOffline/1 PixelCivilizationStore/Apple"
        config.preferences.isTextInteractionEnabled = true
        config.userContentController.addScriptMessageHandler(store,contentWorld:.page,name:"pixelBilling")
        game = WKWebView(frame:.zero,configuration:config)
        game.isOpaque = false
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
                    let args = ProcessInfo.processInfo.arguments
                    if let index = args.firstIndex(of:"-storeTour"), index + 1 < args.count {
                        let routes = ["street":"/#world=rome-starter&era=original&mode=real&view=0",
                                      "skyline":"/#world=rome-skyline&era=original&mode=real&view=0",
                                      "guide":"/handbook.html"]
                        if let route = routes[args[index+1]], let target = URL(string:route,relativeTo:start) { start = target }
                    }
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
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}
