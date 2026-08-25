import Foundation

/// Unsent composer text, kept per thread and across launches. Leaving a chat,
/// switching tasks, or relaunching the app must never cost a typed draft —
/// the draft is durable state until its message is confirmed sent.
public final class ComposerDrafts {
    public static let shared = ComposerDrafts()

    private let defaults: UserDefaults
    private let key: String
    private var cache: [String: String]

    public init(defaults: UserDefaults = .standard, key: String = "composer.drafts") {
        self.defaults = defaults
        self.key = key
        self.cache = (defaults.dictionary(forKey: key) as? [String: String]) ?? [:]
    }

    public func draft(forThread threadId: String) -> String {
        cache[threadId] ?? ""
    }

    /// An emptied composer drops its entry instead of storing "" forever.
    public func setDraft(_ text: String, forThread threadId: String) {
        if text.isEmpty {
            guard cache.removeValue(forKey: threadId) != nil else { return }
        } else {
            guard cache[threadId] != text else { return }
            cache[threadId] = text
        }
        defaults.set(cache, forKey: key)
    }
}
