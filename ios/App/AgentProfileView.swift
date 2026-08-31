import AVFAudio
import CompanionCore
import PhotosUI
import SwiftUI

/// The paired-safe subset of an agent profile. Shared provider keys remain on
/// the computer; the phone sees only configured/not-configured status and the
/// renderer-neutral voice/avatar operations.
struct AgentProfileView: View {
    let bot: Bot

    @EnvironmentObject private var session: Session
    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var title: String
    @State private var description: String
    @State private var notifications: Bool
    @State private var crop: AvatarCrop
    @State private var voice: String
    @State private var speakReplies: Bool
    @State private var spirit: SpiritKind
    @State private var spiritPalette: String
    @State private var spiritGeometry: String
    @State private var spiritTemperament: String
    @State private var photo: PhotosPickerItem?
    @State private var prompt = ""
    @State private var voices: [Voice] = []
    @State private var config: ConfigStatus?
    @State private var busy = false
    @State private var player: AVAudioPlayer?
    @State private var baseline: ProfileFormSnapshot

    init(bot: Bot) {
        self.bot = bot
        _name = State(initialValue: bot.name)
        _title = State(initialValue: bot.title)
        _description = State(initialValue: bot.description)
        _notifications = State(initialValue: bot.notifications)
        _crop = State(initialValue: bot.avatarCrop ?? .mascot)
        _voice = State(initialValue: bot.voice ?? "")
        _speakReplies = State(initialValue: bot.speakReplies == true)
        _spirit = State(initialValue: SpiritKind.forBot(bot) ?? .wormhole)
        _spiritPalette = State(initialValue: bot.spiritPalette ?? "native")
        _spiritGeometry = State(initialValue: bot.spiritGeometry ?? "native")
        _spiritTemperament = State(initialValue: bot.spiritTemperament ?? "native")
        _baseline = State(initialValue: ProfileFormSnapshot(bot: bot))
    }

    private var current: Bot { session.state.bot(bot.id) ?? bot }
    private var imageGenerationReady: Bool { config?.imageGen?.configured == true }
    private var voiceConfigured: Bool { config?.isTTSConfigured == true }
    private var hasWorkspaceDefaultVoice: Bool { config?.hasWorkspaceDefaultVoice == true }
    private var selectedVoiceCanSpeak: Bool { config?.canSpeak(agentVoice: voice) == true }
    /// Which engine's words to use. An unloaded status is ElevenLabs for the
    /// same reason a missing `provider` is: that is the server's own fallback,
    /// and the copy that shipped.
    private var usesSystemVoices: Bool { config?.voiceProvider == .system }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Spacer()
                        BotAvatarView(bot: current, size: 112, state: .happy, animated: true)
                        Spacer()
                    }
                    .listRowBackground(Color.clear)

                    Picker("Shape", selection: $crop) {
                        ForEach(AvatarCrop.allCases, id: \.self) { shape in
                            Text(shape.label).tag(shape)
                        }
                    }
                    .pickerStyle(.segmented)

                    PhotosPicker(selection: $photo, matching: .images) {
                        Label("Upload image", systemImage: "photo.badge.plus")
                    }
                    .disabled(busy)

                    if current.avatarUrl != nil {
                        Button("Use mascot", systemImage: "trash", role: .destructive) {
                            Task { await clearImage() }
                        }
                        .disabled(busy)
                    }
                } header: {
                    Text("Avatar")
                } footer: {
                    Text("PNG, JPEG, GIF, or WebP, up to 10 MB. Images are stored on your paired computer and loaded with this phone's pairing token.")
                }

                Section {
                    TextField("Art direction", text: $prompt, axis: .vertical)
                        .lineLimit(2...5)
                    Button("Generate on computer", systemImage: "sparkles") {
                        Task { await generateImage() }
                    }
                    .disabled(busy || !imageGenerationReady || prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                } header: {
                    Text("Generate an avatar")
                } footer: {
                    Text(imageGenerationReady
                         ? "Generation uses the shared image provider configured on your computer. No provider key is sent to or stored on this phone."
                         : "To generate images, configure the shared image provider in WatcherBotRoom on your computer. Provider keys cannot be added from a phone.")
                }

                Section("Identity") {
                    TextField("Name", text: $name)
                        .textInputAutocapitalization(.words)
                    TextField("Title", text: $title)
                    TextField("What this agent does", text: $description, axis: .vertical)
                        .lineLimit(3...8)
                    Toggle("Agent notifications", isOn: $notifications)
                }

                Section {
                    HStack {
                        Spacer()
                        SpiritAvatar(
                            spirit: spirit,
                            size: 112,
                            state: .happy,
                            animated: true,
                            palette: spiritPalette,
                            geometry: spiritGeometry,
                            temperament: spiritTemperament,
                            label: "Selected living spirit"
                        )
                        Spacer()
                    }
                    .listRowBackground(Color.clear)
                    Picker("Spirit", selection: $spirit) {
                        Text("Wormhole").tag(SpiritKind.wormhole)
                        Text("Sensei").tag(SpiritKind.sensei)
                        Text("Mailman").tag(SpiritKind.mailman)
                        Text("Ganga").tag(SpiritKind.ganga)
                        Text("Signal").tag(SpiritKind.signal)
                        Text("Forge").tag(SpiritKind.forge)
                    }
                    Picker("Color", selection: $spiritPalette) {
                        ForEach(Self.spiritPalettes, id: \.value) { option in
                            Text(option.label).tag(option.value)
                        }
                    }
                    .pickerStyle(.menu)
                    Picker("Geometry", selection: $spiritGeometry) {
                        ForEach(Self.spiritGeometries, id: \.value) { option in
                            Text(option.label).tag(option.value)
                        }
                    }
                    .pickerStyle(.menu)
                    Picker("Temperament", selection: $spiritTemperament) {
                        ForEach(Self.spiritTemperaments, id: \.value) { option in
                            Text(option.label).tag(option.value)
                        }
                    }
                    .pickerStyle(.menu)
                } header: {
                    Text("Living spirit")
                } footer: {
                    Text("This identity is saved on the paired computer and shared by desktop, phone, and rooms.")
                }

                Section {
                    if voiceConfigured {
                        Picker("Voice", selection: $voice) {
                            if hasWorkspaceDefaultVoice {
                                Text("Workspace default").tag("")
                            } else {
                                Text("Choose an agent voice").tag("").disabled(true)
                            }
                            if !voice.isEmpty, !voices.contains(where: { $0.id == voice }) {
                                Text("Current agent voice").tag(voice)
                            }
                            ForEach(voices) { option in
                                VStack(alignment: .leading) {
                                    Text(option.label)
                                    if let detail = option.description { Text(detail) }
                                }
                                .tag(option.id)
                            }
                        }
                        Toggle("Speak replies", isOn: $speakReplies)
                            .disabled(!selectedVoiceCanSpeak)
                        Button("Preview voice", systemImage: "speaker.wave.2") {
                            Task { await previewVoice() }
                        }
                        .disabled(busy || !selectedVoiceCanSpeak)

                        if !hasWorkspaceDefaultVoice, voice.isEmpty {
                            Label("Pick a voice for this agent before enabling speech.", systemImage: "info.circle")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                    } else if usesSystemVoices {
                        Label("Built-in Mac voices are unavailable", systemImage: "speaker.slash")
                            .foregroundStyle(.secondary)
                    } else {
                        Label("ElevenLabs is not configured", systemImage: "speaker.slash")
                            .foregroundStyle(.secondary)
                    }
                } header: {
                    Text("Voice")
                } footer: {
                    if !voiceConfigured {
                        // Under the built-in engine "not configured" is not a
                        // missing credential — there is none — so the remedy
                        // cannot be a key. `providerConfigured` in
                        // `server/tts/index.ts` is reporting that this
                        // computer has no built-in voices to speak with.
                        if usesSystemVoices {
                            Text("Built-in Mac voices need no key, and this computer has none available. Switch the voice engine to ElevenLabs in this agent's profile on the computer to keep using voice.")
                        } else {
                            Text("Add the shared ElevenLabs key in this agent's profile on the computer. The key is never returned to iOS.")
                        }
                    } else if !hasWorkspaceDefaultVoice {
                        if usesSystemVoices {
                            Text("No workspace default voice is selected. Choose an agent-specific voice above; synthesis still uses the built-in Mac voices on your computer.")
                        } else {
                            Text("No workspace default voice is selected. Choose an agent-specific voice above; synthesis still uses the shared ElevenLabs key on your computer.")
                        }
                    } else {
                        Text("The voice choice belongs to this agent. Workspace default uses the shared voice selected on your computer.")
                    }
                }

                Section {
                    Button("Save profile") { Task { await save() } }
                        .disabled(busy || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .navigationTitle("Agent profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } }
            }
            .overlay { if busy { ProgressView().controlSize(.large) } }
            .task {
                async let status = session.configStatus()
                async let options = session.voiceOptions()
                let loadedConfig = await status
                config = loadedConfig
                voices = await options
                if let loadedConfig, !loadedConfig.canSpeak(agentVoice: voice) {
                    speakReplies = false
                }
            }
            .onChange(of: photo) { _, item in
                guard let item else { return }
                Task { await upload(item) }
            }
        }
    }

    private func profilePatch() -> BotProfilePatch {
        let savedSpeakReplies = config.map { $0.canSpeak(agentVoice: voice) && speakReplies } ?? speakReplies
        // Choosing a living spirit is an explicit switch away from a stored
        // uploaded avatar. Clear the image in the same atomic PATCH so the
        // renderer cannot immediately mask the newly selected spirit.
        let spiritChanged = spirit.rawValue != baseline.spirit
        return BotProfilePatch(
            // The shared server contract owns the 100/200/4000 limits. Do not
            // silently apply narrower iOS-only limits to a user's profile.
            name: name == baseline.name ? nil : name.trimmingCharacters(in: .whitespacesAndNewlines),
            title: title == baseline.title ? nil : title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: description == baseline.description
                ? nil : description.trimmingCharacters(in: .whitespacesAndNewlines),
            notifications: notifications == baseline.notifications ? nil : notifications,
            avatarUrl: spiritChanged ? .clear : nil,
            avatarCrop: spiritChanged ? .mascot : (crop == baseline.crop ? nil : crop),
            // Empty is the server's explicit "use workspace default" value;
            // nil would mean the voice field is not part of this patch.
            voice: voice == baseline.voice ? nil : voice,
            speakReplies: savedSpeakReplies == baseline.speakReplies ? nil : savedSpeakReplies,
            spirit: spirit.rawValue == baseline.spirit ? nil : spirit.rawValue,
            spiritPalette: spiritPalette == baseline.spiritPalette ? nil : spiritPalette,
            spiritGeometry: spiritGeometry == baseline.spiritGeometry ? nil : spiritGeometry,
            spiritTemperament: spiritTemperament == baseline.spiritTemperament ? nil : spiritTemperament
        )
    }

    private func save() async {
        busy = true
        if let updated = await session.updateProfile(profilePatch(), for: current) {
            synchronizeForm(with: updated)
        }
        busy = false
    }

    private func clearImage() async {
        busy = true
        defer { busy = false }
        if let updated = await session.updateProfile(
            BotProfilePatch(avatarUrl: .clear, avatarCrop: .mascot),
            for: current
        ) {
            crop = updated.avatarCrop ?? .mascot
            baseline.crop = crop
        }
    }

    private func upload(_ item: PhotosPickerItem) async {
        busy = true
        defer { busy = false; photo = nil }
        guard let data = try? await item.loadTransferable(type: Data.self),
              let mime = Self.imageMIME(data)
        else {
            session.actionError = "Choose a PNG, JPEG, GIF, or WebP image."
            return
        }
        if data.count > 10 * 1_024 * 1_024 {
            session.actionError = "That image is larger than 10 MB."
            return
        }
        let intendedCrop = crop == .mascot ? AvatarCrop.circle : crop
        if let updated = await session.uploadAvatar(data, mime: mime, for: current, crop: intendedCrop) {
            crop = updated.avatarCrop ?? intendedCrop
            baseline.crop = crop
        }
    }

    private func generateImage() async {
        busy = true
        defer { busy = false }
        let intendedCrop = crop == .mascot ? AvatarCrop.circle : crop
        guard let generated = await session.generateAvatar(
            prompt: String(prompt.trimmingCharacters(in: .whitespacesAndNewlines).prefix(400)),
            for: current
        ) else { return }
        // Generation chooses a safe default crop server-side. The selector is
        // the user's explicit choice, so persist it immediately against the
        // returned attachment rather than leaving UI and server out of sync.
        let shapePatch = BotProfilePatch(avatarCrop: intendedCrop)
        if let updated = await session.updateProfile(shapePatch, for: generated) {
            crop = updated.avatarCrop ?? intendedCrop
            baseline.crop = crop
        } else {
            // Generation itself succeeded. Reflect its authoritative fallback
            // rather than claiming the requested crop was persisted.
            crop = generated.avatarCrop ?? .mascot
            baseline.crop = crop
        }
    }

    private func previewVoice() async {
        guard selectedVoiceCanSpeak else {
            session.actionError = "Pick an agent voice or configure a workspace default on your computer first."
            return
        }
        busy = true
        defer { busy = false }
        guard let data = await session.previewVoice(voice, for: current) else { return }
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.playback, mode: .spokenAudio)
            try audioSession.setActive(true)

            let nextPlayer = try AVAudioPlayer(data: data)
            guard nextPlayer.prepareToPlay(), nextPlayer.play() else {
                try? audioSession.setActive(false, options: .notifyOthersOnDeactivation)
                player = nil
                session.actionError = "The generated audio could not be played."
                return
            }
            player = nextPlayer
        } catch {
            player = nil
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            session.actionError = "The generated audio could not be played."
        }
    }

    private static func imageMIME(_ data: Data) -> String? {
        let bytes = [UInt8](data.prefix(12))
        if bytes.starts(with: [0x89, 0x50, 0x4e, 0x47]) { return "image/png" }
        if bytes.starts(with: [0xff, 0xd8, 0xff]) { return "image/jpeg" }
        if bytes.starts(with: Array("GIF8".utf8)) { return "image/gif" }
        if bytes.count >= 12,
           String(bytes: bytes[0..<4], encoding: .ascii) == "RIFF",
           String(bytes: bytes[8..<12], encoding: .ascii) == "WEBP" { return "image/webp" }
        return nil
    }

    private func synchronizeForm(with bot: Bot) {
        name = bot.name
        title = bot.title
        description = bot.description
        notifications = bot.notifications
        crop = bot.avatarCrop ?? .mascot
        voice = bot.voice ?? ""
        speakReplies = bot.speakReplies == true
        spirit = SpiritKind.forBot(bot) ?? .wormhole
        spiritPalette = bot.spiritPalette ?? "native"
        spiritGeometry = bot.spiritGeometry ?? "native"
        spiritTemperament = bot.spiritTemperament ?? "native"
        baseline = ProfileFormSnapshot(bot: bot)
    }

    private struct SpiritOption {
        let value: String
        let label: String
    }

    private static let spiritPalettes = [
        SpiritOption(value: "native", label: "Original"),
        SpiritOption(value: "violet", label: "Violet"),
        SpiritOption(value: "jade", label: "Jade"),
        SpiritOption(value: "rose", label: "Rose"),
        SpiritOption(value: "aqua", label: "Aqua"),
        SpiritOption(value: "azure", label: "Azure"),
        SpiritOption(value: "ember", label: "Ember"),
        SpiritOption(value: "ivory", label: "Ivory"),
        SpiritOption(value: "ultraviolet", label: "Ultraviolet"),
        SpiritOption(value: "solar", label: "Solar"),
        SpiritOption(value: "acid", label: "Acid"),
        SpiritOption(value: "lunar", label: "Lunar"),
        SpiritOption(value: "oilchrome", label: "Oil chrome"),
    ]

    private static let spiritGeometries = [
        SpiritOption(value: "native", label: "Signature"),
        SpiritOption(value: "flower", label: "Flower"),
        SpiritOption(value: "merkaba", label: "Merkaba"),
        SpiritOption(value: "vesica", label: "Vesica"),
        SpiritOption(value: "yantra", label: "Yantra"),
        SpiritOption(value: "seed", label: "Seed"),
        SpiritOption(value: "metatron", label: "Metatron"),
        SpiritOption(value: "lens", label: "Lens"),
        SpiritOption(value: "orbit", label: "Orbit"),
        SpiritOption(value: "constellation", label: "Stars"),
        SpiritOption(value: "torus", label: "Torus"),
        SpiritOption(value: "spiral", label: "Spiral"),
        SpiritOption(value: "lotus", label: "Lotus"),
        SpiritOption(value: "enneagram", label: "Enneagram"),
        SpiritOption(value: "labyrinth", label: "Labyrinth"),
        SpiritOption(value: "portal", label: "Portal"),
    ]

    private static let spiritTemperaments = [
        SpiritOption(value: "native", label: "Signature"),
        SpiritOption(value: "quiet", label: "Quiet"),
        SpiritOption(value: "focused", label: "Focused"),
        SpiritOption(value: "expressive", label: "Expressive"),
        SpiritOption(value: "playful", label: "Playful"),
        SpiritOption(value: "fierce", label: "Fierce"),
        SpiritOption(value: "curious", label: "Curious"),
        SpiritOption(value: "mischievous", label: "Mischievous"),
        SpiritOption(value: "tender", label: "Tender"),
        SpiritOption(value: "mystic", label: "Mystic"),
        SpiritOption(value: "melancholic", label: "Melancholic"),
        SpiritOption(value: "radiant", label: "Radiant"),
    ]
}

private struct ProfileFormSnapshot {
    var name: String
    var title: String
    var description: String
    var notifications: Bool
    var crop: AvatarCrop
    var voice: String
    var speakReplies: Bool
    var spirit: String
    var spiritPalette: String
    var spiritGeometry: String
    var spiritTemperament: String

    init(bot: Bot) {
        name = bot.name
        title = bot.title
        description = bot.description
        notifications = bot.notifications
        crop = bot.avatarCrop ?? .mascot
        voice = bot.voice ?? ""
        speakReplies = bot.speakReplies == true
        spirit = bot.spirit ?? SpiritKind.forBot(bot)?.rawValue ?? SpiritKind.wormhole.rawValue
        spiritPalette = bot.spiritPalette ?? "native"
        spiritGeometry = bot.spiritGeometry ?? "native"
        spiritTemperament = bot.spiritTemperament ?? "native"
    }
}

private extension AvatarCrop {
    var label: String {
        switch self {
        case .mascot: "Mascot"
        case .circle: "Circle"
        case .rounded: "Rounded"
        case .square: "Square"
        }
    }
}
