import type { ReactNode } from "react";

/**
 * Locks the whole experience to a 9:16 portrait screen.
 *
 * On a phone this fills the display; on a desktop it letterboxes to a
 * centred slab so the CRT never stretches. Sizing is done with a pure CSS
 * `min()` pair rather than a resize listener — no layout thrash, and it
 * survives the mobile URL bar collapsing (dvh).
 */
export function Viewport({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-black">
      {/* Ambient phosphor spill onto the desktop letterbox. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 50%, rgba(23,168,102,0.14), transparent 70%)",
        }}
      />
      <div
        className="crt-bezel relative overflow-hidden rounded-[18px] bg-phos-950"
        style={{
          width: "min(100vw, calc(var(--app-h) * 9 / 16))",
          height: "min(var(--app-h), calc(100vw * 16 / 9))",
        }}
      >
        {children}
      </div>
    </div>
  );
}
