#if DEBUG
import Foundation
import WebKit

/// Visual checks opt in at simulator launch. A marker is emitted only after
/// the installed app has drawn its requested city or displayed its Handbook.
@MainActor
enum StoreTourCapture {
    static let routes = [
        "street": "/#world=rome-starter&era=rome-aqueduct&mode=real&view=0",
        "skyline": "/#world=rome-skyline&era=rome-aqueduct&mode=real&view=0",
        "guide": "/handbook.html"
    ]

    static var requested: String? {
        let args = ProcessInfo.processInfo.arguments
        guard let i = args.firstIndex(of: "-storeTour"), i + 1 < args.count,
              routes[args[i + 1]] != nil else { return nil }
        return args[i + 1]
    }

    static func waitForScene(in web: WKWebView, scene: String) {
        let expected = scene == "street" ? "rome-starter" : "rome-skyline"
        let condition = scene == "guide"
            ? "location.pathname === '/handbook.html' && !!document.querySelector('h1')"
            : """
              window.__pixelWorld?.gameState?.exampleWorldId === '\(expected)' &&
              window.__pixelWorld?.gameState?.elements?.length > 3 &&
              window.__pixelWorld?.renderer?.info?.render?.frame >= 4 &&
              !!document.querySelector('button[data-panel-toggle="more"]')
              """
        let deadline = Date().addingTimeInterval(200)
        let expression = "Boolean(document.fonts.status === 'loaded' && (" + condition + "))"
        func inspect() {
            web.evaluateJavaScript(expression) { value, _ in
                if value as? Bool == true {
                    guard let directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return }
                    let file = directory.appendingPathComponent("PixelStoreCapture-" + scene)
                    do { try Data(scene.utf8).write(to: file, options: .atomic) }
                    catch { NSLog("Could not record simulator readiness: %@", error.localizedDescription) }
                } else if Date() < deadline {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1, execute: inspect)
                }
            }
        }
        inspect()
    }
}
#endif
