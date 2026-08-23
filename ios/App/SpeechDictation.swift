import AVFoundation
import Foundation
import Speech

/// Live, on-device dictation for the phone composer. The controller owns the
/// audio tap so ChatView only has to decide where the recognized words go.
@MainActor
final class SpeechDictation: ObservableObject {
    @Published private(set) var isRecording = false

    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var tapInstalled = false
    private var timeline: [SpeechSegment] = []

    func start(onTranscript: @escaping @MainActor (String) -> Void) async throws {
        guard !isRecording else { return }
        let speech = await speechAuthorization()
        guard speech == .authorized else { throw DictationError.speechPermission }
        guard await microphoneAuthorization() else { throw DictationError.microphonePermission }

        let candidates = Locale.preferredLanguages.map(Locale.init(identifier:))
            + [Locale.current, Locale(identifier: "en-US")]
        guard let recognizer = candidates.lazy.compactMap(SFSpeechRecognizer.init(locale:))
            .first(where: \.isAvailable)
        else { throw DictationError.unavailable }

        stop()
        timeline = []

        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: [.duckOthers])
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }
        self.request = request

        let node = engine.inputNode
        let format = node.outputFormat(forBus: 0)
        node.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }
        tapInstalled = true

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            Task { @MainActor in
                guard let self else { return }
                if let result {
                    self.merge(result.bestTranscription.segments)
                    onTranscript(self.renderedTimeline)
                    if result.isFinal { self.stop() }
                } else if error != nil {
                    self.stop()
                }
            }
        }

        engine.prepare()
        do {
            try engine.start()
            isRecording = true
        } catch {
            stop()
            throw DictationError.couldNotStart
        }
    }

    func stop() {
        if engine.isRunning { engine.stop() }
        if tapInstalled {
            engine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        request?.endAudio()
        task?.cancel()
        task = nil
        request = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func speechAuthorization() async -> SFSpeechRecognizerAuthorizationStatus {
        await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
    }

    private func microphoneAuthorization() async -> Bool {
        await withCheckedContinuation { continuation in
            AVAudioApplication.requestRecordPermission { continuation.resume(returning: $0) }
        }
    }

    /// Merge by position in the recording, not by the current text. Apple's
    /// recognizer can restart its visible hypothesis after a pause and return
    /// only the newest phrase. Those words have later timestamps, so they are
    /// appended. Genuine corrections occupy the same audio interval and
    /// replace only that interval.
    private func merge(_ segments: [SFTranscriptionSegment]) {
        guard !segments.isEmpty else { return }
        let incoming = segments.map {
            SpeechSegment(
                start: $0.timestamp,
                end: $0.timestamp + max($0.duration, 0.04),
                text: $0.substring
            )
        }
        guard let first = incoming.first, let last = incoming.last else { return }
        let replacementStart = first.start - 0.08
        let replacementEnd = last.end + 0.08

        // Keep anything clearly before or after the interval Apple supplied.
        // In particular, never delete the earlier sentence merely because a
        // later callback contains only the words spoken after a pause.
        timeline.removeAll { segment in
            segment.start < replacementEnd && segment.end > replacementStart
        }
        timeline.append(contentsOf: incoming)
        timeline.sort { left, right in
            if abs(left.start - right.start) < 0.001 { return left.end < right.end }
            return left.start < right.start
        }
    }

    private var renderedTimeline: String {
        timeline.map(\.text)
            .joined(separator: " ")
            .replacingOccurrences(of: #"\s+([,.!?;:])"#, with: "$1", options: .regularExpression)
            .split(whereSeparator: \.isWhitespace)
            .joined(separator: " ")
    }
}

private struct SpeechSegment {
    let start: TimeInterval
    let end: TimeInterval
    let text: String
}

private enum DictationError: LocalizedError {
    case speechPermission, microphonePermission, unavailable, couldNotStart

    var errorDescription: String? {
        switch self {
        case .speechPermission: "Allow Speech Recognition for The WatcherBot in Settings."
        case .microphonePermission: "Allow microphone access for The WatcherBot in Settings."
        case .unavailable: "Speech recognition is unavailable for your current language."
        case .couldNotStart: "The microphone could not start. Try again."
        }
    }
}
