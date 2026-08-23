import SwiftUI

/// The native room should feel like the same place as the desktop: quiet,
/// nocturnal and alive, with colour belonging to the spirits rather than to
/// generic chrome. These are deliberately few tokens so the phone stays an
/// iPhone app instead of becoming a miniature web dashboard.
enum WatcherTheme {
    static let abyss = Color(hex: "#07060D")
    static let deepViolet = Color(hex: "#171027")
    static let violet = Color(hex: "#9B7AF3")
    static let ultraviolet = Color(hex: "#C5A8FF")
    static let ivory = Color(hex: "#F1EADF")
    static let muted = Color(hex: "#A49CAC")
    static let hairline = Color(hex: "#D7C7B5").opacity(0.14)
}

/// A restrained witnessing lens behind the content. It is atmosphere, not a
/// card or illustration: scrolling content and native material remain the
/// foreground, while every screen still belongs to WatcherBotRoom.
struct WatcherBackdrop: View {
    var body: some View {
        GeometryReader { proxy in
            ZStack {
                WatcherTheme.abyss

                RadialGradient(
                    colors: [WatcherTheme.violet.opacity(0.20), .clear],
                    center: UnitPoint(x: 0.50, y: 0.02),
                    startRadius: 0,
                    endRadius: max(proxy.size.width, proxy.size.height) * 0.68
                )

                ZStack {
                    Ellipse()
                        .stroke(WatcherTheme.ultraviolet.opacity(0.07), lineWidth: 1)
                        .frame(width: proxy.size.width * 1.18, height: proxy.size.width * 0.62)
                    Circle()
                        .stroke(WatcherTheme.ultraviolet.opacity(0.055), lineWidth: 1)
                        .frame(width: proxy.size.width * 0.72)
                    Circle()
                        .stroke(WatcherTheme.ivory.opacity(0.035), lineWidth: 1)
                        .frame(width: proxy.size.width * 0.42)
                }
                .offset(y: -proxy.size.height * 0.36)
                .allowsHitTesting(false)
            }
            .ignoresSafeArea()
        }
        .accessibilityHidden(true)
    }
}

extension View {
    /// Shared surface treatment for scrollable native screens.
    func watcherRoomSurface() -> some View {
        self
            .scrollContentBackground(.hidden)
            .background(WatcherBackdrop())
    }
}
