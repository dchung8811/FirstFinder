import Foundation

// Port of src/utils/shelfDrift.js: the physics behind the home page's shelf
// strip. The strip cruises left on its own, can be grabbed and dragged, and
// when flung keeps going on its own momentum before easing back into the
// cruise -- it never coasts to a dead stop, because a strip that has stopped
// reads as broken.
//
// Offsets are the track's x offset in points; velocities are points per
// second, negative meaning leftward. "span" is the width of one of the
// track's two identical halves: shifting by a whole span lands on an
// identical frame, which is what lets the loop wrap without a visible jump.
enum ShelfDrift {
    // How quickly a fling settles back to the cruise.
    static let settleSeconds = 0.7
    // Faster than this stops reading as momentum.
    static let maxFling = 4000.0
    // Movement under this is a tap, not a drag, so the cover still opens.
    static let dragThreshold = 6.0
    // Release speed is measured over this last stretch of the drag only.
    static let velocityWindowMs = 100.0

    // Seconds each cover takes to cross its own width, near enough.
    static let secondsPerCover = 4.0
    // A strip shorter than this is repeated until it isn't, so one loop is
    // wider than the screen and the seam never comes into view.
    static let minCovers = 12
    // Below this one book circling past on its own reads as a glitch, so the
    // covers just sit in a row.
    static let minToMove = 4
    // A frame that arrives late after the app was in the background is capped,
    // so the strip resumes rather than leaping.
    static let maxFrameSeconds = 0.1

    struct State: Equatable {
        var offset: Double
        var velocity: Double
    }

    struct Sample: Equatable {
        var t: Double // milliseconds
        var x: Double
    }

    // Wraps an offset into [-span, 0).
    static func wrap(_ offset: Double, span: Double) -> Double {
        guard span > 0, offset.isFinite else { return 0 }
        return (offset.truncatingRemainder(dividingBy: span) + span).truncatingRemainder(dividingBy: span) - span
    }

    // Advances the strip by dt seconds while nobody is holding it. The distance
    // is the exact integral of the easing curve, so one slow frame moves the
    // strip as far as several fast ones would have.
    static func step(_ state: State, cruise: Double, dt: Double, span: Double, settle: Double = settleSeconds) -> State {
        guard dt > 0 else { return State(offset: wrap(state.offset, span: span), velocity: state.velocity) }
        let decay = exp(-dt / settle)
        let excess = state.velocity - cruise
        return State(
            offset: wrap(state.offset + cruise * dt + excess * settle * (1 - decay), span: span),
            velocity: cruise + excess * decay
        )
    }

    // The speed the strip is let go at, from the positions recorded during the
    // drag, measured up to the moment of release.
    static func releaseVelocity(_ samples: [Sample], releasedAt: Double, windowMs: Double = velocityWindowMs, max: Double = maxFling) -> Double {
        let recent = samples.filter { releasedAt - $0.t <= windowMs }
        guard recent.count >= 2, let first = recent.first, let last = recent.last else { return 0 }
        let seconds = (releasedAt - first.t) / 1000
        guard seconds > 0 else { return 0 }
        let velocity = (last.x - first.x) / seconds
        return Swift.max(-max, Swift.min(max, velocity))
    }
}
