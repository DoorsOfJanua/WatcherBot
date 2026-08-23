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
    private var accumulated = ""

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
        accumulated = ""

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
                    self.accumulated = Self.merge(
                        previous: self.accumulated,
                        incoming: result.bestTranscription.formattedString
                    )
                    onTranscript(self.accumulated)
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

    /// SFSpeechRecognizer usually grows one hypothesis, but can restart with
    /// only the newest phrase after a pause. Preserve the earlier phrase while
    /// still accepting ordinary revisions to the words currently being heard.
    private static func merge(previous: String, incoming: String) -> String {
        let before = clean(previous)
        let next = clean(incoming)
        guard !next.isEmpty else { return before }
        guard !before.isEmpty else { return next }

        let oldFolded = before.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
        let newFolded = next.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
        if newFolded.hasPrefix(oldFolded) { return next }
        if oldFolded.hasPrefix(newFolded) { return before }

        let oldWords = before.split(separator: " ").map(String.init)
        let newWords = next.split(separator: " ").map(String.init)
        var prefix = 0
        while prefix < min(oldWords.count, newWords.count), folded(oldWords[prefix]) == folded(newWords[prefix]) {
            prefix += 1
        }
        if prefix >= 2 || (prefix == 1 && min(oldWords.count, newWords.count) <= 3) { return next }

        var overlap = 0
        for size in stride(from: min(oldWords.count, newWords.count, 6), through: 1, by: -1) {
            if oldWords.suffix(size).map(folded) == newWords.prefix(size).map(folded) {
                overlap = size
                break
            }
        }
        let addition = newWords.dropFirst(overlap).joined(separator: " ")
        return addition.isEmpty ? before : "\(before) \(addition)"
    }

    private static func clean(_ value: String) -> String {
        value.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    private static func folded(_ value: String) -> String {
        value.trimmingCharacters(in: .punctuationCharacters)
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
    }
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
