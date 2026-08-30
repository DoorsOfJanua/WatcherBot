import Foundation

/// Human-facing copy for an approval. Provider payloads are deliberately
/// kept out of these strings: the exact command remains available as
/// `technicalDetail`, but it is never the decision headline or a list preview.
public struct ApprovalPresentation: Equatable, Sendable {
    public var action: String
    public var note: String
    public var technicalDetail: String?
    public var sensitive: Bool
}

public enum CardPresentation {
    public static func approval(_ card: OptionCard) -> ApprovalPresentation {
        let detail = card.subtitle.trimmingCharacters(in: .whitespacesAndNewlines)

        guard card.isPermission else {
            return ApprovalPresentation(
                action: card.title.isEmpty ? "answer a question" : card.title,
                note: detail,
                technicalDetail: nil,
                sensitive: false
            )
        }

        if card.tool == "email.send" {
            return ApprovalPresentation(
                action: "send this exact email",
                note: "Nothing will be sent until you approve this copy.",
                technicalDetail: detail.isEmpty ? nil : detail,
                sensitive: true
            )
        }

        let lower = detail.lowercased()
        let tool = (card.tool ?? "").lowercased()
        let action: String
        let sensitive: Bool

        if lower.contains("security find-generic-password") || lower.contains("security dump-keychain") {
            action = "check saved login information on your Mac"
            sensitive = true
        } else if lower.contains("pause-schedule") {
            action = "pause ReplyGuy’s schedule"
            sensitive = false
        } else if lower.contains("/api/replyguy/drafts/batch") || lower.contains("/api/drafts/") && lower.contains("/post") {
            action = "publish the replies you approved"
            sensitive = true
        } else if lower.contains("/api/agents/") && (lower.contains("-x put") || lower.contains("-x patch")) {
            action = "change ReplyGuy’s agent settings"
            sensitive = true
        } else if containsDestructiveCommand(lower) {
            action = "run a command that can delete or overwrite files"
            sensitive = true
        } else if lower.contains("git push") {
            action = "publish code changes"
            sensitive = true
        } else if lower.contains("pnpm test") || lower.contains("npm test") || lower.contains("swift test") || lower.contains("xcodebuild") {
            action = "run project checks"
            sensitive = false
        } else if tool == "bash" || tool == "shell" || tool == "zsh" {
            action = "run a command"
            sensitive = false
        } else if tool.contains("computer") || card.approvalScope == "local-computer" {
            action = "control this computer"
            sensitive = true
        } else if tool.hasPrefix("mcp__") {
            action = "use \(humanToolName(card.tool ?? "a connected tool"))"
            sensitive = false
        } else {
            action = "use \(humanToolName(card.tool ?? "a tool"))"
            sensitive = false
        }

        let note: String
        if let held = card.held, !held.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            note = held
        } else if sensitive {
            note = "This can make an external or sensitive change, so it is waiting for your decision."
        } else {
            note = "It is paused until you choose what should happen."
        }

        return ApprovalPresentation(
            action: action,
            note: note,
            technicalDetail: detail.isEmpty ? nil : detail,
            sensitive: sensitive
        )
    }

    /// The one safe line used by the chat list, Updates and Live Activity.
    public static func preview(_ card: OptionCard) -> String {
        let presentation = approval(card)
        if card.isPermission { return "Wants to \(presentation.action)" }
        return presentation.note.isEmpty ? presentation.action : presentation.note
    }

    private static func containsDestructiveCommand(_ value: String) -> Bool {
        let tokens = ["rm -", "rmdir ", " -delete", "git reset --hard", "git clean ", "git push --force", "unlink ", "shred "]
        return tokens.contains(where: value.contains)
            || (value.contains("find ") && (value.contains(" -exec ") || value.contains(" -execdir ")))
    }

    private static func humanToolName(_ raw: String) -> String {
        let trimmed = raw
            .replacingOccurrences(of: "mcp__", with: "")
            .replacingOccurrences(of: "__", with: " ")
            .replacingOccurrences(of: "_", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "a tool" : trimmed.lowercased()
    }
}

public struct ToolPresentation: Equatable, Sendable {
    public var label: String
    public var technicalDetail: String?
    public var failed: Bool
}

public enum ActivityPresentation {
    public static func tool(_ activity: ToolActivity) -> ToolPresentation {
        let raw = activity.name.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = raw.lowercased()
        let detail = activity.detail?.trimmingCharacters(in: .whitespacesAndNewlines)
        let label: String

        if lower.hasPrefix("auto-approved") {
            label = "Approved automatically"
        } else if lower.hasPrefix("error:") {
            label = "Needs attention"
        } else if lower == "bash" || lower == "shell" || lower == "zsh" {
            label = "Ran a command"
        } else if lower.hasPrefix("mcp__") {
            let parts = raw.components(separatedBy: "__")
            label = parts.count > 1 ? "Used \(parts[1].replacingOccurrences(of: "_", with: " "))" : "Used a connected tool"
        } else if raw.contains("_") && !raw.contains(" ") {
            label = raw.replacingOccurrences(of: "_", with: " ").capitalized
        } else {
            label = raw.isEmpty ? "Worked in the background" : raw
        }

        let rawIsTechnical = lower.contains("bash") || lower.hasPrefix("mcp__") || raw.contains("_")
        return ToolPresentation(
            label: label,
            technicalDetail: detail?.isEmpty == false ? detail : (rawIsTechnical ? raw : nil),
            failed: activity.ok == false || lower.hasPrefix("error:")
        )
    }
}

// MARK: - ReplyGuy review deck

public struct ReplyDraftItem: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var author: String
    public var post: String
    public var reply: String
    public var url: String?
}

public struct ReplyDraftBatch: Codable, Hashable, Sendable {
    public var profileId: String
    public var agentId: String?
    public var title: String
    public var items: [ReplyDraftItem]
}

public struct ReplyDraftEnvelope: Equatable, Sendable {
    public var batch: ReplyDraftBatch
    public var prose: String

    /// Finds the exact JSON envelope emitted by ReplyGuy's `review_deck`.
    /// Invalid or partial fences return nil so an older/newer payload still
    /// falls back to ordinary Markdown instead of disappearing.
    public static func parse(_ source: String) -> ReplyDraftEnvelope? {
        let marker = "```reply-drafts"
        guard let markerRange = source.range(of: marker),
              let bodyStart = source[markerRange.upperBound...].firstIndex(of: "\n")
        else { return nil }
        let jsonStart = source.index(after: bodyStart)
        guard let close = source.range(of: "\n```", range: jsonStart..<source.endIndex) else { return nil }
        let json = String(source[jsonStart..<close.lowerBound]).trimmingCharacters(in: .whitespacesAndNewlines)
        guard let data = json.data(using: .utf8),
              let batch = try? JSONDecoder().decode(ReplyDraftBatch.self, from: data),
              (1...10).contains(batch.items.count),
              !batch.profileId.isEmpty,
              batch.items.allSatisfy({ !$0.id.isEmpty && !$0.author.isEmpty && !$0.reply.isEmpty && $0.reply.count <= 280 })
        else { return nil }

        let before = source[..<markerRange.lowerBound]
        let after = source[close.upperBound...]
        let prose = ([String(before), String(after)])
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
        return ReplyDraftEnvelope(batch: batch, prose: prose)
    }
}

public struct ReplyDraftApproval: Codable, Hashable, Sendable {
    public var id: String
    public var text: String

    public init(id: String, text: String) {
        self.id = id
        self.text = text
    }
}

public struct ReplyDraftBatchResult: Codable, Hashable, Sendable {
    public struct Failure: Codable, Hashable, Sendable {
        public var id: String
        public var error: String
    }

    public var profileId: String
    public var requested: Int
    public var postedIds: [String]
    public var postedReceipts: [ReplyGuyPostReceipt]?
    public var queuedIds: [String]?
    public var rejectedIds: [String]
    public var errors: [Failure]
}

public struct ReplyGuyApprovalPolicy: Codable, Hashable, Sendable {
    public var profileId: String
    public var agentId: String
    public var approvalRequired: Bool
    public var canPostAutomatically: Bool
    public var unavailableReason: String
}

public struct ReplyGuyPostReceipt: Codable, Hashable, Identifiable, Sendable {
    public var id: String
    public var text: String
    public var postedUrl: String
    public var postedAt: String?
    public var targetUrl: String?
}

public enum MarkdownPresentation {
    /// Prose fences are a model's visual outline, not source code. Rendering
    /// them as a terminal was the source of the large black boxes on iPhone.
    public static func isProseFence(language: String?, text: String) -> Bool {
        let language = language?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        if ["text", "txt", "plain", "plaintext"].contains(language) { return true }
        guard language == nil else { return false }
        let lines = text.split(separator: "\n")
        let arrows = lines.filter { line in
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            return trimmed.hasPrefix("↓") || trimmed.hasPrefix("→") || trimmed.hasPrefix("->") || trimmed.hasPrefix("=>")
        }.count
        if arrows >= 2 { return true }

        let codeSignals = ["import ", "export ", "const ", "let ", "function ", "class ", "#!/", "$ ", "curl ", "pnpm ", "npm ", "git "]
        return !codeSignals.contains { text.lowercased().contains($0) }
            && !text.contains("{") && !text.contains(";")
    }
}
