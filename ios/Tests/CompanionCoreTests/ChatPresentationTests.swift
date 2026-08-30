import XCTest
@testable import CompanionCore

final class ChatPresentationTests: XCTestCase {
    func testGeminiBashApprovalNeverUsesTheCommandAsItsHeadlineOrPreview() throws {
        let card = try decodeCard("""
        {
          "title":"Approval needed",
          "subtitle":"curl -s -X POST http://127.0.0.1:3004/api/agents/memecoin-agent-1-2/pause-schedule -d '{}'",
          "options":["Allow","Deny"],
          "requestId":"req-1",
          "tool":"Bash",
          "allowKey":"Bash:curl",
          "held":"This looked destructive, so auto mode stopped to ask."
        }
        """)

        let presentation = CardPresentation.approval(card)
        XCTAssertEqual(presentation.action, "pause ReplyGuy’s schedule")
        XCTAssertEqual(CardPresentation.preview(card), "Wants to pause ReplyGuy’s schedule")
        XCTAssertFalse(presentation.action.contains("curl"))
        XCTAssertFalse(CardPresentation.preview(card).contains("127.0.0.1"))
        XCTAssertEqual(presentation.technicalDetail, card.subtitle)
    }

    func testHarmlessFindCommandIsNotCalledDestructive() throws {
        let card = try decodeCard("""
        {
          "title":"Approval needed",
          "subtitle":"find . -name '*.swift' -print",
          "options":["Allow","Deny"],
          "requestId":"req-1",
          "tool":"Bash"
        }
        """)
        XCTAssertEqual(CardPresentation.approval(card).action, "run a command")
    }

    func testActualAutoApprovedActivityFormIsHumanizedAndRawDetailStaysOptional() throws {
        let activity = try JSONDecoder().decode(ToolActivity.self, from: Data("""
        {"name":"auto-approved Bash:cd (always allowed)","detail":"cd /Users/janua/Projects/ReplyGuy-franz && git status","ok":true}
        """.utf8))
        let presentation = ActivityPresentation.tool(activity)
        XCTAssertEqual(presentation.label, "Approved automatically")
        XCTAssertEqual(presentation.technicalDetail, activity.detail)
        XCTAssertFalse(presentation.failed)
    }

    func testReplyGuyJSONFenceBecomesAReviewDeckInsteadOfCode() throws {
        let source = """
        Ready for review.

        ```reply-drafts
        {"profileId":"cryptocat-btc","title":"2 replies ready","items":[{"id":"d1","author":"kikcharts","post":"$BASECAT","reply":"the one word calls are always the ones i miss","url":"https://x.com/kikcharts/status/1"},{"id":"d2","author":"unaboysweb3","post":"new post","reply":"worth watching","url":"https://x.com/unaboysweb3/status/2"}]}
        ```
        """
        let envelope = try XCTUnwrap(ReplyDraftEnvelope.parse(source))
        XCTAssertEqual(envelope.prose, "Ready for review.")
        XCTAssertEqual(envelope.batch.profileId, "cryptocat-btc")
        XCTAssertEqual(envelope.batch.items.map(\.author), ["kikcharts", "unaboysweb3"])
    }

    func testPartialOrInvalidReplyDeckFallsBackToMarkdown() {
        XCTAssertNil(ReplyDraftEnvelope.parse("```reply-drafts\n{\"profileId\":\"x\"}"))
        XCTAssertNil(ReplyDraftEnvelope.parse("```reply-drafts\n{}\n```"))
    }

    func testArrowOutlineIsProseAndCommandsRemainTechnical() {
        XCTAssertTrue(MarkdownPresentation.isProseFence(
            language: nil,
            text: "Low-Cap Reset\n  ↓ evidence laws\nCoin admission\n  ↓ safety\nThree-lane triangulation\n  ↓ price"
        ))
        XCTAssertFalse(MarkdownPresentation.isProseFence(language: "bash", text: "curl http://localhost"))
        XCTAssertFalse(MarkdownPresentation.isProseFence(language: nil, text: "curl http://localhost"))
    }

    private func decodeCard(_ json: String) throws -> OptionCard {
        try JSONDecoder().decode(OptionCard.self, from: Data(json.utf8))
    }
}
