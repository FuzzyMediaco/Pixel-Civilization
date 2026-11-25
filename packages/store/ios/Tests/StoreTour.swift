import XCTest

final class StoreTour: XCTestCase {
    func testPlayableIslandsAndHandbook() throws {
        let app = XCUIApplication()
        for (scene, label) in [("street","More"),("skyline","More"),("guide","Handbook")] {
            app.launchArguments = ["-storeTour",scene]
            app.launch()
            let page = app.webViews.firstMatch
            XCTAssertTrue(page.waitForExistence(timeout:45))
            let marker = page.descendants(matching:.any).matching(NSPredicate(format:"label CONTAINS[c] %@",label)).firstMatch
            let ready = marker.waitForExistence(timeout:90)
            if !ready {
                let tree = XCTAttachment(string: app.debugDescription)
                tree.name = scene + " accessibility hierarchy"; tree.lifetime = .keepAlways; add(tree)
            }
            XCTAssertTrue(ready,"The bundled game's \(scene) scene should have its \(label) control")
            let capture = XCTAttachment(screenshot:XCUIScreen.main.screenshot())
            capture.name = "Pixel Civilization - " + scene
            capture.lifetime = .keepAlways
            add(capture)
            app.terminate()
        }
    }
}
