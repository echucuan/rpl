import { useEffect, useState } from "react";
import type { Design, EstesDesign, WaterDesign } from "../model";
import { newEstesDesign, newWaterDesign } from "../model";
import { About } from "./About";
import { Designs } from "./Designs";
import { Workspace, SUB_TABS, type SubTab } from "./Workspace";
import { loadCurrent, storeCurrent } from "./storage";
import { PROGRAMS, StartScreen, logoUrl } from "./StartScreen";

type Tab = "inicio" | "estes" | "water" | "designs" | "about";

const TABS: { id: Tab; label: string; logo?: Design["type"] }[] = [
  { id: "inicio", label: "Inicio" },
  { id: "estes", label: PROGRAMS.estes.name, logo: "estes" },
  { id: "water", label: PROGRAMS.water.name, logo: "water" },
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

/** Location hash: "#estes/graficas" → tab and sub-tab. */
function parseHash(): { tab: Tab; sub: SubTab } {
  const [t, s] = location.hash.slice(1).split("/");
  return {
    tab: TABS.some((x) => x.id === t) ? (t as Tab) : "inicio",
    sub: SUB_TABS.includes(s as SubTab) ? (s as SubTab) : "cohete",
  };
}

export function App() {
  const [{ tab, sub }, setRoute] = useState(parseHash);
  const [estes, setEstes] = useState<EstesDesign>(() => normalize(loadCurrent<EstesDesign>("estes") ?? newEstesDesign()) as EstesDesign);
  const [water, setWater] = useState<WaterDesign>(() => normalize(loadCurrent<WaterDesign>("water") ?? newWaterDesign()) as WaterDesign);
  const [savedIds, setSavedIds] = useState<Partial<Record<Design["type"], string>>>({});

  useEffect(() => {
    const hash = tab === "estes" || tab === "water" ? `#${tab}/${sub}` : `#${tab}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }, [tab, sub]);
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => { storeCurrent(estes); }, [estes]);
  useEffect(() => { storeCurrent(water); }, [water]);

  const setTab = (t: Tab) => setRoute((r) => ({ tab: t, sub: r.sub }));
  const setSub = (s: SubTab) => setRoute((r) => ({ ...r, sub: s }));

  const open = (d: Design, id?: string) => {
    const n = normalize(d);
    if (n.type === "estes") setEstes(n); else setWater(n);
    setSavedIds((s) => ({ ...s, [n.type]: id }));
    setRoute({ tab: n.type, sub: "cohete" });
  };

  return (
    <>
      <header className="top">
        <div className="top-inner">
          <div className="brand">
            <img src={`${import.meta.env.BASE_URL}brand/logo-tec-azul.png`} alt="Tecnológico de Monterrey" />
            <div className="brand-title">
              <h1>Rocket Physics Lab</h1>
              <p>Física · Matemáticas · Computación — Campus Sinaloa</p>
            </div>
          </div>
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
                {t.logo && <img className="tab-logo" src={logoUrl(t.logo)} alt="" />}
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main>
        {tab === "inicio" && <StartScreen onPick={(type) => setRoute({ tab: type, sub: "cohete" })} />}
        {tab === "estes" && (
          <Workspace
            design={estes}
            onChange={(d) => setEstes(d as EstesDesign)}
            sub={sub}
            onSub={setSub}
            savedId={savedIds.estes}
            onSaved={(id) => setSavedIds((s) => ({ ...s, estes: id }))}
            onNew={() => { setEstes(newEstesDesign()); setSavedIds((s) => ({ ...s, estes: undefined })); }}
            onHome={() => setTab("inicio")}
          />
        )}
        {tab === "water" && (
          <Workspace
            design={water}
            onChange={(d) => setWater(d as WaterDesign)}
            sub={sub}
            onSub={setSub}
            savedId={savedIds.water}
            onSaved={(id) => setSavedIds((s) => ({ ...s, water: id }))}
            onNew={() => { setWater(newWaterDesign()); setSavedIds((s) => ({ ...s, water: undefined })); }}
            onHome={() => setTab("inicio")}
          />
        )}
        {tab === "designs" && <Designs onOpen={open} />}
        {tab === "about" && <About />}
      </main>
      <footer>
        Rocket Physics Lab · Tecnológico de Monterrey, Campus Sinaloa · Software libre (GPL-3.0). Especificaciones de productos: Estes Industries.
      </footer>
    </>
  );
}
