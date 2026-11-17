import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/700.css";
import "katex/dist/katex.min.css";
import "./styles.css";
import { App } from "./ui/App";
import { DataPage } from "./ui/datos/DataPage";
import { MascotLab } from "./ui/mascot/MascotLab";
import { startUsage } from "./ui/usage";
import "./ui/mascot/mascot.css";

// Dev preview of the mascot: open #mascota (temporary, not linked from the app).
const lab = import.meta.env.DEV && location.hash === "#mascota";
// The teacher's data page: open …/rpl/#datos (not linked from the app; it asks for the data key).
const datos = location.hash === "#datos";
// Typing #datos in the address bar of an open RPL reloads it as the data page.
addEventListener("hashchange", () => location.hash === "#datos" && !datos && location.reload());
if (!lab && !datos) startUsage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {lab ? <MascotLab /> : datos ? <DataPage /> : <App />}
  </StrictMode>,
);
