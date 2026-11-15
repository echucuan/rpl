import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "katex/dist/katex.min.css";
import "./styles.css";
import { App } from "./ui/App";
import { MascotLab } from "./ui/mascot/MascotLab";
import "./ui/mascot/mascot.css";

// Dev preview of the mascot: open #mascota (temporary, not linked from the app).
const lab = import.meta.env.DEV && location.hash === "#mascota";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {lab ? <MascotLab /> : <App />}
  </StrictMode>,
);
