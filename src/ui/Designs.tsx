import { useState } from "react";
import { PROGRAMS } from "./StartScreen";
import type { Design } from "../model";
import { deleteDesign, downloadDesign, listDesigns, readDesignFile, saveDesign } from "./storage";

export function Designs({ onOpen }: { onOpen: (d: Design, id?: string) => void }) {
  const [list, setList] = useState(listDesigns);
  const [error, setError] = useState("");

  const upload = async (file: File) => {
    const d = await readDesignFile(file);
    if (typeof d === "string") { setError(d); return; }
    setError("");
    const entry = saveDesign(d);
    setList(listDesigns());
    onOpen(d, entry?.id);
  };

  return (
    <div className="card">
      <div className="card-head">
        <h2>Mis diseños</h2>
        <label className="btn small">
          Abrir archivo…
          <input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
      </div>
      <p className="hint" style={{ marginBottom: 12 }}>
        Se guardan solo en este navegador y en este equipo. Para entregarlos o usarlos en otra computadora, descarga el archivo.
      </p>
      {error && <div className="alert error" style={{ marginBottom: 12 }}>{error}</div>}
      {list.length === 0 && <p className="empty">Todavía no guardas ningún diseño.</p>}
      <div className="designs">
        {list.map((s) => (
          <div className="design-row panel" style={{ padding: "10px 14px" }} key={s.id}>
            <div className="meta">
              <b>{s.design.name}</b>
              <small>{PROGRAMS[s.design.type].name} · {PROGRAMS[s.design.type].fuel.toLowerCase()} · {new Date(s.savedAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</small>
            </div>
            <div className="btn-row">
              <button type="button" className="btn small primary" onClick={() => onOpen(s.design, s.id)}>Abrir</button>
              <button type="button" className="btn small" onClick={() => downloadDesign(s.design)}>Descargar</button>
              <button type="button" className="btn small danger" onClick={() => {
                if (!confirm(`¿Borrar "${s.design.name}" de este navegador?`)) return;
                deleteDesign(s.id);
                setList(listDesigns());
              }}>Borrar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
