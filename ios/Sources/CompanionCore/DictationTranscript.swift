import Foundation

/// One word or punctuation mark returned by a speech recognizer, positioned
/// on the current recording's timeline.
public struct DictationSegment: Equatable, Sendable {
    public let start: TimeInterval
    public let end: TimeInterval
    public let text: String

    public init(start: TimeInterval, end: TimeInterval, text: String) {
        self.start = start
        self.end = end
        self.text = text
    }
}

/// Reconciles Apple's changing partial hypotheses without duplicating a
/// phrase or erasing an earlier sentence after a pause.
///
/// Speech callbacks are snapshots of the live suffix, not independent
/// append-only chunks. A snapshot may begin at zero (a revision of the whole
/// utterance) or later in the recording (only the newest phrase). Everything
/// definitely before its first timestamp is stable; everything from there on
/// must be replaced by the new snapshot.
public struct DictationTranscript: Sendable {
    private var timeline: [DictationSegment] = []

    public init() {}

    public mutating func reset() {
        timeline.removeAll(keepingCapacity: true)
    }

    @discardableResult
    public mutating func update(with segments: [DictationSegment]) -> String {
        let incoming = segments
            .filter { !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .sorted {
                if abs($0.start - $1.start) < 0.001 { return $0.end < $1.end }
                return $0.start < $1.start
            }
        guard let first = incoming.first else { return text }

        // A recognizer result always describes the current suffix through the
        // newest audio. Retaining old segments *after* that suffix is what
        // caused corrected words and whole sentences to appear twice.
        timeline.removeAll { $0.end > first.start }
        timeline.append(contentsOf: incoming)
        return text
    }

    public var text: String {
        timeline.map(\.text)
            .joined(separator: " ")
            .replacingOccurrences(of: #"\s+([,.!?;:])"#, with: "$1", options: .regularExpression)
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
    }
}
