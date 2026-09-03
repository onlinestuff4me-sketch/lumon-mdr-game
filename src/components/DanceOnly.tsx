import { useState } from "react";
import { CATALOG } from "../game/catalog";
import { loadSettings } from "../game/settings";
import { MdeStage } from "./MdeStage";
import { Viewport } from "./Viewport";
import { CRTOverlay } from "./CRTOverlay";

/**
 * The dance floor on its own, at `/dance`.
 *
 * A test door, not a feature. Reaching the Music Dance Experience in the
 * game proper means refining eight files, which is the right price for a
 * refiner and an absurd one for anyone trying to judge whether the floor
 * feels good — so the floor gets a URL, and the eight files stay where
 * they are.
 *
 * It runs the real component with the real reward record and the real
 * settings, because a rehearsal on a different stage tells you about the
 * rehearsal. The only thing it does that the game does not is offer
 * another go at the end.
 */
export function DanceOnly() {
  /**
   * A fresh seed per go, so this door shows many floors rather than one.
   *
   * Held in state and rolled in the handler rather than derived at render:
   * a seed computed while rendering is a different floor on every
   * incidental re-render, which is the one thing a floor must not be.
   */
  const [run, setRun] = useState(() => (Date.now() * 2654435761) >>> 0);
  const reward = CATALOG.R07;
  if (!reward) return null;
  return (
    <Viewport>
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-phos-950">
        <MdeStage
          key={run}
          reward={reward}
          // A different floor every time rather than the rung's fixed seed:
          // the point of this door is to see many of them.
          seed={run}
          muted={loadSettings().muted}
          onDone={() => setRun((n) => (n * 1664525 + 1013904223) >>> 0)}
        />
        <CRTOverlay />
      </div>
    </Viewport>
  );
}
