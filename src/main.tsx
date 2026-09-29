import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { watchForTrouble } from "./game/diagnostics.ts";
import "./index.css";

// Before the first render, so a crash on the way up is still in the
// report a refiner can hand back.
watchForTrouble();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
