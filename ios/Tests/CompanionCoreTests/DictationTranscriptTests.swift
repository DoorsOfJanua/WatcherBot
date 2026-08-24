import XCTest
@testable import CompanionCore

final class DictationTranscriptTests: XCTestCase {
    private func word(_ text: String, _ start: TimeInterval, _ end: TimeInterval) -> DictationSegment {
        DictationSegment(start: start, end: end, text: text)
    }

    func testAFullPartialHypothesisReplacesThePreviousWording() {
        var transcript = DictationTranscript()
        transcript.update(with: [word("Send", 0, 0.3), word("three", 0.35, 0.65), word("copies", 0.7, 1)])

        let text = transcript.update(with: [
            word("Send", 0, 0.3),
            word("two", 0.34, 0.62),
            word("copies", 0.68, 0.98),
        ])

        XCTAssertEqual(text, "Send two copies")
    }

    func testANewerPhraseKeepsTheSettledSentenceBeforeIt() {
        var transcript = DictationTranscript()
        transcript.update(with: [
            word("First", 0, 0.3),
            word("sentence", 0.35, 0.8),
            word(".", 0.8, 0.84),
        ])

        let text = transcript.update(with: [
            word("Second", 1.4, 1.75),
            word("sentence", 1.8, 2.2),
            word(".", 2.2, 2.24),
        ])

        XCTAssertEqual(text, "First sentence. Second sentence.")
    }

    func testAShorterRevisionDropsTheOldTailInsteadOfDuplicatingIt() {
        var transcript = DictationTranscript()
        transcript.update(with: [
            word("The", 0, 0.2),
            word("meeting", 0.25, 0.6),
            word("is", 0.65, 0.8),
            word("tomorrow", 0.85, 1.25),
            word("morning", 1.3, 1.7),
        ])

        let text = transcript.update(with: [
            word("is", 0.64, 0.8),
            word("tomorrow", 0.84, 1.24),
        ])

        XCTAssertEqual(text, "The meeting is tomorrow")
    }

    func testResetStartsACleanRecording() {
        var transcript = DictationTranscript()
        transcript.update(with: [word("Old", 0, 0.2)])
        transcript.reset()

        XCTAssertEqual(transcript.update(with: [word("New", 0, 0.2)]), "New")
    }
}
