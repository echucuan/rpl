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
import { NumericalLesson } from "./learn/NumericalLesson";
import { saveDesign } from "./storage";
import { PROGRAMS, logoUrl } from "./StartScreen";
import { PHASE_SOLID, type PhaseId } from "./phases";

export type SubTab = "cohete" | "graficas" | "fase1" | "fase2" | "fase3" | "fase4" | "estabilidad" | "metodo";

/** First menu row: the design and the topics that apply to the whole flight. */
const MAIN_TABS: { id: SubTab; label: string }[] = [
  { id: "cohete", label: "Cohete" },
  { id: "graficas", label: "Gráficas" },
  { id: "estabilidad", label: "Estabilidad" },
  { id: "metodo", label: "Método numérico" },
];

/** Second menu row: one lesson per flight phase. */
const PHASE_TABS: { id: SubTab; n: number; label: string }[] = [
  { id: "fase1", n: 1, label: "Empuje" },
  { id: "fase2", n: 2, label: "Frenado hasta el apogeo" },
  { id: "fase3", n: 3, label: "Caída libre" },
  { id: "fase4", n: 4, label: "Paracaídas y aterrizaje" },
];

/** Reading order of the lessons, for the previous/next buttons. */
export const LESSONS: { id: SubTab; label: string }[] = [
  ...PHASE_TABS.map((t) => ({ id: t.id, label: `Fase ${t.n} · ${t.label}` })),
  { id: "estabilidad", label: "Estabilidad" },
  { id: "metodo", label: "Método numérico" },
];

export const SUB_TABS = [...MAIN_TABS, ...PHASE_TABS].map((t) => t.id);

interface Props {
  design: Design;
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
  onHome: () => void;
}

export function Workspace({ design, onChange, sub, onSub, savedId, onSaved, onDownload, exporting, exportError, onNew, onHome }: Props) {
  const deferred = useDeferredValue(design);
  const result = useMemo(() => simulate(deferred), [deferred]);
  const [notice, setNotice] = useState("");
  const [comparison, setComparison] = useState<Comparison>({ altimeter: 0, altimeterUnit: "ft", csv: null });

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
        <img src={logoUrl(design.type)} alt={`Logotipo de ${PROGRAMS[design.type].name}`} />
        <div>
          <span className="program-fuel">{PROGRAMS[design.type].fuel}</span>
          <h2>{PROGRAMS[design.type].name}</h2>
        </div>
        <div className="banner-actions no-print">
          {exportError ? <span className="banner-notice" role="alert">No se pudo crear el archivo: {exportError}</span> : notice && <span className="banner-notice">{notice}</span>}
          <button type="button" className="btn small solid" onClick={save} title="Guarda una copia en Mis diseños, solo en este navegador">Guardar</button>
          <button type="button" className="btn small" onClick={onDownload} disabled={exporting} title="Guarda el archivo del proyecto en tu computadora">
            {exporting ? "Preparando…" : "Descargar"}
          </button>
          <button type="button" className="btn small" onClick={onNew}>Nuevo</button>
          <button type="button" className="btn small" onClick={onHome}>Cambiar combustible</button>
        </div>
      </div>

      <nav className="workspace-menu no-print" aria-label="Secciones">
        <div className="menu-row main" role="tablist">
          {MAIN_TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={sub === t.id} onClick={() => go(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="menu-row phases" role="tablist" aria-label="El vuelo por fases">
          <span className="menu-label">El vuelo por fases</span>
          {PHASE_TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={sub === t.id} onClick={() => go(t.id)} style={{ ["--phase" as string]: PHASE_SOLID[t.n as PhaseId] }}>
              <span className="phase-dot">{t.n}</span>{t.label}
            </button>
          ))}
        </div>
      </nav>

      <ErrorBoundary key={sub}>
      {typeof result === "string" && sub !== "cohete" ? (
        <div className="card"><div className="alert error">{result} Corrige el diseño en la pestaña Cohete.</div></div>
      ) : (
        <>
          {sub === "cohete" && <RocketTab design={design} shown={deferred} result={result} onChange={onChange} onGo={go} />}
          {typeof result !== "string" && (
            <>
              {sub === "graficas" && <GraphsTab design={deferred} result={result} comparison={comparison} onComparison={setComparison} onLesson={go} />}
              {sub === "fase1" && <Phase1Lesson design={deferred} result={result} onPhase={(id) => go(`fase${id}`)} />}
              {sub === "fase2" && <Phase2Lesson design={deferred} result={result} onPhase={(id) => go(`fase${id}`)} />}
              {sub === "fase3" && <Phase3Lesson design={deferred} result={result} onPhase={(id) => go(`fase${id}`)} />}
              {sub === "fase4" && <Phase4Lesson design={deferred} result={result} onPhase={(id) => go(`fase${id}`)} />}
              {sub === "estabilidad" && <StabilityLesson design={deferred} result={result} />}
              {sub === "metodo" && <NumericalLesson design={deferred} result={result} />}
            </>
          )}
        </>
      )}
      </ErrorBoundary>
      {sub !== "cohete" && sub !== "graficas" && (
        <LessonNav sub={sub} go={go} />
      )}
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

function LessonNav({ sub, go }: { sub: SubTab; go: (s: SubTab) => void }) {
  const i = LESSONS.findIndex((l) => l.id === sub);
  const prev = LESSONS[i - 1], next = LESSONS[i + 1];
  return (
    <div className="lesson-nav no-print">
      {prev ? <button className="btn" onClick={() => go(prev.id)}>← {prev.label}</button> : <button className="btn" onClick={() => go("graficas")}>← Gráficas</button>}
      {next ? <button className="btn primary" onClick={() => go(next.id)}>{next.label} →</button> : <button className="btn primary" onClick={() => go("cohete")}>Volver al cohete</button>}
    </div>
  );
}
