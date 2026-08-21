import { useEffect, useState, useSyncExternalStore } from "react";
import { GameEngine, type HudSnapshot } from "../game/engine";

/**
 * Creates the engine once per mount and keeps React in step with it.
 *
 * A lazy `useState` initialiser (rather than a ref written during render)
 * gives a stable instance without touching a ref mid-render. The engine
 * allocates nothing expensive in its constructor and starts no loop until
 * `attach` is called, so StrictMode's double invocation is harmless.
 */
export function useEngine(): { engine: GameEngine; hud: HudSnapshot } {
  const [engine] = useState(() => new GameEngine());

  const hud = useSyncExternalStore(engine.subscribe, engine.getSnapshot);

  useEffect(() => {
    return () => {
      engine.dispose();
    };
  }, [engine]);

  return { engine, hud };
}
