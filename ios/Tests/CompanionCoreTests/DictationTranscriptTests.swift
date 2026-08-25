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

    func testARecognizerClockRestartAppendsInsteadOfErasingTheBeginning() {
        // After a pause the recognizer can restart with ONLY the newest phrase
        // and timestamps near zero. Trusting those timestamps wiped everything
        // spoken before the pause out of the composer.
        var transcript = DictationTranscript()
        transcript.update(with: [
            word("Everything", 0, 0.4),
            word("I", 0.45, 0.5),
            word("said", 0.55, 0.9),
            word("before", 0.95, 1.4),
            word("the", 1.45, 1.55),
            word("pause", 1.6, 2.0),
        ])

        let text = transcript.update(with: [
            word("brand", 0.05, 0.4),
            word("new", 0.45, 0.7),
            word("phrase", 0.75, 1.1),
        ])

        XCTAssertEqual(text, "Everything I said before the pause brand new phrase")
    }

    func testARestartRepeatingTheTrailingWordsDoesNotDuplicateThem() {
        var transcript = DictationTranscript()
        transcript.update(with: [
            word("Open", 0, 0.3),
            word("the", 0.35, 0.45),
            word("door", 0.5, 0.9),
        ])

        let text = transcript.update(with: [
            word("the", 0.02, 0.12),
            word("door", 0.16, 0.5),
            word("is", 0.55, 0.66),
            word("open", 0.7, 1.0),
        ])

        XCTAssertEqual(text, "Open the door is open")
    }

    func testLongDictationSurvivesManyRevisionsIntact() {
        var transcript = DictationTranscript()
        transcript.update(with: [word("The", 0, 0.2), word("first", 0.25, 0.6)])
        transcript.update(with: [
            word("The", 0, 0.2), word("first", 0.25, 0.6), word("part", 0.65, 1.0),
        ])
        transcript.update(with: [word("second", 1.5, 1.9), word("part", 1.95, 2.3)])
        let text = transcript.update(with: [word("third", 2.8, 3.2), word("part", 3.25, 3.6)])
        XCTAssertEqual(text, "The first part second part third part")
    }

    func testARestartOpeningWithTheSameCommonWordStillKeepsTheBeginning() {
        // "I need to check the calendar" … pause … "I will send it now":
        // one shared opener must not make the restart read as a revision.
        var transcript = DictationTranscript()
        transcript.update(with: [
            word("I", 0, 0.1), word("need", 0.15, 0.4), word("to", 0.45, 0.55),
            word("check", 0.6, 0.9), word("the", 0.95, 1.05), word("calendar", 1.1, 1.6),
        ])

        let text = transcript.update(with: [
            word("I", 0.05, 0.15), word("will", 0.2, 0.45), word("send", 0.5, 0.8),
            word("it", 0.85, 0.95), word("now", 1.0, 1.3),
        ])

        XCTAssertEqual(text, "I need to check the calendar I will send it now")
    }

    func testGrowthAfterAClockRestartDoesNotDuplicateThePhrase() {
        var transcript = DictationTranscript()
        transcript.update(with: [
            word("Everything", 0, 0.4), word("said", 0.45, 0.8), word("before", 0.85, 1.3),
        ])
        // clock restarts; the new phrase then GROWS across later partials
        transcript.update(with: [
            word("brand", 0.05, 0.4), word("new", 0.45, 0.7), word("phrase", 0.75, 1.1),
        ])
        transcript.update(with: [
            word("brand", 0.05, 0.4), word("new", 0.45, 0.7), word("phrase", 0.75, 1.1),
            word("keeps", 1.15, 1.5), word("growing", 1.55, 2.0),
        ])
        let text = transcript.update(with: [
            word("brand", 0.05, 0.4), word("new", 0.45, 0.7), word("phrase", 0.75, 1.1),
            word("keeps", 1.15, 1.5), word("growing", 1.55, 2.0),
            word("longer", 2.05, 2.5), word("still", 2.55, 2.9),
        ])
        XCTAssertEqual(text, "Everything said before brand new phrase keeps growing longer still")
    }

    func testARevisionInsideTheRestartedPhraseReplacesInsteadOfAppending() {
        var transcript = DictationTranscript()
        transcript.update(with: [word("First", 0, 0.3), word("part", 0.35, 0.7)])
        transcript.update(with: [word("second", 0.05, 0.4), word("bit", 0.45, 0.7)])
        // the recognizer revises the restarted phrase's wording
        let text = transcript.update(with: [word("second", 0.05, 0.4), word("beat", 0.44, 0.72)])
        XCTAssertEqual(text, "First part second beat")
    }

    func testResetStartsACleanRecording() {
        var transcript = DictationTranscript()
        transcript.update(with: [word("Old", 0, 0.2)])
        transcript.reset()

        XCTAssertEqual(transcript.update(with: [word("New", 0, 0.2)]), "New")
    }
}
