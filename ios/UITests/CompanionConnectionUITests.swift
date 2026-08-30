import XCTest

final class CompanionConnectionUITests: XCTestCase {
    func testRepairPairingAndSendPreservedGangaDraft() throws {
        let app = XCUIApplication()
        app.launch()

        let confirm = app.buttons["Pair with this computer"]
        XCTAssertTrue(confirm.waitForExistence(timeout: 45), "the repair pairing invitation did not reach the app")
        confirm.tap()

        let connected = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "connected")
        ).firstMatch
        XCTAssertTrue(connected.waitForExistence(timeout: 30), "the repaired pairing did not reach connected state")

        let ganga = app.staticTexts["Ganga"].firstMatch
        XCTAssertTrue(ganga.waitForExistence(timeout: 20), "Ganga did not appear in the repaired roster")
        ganga.tap()

        let composer = app.textViews.firstMatch
        XCTAssertTrue(composer.waitForExistence(timeout: 20), "Ganga composer did not appear")
        let preserved = (composer.value as? String) ?? ""
        XCTAssertTrue(preserved.lowercased().contains("show me the first final document draft"), "the preserved Ganga draft was missing")
        composer.tap()
        composer.typeText("\n")

        XCTAssertTrue(app.staticTexts[preserved].waitForExistence(timeout: 20), "the preserved Ganga message did not appear in chat after Send")
    }

    func testExistingPhysicalPairingReconnects() throws {
        guard ProcessInfo.processInfo.environment["SIMULATOR_DEVICE_NAME"] == nil else {
            throw XCTSkip("This acceptance check is for the installed physical iPhone.")
        }

        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.staticTexts["The WatcherBot"].waitForExistence(timeout: 12), "the installed app did not restore its paired roster")
        let connected = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "connected")
        ).firstMatch
        if !connected.waitForExistence(timeout: 20) {
            let visible = app.staticTexts.allElementsBoundByIndex.map(\.label).filter { !$0.isEmpty }
            XCTFail("the installed iPhone did not reach connected state; visible text: \(visible.joined(separator: " | "))")
        }
    }

    func testPairsLoadsChatsAndSurvivesRelaunch() throws {
        let app = XCUIApplication()
        app.launch()

        // The acceptance runner opens the desktop's short-lived QR deep link
        // after launch. No credential is embedded in source, logs, arguments,
        // or the test result bundle.
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let openLink = springboard.buttons["Open"]
        XCTAssertTrue(openLink.waitForExistence(timeout: 20), "iOS did not present the pairing-link confirmation")
        openLink.tap()

        let confirm = app.buttons["Pair with this computer"]
        guard confirm.waitForExistence(timeout: 20) else {
            XCTFail("the live pairing invitation did not reach the app")
            return
        }
        confirm.tap()

        let connected = app.staticTexts.matching(
            NSPredicate(format: "label CONTAINS[c] %@", "connected")
        ).firstMatch
        XCTAssertTrue(connected.waitForExistence(timeout: 20), "paired app never reached the connected roster")
        XCTAssertTrue(app.staticTexts["The WatcherBot"].exists)

        // The device token must have reached Keychain, not only memory.
        app.terminate()
        app.launch()
        XCTAssertTrue(connected.waitForExistence(timeout: 20), "saved pairing did not reconnect after relaunch")
        XCTAssertTrue(app.staticTexts["The WatcherBot"].exists)
    }
}
