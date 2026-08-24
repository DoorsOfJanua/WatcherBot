import AVFoundation
import CompanionCore
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
    private var transcript = DictationTranscript()
    private var recognitionID: UUID?

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
        transcript.reset()
        let recognitionID = UUID()
        self.recognitionID = recognitionID

        let audioSession = AVAudioSession.sharedInstance()
        try audioSession.setCategory(.record, mode: .measurement, options: [.duckOthers])
        try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.taskHint = .dictation
        request.addsPunctuation = true
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
                guard let self, self.recognitionID == recognitionID else { return }
                if let result {
                    let segments = result.bestTranscription.segments.map {
                        DictationSegment(
                            start: $0.timestamp,
                            end: $0.timestamp + max($0.duration, 0.04),
                            text: $0.substring
                        )
                    }
                    onTranscript(self.transcript.update(with: segments))
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
        recognitionID = nil
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
