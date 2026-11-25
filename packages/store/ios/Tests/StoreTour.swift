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
            XCTAssertTrue(marker.waitForExistence(timeout:90),"The bundled game's \(label) control should be available")
            let capture = XCTAttachment(screenshot:XCUIScreen.main.screenshot())
            capture.name = "Pixel Civilization - " + scene
            capture.lifetime = .keepAlways
            add(capture)
            app.terminate()
        }
    }
}
