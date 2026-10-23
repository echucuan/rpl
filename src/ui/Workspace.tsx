import { Component, useDeferredValue, useMemo, useState, type ReactNode } from "react";
import type { Design, EstesDesign } from "../model";
import { simulate } from "../physics/simulate";
import { RocketTab } from "./RocketTab";
import { GraphsTab, type Comparison } from "./GraphsTab";
import { Phase1Lesson } from "./learn/Phase1Lesson";
import { Phase2Lesson } from "./learn/Phase2Lesson";
import { Phase3Lesson } from "./learn/Phase3Lesson";
import { Phase4Lesson } from "./learn/Phase4Lesson";
import { StabilityLesson } from "./learn/StabilityLesson";
import { NumericalLesson } from "./learn/NumericalLesson";
import { downloadDesign, saveDesign } from "./storage";

export type SubTab = "cohete" | "graficas" | "fase1" | "fase2" | "fase3" | "fase4" | "estabilidad" | "metodo";

const DESIGN_TABS: { id: SubTab; label: string }[] = [
  { id: "cohete", label: "Cohete" },
  { id: "graficas", label: "Gráficas" },
];

export const LESSONS: { id: SubTab; label: string }[] = [
  { id: "fase1", label: "Fase 1 · Empuje" },
  { id: "fase2", label: "Fase 2 · Frenado" },
  { id: "fase3", label: "Fase 3 · Caída libre" },
  { id: "fase4", label: "Fase 4 · Paracaídas" },
  { id: "estabilidad", label: "Estabilidad" },
  { id: "metodo", label: "Método numérico" },
];

export const SUB_TABS = [...DESIGN_TABS, ...LESSONS].map((t) => t.id);

interface Props {
  design: Design;
  onChange: (d: Design) => void;
  sub: SubTab;
  onSub: (s: SubTab) => void;
  onLoadKit?: (d: EstesDesign) => void;
  savedId?: string;
  onSaved: (id: string) => void;
  onNew: () => void;
}

export function Workspace({ design, onChange, sub, onSub, onLoadKit, savedId, onSaved, onNew }: Props) {
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
      <div className="workspace-bar no-print">
        <div className="subtabs" role="tablist" aria-label="Diseño">
          {DESIGN_TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={sub === t.id} onClick={() => go(t.id)}>{t.label}</button>
          ))}
        </div>
        <div className="subtabs lessons" role="tablist" aria-label="Aprende cómo se calcula">
          <span className="subtabs-label">Aprende cómo se calcula:</span>
          {LESSONS.map((t) => (
            <button key={t.id} role="tab" aria-selected={sub === t.id} onClick={() => go(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="workspace-actions">
          {notice && <span className="hint">{notice}</span>}
          <button type="button" className="btn small primary" onClick={save}>Guardar</button>
          <button type="button" className="btn small" onClick={() => downloadDesign(design)}>Descargar</button>
          <button type="button" className="btn small" onClick={() => confirm("¿Empezar un diseño nuevo? Los cambios sin guardar se pierden.") && onNew()}>Nuevo</button>
        </div>
      </div>

      <ErrorBoundary key={sub}>
      {typeof result === "string" && sub !== "cohete" ? (
        <div className="card"><div className="alert error">{result} Corrige el diseño en la pestaña Cohete.</div></div>
      ) : (
        <>
          {sub === "cohete" && <RocketTab design={design} shown={deferred} result={result} onChange={onChange} onLoadKit={onLoadKit} onGo={go} />}
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
