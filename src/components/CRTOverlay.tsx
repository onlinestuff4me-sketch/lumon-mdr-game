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
      {/* Slow phosphor flicker. */}
      <div className="absolute inset-0 animate-crt-flicker bg-phos-300" />
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
