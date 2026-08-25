import XCTest
@testable import CompanionCore

final class ComposerDraftsTests: XCTestCase {
    private var defaults: UserDefaults!
    private let suite = "composer-drafts-tests"

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: suite)
        defaults.removePersistentDomain(forName: suite)
    }

    func testDraftsAreKeptPerThreadAndSurviveANewInstance() {
        let drafts = ComposerDrafts(defaults: defaults)
        let long = String(repeating: "a long message that must survive ", count: 100)
        drafts.setDraft(long, forThread: "thread-a")
        drafts.setDraft("other", forThread: "thread-b")

        // a fresh instance (a relaunch) reads the same persisted drafts
        let relaunched = ComposerDrafts(defaults: defaults)
        XCTAssertEqual(relaunched.draft(forThread: "thread-a"), long)
        XCTAssertEqual(relaunched.draft(forThread: "thread-b"), "other")
    }

    func testAnEmptiedComposerDropsItsEntry() {
        let drafts = ComposerDrafts(defaults: defaults)
        drafts.setDraft("typed", forThread: "thread-a")
        drafts.setDraft("", forThread: "thread-a")
        XCTAssertEqual(ComposerDrafts(defaults: defaults).draft(forThread: "thread-a"), "")
        XCTAssertNil(defaults.dictionary(forKey: "composer.drafts")?["thread-a"])
    }

    func testAnUnknownThreadReadsAsEmpty() {
        XCTAssertEqual(ComposerDrafts(defaults: defaults).draft(forThread: "nope"), "")
    }
}
