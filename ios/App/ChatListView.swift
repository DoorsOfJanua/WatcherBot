// The roster.
//
// Messages-shaped: a glass header, your groups across the top, every bot
// below with the unread dot in the bot's own colour at the left edge, and a
// glass bar floating at the bottom. The bar's pill is Updates — only the
// bots that need you, are working, or have something you have not read —
// beside round search and new-bot buttons. Everything scrolls under the
// glass, which is the whole point of the glass.
import SwiftUI
import CompanionCore

struct ChatListView: View {
    @EnvironmentObject private var session: Session
    @State private var query = ""
    /// Driven so that making a bot can open it. Value-based navigation alone
    /// cannot push without a tap, and a new bot appearing silently at the
    /// bottom of the roster is a poor answer to pressing +.
    @State private var path = NavigationPath()
    @State private var searchHits: [SearchHit] = []
    @State private var searching = false
    @State private var searchOpen = false
    @State private var showingUpdates = false
    @State private var showingNewAgent = false
    @State private var showingNewGroup = false
    @State private var folderBot: Bot?
    @AppStorage("watcher.sidebar.roomsCollapsed") private var roomsCollapsed = false
    @AppStorage("watcher.sidebar.collapsedFolders") private var collapsedFoldersJSON = "[]"
    @FocusState private var searchFocused: Bool

    /// Room for the floating bar, so the last row can scroll clear of it.
    private static let barClearance: CGFloat = 96

    var body: some View {
        NavigationStack(path: $path) {
            GeometryReader { geo in
            VStack(spacing: 0) {
                header
                StatusBanner()

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 0) {
                        if query.isEmpty {
                            roomsSection
                            agentSections
                        }

                        if !query.isEmpty, !searchHits.isEmpty {
                            HStack {
                                sectionLabel("Messages")
                                Spacer()
                                if searching { ProgressView().controlSize(.small) }
                            }
                            .padding(.top, 10)
                            .padding(.bottom, 4)

                            ForEach(searchHits) { hit in
                                Button {
                                    Task {
                                        if let chat = await session.open(hit) { path.append(chat) }
                                    }
                                } label: {
                                    SearchHitRow(hit: hit)
                                }
                                .buttonStyle(.plain)
                                .padding(.horizontal, 16)
                            }
                            sectionLabel("Chats")
                                .padding(.top, 14)
                                .padding(.bottom, 4)
                        }

                        if !query.isEmpty {
                            let rows = chats
                            ForEach(Array(rows.enumerated()), id: \.element.id) { index, summary in
                                chatLink(summary, last: index == rows.count - 1)
                            }
                        }
                    }
                    .padding(.bottom, Self.barClearance)
                }
                .refreshable { await session.refresh() }
                .overlay {
                    if chats.isEmpty && searchHits.isEmpty {
                        ContentUnavailableView(
                            query.isEmpty ? "No agents yet" : "Nothing matches",
                            systemImage: query.isEmpty ? "sparkles" : "magnifyingglass",
                            description: Text(
                                query.isEmpty
                                    ? "Create a teammate, name them, and choose their living spirit."
                                    : "No chat matches \u{201C}\(query)\u{201D}."
                            )
                        )
                    }
                }
            }
            // top-aligned: the roster fills downward from the header
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .background(WatcherBackdrop())
            .overlay(alignment: .bottom) { bottomBar }
            // a bot that stopped for you grows out of the island
            .overlay(alignment: .top) {
                NeedsYouIsland(
                    update: session.state.updates.first { $0.kind == .needsYou },
                    hasIsland: IslandGeometry.hasIsland(topInset: geo.safeAreaInsets.top)
                ) { chat in path.append(chat) }
            }
            }
            .toolbar(.hidden, for: .navigationBar)
            .navigationDestination(for: Chat.self) { ChatView(chat: $0) }
            .onChange(of: session.notificationChat) { _, chat in
                guard let chat else { return }
                path.append(chat)
                session.consumeNotificationChat()
            }
            .task {
                if let chat = session.notificationChat {
                    path.append(chat)
                    session.consumeNotificationChat()
                }
            }
#if DEBUG
            // `-store-preview -open-first`: land on the first chat, for the
            // screenshot harness and for looking at the chat screen without
            // a pairing.
            .task {
                if ProcessInfo.processInfo.arguments.contains("-open-first"),
                   path.isEmpty, let first = chats.first {
                    path.append(first.chat)
                }
            }
#endif
            .sheet(isPresented: $showingUpdates) {
                UpdatesSheet { chat in
                    showingUpdates = false
                    path.append(chat)
                }
            }
            .sheet(isPresented: $showingNewGroup) {
                NewGroupSheet { room in
                    showingNewGroup = false
                    path.append(Chat.room(room))
                }
            }
            .sheet(isPresented: $showingNewAgent) {
                NewAgentSheet { bot in
                    showingNewAgent = false
                    path.append(Chat.bot(bot))
                }
            }
            .sheet(item: $folderBot) { bot in
                AgentFolderSheet(bot: bot, folders: folderNames)
            }
            .task(id: query) {
                let expected = query
                guard expected.trimmingCharacters(in: .whitespacesAndNewlines).count >= 2 else {
                    searchHits = []
                    searching = false
                    return
                }
                searching = true
                try? await Task.sleep(for: .milliseconds(250))
                guard !Task.isCancelled, query == expected else { return }
                searchHits = await session.search(expected)
                searching = false
            }
        }
    }

    // MARK: - Header

    /// You (the computer you are paired with) on the left, settings on the
    /// right, and where you are in between. Glass tiles, like the system's.
    private var header: some View {
        HStack(alignment: .center) {
            NavigationLink { SettingsView() } label: {
                ProfileAvatar(name: session.connection?.name ?? "You", size: 30)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .glassCapsule()
            .accessibilityLabel("Settings")

            Spacer(minLength: 8)

            VStack(spacing: 2) {
                Text("The WatcherBot")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(WatcherTheme.ivory)
                Text(headerSubtitle)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.secondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 8)

            NavigationLink { SettingsView() } label: {
                Image(systemName: "gearshape")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(Color.primary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .glassCapsule()
            .accessibilityLabel("Settings")
        }
        .padding(.horizontal, 16)
        .padding(.top, 4)
        .padding(.bottom, 12)
    }

    private var headerSubtitle: String {
        let name = session.connection?.name ?? "Not paired"
        switch session.status {
        case .live: return "\(name) · connected"
        case .connecting: return "\(name) · connecting…"
        case .offline: return "\(name) · offline"
        case .unauthorized: return "\(name) · unpaired"
        case .unpaired: return "Not paired"
        }
    }

    // MARK: - Rooms and agents

    private var roomsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            collapsibleLabel(
                "Rooms",
                count: session.state.rooms.count,
                expanded: !roomsCollapsed,
                active: session.state.rooms.contains { $0.unread || $0.busyBotId != nil }
            ) {
                withAnimation(.snappy(duration: 0.22)) { roomsCollapsed.toggle() }
            } trailing: {
                Button { showingNewGroup = true } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 15, weight: .semibold))
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("New room")
            }

            if !roomsCollapsed {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(session.state.rooms) { room in
                            NavigationLink(value: Chat.room(room)) {
                                GroupTile(room: room)
                            }
                            .buttonStyle(.plain)
                        }
                        Button {
                            showingNewGroup = true
                        } label: {
                            GroupTile(room: nil)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("New room")
                    }
                    .padding(.horizontal, 16)
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.top, 2)
        .animation(.snappy(duration: 0.22), value: roomsCollapsed)
    }

    @ViewBuilder
    private var agentSections: some View {
        if !pinnedAgents.isEmpty {
            sectionLabel("Pinned", count: pinnedAgents.count)
                .padding(.top, 18)
                .padding(.bottom, 4)
            ForEach(Array(pinnedAgents.enumerated()), id: \.element.id) { index, summary in
                agentRow(summary, last: index == pinnedAgents.count - 1)
            }
        }

        if !unfiledAgents.isEmpty {
            sectionLabel("Agents", count: unfiledAgents.count)
                .padding(.top, pinnedAgents.isEmpty ? 18 : 12)
                .padding(.bottom, 4)
            ForEach(Array(unfiledAgents.enumerated()), id: \.element.id) { index, summary in
                agentRow(summary, last: index == unfiledAgents.count - 1)
            }
        }

        ForEach(folderNames, id: \.self) { folder in
            let rows = agents(in: folder)
            let expanded = !collapsedFolders.contains(folder)
            collapsibleLabel(
                folder,
                count: rows.count,
                expanded: expanded,
                active: rows.contains { $0.chat.unread || $0.chat.busy }
            ) {
                toggleFolder(folder)
            }
            .padding(.top, 10)

            if expanded {
                ForEach(Array(rows.enumerated()), id: \.element.id) { index, summary in
                    agentRow(summary, last: index == rows.count - 1)
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }

    // MARK: - Bottom bar

    private var bottomBar: some View {
        GlassGroup(spacing: 8) {
            HStack(spacing: 8) {
                if searchOpen {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .font(.system(size: 15, weight: .semibold))
                            .foregroundStyle(Color.secondary)
                        TextField("Search chats", text: $query)
                            .font(.system(size: 17))
                            .submitLabel(.search)
                            .autocorrectionDisabled()
                            .focused($searchFocused)
                        if !query.isEmpty {
                            Button {
                                query = ""
                            } label: {
                                Image(systemName: "xmark.circle.fill").foregroundStyle(Color.secondary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 16)
                    .frame(height: 52)
                    .glassCapsule()

                    Button("Cancel") {
                        query = ""
                        searchOpen = false
                        searchFocused = false
                    }
                    .font(.system(size: 17))
                    .foregroundStyle(Color.primary)
                    .padding(.horizontal, 16)
                    .frame(height: 52)
                    .glassCapsule()
                } else {
                    UpdatesPill(updates: session.state.updates) { showingUpdates = true }
                        .frame(height: 52)

                    GlassButton(systemImage: "magnifyingglass", size: 48, weight: .semibold) {
                        searchOpen = true
                        searchFocused = true
                    }
                    .accessibilityLabel("Search")

                    GlassButton(systemImage: "square.and.pencil", size: 48, weight: .medium) {
                        showingNewAgent = true
                    }
                    .accessibilityLabel("New agent")
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .animation(.snappy(duration: 0.25), value: searchOpen)
    }

    // MARK: - Data

    private var chats: [ChatSummary] {
        let all = session.state.chatSummaries
        guard !query.isEmpty else {
            // rooms live in the strip; the list is bots
            return all.filter { if case .bot = $0.chat { return true } else { return false } }
        }
        return all.filter {
            $0.chat.name.localizedCaseInsensitiveContains(query)
                || $0.chat.subtitle.localizedCaseInsensitiveContains(query)
                || $0.preview.localizedCaseInsensitiveContains(query)
        }
    }

    private var botChats: [ChatSummary] {
        session.state.chatSummaries.filter { if case .bot = $0.chat { return true } else { return false } }
    }

    private var pinnedAgents: [ChatSummary] {
        botChats.filter { if case let .bot(bot) = $0.chat { return bot.pinned == true } else { return false } }
    }

    private var unfiledAgents: [ChatSummary] {
        botChats.filter {
            if case let .bot(bot) = $0.chat { return bot.pinned != true && normalizedFolder(bot.section) == nil }
            return false
        }
    }

    private var folderNames: [String] {
        Array(Set(session.state.bots.compactMap { bot in
            bot.hidden == true ? nil : normalizedFolder(bot.section)
        })).sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }

    private func agents(in folder: String) -> [ChatSummary] {
        botChats.filter {
            if case let .bot(bot) = $0.chat { return bot.pinned != true && normalizedFolder(bot.section) == folder }
            return false
        }
    }

    private func normalizedFolder(_ value: String?) -> String? {
        guard let value else { return nil }
        let folder = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return folder.isEmpty ? nil : folder
    }

    private var collapsedFolders: Set<String> {
        guard let data = collapsedFoldersJSON.data(using: .utf8),
              let values = try? JSONDecoder().decode([String].self, from: data)
        else { return [] }
        return Set(values)
    }

    private func toggleFolder(_ folder: String) {
        var folders = collapsedFolders
        if folders.contains(folder) { folders.remove(folder) } else { folders.insert(folder) }
        if let data = try? JSONEncoder().encode(folders.sorted()),
           let value = String(data: data, encoding: .utf8) {
            withAnimation(.snappy(duration: 0.22)) { collapsedFoldersJSON = value }
        }
    }

    private var waitingChats: Set<String> {
        Set(session.state.pendingApprovals.compactMap { session.state.chat(forThread: $0.threadId)?.id })
    }

    private func sectionLabel(_ text: String, count: Int? = nil) -> some View {
        HStack(spacing: 7) {
            Text(text.uppercased())
                .font(.system(size: 13, weight: .semibold))
                .tracking(0.4)
            if let count {
                Text("\(count)")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .monospacedDigit()
            }
        }
        .foregroundStyle(Color.secondary)
        .padding(.horizontal, 20)
    }

    private func collapsibleLabel<Trailing: View>(
        _ text: String,
        count: Int,
        expanded: Bool,
        active: Bool,
        action: @escaping () -> Void,
        @ViewBuilder trailing: () -> Trailing
    ) -> some View {
        HStack(spacing: 4) {
            Button(action: action) {
                HStack(spacing: 8) {
                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .rotationEffect(.degrees(expanded ? 0 : -90))
                    Image(systemName: text == "Rooms" ? "person.2" : "folder")
                        .font(.system(size: 13, weight: .semibold))
                    sectionLabel(text, count: count).padding(.horizontal, -20)
                    Spacer(minLength: 4)
                    if active {
                        Circle().fill(WatcherTheme.ultraviolet).frame(width: 7, height: 7)
                    }
                }
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(expanded ? "Collapse" : "Expand") \(text)")
            .accessibilityValue("\(count) items")
            trailing()
        }
        .padding(.leading, 20)
        .padding(.trailing, 8)
    }

    private func collapsibleLabel(
        _ text: String,
        count: Int,
        expanded: Bool,
        active: Bool,
        action: @escaping () -> Void
    ) -> some View {
        collapsibleLabel(text, count: count, expanded: expanded, active: active, action: action) { EmptyView() }
    }

    private func chatLink(_ summary: ChatSummary, last: Bool) -> some View {
        NavigationLink(value: summary.chat) {
            ChatRow(
                chat: summary.chat,
                preview: summary.preview,
                at: summary.lastActivity,
                state: WatcherState.forChat(summary.chat, in: session.state),
                waiting: waitingChats.contains(summary.chat.id),
                last: last
            )
        }
        .buttonStyle(.plain)
    }

    private func agentRow(_ summary: ChatSummary, last: Bool) -> some View {
        ZStack(alignment: .trailing) {
            chatLink(summary, last: last)
                .padding(.trailing, 42)
            if case let .bot(bot) = summary.chat {
                Menu {
                    Button {
                        Task { await session.updateOrganization(BotOrganizationPatch(pinned: bot.pinned != true), for: bot) }
                    } label: {
                        Label(bot.pinned == true ? "Unpin" : "Pin", systemImage: bot.pinned == true ? "pin.slash" : "pin")
                    }
                    Button {
                        folderBot = bot
                    } label: {
                        Label("Move to Folder…", systemImage: "folder")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.secondary)
                        .frame(width: 44, height: 52)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Agent actions for \(bot.name)")
            }
        }
    }
}

private struct AgentFolderSheet: View {
    @EnvironmentObject private var session: Session
    @Environment(\.dismiss) private var dismiss
    let bot: Bot
    let folders: [String]
    @State private var newFolder = ""
    @State private var saving = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    folderButton("No folder", value: nil)
                    ForEach(folders, id: \.self) { folder in folderButton(folder, value: folder) }
                } header: {
                    Text(bot.pinned == true ? "Choose where \(bot.name) returns when unpinned" : "Move \(bot.name)")
                }

                Section("New folder") {
                    TextField("Folder name", text: $newFolder)
                    Button("Create and move") {
                        let name = newFolder.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !name.isEmpty else { return }
                        move(to: name)
                    }
                    .disabled(saving || newFolder.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .navigationTitle("Agent folder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
            }
            .disabled(saving)
        }
        .presentationDetents([.medium, .large])
    }

    private func folderButton(_ label: String, value: String?) -> some View {
        Button {
            if value == bot.section || (value == nil && normalizedCurrentFolder == nil) { dismiss(); return }
            move(to: value)
        } label: {
            HStack {
                Text(label).foregroundStyle(Color.primary)
                Spacer()
                if value == normalizedCurrentFolder {
                    Image(systemName: "checkmark").foregroundStyle(WatcherTheme.ultraviolet)
                }
            }
        }
    }

    private var normalizedCurrentFolder: String? {
        guard let section = bot.section?.trimmingCharacters(in: .whitespacesAndNewlines), !section.isEmpty else { return nil }
        return section
    }

    private func move(to folder: String?) {
        saving = true
        Task {
            let change: BotOrganizationPatch.Folder = folder.map(BotOrganizationPatch.Folder.set) ?? .clear
            _ = await session.updateOrganization(BotOrganizationPatch(folder: change), for: bot)
            dismiss()
        }
    }
}

// MARK: - Rows and tiles

/// A room as a round tile: the first two members' mascots stacked, its name
/// beneath. `nil` is the "make one" tile.
struct GroupTile: View {
    let room: Room?
    @EnvironmentObject private var session: Session

    var body: some View {
        VStack(spacing: 7) {
            ZStack {
                if let room {
                    Circle().fill(Color.secondary.opacity(0.14))
                    let bots = memberBots(room)
                    if let first = bots.first {
                        BotAvatarView(bot: first, size: 34, state: .happy, animated: false)
                            .offset(x: -9, y: -6)
                    }
                    if bots.count > 1 {
                        BotAvatarView(bot: bots[1], size: 30, state: .happy, animated: false)
                            .padding(2)
                            .background(Circle().fill(Color(uiColor: .systemBackground)))
                            .offset(x: 11, y: 9)
                    }
                    if room.unread {
                        Circle()
                            .fill(WatcherPalette.color("blue"))
                            .frame(width: 10, height: 10)
                            .overlay(Circle().stroke(Color(uiColor: .systemBackground), lineWidth: 2))
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                            .padding(3)
                    }
                } else {
                    Circle()
                        .strokeBorder(style: StrokeStyle(lineWidth: 1.5, dash: [4, 4]))
                        .foregroundStyle(Color.secondary.opacity(0.6))
                    Image(systemName: "plus")
                        .font(.system(size: 22, weight: .medium))
                        .foregroundStyle(Color.secondary)
                }
            }
            .frame(width: 64, height: 64)

            Text(room?.name ?? "New group")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(room == nil ? Color.secondary : Color.primary)
                .lineLimit(1)
        }
        .frame(width: 76)
        .contentShape(Rectangle())
    }

    private func memberBots(_ room: Room) -> [Bot] {
        room.memberIds.compactMap { session.state.bot($0) }
    }
}

struct ChatRow: View {
    let chat: Chat
    let preview: String
    let at: Double
    var state: WatcherState = .idle
    var waiting = false
    var last = false

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            // the unread dot, in the bot's own colour, at the very edge
            ZStack {
                if chat.unread && !chat.busy {
                    Circle()
                        .fill(WatcherPalette.color(chat.color))
                        .frame(width: 10, height: 10)
                }
            }
            .frame(width: 22)
            .frame(maxHeight: .infinity)

            HStack(alignment: .top, spacing: 14) {
                ChatAvatarView(chat: chat, size: 52, state: state)
                    .padding(.top, 12)

                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Text(chat.name)
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundStyle(Color.primary)
                            .lineLimit(1)
                            .layoutPriority(1)

                        // the bot's job, the way the desktop shows it
                        if !chat.subtitle.isEmpty {
                            Text(chat.subtitle)
                                .font(.system(size: 13))
                                .foregroundStyle(Color.secondary)
                                .lineLimit(1)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(Capsule().fill(Color.secondary.opacity(0.15)))
                        }

                        Spacer(minLength: 4)

                        Text(RelativeStamp.list(at))
                            .font(.system(size: 15))
                            .foregroundStyle(Color.secondary)
                            .fixedSize()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.secondary.opacity(0.5))
                    }

                    HStack(alignment: .top, spacing: 8) {
                        // one line for every bot, so the rows keep one rhythm
                        Text(preview.isEmpty ? " " : preview)
                            .font(.system(size: 15))
                            .foregroundStyle(Color.secondary)
                            .lineLimit(1)

                        Spacer(minLength: 0)

                        if chat.busy {
                            ProgressView().controlSize(.mini).padding(.top, 3)
                        }
                    }

                    if waiting {
                        Label("Waiting on you", systemImage: "hand.raised.fill")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(WatcherPalette.color(chat.color)))
                            .padding(.top, 4)
                    }
                }
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) {
                    if !last { Divider() }
                }
            }
            .padding(.trailing, 16)
        }
        .padding(.leading, 6)
        .contentShape(Rectangle())
    }
}

/// The floating pill: who is doing what right now, at a glance.
struct UpdatesPill: View {
    let updates: [ChatUpdate]
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                if !updates.isEmpty {
                    SpiritStack(chats: Array(updates.prefix(3).map(\.chat)))
                }
                VStack(alignment: .leading, spacing: 1) {
                    HStack(spacing: 4) {
                        if let first = updates.first {
                            switch first.kind {
                            case .needsYou:
                                Image(systemName: "hand.raised.fill")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundStyle(WatcherPalette.color(first.chat.color))
                                Text("\(first.chat.name) needs you")
                            case .working:
                                Text("\(first.chat.name) is working")
                            case .toReview:
                                Text("\(first.chat.name) has an update")
                            }
                        } else {
                            Text("All quiet")
                        }
                    }
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(updates.isEmpty ? Color.secondary : Color.primary)
                    .lineLimit(1)

                    Text(subline)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.secondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.up")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.secondary)
            }
            .padding(.leading, updates.isEmpty ? 16 : 7)
            .padding(.trailing, 12)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .glassCapsule()
        .accessibilityLabel("Updates")
    }

    private var subline: String {
        guard let first = updates.first else { return "Nothing needs you" }
        let rest = updates.count - 1
        if rest == 0 { return first.line.isEmpty ? " " : first.line }
        return rest == 1 ? "1 more update" : "\(rest) more updates"
    }
}

/// Up to three agents overlapping, each with the living spirit selected in
/// their profile. This is the bottom Working pill, so it must never fall back
/// to a generic legacy mascot merely because the stack used to accept colors.
struct SpiritStack: View {
    let chats: [Chat]
    var size: CGFloat = 28
    var overlap: CGFloat = 12

    var body: some View {
        HStack(spacing: -overlap) {
            ForEach(chats) { chat in
                ChatAvatarView(chat: chat, size: size, state: .working, animated: true)
                    .padding(2)
                    .background(Circle().fill(Color(uiColor: .systemBackground)))
            }
        }
    }
}

/// Connection state, shown only when it is not "fine".
struct StatusBanner: View {
    @EnvironmentObject private var session: Session

    var body: some View {
        Group {
            switch session.status {
            case .live, .unpaired:
                EmptyView()
            case .connecting:
                banner("Connecting…", systemImage: "arrow.triangle.2.circlepath", tint: .secondary, retry: true)
            case let .offline(reason):
                banner(reason, systemImage: "wifi.slash", tint: .orange, retry: true)
            case .unauthorized:
                banner("This phone was unpaired on the computer.", systemImage: "lock.slash", tint: .red)
            }
        }
        .animation(.default, value: session.status)
    }

    private func banner(_ text: String, systemImage: String, tint: Color, retry: Bool = false) -> some View {
        HStack(spacing: 8) {
            Label(text, systemImage: systemImage)
                .font(.footnote)
                .foregroundStyle(tint)
                .lineLimit(2)
            if retry {
                Button {
                    Task { await session.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.primary)
                        .frame(width: 28, height: 28)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Reconnect")
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .glassCapsule(interactive: false)
        .padding(.bottom, 8)
    }
}

struct SearchHitRow: View {
    let hit: SearchHit

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: hit.role == .user ? "person.fill" : "bubble.left.fill")
                .foregroundStyle(Color.secondary)
                .frame(width: 26, height: 26)
                .background(Circle().fill(Color.secondary.opacity(0.13)))

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(hit.name).font(.system(size: 15, weight: .semibold))
                    if let task = hit.task, !task.isEmpty {
                        Text(task).font(.system(size: 12)).foregroundStyle(Color.secondary)
                    }
                    Spacer()
                    Text(RelativeStamp.list(hit.at))
                        .font(.system(size: 12))
                        .foregroundStyle(Color.secondary)
                }
                Text(hit.snippet)
                    .font(.system(size: 14))
                    .foregroundStyle(Color.secondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
        }
        .padding(.vertical, 10)
        .contentShape(Rectangle())
    }
}

/// Timestamps the way a messaging app writes them.
enum RelativeStamp {
    /// Roster: time today, weekday this week, date beyond that.
    static func list(_ at: Double) -> String {
        guard at > 0 else { return "" }
        let date = Date(timeIntervalSince1970: at / 1000)
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            return date.formatted(date: .omitted, time: .shortened)
        }
        if calendar.isDateInYesterday(date) { return "Yesterday" }
        if let week = calendar.date(byAdding: .day, value: -6, to: Date()), date > week {
            return date.formatted(.dateTime.weekday(.wide))
        }
        return date.formatted(.dateTime.day().month(.abbreviated))
    }

    /// In a transcript: enough to place a gap in the conversation.
    static func separator(_ date: Date) -> String {
        let calendar = Calendar.current
        let time = date.formatted(date: .omitted, time: .shortened)
        if calendar.isDateInToday(date) { return "Today \(time)" }
        if calendar.isDateInYesterday(date) { return "Yesterday \(time)" }
        return "\(date.formatted(.dateTime.day().month(.abbreviated))) \(time)"
    }
}
