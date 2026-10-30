import AVFoundation
import SwiftUI

// DemoVideoPlayer / LoopingVideo: the 90-second walkthrough, streamed from the
// live site. It plays muted and on a loop, like the web's. Anyone who has asked
// for less motion, or whose phone is in Low Power Mode, gets the poster frame
// and a play button instead of a film starting by itself.
struct DemoVideoPlayer: View {
    let videoURL: URL
    let posterURL: URL

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var playing = false
    @State private var poster: UIImage?

    private var autoplays: Bool { !reduceMotion && !ProcessInfo.processInfo.isLowPowerModeEnabled }

    var body: some View {
        ZStack {
            Color.black
            if let poster {
                Image(uiImage: poster).resizable().scaledToFill()
            }
            if playing {
                LoopingPlayerView(url: videoURL)
            } else if !autoplays {
                Button {
                    playing = true
                } label: {
                    Image(systemName: "play.fill")
                        .font(.title2)
                        .foregroundStyle(Theme.adaptive(0x123f38, dark: 0x123f38))
                        .frame(width: 64, height: 64)
                        .background(Theme.adaptive(0xfff7ea, dark: 0xfff7ea), in: Circle())
                        .shadow(radius: 8)
                }
                .accessibilityLabel("Play the 90-second walkthrough")
            }
        }
        .clipped()
        .accessibilityElement(children: .contain)
        .accessibilityLabel("A walkthrough of adding an item to FirstFinder on an iPhone")
        .task {
            poster = await ImageLoader.shared.image(for: posterURL, cacheKey: posterURL.absoluteString)
            if autoplays { playing = true }
        }
    }
}

private struct LoopingPlayerView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> PlayerView {
        let view = PlayerView()
        view.play(url)
        return view
    }

    func updateUIView(_ view: PlayerView, context: Context) {}

    static func dismantleUIView(_ view: PlayerView, coordinator: ()) {
        view.stop()
    }

    @MainActor
    final class PlayerView: UIView {
        override static var layerClass: AnyClass { AVPlayerLayer.self }

        private var player: AVQueuePlayer?
        private var looper: AVPlayerLooper?

        func play(_ url: URL) {
            let player = AVQueuePlayer()
            player.isMuted = true
            // Muted and silent: it must not interrupt whatever the phone is playing.
            player.preventsDisplaySleepDuringVideoPlayback = false
            looper = AVPlayerLooper(player: player, templateItem: AVPlayerItem(url: url))
            (layer as? AVPlayerLayer)?.player = player
            (layer as? AVPlayerLayer)?.videoGravity = .resizeAspectFill
            self.player = player
            player.play()
        }

        func stop() {
            player?.pause()
            looper = nil
            player = nil
        }
    }
}
