/**
 * Non-interactive CRT glass stack. Every layer is composited only — no
 * per-frame repaint, no SVG filters over the animated canvas.
 */
export function CRTOverlay({ glitch = false }: { glitch?: boolean }) {
  return (
    <div
      aria-hidden
      className="motion-guard pointer-events-none absolute inset-0 z-50"
      style={{ contain: "strict" }}
    >
      <div className="crt-scanlines absolute inset-0 opacity-70" />
      <div className="crt-shadowmask absolute inset-0 opacity-50" />
      <div className="crt-vignette absolute inset-0" />
      {/* Slow phosphor flicker.
          The opacity is declared here as well as in the keyframes, and it
          has to be. This layer is a full-bleed sheet of `phos-300`; its
          only opacity used to live inside `@keyframes crt-flicker`, so on
          any device that declined to run the animation it painted at 1 —
          a solid mint screen over the whole stage. That is what
          `prefers-reduced-motion` did here, via the `.motion-guard` rule
          below, and a refiner with Reduce Motion switched on saw the
          terminal only until the first screen that sits above z-50.
          A layer whose resting appearance comes only from a keyframe is a
          bug waiting for a device that does not animate. */}
      <div className="absolute inset-0 animate-crt-flicker bg-phos-300 opacity-[0.035]" />
      {/* Rolling refresh bar. */}
      <div
        className="absolute inset-x-0 h-[8%] opacity-[0.03]"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(195,253,223,0.55), transparent)",
          animation: "boot-sweep 9s linear infinite",
        }}
      />
      {glitch ? (
        <div
          className="absolute inset-0 bg-alarm/25 mix-blend-screen"
          style={{ animation: "glitch-shift 220ms steps(2, end) 2" }}
        />
      ) : null}
    </div>
  );
}
