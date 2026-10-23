import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { Design, EstesDesign, WaterDesign } from "../model";
import { newEstesDesign, newWaterDesign } from "../model";
import { simulate } from "../physics/simulate";
import { DesignForm } from "./DesignForm";
import { Results } from "./Results";
import { About } from "./About";
import { Designs } from "./Designs";
import { downloadDesign, loadCurrent, saveDesign, storeCurrent } from "./storage";

type Tab = "estes" | "water" | "designs" | "about";

const TABS: { id: Tab; label: string }[] = [
  { id: "estes", label: "Cohete Estes" },
  { id: "water", label: "Cohete de agua" },
  { id: "designs", label: "Mis diseños" },
  { id: "about", label: "Acerca de" },
];

/** Fills fields missing from designs saved by older versions with today's defaults. */
export function normalize(d: Design): Design {
  const base = d.type === "water" ? newWaterDesign() : newEstesDesign();
  const merged: Record<string, unknown> = { ...base, ...d };
  for (const [k, v] of Object.entries(base)) {
    if (v && typeof v === "object" && !Array.isArray(v)) merged[k] = { ...v, ...((d as unknown as Record<string, object>)[k] ?? {}) };
  }
  return merged as unknown as Design;
}

export function App() {
  const [tab, setTab] = useState<Tab>(() => (location.hash.slice(1) as Tab) || "estes");
  const [estes, setEstes] = useState<EstesDesign>(() => normalize(loadCurrent<EstesDesign>("estes") ?? newEstesDesign()) as EstesDesign);
  const [water, setWater] = useState<WaterDesign>(() => normalize(loadCurrent<WaterDesign>("water") ?? newWaterDesign()) as WaterDesign);
  const [savedIds, setSavedIds] = useState<Partial<Record<Design["type"], string>>>({});

  useEffect(() => { history.replaceState(null, "", `#${tab}`); }, [tab]);
  useEffect(() => {
    const onHash = () => {
      const t = location.hash.slice(1) as Tab;
      if (TABS.some((x) => x.id === t)) setTab(t);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => { storeCurrent(estes); }, [estes]);
  useEffect(() => { storeCurrent(water); }, [water]);

  const open = (d: Design, id?: string) => {
    const n = normalize(d);
    if (n.type === "estes") setEstes(n); else setWater(n);
    setSavedIds((s) => ({ ...s, [n.type]: id }));
    setTab(n.type);
  };

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <div className="brand">
            <img src={`${import.meta.env.BASE_URL}brand/logo-tec-azul.png`} alt="Tecnológico de Monterrey" />
            <div className="brand-title">
              <h1>Rocket Physics Lab</h1>
              <p>Simulador de cohetes · Campus Sinaloa</p>
            </div>
          </div>
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
          </nav>
        </div>
      </header>
      <main>
        {tab === "estes" && (
          <Designer
            design={estes}
            onChange={(d) => setEstes(d as EstesDesign)}
            onLoadKit={(d) => { setEstes(d); setSavedIds((s) => ({ ...s, estes: undefined })); }}
            savedId={savedIds.estes}
            onSaved={(id) => setSavedIds((s) => ({ ...s, estes: id }))}
            onNew={() => { setEstes(newEstesDesign()); setSavedIds((s) => ({ ...s, estes: undefined })); }}
          />
        )}
        {tab === "water" && (
          <Designer
            design={water}
            onChange={(d) => setWater(d as WaterDesign)}
            savedId={savedIds.water}
            onSaved={(id) => setSavedIds((s) => ({ ...s, water: id }))}
            onNew={() => { setWater(newWaterDesign()); setSavedIds((s) => ({ ...s, water: undefined })); }}
          />
        )}
        {tab === "designs" && <Designs onOpen={open} />}
        {tab === "about" && <About />}
      </main>
      <footer>
        Rocket Physics Lab · Tecnológico de Monterrey, Campus Sinaloa · Software libre (GPL-3.0). Datos de motores y piezas Estes tomados de OpenRocket.
      </footer>
    </>
  );
}

function Designer({ design, onChange, onLoadKit, savedId, onSaved, onNew }: {
  design: Design;
  onChange: (d: Design) => void;
  onLoadKit?: (d: EstesDesign) => void;
  savedId?: string;
  onSaved: (id: string) => void;
  onNew: () => void;
}) {
  const deferred = useDeferredValue(design);
  const result = useMemo(() => simulate(deferred), [deferred]);
  const [notice, setNotice] = useState("");

  const save = () => {
    const entry = saveDesign(design, savedId);
    setNotice(entry ? "Guardado en este navegador." : "No se pudo guardar: el navegador no permite almacenamiento.");
    if (entry) onSaved(entry.id);
    setTimeout(() => setNotice(""), 3000);
  };

  return (
    <div className="designer">
      <div className="form">
        <div className="btn-row">
          <button type="button" className="btn primary" onClick={save}>Guardar</button>
          <button type="button" className="btn" onClick={() => downloadDesign(design)}>Descargar archivo</button>
          <button type="button" className="btn" onClick={() => confirm("¿Empezar un diseño nuevo? Los cambios sin guardar se pierden.") && onNew()}>Nuevo</button>
        </div>
        {notice && <p className="hint">{notice}</p>}
        <DesignForm design={design} update={(fn) => onChange(fn(design))} onLoadKit={onLoadKit} />
      </div>
      <Results design={deferred} result={result} />
    </div>
  );
}
