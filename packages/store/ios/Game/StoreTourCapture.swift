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

    static func waitForScene(in web: WKWebView, scene: String, launchStatus: IslandStartupStatus) {
        guard let directory = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return }
        let id = scene == "street" ? "rome-starter" : "rome-skyline"
        let name = scene == "street" ? "Via delle Vigne" : "Colonia Alta"
        let file = directory.appendingPathComponent("PixelStoreCapture-" + scene)
        let deadline = Date().addingTimeInterval(180)
        // Read only fixture/renderer status. Never collect page text, player data or cookies.
        let expression = """
            (() => {
                const scene = '\(scene)';
                const fonts = document.fonts.status === 'loaded';
                const foreground = document.visibilityState === 'visible';
                const more = document.querySelector('button[data-panel-toggle="more"]');
                const guide = document.querySelector('aside.world-guide')?.getAttribute('aria-label');
                const fixture = guide === '\(name) island guide';
                const world = window.__pixelWorld;
                const frame = world?.renderer?.info?.render?.frame || 0;
                const era = world?.appearanceEra || '';
                const sites = world?.gameState?.elements?.length || 0;
                const game3D = era === 'rome-aqueduct' && world?.gameState?.exampleWorldId === '\(id)' && frame >= 4 && sites > 3;
                const map = document.querySelector('canvas[aria-label="Pixel Civilization island map"]');
                let colors = 0;
                if (map?.width > 50 && map.height > 50) {
                    const sample = document.createElement('canvas');
                    sample.width = sample.height = 24;
                    const ctx = sample.getContext('2d');
                    ctx.drawImage(map, 0, 0, 24, 24);
                    const pixels = ctx.getImageData(0, 0, 24, 24).data;
                    const chart = new Set();
                    for (let i = 0; i < pixels.length; i += 4) {
                        if (pixels[i+3]) chart.add((pixels[i] >> 3) * 1024 + (pixels[i+1] >> 3) * 32 + (pixels[i+2] >> 3));
                    }
                    colors = chart.size;
                }
                const game2D = fixture && colors > 8 && !!document.querySelector('[aria-label="Island map controls"]');
                const handbook = location.pathname === '/handbook.html' && !!document.querySelector('h1');
                const renderer = handbook ? 'handbook' : game3D ? '3d' : game2D ? '2d' : 'loading';
                const visiblePage = scene === 'guide' ? handbook : fixture && more && (game3D || game2D);
                let menu = window.__pixelCaptureMenu || 'start';
                if (scene !== 'guide' && more && (visiblePage || menu !== 'start') && foreground && fonts && menu !== 'passed') {
                    const expanded = more.getAttribute('aria-pressed') === 'true';
                    if (menu === 'start' && !expanded) { more.click(); menu = 'open'; }
                    else if (menu === 'open' && expanded) { more.click(); menu = 'closing'; }
                    else if (menu === 'closing' && !expanded) menu = 'passed';
                    window.__pixelCaptureMenu = menu;
                }
                return {scene,renderer,foreground,fonts,fixture,era,frame,sites,colors,menu,controls:!!more,
                        documentState:document.readyState,rootChildren:document.querySelector('#root')?.childElementCount ?? -1,
                        ready:!!(foreground && fonts && (handbook || (visiblePage && menu === 'passed')))};
            })()
            """
        var attempt = 0
        func inspect() {
            attempt += 1
            web.evaluateJavaScript(expression) { value, error in
                var status = value as? [String: Any] ?? ["ready": false, "evaluationError": error != nil]
                status["foregroundWindow"] = web.window?.isKeyWindow == true
                status["width"] = web.bounds.width
                status["height"] = web.bounds.height
                status["nativeStartupVisible"] = !launchStatus.isHidden
                let ready = status["ready"] as? Bool == true && web.window?.isKeyWindow == true && launchStatus.isHidden
                let last = Date() >= deadline
                if let data = try? JSONSerialization.data(withJSONObject: status, options: [.sortedKeys]) {
                    try? data.write(to: file.appendingPathExtension("json"), options: .atomic)
                }
                if ready || last || attempt == 15 {
                    let options = WKSnapshotConfiguration()
                    options.afterScreenUpdates = true
                    web.takeSnapshot(with: options) { image, _ in
                        if let png = image?.pngData() {
                            try? png.write(to: file.appendingPathExtension("png"), options: .atomic)
                        }
                    }
                }
                if ready {
                    try? Data(scene.utf8).write(to: file, options: .atomic)
                } else if !last {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1, execute: inspect)
                }
            }
        }
        inspect()
    }
}
#endif
