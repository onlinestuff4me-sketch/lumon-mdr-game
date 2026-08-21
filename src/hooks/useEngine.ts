import { useEffect, useRef, useSyncExternalStore } from "react";
import { GameEngine, type HudSnapshot } from "../game/engine";

/** Creates the engine once per mount and keeps React in step with it. */
export function useEngine(): { engine: GameEngine; hud: HudSnapshot } {
  const ref = useRef<GameEngine | null>(null);
  if (ref.current === null) ref.current = new GameEngine();
  const engine = ref.current;

  const hud = useSyncExternalStore(engine.subscribe, engine.getSnapshot);

  useEffect(() => {
    return () => {
      engine.dispose();
    };
  }, [engine]);

  return { engine, hud };
}
