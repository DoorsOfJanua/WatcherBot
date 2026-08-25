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
    /// Cumulative shift applied to incoming timestamps after the recognizer
    /// restarted its clock mid-recording (a pause does this). Keeping the
    /// offset means every later snapshot from the restarted clock lands on
    /// the same corrected timeline, so its revisions replace the right words
    /// instead of duplicating the whole phrase.
    private var clockOffset: TimeInterval = 0

    public init() {}

    public mutating func reset() {
        timeline.removeAll(keepingCapacity: true)
        clockOffset = 0
    }

    @discardableResult
    public mutating func update(with segments: [DictationSegment]) -> String {
        let incoming = segments
            .filter { !$0.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .sorted {
                if abs($0.start - $1.start) < 0.001 { return $0.end < $1.end }
                return $0.start < $1.start
            }
            .map { shifted($0, by: clockOffset) }
        guard let first = incoming.first else { return text }

        // After a pause the recognizer can restart its CLOCK: it delivers only
        // the newest phrase with timestamps near zero again. Taking those
        // timestamps at face value replaced the whole timeline with that
        // phrase — the beginning of the message vanished from the composer.
        // A clock restart is told apart from a genuine whole-utterance
        // revision by its words: a revision re-reads the words it rewinds
        // over, a restart brings unrelated speech. When in doubt, append —
        // a rare duplicated phrase is recoverable, an erased beginning is not.
        if let last = timeline.last, first.start + 0.05 < last.end {
            let replaced = timeline.filter { $0.end > first.start }
            if !readsAsRevision(of: replaced, incoming: incoming) {
                // a restarted phrase sometimes re-sends words already settled
                let overlap = trailingOverlap(of: incoming)
                if overlap == incoming.count { return text } // pure re-send
                let shift = last.end - first.start + 0.05
                clockOffset += shift
                timeline.append(contentsOf: incoming.dropFirst(overlap).map { shifted($0, by: shift) })
                return text
            }
        }

        // A recognizer result always describes the current suffix through the
        // newest audio. Retaining old segments *after* that suffix is what
        // caused corrected words and whole sentences to appear twice.
        timeline.removeAll { $0.end > first.start }
        timeline.append(contentsOf: incoming)
        return text
    }

    private func shifted(_ segment: DictationSegment, by offset: TimeInterval) -> DictationSegment {
        offset == 0
            ? segment
            : DictationSegment(start: segment.start + offset, end: segment.end + offset, text: segment.text)
    }

    /// Whether `incoming` re-reads the words it rewinds over (a revision)
    /// rather than bringing new speech (a clock restart). Mirrors the
    /// desktop's merge rules: two matching leading words, or one when the
    /// phrase is short enough that a single word IS its opening.
    private func readsAsRevision(of replaced: [DictationSegment], incoming: [DictationSegment]) -> Bool {
        let left = replaced.compactMap(foldedWord)
        let right = incoming.compactMap(foldedWord)
        guard !left.isEmpty, !right.isEmpty else { return true }
        var shared = 0
        while shared < left.count, shared < right.count, left[shared] == right[shared] { shared += 1 }
        return shared >= 2 || (shared == 1 && min(left.count, right.count) <= 3)
    }

    /// How many of `incoming`'s leading segments are already sitting at the
    /// end of the timeline — a restarted phrase sometimes re-sends them.
    private func trailingOverlap(of incoming: [DictationSegment]) -> Int {
        let maximum = min(timeline.count, incoming.count)
        for size in stride(from: maximum, to: 0, by: -1) {
            let matches = zip(timeline.suffix(size), incoming.prefix(size)).allSatisfy { left, right in
                guard let a = foldedWord(left), let b = foldedWord(right) else { return false }
                return a == b
            }
            if matches { return size }
        }
        return 0
    }

    private func foldedWord(_ segment: DictationSegment) -> String? {
        let folded = segment.text.lowercased().trimmingCharacters(
            in: CharacterSet.alphanumerics.inverted
        )
        return folded.isEmpty ? nil : folded
    }

    public var text: String {
        timeline.map(\.text)
            .joined(separator: " ")
            .replacingOccurrences(of: #"\s+([,.!?;:])"#, with: "$1", options: .regularExpression)
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
    }
}
