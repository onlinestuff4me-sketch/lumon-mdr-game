import { GameStage } from "./components/GameStage";
import { DanceOnly } from "./components/DanceOnly";

/**
 * Which door was used.
 *
 * `/dance` is a test door onto the Music Dance Experience — reaching it in
 * the game proper costs eight files, which is the right price for a
 * refiner and an absurd one for judging whether the floor feels good.
 *
 * Three spellings, because the two hosts this ships to disagree about
 * paths. Vercel rewrites `/dance` to the document; GitHub Pages has no
 * rewrites and answers an unknown path with `404.html`, which the build
 * makes a copy of `index.html` for exactly this reason. `#dance` and
 * `?dance` work everywhere with no server involved at all, and are the
 * fallback if either of those arrangements is ever undone.
 */
function wantsDance(): boolean {
  if (typeof window === "undefined") return false;
  const { pathname, hash, search } = window.location;
  return (
    /\/dance\/?$/.test(pathname) ||
    hash.replace(/^#\/?/, "") === "dance" ||
    new URLSearchParams(search).has("dance")
  );
}

export default function App() {
  return wantsDance() ? <DanceOnly /> : <GameStage />;
}
