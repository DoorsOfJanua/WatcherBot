// Native The WatcherBot spirits.
//
// This is the SwiftUI/Canvas counterpart of the production hood family in
// `src/components/spirits/HoodSpirit.tsx` and `LivingHoodSpirit.tsx`. The
// geometry, authored palettes, semantic states, and restrained motion all use
// the same 120 × 120 drawing space as the desktop artwork. Unknown profile
// values stay harmless: they fall back to the authored identity, then to the
// classic mascot in `BotAvatarView`.
import SwiftUI
import CompanionCore

enum SpiritKind: String, CaseIterable, Hashable {
    case wormhole, sensei, mailman, ganga, signal, forge, watcher

    static func forBot(_ bot: Bot) -> SpiritKind? {
        if let explicit = bot.spirit?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
           let spirit = SpiritKind(rawValue: explicit) {
            return spirit
        }

        let memory = bot.sharedMemoryId?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let memory, let mapped = memoryMap[memory] { return mapped }
        if let named = nameMap[bot.name.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()] {
            return named
        }

        // Pre-spirit and custom agents should not puncture the native room
        // with the old mascot. Their existing identity colour gives them a
        // stable family member until the user authors a specific spirit.
        return colorMap[bot.color.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()] ?? .wormhole
    }

    private static let memoryMap: [String: SpiritKind] = [
        "wormhole": .wormhole,
        "coach": .sensei,
        "mailroom": .mailman,
        "ganga": .ganga,
        "signal": .signal,
        "forge": .forge,
    ]

    private static let nameMap: [String: SpiritKind] = [
        "wormhole": .wormhole,
        "the watcher": .wormhole,
        "sensei": .sensei,
        "mailman": .mailman,
        "ganga": .ganga,
        "signal": .signal,
        "forge": .forge,
    ]

    private static let colorMap: [String: SpiritKind] = [
        "purple": .wormhole,
        "green": .sensei,
        "red": .mailman,
        "pink": .mailman,
        "cyan": .ganga,
        "teal": .ganga,
        "blue": .signal,
        "orange": .forge,
        "yellow": .forge,
        "coral": .forge,
    ]

    fileprivate var nativeGeometry: SpiritGeometry {
        switch self {
        case .wormhole: .flower
        case .sensei: .merkaba
        case .mailman: .vesica
        case .ganga: .yantra
        case .signal: .seed
        case .forge: .metatron
        case .watcher: .lens
        }
    }
}
private enum SpiritGeometry: String, Hashable {
    case flower, merkaba, vesica, yantra, seed, metatron, lens, orbit, constellation
    case torus, spiral, lotus, enneagram, labyrinth, portal

    static func resolve(_ raw: String?, for spirit: SpiritKind) -> SpiritGeometry {
        guard let raw, raw != "native", let geometry = SpiritGeometry(rawValue: raw) else {
            return spirit.nativeGeometry
        }
        return geometry
    }
}

private enum SpiritActivity: Hashable {
    case idle, listening, thinking, working, waiting, success, failure, sleeping

    init(_ state: MausState) {
        switch state {
        case .listening, .receiving, .dictating, .surprised, .notifying, .waking, .spawning:
            self = .listening
        case .thinking, .searching, .thinkingDots, .curious, .confused:
            self = .thinking
        case .working, .progress, .loading, .humming, .writing, .sending, .uploading,
             .orbit, .radar, .dragging, .bouncing:
            self = .working
        case .suspicious, .shy:
            self = .waiting
        case .happy, .excited, .celebrate, .proud, .laughing, .playful:
            self = .success
        case .sad, .scared, .angry, .alerting:
            self = .failure
        case .sleeping, .drowsy, .bored, .poweringDown:
            self = .sleeping
        case .idle:
            self = .idle
        }
    }
}

private enum SpiritMood: Hashable {
    case open, calm, wide, happy, angry, suspicious, stoned, wink, love, dots, focused, surprised, closed
}

private enum SpiritHeading: Hashable {
    case center, left, right, up, down
}

private struct SpiritPose {
    let mood: SpiritMood
    let heading: SpiritHeading
}

private struct SpiritLook {
    let hi: Color
    let mid: Color
    let lo: Color
    let deep: Color
    let ring: Color

    init(_ hi: String, _ mid: String, _ lo: String, _ deep: String, _ ring: String) {
        self.hi = Color(hex: hi)
        self.mid = Color(hex: mid)
        self.lo = Color(hex: lo)
        self.deep = Color(hex: deep)
        self.ring = Color(hex: ring)
    }

    static func resolve(_ palette: String?, spirit: SpiritKind) -> SpiritLook {
        if let palette, palette != "native", let look = palettes[palette] { return look }
        return native[spirit]!
    }

    private static let native: [SpiritKind: SpiritLook] = [
        .wormhole: .init("#b8a1fb", "#8b5cf6", "#6d28d9", "#3b1878", "#8b5cf6"),
        .sensei: .init("#86efc0", "#10b981", "#059669", "#054e38", "#10b981"),
        .mailman: .init("#fdb5be", "#f43f5e", "#e11d48", "#8a1030", "#f43f5e"),
        .ganga: .init("#7ceee0", "#2dd4bf", "#0d9488", "#0c4f4a", "#2dd4bf"),
        .signal: .init("#a3cdfd", "#3b82f6", "#2563eb", "#173a8a", "#3b82f6"),
        .forge: .init("#fddc84", "#f59e0b", "#d97706", "#7c3d0a", "#f59e0b"),
        .watcher: .init("#f1eadf", "#b7a99a", "#71665e", "#211d1b", "#d7c7b5"),
    ]

    private static let palettes: [String: SpiritLook] = [
        "violet": .init("#c4b5fd", "#8b5cf6", "#6d28d9", "#35146c", "#a78bfa"),
        "jade": .init("#86efac", "#22c55e", "#059669", "#064e3b", "#34d399"),
        "rose": .init("#fda4af", "#f43f5e", "#be123c", "#74142e", "#fb7185"),
        "aqua": .init("#99f6e4", "#2dd4bf", "#0f766e", "#134e4a", "#5eead4"),
        "azure": .init("#bfdbfe", "#3b82f6", "#1d4ed8", "#172f75", "#60a5fa"),
        "ember": .init("#fde68a", "#f59e0b", "#c2410c", "#70250d", "#fbbf24"),
        "ivory": .init("#fffaf0", "#d8c8b5", "#8d7d70", "#28211e", "#eadcca"),
        "ultraviolet": .init("#f5d0fe", "#d946ef", "#7e22ce", "#2e1065", "#e879f9"),
        "solar": .init("#fff7ae", "#facc15", "#ea580c", "#7c2d12", "#fbbf24"),
        "acid": .init("#ecfccb", "#a3e635", "#16a34a", "#14532d", "#bef264"),
        "lunar": .init("#f8fafc", "#94a3b8", "#475569", "#0f172a", "#cbd5e1"),
        "oilchrome": .init("#e9fbff", "#51d7ff", "#8b32ff", "#170d34", "#ff55bf"),
    ]
}

struct SpiritAvatar: View {
    let spirit: SpiritKind
    var size: CGFloat = 52
    var state: MausState = .idle
    var animated = true
    var comets = false
    var palette: String? = nil
    var geometry: String? = nil
    var temperament: String? = nil
    var label: String? = nil

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let live = animated && !reduceMotion
        TimelineView(.animation(minimumInterval: 1.0 / 24.0, paused: !live)) { timeline in
            Canvas { context, canvasSize in
                SpiritRenderer.draw(
                    in: &context,
                    size: canvasSize,
                    spirit: spirit,
                    activity: SpiritActivity(state),
                    look: SpiritLook.resolve(palette, spirit: spirit),
                    geometry: SpiritGeometry.resolve(geometry, for: spirit),
                    temperament: temperament,
                    time: live ? timeline.date.timeIntervalSinceReferenceDate : 0,
                    moving: live,
                    forceComet: comets
                )
            }
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label ?? (spirit == .watcher ? "The Watcher" : "\(spirit.rawValue) spirit"))
    }
}

private enum SpiritRenderer {
    private static let flowerInner: [CGPoint] = hexagon(radius: 15)
    private static let flowerOuter: [CGPoint] = [
        .init(x: 90, y: 60), .init(x: 75, y: 85.98), .init(x: 45, y: 85.98),
        .init(x: 30, y: 60), .init(x: 45, y: 34.02), .init(x: 75, y: 34.02),
        .init(x: 82.5, y: 72.99), .init(x: 60, y: 85.98), .init(x: 37.5, y: 72.99),
        .init(x: 37.5, y: 47.01), .init(x: 60, y: 34.02), .init(x: 82.5, y: 47.01),
    ]
    private static let seedCenters: [CGPoint] = hexagon(radius: 17)
    private static let metatronInner: [CGPoint] = hexagon(radius: 16)
    private static let metatronOuter: [CGPoint] = hexagon(radius: 32)

    private static let cape = Path { path in
        path.move(to: CGPoint(x: 60, y: 34))
        path.addCurve(to: CGPoint(x: 28.5, y: 66), control1: CGPoint(x: 47, y: 40), control2: CGPoint(x: 35.5, y: 52))
        path.addCurve(to: CGPoint(x: 21.5, y: 86.5), control1: CGPoint(x: 24, y: 74.5), control2: CGPoint(x: 22, y: 81))
        path.addCurve(to: CGPoint(x: 60, y: 81), control1: CGPoint(x: 34.5, y: 83), control2: CGPoint(x: 47.5, y: 81))
        path.addCurve(to: CGPoint(x: 98.5, y: 86.5), control1: CGPoint(x: 72.5, y: 81), control2: CGPoint(x: 85.5, y: 83))
        path.addCurve(to: CGPoint(x: 91.5, y: 66), control1: CGPoint(x: 98, y: 81), control2: CGPoint(x: 96, y: 74.5))
        path.addCurve(to: CGPoint(x: 60, y: 34), control1: CGPoint(x: 84.5, y: 52), control2: CGPoint(x: 73, y: 40))
        path.closeSubpath()
    }

    private static let chest = Path { path in
        path.move(to: CGPoint(x: 60, y: 58))
        path.addLine(to: CGPoint(x: 88, y: 76))
        path.addLine(to: CGPoint(x: 60, y: 100))
        path.addLine(to: CGPoint(x: 32, y: 76))
        path.closeSubpath()
    }

    private static let cowl = Path { path in
        path.move(to: CGPoint(x: 60, y: 5.5))
        path.addCurve(to: CGPoint(x: 53.8, y: 9.5), control1: CGPoint(x: 57.5, y: 5.5), control2: CGPoint(x: 55.5, y: 7))
        path.addCurve(to: CGPoint(x: 34, y: 44), control1: CGPoint(x: 46.5, y: 19.5), control2: CGPoint(x: 38.5, y: 31.5))
        path.addCurve(to: CGPoint(x: 38, y: 72), control1: CGPoint(x: 29, y: 55), control2: CGPoint(x: 30, y: 65.5))
        path.addCurve(to: CGPoint(x: 60, y: 80.5), control1: CGPoint(x: 46, y: 78.5), control2: CGPoint(x: 53.5, y: 80.5))
        path.addCurve(to: CGPoint(x: 82, y: 72), control1: CGPoint(x: 66.5, y: 80.5), control2: CGPoint(x: 74, y: 78.5))
        path.addCurve(to: CGPoint(x: 86, y: 44), control1: CGPoint(x: 90, y: 65.5), control2: CGPoint(x: 91, y: 55))
        path.addCurve(to: CGPoint(x: 66.2, y: 9.5), control1: CGPoint(x: 81.5, y: 31.5), control2: CGPoint(x: 73.5, y: 19.5))
        path.addCurve(to: CGPoint(x: 60, y: 5.5), control1: CGPoint(x: 64.5, y: 7), control2: CGPoint(x: 62.5, y: 5.5))
        path.closeSubpath()
    }

    private static let facet = Path { path in
        path.move(to: CGPoint(x: 60, y: 5.5))
        path.addCurve(to: CGPoint(x: 66.2, y: 9.5), control1: CGPoint(x: 62.5, y: 5.5), control2: CGPoint(x: 64.5, y: 7))
        path.addCurve(to: CGPoint(x: 86, y: 44), control1: CGPoint(x: 73.5, y: 19.5), control2: CGPoint(x: 81.5, y: 31.5))
        path.addCurve(to: CGPoint(x: 82, y: 72), control1: CGPoint(x: 91, y: 55), control2: CGPoint(x: 90, y: 65.5))
        path.addCurve(to: CGPoint(x: 60, y: 80.5), control1: CGPoint(x: 74, y: 78.5), control2: CGPoint(x: 66.5, y: 80.5))
        path.closeSubpath()
    }

    private static let faceVoid = Path { path in
        path.move(to: CGPoint(x: 60, y: 28))
        path.addCurve(to: CGPoint(x: 75, y: 41.5), control1: CGPoint(x: 63.7, y: 29), control2: CGPoint(x: 70.3, y: 34.5))
        path.addCurve(to: CGPoint(x: 81, y: 52), control1: CGPoint(x: 78.2, y: 46.1), control2: CGPoint(x: 81, y: 49.7))
        path.addCurve(to: CGPoint(x: 75, y: 64.8), control1: CGPoint(x: 81, y: 55.3), control2: CGPoint(x: 78.2, y: 59.8))
        path.addCurve(to: CGPoint(x: 60, y: 78), control1: CGPoint(x: 70.6, y: 70.3), control2: CGPoint(x: 65.4, y: 74.7))
        path.addCurve(to: CGPoint(x: 45, y: 64.8), control1: CGPoint(x: 54.6, y: 74.7), control2: CGPoint(x: 49.4, y: 70.3))
        path.addCurve(to: CGPoint(x: 39, y: 52), control1: CGPoint(x: 41.8, y: 59.8), control2: CGPoint(x: 39, y: 55.3))
        path.addCurve(to: CGPoint(x: 45, y: 41.5), control1: CGPoint(x: 39, y: 49.7), control2: CGPoint(x: 41.8, y: 46.1))
        path.addCurve(to: CGPoint(x: 60, y: 28), control1: CGPoint(x: 49.7, y: 34.5), control2: CGPoint(x: 56.3, y: 29))
        path.closeSubpath()
    }

    static func draw(
        in context: inout GraphicsContext,
        size: CGSize,
        spirit: SpiritKind,
        activity: SpiritActivity,
        look: SpiritLook,
        geometry: SpiritGeometry,
        temperament: String?,
        time: TimeInterval,
        moving: Bool,
        forceComet: Bool
    ) {
        let scale = min(size.width, size.height) / 120
        context.translateBy(x: (size.width - 120 * scale) / 2, y: (size.height - 120 * scale) / 2)
        context.scaleBy(x: scale, y: scale)

        let pose = pose(for: spirit, activity: activity, temperament: temperament, time: time)
        drawEnvironment(in: &context, look: look, geometry: geometry, activity: activity, time: time, moving: moving, forceComet: forceComet)
        drawCharacter(in: &context, spirit: spirit, pose: pose, look: look, activity: activity, time: time, moving: moving)
    }

    private static func drawEnvironment(
        in context: inout GraphicsContext,
        look: SpiritLook,
        geometry: SpiritGeometry,
        activity: SpiritActivity,
        time: TimeInterval,
        moving: Bool,
        forceComet: Bool
    ) {
        let haloOpacity: Double
        switch activity {
        case .thinking: haloOpacity = 0.45
        case .working: haloOpacity = 0.50
        case .waiting: haloOpacity = 0.18
        case .failure: haloOpacity = 0.14
        case .sleeping: haloOpacity = 0.08
        default: haloOpacity = 0.38
        }

        context.drawLayer { layer in
            layer.opacity = haloOpacity
            if moving {
                layer.translateBy(x: 60, y: 60)
                layer.rotate(by: .radians(-time * .pi * 2 / 80))
                layer.translateBy(x: -60, y: -60)
            }
            drawHalo(in: &layer, geometry: geometry, color: look.ring)
        }

        context.drawLayer { layer in
            layer.opacity = activity == .sleeping ? 0.25 : (activity == .waiting || activity == .failure ? 0.45 : 0.75)
            let ring = Path(ellipseIn: CGRect(x: 8, y: 8, width: 104, height: 104))
            layer.stroke(
                ring,
                with: .linearGradient(
                    Gradient(colors: [look.hi, look.ring]),
                    startPoint: CGPoint(x: 20, y: 12),
                    endPoint: CGPoint(x: 100, y: 108)
                ),
                style: StrokeStyle(lineWidth: activity == .success ? 2.3 : 1.6, dash: activity == .thinking ? [4, 7] : [])
            )
        }

        let showComet = forceComet || [.listening, .thinking, .working, .success].contains(activity)
        guard showComet, activity != .sleeping else { return }
        let angle: Double
        switch activity {
        case .working: angle = moving ? time * .pi * 2 / 1.7 : 0
        case .thinking: angle = moving ? -time * .pi * 2 / 9 : 0
        case .listening: angle = moving ? sin(time * .pi * 2 / 1.3) * 0.24 : 0
        case .success: angle = moving ? min(time.truncatingRemainder(dividingBy: 1.15) / 1.15, 1) * .pi * 2 : 0
        default: angle = moving ? time * .pi * 2 / 3 : 0
        }
        let head = CGPoint(x: 60 + sin(angle) * 52, y: 60 - cos(angle) * 52)
        context.drawLayer { layer in
            layer.addFilter(.shadow(color: look.hi.opacity(0.8), radius: 4))
            layer.fill(Path(ellipseIn: CGRect(x: head.x - 3.2, y: head.y - 3.2, width: 6.4, height: 6.4)), with: .color(look.hi))
        }
    }

    private static func drawCharacter(
        in context: inout GraphicsContext,
        spirit: SpiritKind,
        pose: SpiritPose,
        look: SpiritLook,
        activity: SpiritActivity,
        time: TimeInterval,
        moving: Bool
    ) {
        var dy: CGFloat = 0
        var dx: CGFloat = 0
        var rotation: Double = 0
        var scale: CGFloat = 1
        if moving {
            switch activity {
            case .idle: dy = CGFloat(sin(time * .pi * 2 / 4.2)) * -1.5
            case .listening: scale = 1.04; dy = -1
            case .working: dy = CGFloat(sin(time * .pi * 2 / 0.9)) * 1.4
            case .waiting: rotation = sin(time * .pi * 2 / 4) * 1.2
            case .success: scale = 1 + CGFloat(max(0, sin(time * .pi * 2 / 1.4))) * 0.04
            case .failure: dx = CGFloat(sin(time * .pi * 2 / 0.55)) * 2.1
            case .sleeping: dy = 3.25 + CGFloat(sin(time * .pi * 2 / 5.5)) * 0.75
            case .thinking: break
            }
        }

        context.drawLayer { layer in
            layer.translateBy(x: 60 + dx, y: 60 + dy)
            layer.rotate(by: .degrees(rotation))
            layer.scaleBy(x: scale, y: scale)
            layer.translateBy(x: -60, y: -60)

            layer.drawLayer { glow in
                glow.opacity = 0.22
                glow.addFilter(.blur(radius: 6))
                glow.fill(Path(ellipseIn: CGRect(x: 40, y: 79, width: 40, height: 14)), with: .color(look.ring))
            }
            layer.fill(cape, with: .linearGradient(
                Gradient(stops: [
                    .init(color: look.lo, location: 0),
                    .init(color: look.deep, location: 0.58),
                    .init(color: look.deep.opacity(0.02), location: 1),
                ]),
                startPoint: CGPoint(x: 60, y: 34), endPoint: CGPoint(x: 60, y: 92)
            ))
            layer.opacity = 0.88
            layer.fill(chest, with: .linearGradient(
                Gradient(colors: [look.deep, look.deep.opacity(0.02)]),
                startPoint: CGPoint(x: 60, y: 58), endPoint: CGPoint(x: 60, y: 100)
            ))
            layer.opacity = 1

            drawHead(in: &layer, spirit: spirit, pose: pose, look: look)
            drawOrnaments(in: &layer, activity: activity, look: look, time: time, moving: moving)
        }
    }

    private static func drawHead(in context: inout GraphicsContext, spirit: SpiritKind, pose: SpiritPose, look: SpiritLook) {
        context.drawLayer { head in
            let transform = headingTransform(pose.heading)
            head.translateBy(x: 60, y: 82)
            head.rotate(by: .degrees(transform.rotation))
            head.scaleBy(x: 1, y: transform.scaleY)
            head.translateBy(x: -60 + transform.x, y: -82 + transform.y)

            head.fill(cowl, with: .linearGradient(
                Gradient(stops: [
                    .init(color: look.hi, location: 0),
                    .init(color: look.mid, location: 0.45),
                    .init(color: look.lo, location: 1),
                ]),
                startPoint: CGPoint(x: 60, y: 5), endPoint: CGPoint(x: 60, y: 82)
            ))
            head.opacity = 0.62
            head.fill(facet, with: .linearGradient(
                Gradient(colors: [look.mid, look.deep]),
                startPoint: CGPoint(x: 60, y: 5), endPoint: CGPoint(x: 75, y: 82)
            ))
            head.opacity = 1
            head.fill(faceVoid, with: .color(Color(hex: spirit == .wormhole ? "#030108" : "#070a16")))

            var brow = Path()
            brow.move(to: CGPoint(x: 45.5, y: 41))
            brow.addCurve(to: CGPoint(x: 74.5, y: 41), control1: CGPoint(x: 49.5, y: 34.5), control2: CGPoint(x: 70.5, y: 34.5))
            head.opacity = spirit == .wormhole ? 0.98 : 0.85
            head.stroke(brow, with: .color(look.deep), style: StrokeStyle(lineWidth: spirit == .wormhole ? 5.8 : 4.5, lineCap: .round))

            var edge = Path()
            edge.move(to: CGPoint(x: 56.5, y: 9))
            edge.addCurve(to: CGPoint(x: 35.5, y: 44.5), control1: CGPoint(x: 49.5, y: 18.5), control2: CGPoint(x: 40, y: 31.5))
            edge.addCurve(to: CGPoint(x: 38.7, y: 68), control1: CGPoint(x: 31.7, y: 54), control2: CGPoint(x: 32.7, y: 62))
            head.opacity = 0.45
            head.stroke(edge, with: .color(look.hi), style: StrokeStyle(lineWidth: 2, lineCap: .round))

            head.opacity = 0.9
            let peak = Path { path in
                path.move(to: CGPoint(x: 60, y: 6.5))
                path.addCurve(to: CGPoint(x: 64.5, y: 9.5), control1: CGPoint(x: 61.8, y: 6.5), control2: CGPoint(x: 63.3, y: 7.6))
                path.addLine(to: CGPoint(x: 60, y: 17.5))
                path.addLine(to: CGPoint(x: 55.5, y: 9.5))
                path.addCurve(to: CGPoint(x: 60, y: 6.5), control1: CGPoint(x: 56.7, y: 7.6), control2: CGPoint(x: 58.2, y: 6.5))
                path.closeSubpath()
            }
            head.fill(peak, with: .color(look.hi))
            head.opacity = 1

            let eyeOffset = headingEyeOffset(pose.heading)
            head.translateBy(x: eyeOffset.x, y: eyeOffset.y)
            head.drawLayer { eyes in
                eyes.addFilter(.shadow(color: .white.opacity(0.65), radius: 3.2))
                drawEyes(in: &eyes, mood: pose.mood, hostileRest: spirit == .wormhole && pose.mood == .open)
            }
        }
    }

    private static func drawOrnaments(in context: inout GraphicsContext, activity: SpiritActivity, look: SpiritLook, time: TimeInterval, moving: Bool) {
        switch activity {
        case .thinking:
            context.drawLayer { layer in
                layer.opacity = moving ? 0.65 + sin(time * .pi * 2 / 2.8) * 0.30 : 1
                layer.stroke(Path(ellipseIn: CGRect(x: 88, y: 12, width: 20, height: 20)), with: .color(look.ring), lineWidth: 2)
                var mark = Path()
                mark.move(to: CGPoint(x: 94.5, y: 19))
                mark.addCurve(to: CGPoint(x: 98, y: 24), control1: CGPoint(x: 94.5, y: 14), control2: CGPoint(x: 101.5, y: 14))
                layer.stroke(mark, with: .color(look.ring), style: StrokeStyle(lineWidth: 2, lineCap: .round))
                layer.fill(Path(ellipseIn: CGRect(x: 96.6, y: 26.1, width: 2.8, height: 2.8)), with: .color(look.ring))
            }
        case .success:
            let spark = Path { path in
                path.move(to: CGPoint(x: 97, y: 28))
                path.addLine(to: CGPoint(x: 99.4, y: 34.6))
                path.addLine(to: CGPoint(x: 106, y: 37))
                path.addLine(to: CGPoint(x: 99.4, y: 39.4))
                path.addLine(to: CGPoint(x: 97, y: 46))
                path.addLine(to: CGPoint(x: 94.6, y: 39.4))
                path.addLine(to: CGPoint(x: 88, y: 37))
                path.addLine(to: CGPoint(x: 94.6, y: 34.6))
                path.closeSubpath()
            }
            context.fill(spark, with: .color(look.hi))
        case .failure:
            context.drawLayer { layer in
                layer.addFilter(.shadow(color: look.ring.opacity(0.8), radius: 3))
                let pulse: CGFloat = moving ? 1 + CGFloat(sin(time * .pi * 2 / 1.4)) * 0.08 : 1
                layer.translateBy(x: 103, y: 79)
                layer.scaleBy(x: pulse, y: pulse)
                layer.translateBy(x: -103, y: -79)
                layer.fill(Path(ellipseIn: CGRect(x: 98.5, y: 74.5, width: 9, height: 9)), with: .color(look.ring))
            }
        default: break
        }
    }

    private static func drawEyes(in context: inout GraphicsContext, mood: SpiritMood, hostileRest: Bool) {
        let white = Color.white.opacity(mood == .closed ? 0.5 : 1)
        if hostileRest {
            var left = Path()
            left.move(to: CGPoint(x: 43.5, y: 48.1)); left.addLine(to: CGPoint(x: 57, y: 52.1)); left.addLine(to: CGPoint(x: 57, y: 54.6)); left.addLine(to: CGPoint(x: 43.5, y: 51.5)); left.closeSubpath()
            var right = Path()
            right.move(to: CGPoint(x: 76.5, y: 48.1)); right.addLine(to: CGPoint(x: 63, y: 52.1)); right.addLine(to: CGPoint(x: 63, y: 54.6)); right.addLine(to: CGPoint(x: 76.5, y: 51.5)); right.closeSubpath()
            context.fill(left, with: .color(white)); context.fill(right, with: .color(white)); return
        }

        switch mood {
        case .open, .wide:
            let lift: CGFloat = mood == .wide ? 8.5 : 7.5
            context.fill(almond(centerX: 50, centerY: 51, halfWidth: mood == .wide ? 7.5 : 7, lift: lift), with: .color(white))
            context.fill(almond(centerX: 70, centerY: 51, halfWidth: mood == .wide ? 7.5 : 7, lift: lift), with: .color(white))
        case .calm, .happy, .closed:
            let upward = mood != .closed
            let height: CGFloat = mood == .happy ? 9 : (mood == .calm ? 6.5 : 5.5)
            for x in [50.5, 69.5] {
                var path = Path()
                path.move(to: CGPoint(x: x - 6.5, y: mood == .happy ? 53.5 : 52))
                path.addQuadCurve(to: CGPoint(x: x + 6.5, y: mood == .happy ? 53.5 : 52), control: CGPoint(x: x, y: 52 + (upward ? -height : height)))
                context.stroke(path, with: .color(white), style: StrokeStyle(lineWidth: 4.2, lineCap: .round))
            }
        case .angry, .focused:
            let inward = mood == .angry
            for leftSide in [true, false] {
                var path = Path()
                if inward {
                    let points = leftSide
                        ? [CGPoint(x: 43.5, y: 47), CGPoint(x: 57, y: 51.2), CGPoint(x: 57, y: 54.8), CGPoint(x: 43.5, y: 51)]
                        : [CGPoint(x: 76.5, y: 47), CGPoint(x: 63, y: 51.2), CGPoint(x: 63, y: 54.8), CGPoint(x: 76.5, y: 51)]
                    path.addLines(points)
                } else {
                    let points = leftSide
                        ? [CGPoint(x: 43.5, y: 49.8), CGPoint(x: 57, y: 48.4), CGPoint(x: 57, y: 52.6), CGPoint(x: 43.5, y: 54)]
                        : [CGPoint(x: 76.5, y: 49.8), CGPoint(x: 63, y: 48.4), CGPoint(x: 63, y: 52.6), CGPoint(x: 76.5, y: 54)]
                    path.addLines(points)
                }
                path.closeSubpath(); context.fill(path, with: .color(white))
            }
        case .suspicious:
            context.fill(Path(CGRect(x: 43.5, y: 50, width: 13.5, height: 3.6)), with: .color(white))
            context.fill(Path(CGRect(x: 63, y: 50, width: 13.5, height: 3.6)), with: .color(white))
        case .stoned:
            context.fill(heavyLid(centerX: 50, centerY: 52.5), with: .color(white))
            context.fill(heavyLid(centerX: 70, centerY: 52.5), with: .color(white))
        case .wink:
            var wink = Path(); wink.move(to: CGPoint(x: 44, y: 52.5)); wink.addQuadCurve(to: CGPoint(x: 57, y: 52.5), control: CGPoint(x: 50.5, y: 45.5))
            context.stroke(wink, with: .color(white), style: StrokeStyle(lineWidth: 4.2, lineCap: .round))
            context.fill(almond(centerX: 69.5, centerY: 51, halfWidth: 7, lift: 7.5), with: .color(white))
        case .love:
            context.fill(heart(centerX: 50, topY: 46), with: .color(white))
            context.fill(heart(centerX: 70, topY: 46), with: .color(white))
        case .dots:
            context.fill(Path(ellipseIn: CGRect(x: 45.2, y: 46.7, width: 9.6, height: 9.6)), with: .color(white))
            context.fill(Path(ellipseIn: CGRect(x: 65.2, y: 46.7, width: 9.6, height: 9.6)), with: .color(white))
        case .surprised:
            context.fill(Path(ellipseIn: CGRect(x: 44.2, y: 44.7, width: 11.6, height: 11.6)), with: .color(white))
            context.fill(Path(ellipseIn: CGRect(x: 64.2, y: 44.7, width: 11.6, height: 11.6)), with: .color(white))
        }
    }

    private static func drawHalo(in context: inout GraphicsContext, geometry: SpiritGeometry, color: Color) {
        func circle(_ center: CGPoint, _ radius: CGFloat) {
            context.stroke(Path(ellipseIn: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2)), with: .color(color), lineWidth: 1.3)
        }
        func linePath(_ points: [CGPoint], close: Bool = false, opacity: Double = 1) {
            guard let first = points.first else { return }
            var path = Path(); path.move(to: first)
            for point in points.dropFirst() { path.addLine(to: point) }
            if close { path.closeSubpath() }
            context.drawLayer { layer in
                layer.opacity = opacity
                layer.stroke(path, with: .color(color), lineWidth: 1.3)
            }
        }

        switch geometry {
        case .flower:
            circle(CGPoint(x: 60, y: 60), 15)
            for center in flowerInner + flowerOuter { circle(center, 15) }
        case .merkaba:
            linePath([.init(x: 60, y: 16), .init(x: 21.9, y: 82), .init(x: 98.1, y: 82)], close: true)
            linePath([.init(x: 60, y: 104), .init(x: 21.9, y: 38), .init(x: 98.1, y: 38)], close: true)
        case .vesica:
            circle(CGPoint(x: 46, y: 60), 28); circle(CGPoint(x: 74, y: 60), 28)
        case .yantra:
            linePath([.init(x: 60, y: 20), .init(x: 27, y: 82), .init(x: 93, y: 82)], close: true)
            linePath([.init(x: 60, y: 33), .init(x: 38, y: 74), .init(x: 82, y: 74)], close: true)
            linePath([.init(x: 60, y: 98), .init(x: 28, y: 41), .init(x: 92, y: 41)], close: true)
            linePath([.init(x: 60, y: 82), .init(x: 39, y: 46), .init(x: 81, y: 46)], close: true)
            circle(CGPoint(x: 60, y: 60), 1.6)
        case .seed:
            circle(CGPoint(x: 60, y: 60), 17)
            for center in seedCenters { circle(center, 17) }
        case .metatron:
            let centers = [CGPoint(x: 60, y: 60)] + metatronInner + metatronOuter
            for center in centers { circle(center, 8) }
            linePath(metatronOuter, close: true)
            linePath([metatronOuter[0], metatronOuter[2], metatronOuter[4]], close: true)
            linePath([metatronOuter[3], metatronOuter[5], metatronOuter[1]], close: true)
            linePath([metatronOuter[3], metatronOuter[0]])
        case .lens:
            var lens = Path(); lens.move(to: CGPoint(x: 18, y: 60)); lens.addQuadCurve(to: CGPoint(x: 102, y: 60), control: CGPoint(x: 60, y: 22)); lens.addQuadCurve(to: CGPoint(x: 18, y: 60), control: CGPoint(x: 60, y: 98)); lens.closeSubpath()
            context.stroke(lens, with: .color(color), lineWidth: 1.3)
            circle(CGPoint(x: 60, y: 60), 17); circle(CGPoint(x: 60, y: 60), 5)
            linePath([.init(x: 60, y: 18), .init(x: 60, y: 43)], opacity: 0.55)
            linePath([.init(x: 60, y: 77), .init(x: 60, y: 102)], opacity: 0.55)
            linePath([.init(x: 18, y: 60), .init(x: 43, y: 60)], opacity: 0.55)
            linePath([.init(x: 77, y: 60), .init(x: 102, y: 60)], opacity: 0.55)
        case .orbit:
            circle(CGPoint(x: 60, y: 60), 39)
            context.drawLayer { layer in
                layer.translateBy(x: 60, y: 60); layer.rotate(by: .degrees(-24)); layer.translateBy(x: -60, y: -60)
                layer.stroke(Path(ellipseIn: CGRect(x: 14, y: 40, width: 92, height: 40)), with: .color(color), lineWidth: 1.3)
            }
            context.drawLayer { layer in
                layer.translateBy(x: 60, y: 60); layer.rotate(by: .degrees(36)); layer.translateBy(x: -60, y: -60)
                layer.stroke(Path(ellipseIn: CGRect(x: 14, y: 40, width: 92, height: 40)), with: .color(color), lineWidth: 1.3)
            }
            circle(CGPoint(x: 101, y: 41), 3.2); circle(CGPoint(x: 24, y: 82), 2.2)
        case .constellation:
            let stars: [CGPoint] = [.init(x: 23, y: 75), .init(x: 37, y: 36), .init(x: 61, y: 22), .init(x: 88, y: 38), .init(x: 99, y: 70), .init(x: 75, y: 96), .init(x: 42, y: 94)]
            linePath(stars, close: true)
            for star in stars { circle(star, 2.3) }
            circle(CGPoint(x: 60, y: 60), 3)
            for index in [0, 1, 3, 4, 5, 6] { linePath([stars[index], CGPoint(x: 60, y: 60)], opacity: 0.7) }
        case .torus:
            circle(CGPoint(x: 60, y: 60), 42)
            for angle in [-60.0, -30, 0, 30, 60] {
                context.drawLayer { layer in
                    layer.translateBy(x: 60, y: 60)
                    layer.rotate(by: .degrees(angle))
                    layer.translateBy(x: -60, y: -60)
                    layer.stroke(Path(ellipseIn: CGRect(x: 18, y: 45, width: 84, height: 30)), with: .color(color), lineWidth: 1.3)
                }
            }
            circle(CGPoint(x: 60, y: 60), 4)
        case .spiral:
            circle(CGPoint(x: 60, y: 60), 45)
            var spiral = Path()
            spiral.move(to: CGPoint(x: 60, y: 60))
            spiral.addCurve(to: CGPoint(x: 77, y: 53), control1: CGPoint(x: 60, y: 52), control2: CGPoint(x: 70, y: 48))
            spiral.addCurve(to: CGPoint(x: 74, y: 80), control1: CGPoint(x: 86, y: 59), control2: CGPoint(x: 84, y: 74))
            spiral.addCurve(to: CGPoint(x: 39, y: 62), control1: CGPoint(x: 59, y: 89), control2: CGPoint(x: 41, y: 79))
            spiral.addCurve(to: CGPoint(x: 80, y: 33), control1: CGPoint(x: 36, y: 39), control2: CGPoint(x: 59, y: 23))
            spiral.addCurve(to: CGPoint(x: 91, y: 102), control1: CGPoint(x: 107, y: 45), control2: CGPoint(x: 113, y: 82))
            context.stroke(spiral, with: .color(color), lineWidth: 1.3)
        case .lotus:
            for index in 0..<8 {
                context.drawLayer { layer in
                    layer.translateBy(x: 60, y: 60)
                    layer.rotate(by: .degrees(Double(index) * 45))
                    layer.translateBy(x: -60, y: -60)
                    layer.stroke(Path(ellipseIn: CGRect(x: 50, y: 9, width: 20, height: 50)), with: .color(color), lineWidth: 1.3)
                }
            }
            circle(CGPoint(x: 60, y: 60), 13)
            circle(CGPoint(x: 60, y: 60), 4)
        case .enneagram:
            circle(CGPoint(x: 60, y: 60), 44)
            let points = (0..<9).map { index -> CGPoint in
                let angle = -Double.pi / 2 + Double(index) * 2 * Double.pi / 9
                return CGPoint(x: 60 + CGFloat(cos(angle)) * 44, y: 60 + CGFloat(sin(angle)) * 44)
            }
            let order = [0, 3, 6, 1, 4, 7, 2, 5, 8]
            linePath(order.map { points[$0] }, close: true)
            circle(CGPoint(x: 60, y: 60), 4)
        case .labyrinth:
            for radius: CGFloat in [13, 24, 35, 46] {
                var arc = Path()
                arc.addArc(
                    center: CGPoint(x: 60, y: 60),
                    radius: radius,
                    startAngle: .degrees(-82),
                    endAngle: .degrees(258),
                    clockwise: false
                )
                context.stroke(arc, with: .color(color), lineWidth: 1.3)
            }
            linePath([.init(x: 60, y: 14), .init(x: 60, y: 47)], opacity: 0.72)
            linePath([.init(x: 60, y: 73), .init(x: 60, y: 106)], opacity: 0.72)
        case .portal:
            for radius: CGFloat in [17, 27, 38, 48] { circle(CGPoint(x: 60, y: 60), radius) }
            for index in 0..<12 {
                let angle = Double(index) * Double.pi / 6
                circle(CGPoint(x: 60 + CGFloat(cos(angle)) * 48, y: 60 + CGFloat(sin(angle)) * 48), 2.4)
            }
            linePath([.init(x: 60, y: 12), .init(x: 60, y: 27)], opacity: 0.65)
            linePath([.init(x: 60, y: 93), .init(x: 60, y: 108)], opacity: 0.65)
            linePath([.init(x: 12, y: 60), .init(x: 27, y: 60)], opacity: 0.65)
            linePath([.init(x: 93, y: 60), .init(x: 108, y: 60)], opacity: 0.65)
        }
    }

    private static func pose(for spirit: SpiritKind, activity: SpiritActivity, temperament: String?, time: TimeInterval) -> SpiritPose {
        if activity == .idle {
            let cadence = cadence(for: spirit, temperament: temperament)
            let poses = idlePoses(for: spirit, temperament: temperament)
            let beat = Int(max(0, floor(time / cadence))) % poses.count
            return poses[beat]
        }
        switch spirit {
        case .wormhole:
            return statePose(activity, [.listening: (.wide, .right), .thinking: (.dots, .left), .working: (.focused, .down), .waiting: (.calm, .center), .success: (.happy, .up), .failure: (.angry, .right), .sleeping: (.closed, .down)])
        case .sensei:
            return statePose(activity, [.listening: (.calm, .down), .thinking: (.suspicious, .left), .working: (.focused, .down), .waiting: (.stoned, .center), .success: (.calm, .down), .failure: (.angry, .center), .sleeping: (.closed, .down)])
        case .mailman:
            return statePose(activity, [.listening: (.wide, .up), .thinking: (.dots, .left), .working: (.focused, .right), .waiting: (.suspicious, .left), .success: (.happy, .up), .failure: (.surprised, .down), .sleeping: (.closed, .down)])
        case .ganga:
            return statePose(activity, [.listening: (.calm, .left), .thinking: (.dots, .up), .working: (.focused, .down), .waiting: (.calm, .left), .success: (.love, .up), .failure: (.suspicious, .down), .sleeping: (.closed, .down)])
        case .signal:
            return statePose(activity, [.listening: (.suspicious, .right), .thinking: (.dots, .left), .working: (.focused, .up), .waiting: (.suspicious, .center), .success: (.wide, .up), .failure: (.angry, .right), .sleeping: (.closed, .down)])
        case .forge:
            return statePose(activity, [.listening: (.open, .down), .thinking: (.suspicious, .down), .working: (.focused, .down), .waiting: (.stoned, .center), .success: (.happy, .up), .failure: (.angry, .down), .sleeping: (.closed, .down)])
        case .watcher:
            return statePose(activity, [.listening: (.wide, .center), .thinking: (.dots, .up), .working: (.focused, .down), .waiting: (.suspicious, .right), .success: (.calm, .up), .failure: (.angry, .center), .sleeping: (.closed, .down)])
        }
    }

    private static func statePose(_ activity: SpiritActivity, _ values: [SpiritActivity: (SpiritMood, SpiritHeading)]) -> SpiritPose {
        let value = values[activity] ?? (.open, .center)
        return SpiritPose(mood: value.0, heading: value.1)
    }

    private static func cadence(for spirit: SpiritKind, temperament: String?) -> TimeInterval {
        switch temperament {
        case "quiet": return 9.2
        case "focused": return 6.8
        case "expressive": return 4.5
        case "playful": return 3.6
        case "fierce": return 5.6
        case "curious": return 4.8
        case "mischievous": return 4.0
        case "tender": return 7.5
        case "mystic": return 8.6
        case "melancholic": return 8.0
        case "radiant": return 4.2
        default:
            switch spirit {
            case .wormhole: return 6.8
            case .sensei: return 7.6
            case .mailman: return 4.1
            case .ganga: return 6.8
            case .signal: return 4.9
            case .forge: return 7.2
            case .watcher: return 8.4
            }
        }
    }

    private static func idlePoses(for spirit: SpiritKind, temperament: String?) -> [SpiritPose] {
        func poses(_ values: [(SpiritMood, SpiritHeading)]) -> [SpiritPose] {
            values.map { SpiritPose(mood: $0.0, heading: $0.1) }
        }
        switch temperament {
        case "quiet": return poses([(.calm, .center), (.closed, .down), (.open, .left)])
        case "focused": return poses([(.focused, .center), (.suspicious, .left), (.open, .down)])
        case "expressive": return poses([(.open, .center), (.wide, .left), (.happy, .up), (.surprised, .right)])
        case "playful": return poses([(.wink, .right), (.happy, .up), (.love, .left), (.surprised, .down)])
        case "fierce": return poses([(.suspicious, .center), (.focused, .left), (.angry, .right)])
        case "curious": return poses([(.wide, .left), (.open, .right), (.dots, .up), (.surprised, .center)])
        case "mischievous": return poses([(.suspicious, .left), (.wink, .right), (.stoned, .center), (.happy, .up)])
        case "tender": return poses([(.calm, .center), (.love, .left), (.open, .down)])
        case "mystic": return poses([(.stoned, .center), (.closed, .down), (.dots, .up), (.calm, .left)])
        case "melancholic": return poses([(.calm, .down), (.closed, .left), (.open, .down)])
        case "radiant": return poses([(.happy, .up), (.wide, .center), (.love, .right), (.wink, .left)])
        default:
            switch spirit {
            case .wormhole: return poses([(.open, .center), (.suspicious, .left), (.calm, .right)])
            case .sensei: return poses([(.calm, .center), (.suspicious, .down), (.calm, .left)])
            case .mailman: return poses([(.open, .right), (.wide, .left), (.wink, .right), (.happy, .up)])
            case .ganga: return poses([(.calm, .center), (.open, .up), (.love, .left)])
            case .signal: return poses([(.suspicious, .left), (.focused, .right), (.dots, .up)])
            case .forge: return poses([(.focused, .down), (.open, .center), (.suspicious, .right)])
            case .watcher: return poses([(.calm, .center), (.open, .left), (.suspicious, .right), (.calm, .up)])
            }
        }
    }

    private static func headingTransform(_ heading: SpiritHeading) -> (x: CGFloat, y: CGFloat, rotation: Double, scaleY: CGFloat) {
        switch heading {
        case .center: (0, 0, 0, 1)
        case .left: (3, 0, -4.5, 1)
        case .right: (-3, 0, 4.5, 1)
        case .up: (0, 2.6, 0, 1.02)
        case .down: (0, -2.6, 0, 0.97)
        }
    }

    private static func headingEyeOffset(_ heading: SpiritHeading) -> CGPoint {
        switch heading {
        case .center: .zero
        case .left: CGPoint(x: -3.5, y: 0)
        case .right: CGPoint(x: 3.5, y: 0)
        case .up: CGPoint(x: 0, y: -3.2)
        case .down: CGPoint(x: 0, y: 3.2)
        }
    }

    private static func almond(centerX: CGFloat, centerY: CGFloat, halfWidth: CGFloat, lift: CGFloat) -> Path {
        Path { path in
            path.move(to: CGPoint(x: centerX - halfWidth, y: centerY))
            path.addQuadCurve(to: CGPoint(x: centerX + halfWidth, y: centerY), control: CGPoint(x: centerX, y: centerY - lift))
            path.addQuadCurve(to: CGPoint(x: centerX - halfWidth, y: centerY), control: CGPoint(x: centerX, y: centerY + lift))
            path.closeSubpath()
        }
    }

    private static func heavyLid(centerX: CGFloat, centerY: CGFloat) -> Path {
        Path { path in
            path.move(to: CGPoint(x: centerX - 6.5, y: centerY))
            path.addQuadCurve(to: CGPoint(x: centerX + 6.5, y: centerY), control: CGPoint(x: centerX, y: centerY - 4))
            path.addLine(to: CGPoint(x: centerX + 6.5, y: centerY + 1.8))
            path.addQuadCurve(to: CGPoint(x: centerX - 6.5, y: centerY + 1.8), control: CGPoint(x: centerX, y: centerY + 4.6))
            path.closeSubpath()
        }
    }

    private static func heart(centerX: CGFloat, topY: CGFloat) -> Path {
        Path { path in
            path.move(to: CGPoint(x: centerX, y: topY + 11.5))
            path.addCurve(to: CGPoint(x: centerX - 6.6, y: topY + 3), control1: CGPoint(x: centerX - 4, y: topY + 8.5), control2: CGPoint(x: centerX - 6.6, y: topY + 5.7))
            path.addCurve(to: CGPoint(x: centerX, y: topY + 1.2), control1: CGPoint(x: centerX - 6.6, y: topY - 0.8), control2: CGPoint(x: centerX - 2.4, y: topY - 1.7))
            path.addCurve(to: CGPoint(x: centerX + 6.6, y: topY + 3), control1: CGPoint(x: centerX + 2.4, y: topY - 1.7), control2: CGPoint(x: centerX + 6.6, y: topY - 0.8))
            path.addCurve(to: CGPoint(x: centerX, y: topY + 11.5), control1: CGPoint(x: centerX + 6.6, y: topY + 5.7), control2: CGPoint(x: centerX + 4, y: topY + 8.5))
            path.closeSubpath()
        }
    }

    private static func hexagon(radius: CGFloat) -> [CGPoint] {
        (0..<6).map { index in
            let angle = CGFloat(index) * .pi / 3
            return CGPoint(x: 60 + cos(angle) * radius, y: 60 + sin(angle) * radius)
        }
    }
}
