import { Component, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Design } from "../model";
import { designStatics, simulate } from "../physics/simulate";
import { stabilityStatus } from "./stabilityStatus";
import { RocketTab } from "./RocketTab";
import { rocketStepLabels, rocketStepNotes, type RocketPart } from "./DesignForm";
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
import { STATIC_TEST_COLOR, StaticTestLesson, motorStepNotes, type MotorPart } from "./learn/StaticTestLesson";

export type SubTab = "cohete" | "cohete2" | "cohete3" | "cohete4" | "cohete5" | "cohete6" | "cohete7" | "graficas" | "fase0" | "motor2" | "motor3" | "motor4" | "fase1" | "fase2" | "fase3" | "fase4" | "estabilidad";

/**
 * First menu row: the steps before the flight, in order. Rocket Tec starts with the motor (its static test);
 * Rocket Challenge with the experiment.
 */
const MAIN_TABS = (type: Design["type"]): { id: SubTab; label: string; icon: string; sub: string }[] => [
  type === "water"
    ? { id: "fase0", label: "Experimento", icon: "🧪", sub: "Paso 1 · prepara el experimento" }
    : { id: "fase0", label: "Motor", icon: "🔥", sub: "Paso 1 · prueba tu motor" },
  { id: "cohete", label: "Cohete", icon: "🚀", sub: "Paso 2 · simula tu cohete" },
  { id: "estabilidad", label: "Estabilidad", icon: "⚖️", sub: "Paso 3 · ¿cómo volará?" },
];

/**
 * Rocket Tec's Motor works like Go for launch: it opens a second row with its own steps, one page each
 * (the first one keeps the old "fase0" address).
 */
const MOTOR_STEPS: { id: SubTab; part: MotorPart; label: string }[] = [
  { id: "fase0", part: 1, label: "Tu motor" },
  { id: "motor2", part: 2, label: "Mide" },
  { id: "motor3", part: 3, label: "Compara" },
  { id: "motor4", part: 4, label: "Decide" },
];
const isMotorView = (type: Design["type"], v: SubTab) => type === "estes" && MOTOR_STEPS.some((m) => m.id === v);

/** Cohete works the same way: its own row of steps, each with only its part of the form. */
const ROCKET_COLOR = "#0039a6";
const ROCKET_STEPS = (type: Design["type"]): { id: SubTab; part: RocketPart; label: string }[] => {
  const labels = rocketStepLabels(type);
  // Water rockets carry no altimeter: no Sensores step.
  return ((type === "water" ? [1, 2, 3, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 7]) as RocketPart[]).map((part) => ({ id: (part === 1 ? "cohete" : `cohete${part}`) as SubTab, part, label: labels[part] }));
};
const isRocketView = (v: SubTab) => v === "cohete" || /^cohete[2-7]$/.test(v);

/** Second menu row: one lesson per flight phase (names and numerals depend on the program). */
const PHASE_IDS: PhaseId[] = [1, 2, 3, 4];
const PHASE_TABS = (type: Design["type"]): { id: SubTab; n: string; label: string; color: string }[] =>
  PHASE_IDS.map((id) => ({ id: `fase${id}` as SubTab, n: phaseNum(type, id), label: phaseName(type, id), color: PHASE_SOLID[id] }));
const phaseTabs = PHASE_TABS;

/** After the four phases: the whole flight simulated, with all its charts and results. */
const SIM_TAB = { id: "graficas" as SubTab, label: "Simulaciones", color: "#0039a6" };

/** Reading order of the lessons, for the previous/next buttons. */
const lessons = (type: Design["type"]): { id: SubTab; label: string }[] => [
  ...(type === "estes" ? MOTOR_STEPS.map((m) => ({ id: m.id, label: `Motor · ${m.label}` })) : []),
  ...MAIN_TABS(type).filter((t) => type !== "estes" || t.id !== "fase0").flatMap((t) =>
    t.id === "cohete" ? ROCKET_STEPS(type).map((r) => ({ id: r.id, label: `Cohete · ${r.label}` })) : [{ id: t.id, label: t.label }]),
  ...phaseTabs(type).map((t) => ({ id: t.id, label: `Fase ${t.n} · ${t.label}` })),
  { id: SIM_TAB.id, label: SIM_TAB.label },
];

export const SUB_TABS: SubTab[] = ["fase0", "motor2", "motor3", "motor4", "cohete", "cohete2", "cohete3", "cohete4", "cohete5", "cohete6", "cohete7", "estabilidad", SIM_TAB.id, ...PHASE_IDS.map((id) => `fase${id}` as SubTab)];

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
  /** Opens a downloaded project file; resolves to an error message when the file cannot be read. */
  onOpenFile: (file: File) => Promise<string | null>;
}

export function Workspace({ design, onChange, sub, onSub, savedId, onSaved, onDownload, exporting, exportError, onNew, onOpenFile, status }: Props) {
  const deferred = useDeferredValue(design);
  const result = useMemo(() => simulate(deferred), [deferred]);
  const phaseSpans = useMemo(() => (typeof result === "string" ? null : flightPhases(result)), [result]);
  const [notice, setNotice] = useState("");
  const [comparison, setComparison] = useState<Comparison>({ altimeter: 0, altimeterUnit: design.type === "water" ? "m" : "ft", apogeeTime: 0, descentTime: 0, csv: null });
  const view: SubTab = sub;
  // The flight phases only show during the flight: "Go for launch" takes off into Fase I, and going back to
  // Motor, Cohete or Estabilidad hides them again.
  const showPhases = view === SIM_TAB.id || /^fase[1-4]$/.test(view);
  const showMotor = isMotorView(design.type, view);
  const showRocket = isRocketView(view);
  const inGroup = (id: SubTab) => (id === "fase0" ? showMotor || view === "fase0" : id === "cohete" ? showRocket : view === id);
  // The steps already visited get a check, so the student sees where they are in the path.
  const [visited, setVisited] = useState<ReadonlySet<SubTab>>(() => new Set([view]));
  useEffect(() => setVisited((v) => (v.has(view) ? v : new Set(v).add(view))), [view]);
  const launched = [...visited].some((s) => s === SIM_TAB.id || /^fase[1-4]$/.test(s));
  const seen = (id: SubTab) =>
    id === "fase0" ? [...visited].some((s) => s === "fase0" || isMotorView(design.type, s)) : id === "cohete" ? [...visited].some(isRocketView) : visited.has(id);
  const rocketNotes = useMemo(() => rocketStepNotes(deferred), [deferred]);
  const motorNotes = useMemo(() => (deferred.type === "estes" ? motorStepNotes(deferred) : null), [deferred]);
  // The question that drives the whole design: is it stable yet? Shown on the Estabilidad step from any tab.
  const stab = useMemo(() => {
    const s = typeof result === "string" ? designStatics(deferred) : { loaded: result.stabilityLoaded, empty: result.stabilityEmpty };
    return typeof s === "string" ? null : stabilityStatus(deferred.type, s.loaded, s.empty);
  }, [result, deferred]);

  const save = () => {
    const entry = saveDesign(design, savedId);
    setNotice(entry ? "Guardado en este navegador." : "No se pudo guardar: el navegador no permite almacenamiento.");
    if (entry) onSaved(entry.id);
    setTimeout(() => setNotice(""), 3000);
  };

  /*
   * Maximize the working area. A main step settles the page with the program banner at the top (the Tec bar
   * just above, out of view). A sub-step (motor step, flight phase) goes further: only its row stays on screen,
   * with a small button for its parent step at the left; scrolling up shows everything again.
   */
  const mainRow = useRef<HTMLDivElement>(null);
  const subRow = useRef<HTMLDivElement>(null);
  const focus = useRef<"banner" | "sub" | null>(null);
  const [mainHidden, setMainHidden] = useState(false);
  const scrollToFocus = (to: "banner" | "sub") => {
    const el = to === "sub" && subRow.current ? subRow.current : document.querySelector(".program-banner");
    scrollTo({ top: el ? el.getBoundingClientRect().top + scrollY - 8 : 0 });
  };
  const go = (s: SubTab, to: "banner" | "sub" = "banner") => {
    // Already there: no re-render will come, so place the page now.
    if (s === view) return scrollToFocus(to);
    focus.current = to;
    onSub(s);
  };
  const isSub = (s: SubTab) => isMotorView(design.type, s) || isRocketView(s) || s === SIM_TAB.id || /^fase[1-4]$/.test(s);
  const goNav = (s: SubTab) => go(s, isSub(s) ? "sub" : "banner");
  const reveal = () => {
    const banner = document.querySelector(".program-banner");
    scrollTo({ top: banner ? banner.getBoundingClientRect().top + scrollY - 8 : 0, behavior: "smooth" });
  };
  useLayoutEffect(() => {
    const to = focus.current;
    focus.current = null;
    if (to) scrollToFocus(to);
  }, [view]);
  useEffect(() => {
    const el = mainRow.current;
    if (!el) return;
    // The parent button shows only while the main steps are scrolled out of view (above the top edge).
    const check = () => setMainHidden(el.getBoundingClientRect().bottom < 16);
    check();
    addEventListener("scroll", check, { passive: true });
    addEventListener("resize", check);
    return () => { removeEventListener("scroll", check); removeEventListener("resize", check); };
  }, []);

  return (
    <>
      <div className={`program-banner ${design.type}`}>
        <div className="banner-program">{status}</div>
        <h1 className="banner-title">Rocket Physics Lab <span>Sinaloa</span></h1>
        <div className="banner-actions no-print">
          {exportError ? <span className="banner-notice" role="alert">No se pudo crear el archivo: {exportError}</span> : notice && <span className="banner-notice">{notice}</span>}
          <button type="button" className="bar-btn primary" onClick={save} title="Guarda una copia en Mis diseños, solo en este navegador"><span aria-hidden="true">💾</span><span className="bar-label">Guardar</span></button>
          <FileMenu
            exporting={exporting}
            onDownload={onDownload}
            onNew={onNew}
            onOpenFile={async (file) => {
              const error = await onOpenFile(file);
              setNotice(error ? `No se pudo abrir: ${error}` : "");
              if (error) setTimeout(() => setNotice(""), 6000);
            }}
          />
        </div>
      </div>

      <nav className="workspace-menu no-print" aria-label="Secciones">
        <div className="menu-row main" role="tablist" ref={mainRow}>
          {MAIN_TABS(design.type).map((t) => (
            <button key={t.id} role="tab" aria-selected={inGroup(t.id)} data-done={seen(t.id) && !inGroup(t.id) ? "" : undefined} onClick={() => go(t.id)}>
              <span className="tab-icon" aria-hidden="true">{t.icon}</span>
              <span className="tab-text">
                <span className="tab-title">
                  {t.label}
                  {t.id === "estabilidad" && stab && <span className={`stab-chip ${stab.level}`} title={`Margen de estabilidad: ${stab.detail}`}>{stab.label}</span>}
                </span>
                <small>{t.sub}</small>
              </span>
              {seen(t.id) && !inGroup(t.id) && <span className="visually-hidden"> (visto)</span>}
            </button>
          ))}
          <button type="button" data-done={launched && !showPhases ? "" : undefined} className={`launch-btn${showPhases ? " launched" : ""}`} aria-pressed={showPhases} aria-expanded={showPhases} onClick={() => go("fase1")}>
            <span className="tab-icon" aria-hidden="true">{showPhases ? "🚀" : "🟢"}</span>
            <span className="tab-text">Go for launch<small>{showPhases ? "¡despegue! vuelo por fases" : "Paso 4 · simula tu vuelo"}</small></span>
          </button>
        </div>
        {showMotor && motorNotes && (
        <div className="menu-row phases motor-steps" role="tablist" aria-label="Prueba tu motor" ref={subRow}>
          <div className="sub-steps">
          {mainHidden && <SubParent icon="🔥" label="Motor" onClick={reveal} />}
          {MOTOR_STEPS.map((m) => (
            <button key={m.id} role="tab" aria-selected={view === m.id} onClick={() => go(m.id, "sub")} style={{ ["--phase" as string]: STATIC_TEST_COLOR }}>
              <span className="phase-dot">{m.part}</span>
              <span className="phase-tab-text">{m.label}<small>{motorNotes[m.part]}</small></span>
            </button>
          ))}
          </div>
        </div>
        )}
        {showRocket && (
        <div className="menu-row phases rocket-steps" role="tablist" aria-label="Simula tu cohete" ref={subRow}>
          <div className="sub-steps">
          {mainHidden && <SubParent icon="🚀" label="Cohete" onClick={reveal} />}
          {ROCKET_STEPS(design.type).map((r, i) => (
            <button key={r.id} role="tab" title={rocketNotes[r.part]} aria-selected={view === r.id} onClick={() => go(r.id, "sub")} style={{ ["--phase" as string]: ROCKET_COLOR }}>
              <span className="phase-dot">{i + 1}</span>
              <span className="phase-tab-text"><span className="step-name">{r.label}</span><small>{rocketNotes[r.part]}</small></span>
            </button>
          ))}
          </div>
        </div>
        )}
        {showPhases && (
        <div className="menu-row phases" role="tablist" aria-label="El vuelo por fases" ref={subRow}>
          <div className="sub-steps">
          {mainHidden && <SubParent icon="🚀" label="Go for launch" launch onClick={reveal} />}
          <span className="menu-label">El vuelo por fases</span>
          {phaseTabs(design.type).map((t) => {
            const ph = phaseSpans?.find((p) => `fase${p.id}` === t.id);
            return (
              <button key={t.id} role="tab" aria-selected={view === t.id} onClick={() => go(t.id, "sub")} style={{ ["--phase" as string]: t.color }} className={ph && !ph.exists ? "missing" : undefined}>
                <span className="phase-dot">{t.n}</span>
                <span className="phase-tab-text">
                  {t.label}
                  {ph && <small>{ph.exists ? `${format(ph.from, ph.to < 1 ? 3 : 2)} – ${format(ph.to, ph.to < 1 ? 3 : 1)} s · dura ${format(ph.to - ph.from, ph.to - ph.from < 1 ? 3 : 1)} s` : "No existe en este vuelo"}</small>}
                </span>
              </button>
            );
          })}
          <span className="menu-sep" aria-hidden="true" />
          <button role="tab" aria-selected={view === SIM_TAB.id} onClick={() => go(SIM_TAB.id, "sub")} style={{ ["--phase" as string]: SIM_TAB.color }} className="sim-tab">
            <span className="phase-dot">▶</span>
            <span className="phase-tab-text">
              {SIM_TAB.label}
              <small>todo el vuelo · gráficas y resultados</small>
            </span>
          </button>
          </div>
        </div>
        )}
      </nav>

      <ErrorBoundary key={view}>
      {typeof result === "string" && !showRocket && view !== "fase0" && !showMotor ? (
        <div className="card"><div className="alert error">{result} Corrige el diseño en la pestaña Cohete.</div></div>
      ) : (
        <>
          {view === "fase0" && deferred.type === "water" && <Phase0Lesson design={deferred} result={typeof result === "string" ? null : result} onGo={goNav} />}
          {showMotor && design.type === "estes" && <StaticTestLesson design={design} part={MOTOR_STEPS.find((m) => m.id === view)!.part} onChange={onChange} onGo={goNav} />}
          {showRocket && <RocketTab design={design} shown={deferred} result={result} onChange={onChange} onGo={goNav} part={ROCKET_STEPS(design.type).find((r) => r.id === view)?.part ?? 1} />}
          {typeof result !== "string" && (
            <LessonTypeContext.Provider value={deferred.type}>
              {view === "graficas" && <GraphsTab design={deferred} result={result} comparison={comparison} onComparison={setComparison} onLesson={goNav} />}
              {view === "fase1" && <Phase1Lesson design={deferred} result={result} onPhase={(id) => goNav(`fase${id}`)} onChange={onChange} />}
              {view === "fase2" && <Phase2Lesson design={deferred} result={result} onPhase={(id) => goNav(`fase${id}`)} onChange={onChange} />}
              {view === "fase3" && <Phase3Lesson design={deferred} result={result} onPhase={(id) => goNav(`fase${id}`)} onChange={onChange} />}
              {view === "fase4" && <Phase4Lesson design={deferred} result={result} onPhase={(id) => goNav(`fase${id}`)} onChange={onChange} />}
              {view === "estabilidad" && <StabilityLesson design={deferred} result={result} />}
            </LessonTypeContext.Provider>
          )}
        </>
      )}
      </ErrorBoundary>
      <LessonNav sub={view} type={design.type} go={goNav} />
    </>
  );
}

/**
 * Guardar is the one action used all the time; the rest (download, open, new) live in an Archivo menu,
 * so the banner shows a single main button.
 */
function FileMenu({ exporting, onDownload, onNew, onOpenFile }: { exporting: boolean; onDownload: () => void; onNew: () => void; onOpenFile: (f: File) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <div className="file-menu" ref={box}>
      <button type="button" className="bar-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span aria-hidden="true">📁</span><span className="bar-label">{exporting ? "Preparando…" : "Archivo"}</span><span aria-hidden="true" className="caret">▾</span>
      </button>
      {open && (
        <div className="file-menu-list" role="menu">
          <button type="button" role="menuitem" onClick={pick(onDownload)} disabled={exporting}>
            <span aria-hidden="true">⬇</span><span>Descargar<small>guarda el archivo en tu computadora</small></span>
          </button>
          <label role="menuitem" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.querySelector("input")?.click(); } }}>
            <span aria-hidden="true">📂</span><span>Abrir<small>un diseño que descargaste (.rpl.json)</small></span>
            <input
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = ""; // the same file can be opened again
                setOpen(false);
                if (file) onOpenFile(file);
              }}
            />
          </label>
          <button type="button" role="menuitem" onClick={pick(onNew)}>
            <span aria-hidden="true">＋</span><span>Nuevo<small>empieza un cohete desde cero</small></span>
          </button>
        </div>
      )}
    </div>
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
      {next && next.id === "cohete" && type === "estes"
        ? <button className="btn primary" onClick={() => go(next.id)}>Paso 2 · simula tu cohete →</button>
        : next && sub === "estabilidad"
        ? <button className="btn primary" onClick={() => go(next.id)}>🟢 Go for launch →</button>
        : next ? <button className="btn primary" onClick={() => go(next.id)}>{next.label} →</button> : <button className="btn primary" onClick={() => go("cohete")}>Volver al cohete</button>}
    </div>
  );
}

/** The parent step, shown at the left of its sub-steps once the main steps scroll away: a breadcrumb back to them. */
function SubParent({ icon, label, launch, onClick }: { icon: string; label: string; launch?: boolean; onClick: () => void }) {
  return (
    <span className="sub-parent-wrap">
      <button type="button" className={`sub-parent${launch ? " launch" : ""}`} onClick={onClick} title="Ver todos los pasos" aria-label={`${label}: ver todos los pasos`}>
        <span className="sub-parent-icon" aria-hidden="true">{icon}</span>
        <span className="sub-parent-text">{label}</span>
      </button>
      <span className="sub-parent-arrow" aria-hidden="true">›</span>
    </span>
  );
}
