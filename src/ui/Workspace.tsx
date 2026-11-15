import { Component, useDeferredValue, useMemo, useState, type ReactNode } from "react";
import type { Design } from "../model";
import { simulate } from "../physics/simulate";
import { RocketTab } from "./RocketTab";
import { GraphsTab, type Comparison } from "./GraphsTab";
import { Phase1Lesson } from "./learn/Phase1Lesson";
import { Phase2Lesson } from "./learn/Phase2Lesson";
import { Phase3Lesson } from "./learn/Phase3Lesson";
import { Phase4Lesson } from "./learn/Phase4Lesson";
import { StabilityLesson } from "./learn/StabilityLesson";
import { LessonTypeContext } from "./learn/common";
import { saveDesign } from "./storage";
import { PHASE_SOLID, flightPhases, phaseName, phaseNum, type PhaseId } from "./phases";
import { format } from "./fields";
import { Phase0Lesson } from "./learn/Phase0Lesson";
import { StaticTestLesson } from "./learn/StaticTestLesson";
import type { StaticTestFile } from "./staticTest";

export type SubTab = "cohete" | "graficas" | "fase0" | "fase1" | "fase2" | "fase3" | "fase4" | "estabilidad";

/**
 * First menu row: the steps before the flight, in order. Rocket Tec starts with the motor (its static test);
 * Rocket Challenge with the experiment.
 */
const MAIN_TABS = (type: Design["type"]): { id: SubTab; label: string; icon: string; sub: string }[] => [
  type === "water"
    ? { id: "fase0", label: "Experimento", icon: "🧪", sub: "Paso 1 · prepara el experimento" }
    : { id: "fase0", label: "Motor", icon: "🔥", sub: "Paso 1 · prueba estática del motor" },
  { id: "cohete", label: "Cohete", icon: "🚀", sub: "Paso 2 · arma tu cohete" },
  { id: "estabilidad", label: "Estabilidad", icon: "⚖️", sub: "Paso 3 · que vuele en línea recta" },
];

/** Second menu row: one lesson per flight phase (names and numerals depend on the program). */
const PHASE_IDS: PhaseId[] = [1, 2, 3, 4];
const PHASE_TABS = (type: Design["type"]): { id: SubTab; n: string; label: string; color: string }[] =>
  PHASE_IDS.map((id) => ({ id: `fase${id}` as SubTab, n: phaseNum(type, id), label: phaseName(type, id), color: PHASE_SOLID[id] }));
const phaseTabs = PHASE_TABS;

/** After the four phases: the whole flight simulated, with all its charts and results. */
const SIM_TAB = { id: "graficas" as SubTab, label: "Simulaciones", color: "#0039a6" };

/** Reading order of the lessons, for the previous/next buttons. */
const lessons = (type: Design["type"]): { id: SubTab; label: string }[] => [
  ...MAIN_TABS(type).map((t) => ({ id: t.id, label: t.label })),
  ...phaseTabs(type).map((t) => ({ id: t.id, label: `Fase ${t.n} · ${t.label}` })),
  { id: SIM_TAB.id, label: SIM_TAB.label },
];

export const SUB_TABS: SubTab[] = ["fase0", "cohete", "estabilidad", SIM_TAB.id, ...PHASE_IDS.map((id) => `fase${id}` as SubTab)];

interface Props {
  design: Design;
  /** The save status, shown at the left of the banner. */
  status?: ReactNode;
  onChange: (d: Design) => void;
  sub: SubTab;
  onSub: (s: SubTab) => void;
  savedId?: string;
  onSaved: (id: string) => void;
  /** Saves the project file; the app tracks whether it worked. */
  onDownload: () => void;
  exporting: boolean;
  exportError: string | null;
  /** Both go through the app's unsaved-changes check. */
  onNew: () => void;
}

export function Workspace({ design, onChange, sub, onSub, savedId, onSaved, onDownload, exporting, exportError, onNew, status }: Props) {
  const deferred = useDeferredValue(design);
  const result = useMemo(() => simulate(deferred), [deferred]);
  const phaseSpans = useMemo(() => (typeof result === "string" ? null : flightPhases(result)), [result]);
  const [notice, setNotice] = useState("");
  const [comparison, setComparison] = useState<Comparison>({ altimeter: 0, altimeterUnit: design.type === "water" ? "m" : "ft", apogeeTime: 0, descentTime: 0, csv: null });
  const [staticTest, setStaticTest] = useState<StaticTestFile | null>(null);
  const view: SubTab = sub;
  // The flight phases only show during the flight: "Go for launch" takes off into Fase I, and going back to
  // Motor, Cohete or Estabilidad hides them again.
  const showPhases = view === SIM_TAB.id || /^fase[1-4]$/.test(view);

  const save = () => {
    const entry = saveDesign(design, savedId);
    setNotice(entry ? "Guardado en este navegador." : "No se pudo guardar: el navegador no permite almacenamiento.");
    if (entry) onSaved(entry.id);
    setTimeout(() => setNotice(""), 3000);
  };

  const go = (s: SubTab) => {
    onSub(s);
    scrollTo({ top: 0 });
  };

  return (
    <>
      <div className={`program-banner ${design.type}`}>
        <div className="banner-program">{status}</div>
        <h1 className="banner-title">Rocket Physics Lab <span>Sinaloa</span></h1>
        <div className="banner-actions no-print">
          {exportError ? <span className="banner-notice" role="alert">No se pudo crear el archivo: {exportError}</span> : notice && <span className="banner-notice">{notice}</span>}
          <button type="button" className="bar-btn primary" onClick={save} title="Guarda una copia en Mis diseños, solo en este navegador"><span aria-hidden="true">💾</span><span className="bar-label">Guardar</span></button>
          <button type="button" className="bar-btn" onClick={onDownload} disabled={exporting} title="Guarda el archivo del proyecto en tu computadora" aria-label="Descargar">
            <span aria-hidden="true">⬇</span><span className="bar-label">{exporting ? "Preparando…" : "Descargar"}</span>
          </button>
          <button type="button" className="bar-btn" onClick={onNew} title="Empieza un diseño nuevo" aria-label="Nuevo"><span aria-hidden="true">＋</span><span className="bar-label">Nuevo</span></button>
        </div>
      </div>

      <nav className="workspace-menu no-print" aria-label="Secciones">
        <div className="menu-row main" role="tablist">
          {MAIN_TABS(design.type).map((t) => (
            <button key={t.id} role="tab" aria-selected={view === t.id} onClick={() => go(t.id)}><span className="tab-icon" aria-hidden="true">{t.icon}</span><span className="tab-text">{t.label}<small>{t.sub}</small></span></button>
          ))}
          <button type="button" className={`launch-btn${showPhases ? " launched" : ""}`} aria-pressed={showPhases} aria-expanded={showPhases} onClick={() => go("fase1")}>
            <span className="tab-icon" aria-hidden="true">{showPhases ? "🚀" : "🟢"}</span>
            <span className="tab-text">Go for launch<small>{showPhases ? "¡despegue! vuelo por fases" : "Paso 4 · despega y sigue el vuelo"}</small></span>
          </button>
        </div>
        {showPhases && (
        <div className="menu-row phases" role="tablist" aria-label="El vuelo por fases">
          <span className="menu-label">El vuelo por fases</span>
          {phaseTabs(design.type).map((t) => {
            const ph = phaseSpans?.find((p) => `fase${p.id}` === t.id);
            return (
              <button key={t.id} role="tab" aria-selected={view === t.id} onClick={() => go(t.id)} style={{ ["--phase" as string]: t.color }} className={ph && !ph.exists ? "missing" : undefined}>
                <span className="phase-dot">{t.n}</span>
                <span className="phase-tab-text">
                  {t.label}
                  {ph && <small>{ph.exists ? `${format(ph.from, ph.to < 1 ? 3 : 2)} – ${format(ph.to, ph.to < 1 ? 3 : 1)} s · dura ${format(ph.to - ph.from, ph.to - ph.from < 1 ? 3 : 1)} s` : "No existe en este vuelo"}</small>}
                </span>
              </button>
            );
          })}
          <span className="menu-sep" aria-hidden="true" />
          <button role="tab" aria-selected={view === SIM_TAB.id} onClick={() => go(SIM_TAB.id)} style={{ ["--phase" as string]: SIM_TAB.color }} className="sim-tab">
            <span className="phase-dot">▶</span>
            <span className="phase-tab-text">
              {SIM_TAB.label}
              <small>todo el vuelo · gráficas y resultados</small>
            </span>
          </button>
        </div>
        )}
      </nav>

      <ErrorBoundary key={view}>
      {typeof result === "string" && view !== "cohete" && view !== "fase0" ? (
        <div className="card"><div className="alert error">{result} Corrige el diseño en la pestaña Cohete.</div></div>
      ) : (
        <>
          {view === "fase0" && deferred.type === "water" && <Phase0Lesson design={deferred} result={typeof result === "string" ? null : result} onGo={go} />}
          {view === "fase0" && design.type === "estes" && <StaticTestLesson design={design} onChange={onChange} file={staticTest} onFile={setStaticTest} onGo={go} />}
          {view === "cohete" && <RocketTab design={design} shown={deferred} result={result} onChange={onChange} onGo={go} />}
          {typeof result !== "string" && (
            <LessonTypeContext.Provider value={deferred.type}>
              {view === "graficas" && <GraphsTab design={deferred} result={result} comparison={comparison} onComparison={setComparison} onLesson={go} />}
              {view === "fase1" && <Phase1Lesson design={deferred} result={result} onPhase={(id) => go(`fase${id}`)} onChange={onChange} />}
              {view === "fase2" && <Phase2Lesson design={deferred} result={result} onPhase={(id) => go(`fase${id}`)} onChange={onChange} />}
              {view === "fase3" && <Phase3Lesson design={deferred} result={result} onPhase={(id) => go(`fase${id}`)} onChange={onChange} />}
              {view === "fase4" && <Phase4Lesson design={deferred} result={result} onPhase={(id) => go(`fase${id}`)} onChange={onChange} />}
              {view === "estabilidad" && <StabilityLesson design={deferred} result={result} />}
            </LessonTypeContext.Provider>
          )}
        </>
      )}
      </ErrorBoundary>
      <LessonNav sub={view} type={design.type} go={go} />
    </>
  );
}

/** Keeps one broken tab from blanking the whole page. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    if (this.state.error) {
      return <div className="card"><div className="alert error">Esta pestaña tuvo un error ({this.state.error}). Revisa los datos del diseño o cambia de pestaña.</div></div>;
    }
    return this.props.children;
  }
}

function LessonNav({ sub, type, go }: { sub: SubTab; type: Design["type"]; go: (s: SubTab) => void }) {
  const LESSONS = lessons(type);
  const i = LESSONS.findIndex((l) => l.id === sub);
  const prev = LESSONS[i - 1], next = LESSONS[i + 1];
  return (
    <div className="lesson-nav no-print">
      {prev ? <button className="btn" onClick={() => go(prev.id)}>← {prev.label}</button> : <span />}
      {next && sub === "estabilidad"
        ? <button className="btn primary" onClick={() => go(next.id)}>🟢 Go for launch →</button>
        : next ? <button className="btn primary" onClick={() => go(next.id)}>{next.label} →</button> : <button className="btn primary" onClick={() => go("cohete")}>Volver al cohete</button>}
    </div>
  );
}
