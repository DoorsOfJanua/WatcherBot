// Create a persistent The WatcherBot teammate on the phone.
//
// The identity controls mirror the desktop contract: a human-chosen name and
// role, one of the six authored living spirits, and optional visual/personality
// tuning. The Watcher remains the owner's identity rather than a worker choice.
import SwiftUI
import CompanionCore

struct NewAgentSheet: View {
    let created: (Bot) -> Void

    @EnvironmentObject private var session: Session
    @Environment(\.dismiss) private var dismiss
    @FocusState private var nameFocused: Bool

    @State private var name = ""
    @State private var title = ""
    @State private var brief = ""
    @State private var roleTemplates: [AgentRoleTemplate] = []
    @State private var selectedRoleId: String?
    @State private var loadingRoles = true
    @State private var spirit: SpiritKind = .wormhole
    @State private var palette = "native"
    @State private var geometry = "native"
    @State private var temperament = "native"
    @State private var creating = false
    @State private var seededSpirit = false

    private static let spirits: [SpiritChoice] = [
        .init(kind: .wormhole, name: "Wormhole", note: "Depth · synthesis"),
        .init(kind: .sensei, name: "Sensei", note: "Clarity · guidance"),
        .init(kind: .mailman, name: "Mailman", note: "Motion · delivery"),
        .init(kind: .ganga, name: "Ganga", note: "Flow · care"),
        .init(kind: .signal, name: "Signal", note: "Pattern · discovery"),
        .init(kind: .forge, name: "Forge", note: "Building · repair"),
    ]

    private static let palettes: [LabeledValue] = [
        .init(value: "native", label: "Original"),
        .init(value: "violet", label: "Violet"),
        .init(value: "jade", label: "Jade"),
        .init(value: "rose", label: "Rose"),
        .init(value: "aqua", label: "Aqua"),
        .init(value: "azure", label: "Azure"),
        .init(value: "ember", label: "Ember"),
        .init(value: "ivory", label: "Ivory"),
        .init(value: "ultraviolet", label: "Ultraviolet"),
        .init(value: "solar", label: "Solar"),
        .init(value: "acid", label: "Acid"),
        .init(value: "lunar", label: "Lunar"),
        .init(value: "oilchrome", label: "Oil chrome"),
    ]

    private static let geometries: [LabeledValue] = [
        .init(value: "native", label: "Signature"),
        .init(value: "flower", label: "Flower"),
        .init(value: "merkaba", label: "Merkaba"),
        .init(value: "vesica", label: "Vesica"),
        .init(value: "yantra", label: "Yantra"),
        .init(value: "seed", label: "Seed"),
        .init(value: "metatron", label: "Metatron"),
        .init(value: "lens", label: "Lens"),
        .init(value: "orbit", label: "Orbit"),
        .init(value: "constellation", label: "Stars"),
        .init(value: "torus", label: "Torus"),
        .init(value: "spiral", label: "Spiral"),
        .init(value: "lotus", label: "Lotus"),
        .init(value: "enneagram", label: "Enneagram"),
        .init(value: "labyrinth", label: "Labyrinth"),
        .init(value: "portal", label: "Portal"),
    ]

    private static let temperaments: [LabeledValue] = [
        .init(value: "native", label: "Signature"),
        .init(value: "quiet", label: "Quiet"),
        .init(value: "focused", label: "Focused"),
        .init(value: "expressive", label: "Expressive"),
        .init(value: "playful", label: "Playful"),
        .init(value: "fierce", label: "Fierce"),
        .init(value: "curious", label: "Curious"),
        .init(value: "mischievous", label: "Mischievous"),
        .init(value: "tender", label: "Tender"),
        .init(value: "mystic", label: "Mystic"),
        .init(value: "melancholic", label: "Melancholic"),
        .init(value: "radiant", label: "Radiant"),
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(spacing: 10) {
                        SpiritAvatar(
                            spirit: spirit,
                            size: 112,
                            state: .listening,
                            animated: true,
                            palette: palette,
                            geometry: geometry,
                            temperament: temperament,
                            label: "Selected living spirit"
                        )
                        Text("Give them an identity")
                            .font(.system(size: 22, weight: .semibold))
                        Text("Name the teammate you want to return to—not a disposable chat.")
                            .font(.system(size: 13))
                            .foregroundStyle(Color.secondary)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: 320)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
                }
                .listRowBackground(Color.clear)

                Section {
                    NavigationLink {
                        AgentRoleLibraryView(
                            templates: roleTemplates,
                            selectedRoleId: selectedRoleId,
                            choose: chooseRole
                        )
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "books.vertical.fill")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(WatcherTheme.violet)
                                .frame(width: 32, height: 32)
                                .background(WatcherTheme.violet.opacity(0.14), in: Circle())
                            VStack(alignment: .leading, spacing: 2) {
                                Text(selectedRole?.name ?? "Choose a proven role")
                                    .font(.system(size: 14, weight: .semibold))
                                Text(selectedRole?.summary ?? roleLibrarySubtitle)
                                    .font(.system(size: 11.5))
                                    .foregroundStyle(Color.secondary)
                                    .lineLimit(2)
                            }
                        }
                        .padding(.vertical, 3)
                    }
                    .disabled(loadingRoles)

                    if let role = selectedRole {
                        if roleWasEdited {
                            Button {
                                title = role.title
                                brief = role.description
                            } label: {
                                Label("Restore original charter", systemImage: "arrow.counterclockwise")
                            }
                        }
                        Button("Keep this text as a custom role") {
                            selectedRoleId = nil
                        }
                    }
                } header: {
                    Text("Start with a role")
                } footer: {
                    Text("A role copies an editable working charter. It grants no tools, accounts, or permission to act.")
                }

                Section("Identity") {
                    TextField("Name", text: $name)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                        .focused($nameFocused)
                        .onChange(of: name) { _, value in
                            if value.count > 100 { name = String(value.prefix(100)) }
                        }

                    TextField("Role — what does this agent own?", text: $title)
                        .textInputAutocapitalization(.sentences)
                        .onChange(of: title) { _, value in
                            if value.count > 200 { title = String(value.prefix(200)) }
                        }

                    TextField(
                        "Working brief — how should they work, and where should their authority stop?",
                        text: $brief,
                        axis: .vertical
                    )
                    .lineLimit(3...7)
                    .textInputAutocapitalization(.sentences)
                    .onChange(of: brief) { _, value in
                        if value.count > 4_000 { brief = String(value.prefix(4_000)) }
                    }
                }

                Section {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                        ForEach(Self.spirits) { choice in
                            spiritButton(choice)
                        }
                    }
                    .padding(.vertical, 4)
                } header: {
                    Text("Choose a living spirit")
                } footer: {
                    Text("The Watcher is your identity. New teammates choose from the six WatcherBot spirits.")
                }

                Section("Make it yours") {
                    choicePicker("Color", selection: $palette, choices: Self.palettes)
                    choicePicker("Geometry", selection: $geometry, choices: Self.geometries)
                    choicePicker("Temperament", selection: $temperament, choices: Self.temperaments)
                }
            }
            .scrollContentBackground(.hidden)
            .background(WatcherBackdrop())
            .navigationTitle("New agent")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(creating)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        create()
                    } label: {
                        if creating {
                            ProgressView()
                        } else {
                            Text("Create")
                                .fontWeight(.semibold)
                        }
                    }
                    .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || creating)
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .interactiveDismissDisabled(creating)
        .onAppear {
            chooseFirstAvailableSpirit()
            nameFocused = true
        }
        .task {
            guard roleTemplates.isEmpty else {
                loadingRoles = false
                return
            }
            roleTemplates = await session.agentRoleTemplates()
            loadingRoles = false
        }
    }

    private func spiritButton(_ choice: SpiritChoice) -> some View {
        let selected = spirit == choice.kind
        return Button {
            spirit = choice.kind
        } label: {
            HStack(spacing: 8) {
                SpiritAvatar(
                    spirit: choice.kind,
                    size: 52,
                    state: selected ? .listening : .idle,
                    animated: selected,
                    palette: palette,
                    geometry: geometry,
                    temperament: temperament,
                    label: choice.name
                )
                VStack(alignment: .leading, spacing: 2) {
                    Text(choice.name)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.primary)
                    Text(choice.note)
                        .font(.system(size: 10.5))
                        .foregroundStyle(Color.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
            }
            .padding(8)
            .frame(maxWidth: .infinity, minHeight: 70, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(selected ? WatcherTheme.violet.opacity(0.16) : Color.secondary.opacity(0.06))
            )
            .overlay {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(selected ? WatcherTheme.violet : Color.secondary.opacity(0.18), lineWidth: selected ? 2 : 1)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(choice.name), \(choice.note)")
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private func choicePicker(
        _ label: String,
        selection: Binding<String>,
        choices: [LabeledValue]
    ) -> some View {
        Picker(label, selection: selection) {
            ForEach(choices) { choice in
                Text(choice.label).tag(choice.value)
            }
        }
        .pickerStyle(.menu)
    }

    private func chooseFirstAvailableSpirit() {
        guard !seededSpirit else { return }
        let used = Set(session.state.bots.compactMap { bot -> SpiritKind? in
            guard let raw = bot.spirit?.lowercased() else { return nil }
            return SpiritKind(rawValue: raw)
        })
        spirit = Self.spirits.first(where: { !used.contains($0.kind) })?.kind
            ?? Self.spirits[session.state.bots.count % Self.spirits.count].kind
        seededSpirit = true
    }

    private var selectedRole: AgentRoleTemplate? {
        roleTemplates.first { $0.id == selectedRoleId }
    }

    private var roleWasEdited: Bool {
        guard let selectedRole else { return false }
        return title != selectedRole.title || brief != selectedRole.description
    }

    private var roleLibrarySubtitle: String {
        if loadingRoles { return "Loading operating charters…" }
        if roleTemplates.isEmpty { return "Custom agent" }
        return "\(roleTemplates.count) editable operating charters, or stay custom."
    }

    private func chooseRole(_ role: AgentRoleTemplate) {
        title = role.title
        brief = role.description
        selectedRoleId = role.id
    }

    private func create() {
        let chosenName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !chosenName.isEmpty, !creating else { return }
        creating = true
        session.actionError = nil
        let profile = NewAgentProfile(
            name: chosenName,
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            description: brief.trimmingCharacters(in: .whitespacesAndNewlines),
            spirit: spirit.rawValue,
            spiritPalette: palette,
            spiritGeometry: geometry,
            spiritTemperament: temperament,
            color: accentColor
        )
        Task {
            if let bot = await session.createBot(profile: profile) {
                created(bot)
            }
            creating = false
        }
    }

    private var accentColor: String {
        if palette == "native" {
            switch spirit {
            case .wormhole: return "purple"
            case .sensei: return "green"
            case .mailman: return "pink"
            case .ganga: return "teal"
            case .signal: return "blue"
            case .forge: return "orange"
            case .watcher: return "yellow"
            }
        }
        switch palette {
        case "jade", "acid": return "green"
        case "rose": return "pink"
        case "aqua": return "teal"
        case "azure", "lunar": return "blue"
        case "ember", "solar": return "orange"
        case "ivory": return "yellow"
        case "oilchrome": return "cyan"
        default: return "purple"
        }
    }
}

private struct SpiritChoice: Identifiable {
    let kind: SpiritKind
    let name: String
    let note: String
    var id: SpiritKind { kind }
}

private struct LabeledValue: Identifiable {
    let value: String
    let label: String
    var id: String { value }
}

private struct AgentRoleLibraryView: View {
    let templates: [AgentRoleTemplate]
    let selectedRoleId: String?
    let choose: (AgentRoleTemplate) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private static let categories = [
        "coordination", "communication", "research", "creative", "operations", "personal",
    ]

    var body: some View {
        List {
            if visibleTemplates.isEmpty {
                ContentUnavailableView(
                    "No matching role",
                    systemImage: "person.crop.circle.badge.questionmark",
                    description: Text("Try another word, or return and create a custom agent.")
                )
                .listRowBackground(Color.clear)
            } else {
                ForEach(Self.categories, id: \.self) { category in
                    let roles = visibleTemplates.filter { $0.category == category }
                    if !roles.isEmpty {
                        Section(categoryLabel(category)) {
                            ForEach(roles) { role in
                                Button {
                                    choose(role)
                                    dismiss()
                                } label: {
                                    HStack(alignment: .top, spacing: 12) {
                                        VStack(alignment: .leading, spacing: 4) {
                                            Text(role.name)
                                                .font(.system(size: 15, weight: .semibold))
                                                .foregroundStyle(Color.primary)
                                            Text(role.summary)
                                                .font(.system(size: 12))
                                                .foregroundStyle(Color.secondary)
                                                .fixedSize(horizontal: false, vertical: true)
                                        }
                                        Spacer(minLength: 8)
                                        if role.id == selectedRoleId {
                                            Image(systemName: "checkmark.circle.fill")
                                                .foregroundStyle(WatcherTheme.violet)
                                        }
                                    }
                                    .padding(.vertical, 4)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("Role library")
        .navigationBarTitleDisplayMode(.inline)
        .searchable(text: $query, prompt: "Search roles")
    }

    private var visibleTemplates: [AgentRoleTemplate] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return templates }
        return templates.filter { role in
            [role.name, role.title, role.summary, role.category]
                .contains { $0.lowercased().contains(needle) }
        }
    }

    private func categoryLabel(_ value: String) -> String {
        switch value {
        case "coordination": return "Coordination"
        case "communication": return "Communication"
        case "research": return "Research"
        case "creative": return "Creative"
        case "operations": return "Operations"
        case "personal": return "Personal"
        default: return value.capitalized
        }
    }
}
