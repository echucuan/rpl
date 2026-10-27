import { useEffect, useRef, useState } from "react";
import type { Design } from "../model";
import { newEstesDesign, newWaterDesign } from "../model";
import { About } from "./About";
import { Designs } from "./Designs";
import { Dialog } from "./Dialog";
import { Workspace, SUB_TABS, type SubTab } from "./Workspace";
import { designFileName, loadDraft, saveProjectFile, storeDraft } from "./storage";
import { PROGRAMS, StartScreen, logoUrl } from "./StartScreen";
import {
  STATUS_TEXT, afterExport, discard, draftOf, exportSnapshot, fingerprint, guardFor, isDirty, project, readDraft, saveStatus, shouldWarnOnUnload,
  type Intent, type ProgramType, type Project, type SaveStatus, type Tab,
} from "./project";

const TABS: { id: Tab; label: string; logo?: Design["type"] }[] = [
  { id: "inicio", label: "Inicio" },
  { id: "estes", label: PROGRAMS.estes.name, logo: "estes" },
  { id: "water", label: PROGRAMS.water.name, logo: "water" },
  { id: "designs", label: "Mis diseños" },
  { id: "about", label: "Acerca de" },
];

const TYPES: ProgramType[] = ["estes", "water"];
const fresh = (t: ProgramType) => project(t === "water" ? newWaterDesign() : newEstesDesign(), "new");

type Route = { tab: Tab; sub: SubTab };

/** Location hash: "#estes/graficas" → tab and sub-tab. */
function parseHash(): Route {
  const [t, s] = location.hash.slice(1).split("/");
  return {
    tab: TABS.some((x) => x.id === t) ? (t as Tab) : "inicio",
    sub: SUB_TABS.includes(s as SubTab) ? (s as SubTab) : "cohete",
  };
}
const hashOf = ({ tab, sub }: Route) => (tab === "estes" || tab === "water" ? `#${tab}/${sub}` : `#${tab}`);

type Pending = { project: Project; updatedAt: string | null };

/** Start-up: resume drafts with nothing unsaved; hold back the ones with unsaved work until the student decides. */
function initialState() {
  const projects = {} as Record<ProgramType, Project>;
  const pending: Partial<Record<ProgramType, Pending>> = {};
  for (const t of TYPES) {
    const r = readDraft(loadDraft(t), t);
    if (r.action === "resume") projects[t] = r.project;
    else {
      projects[t] = fresh(t);
      if (r.action === "ask") pending[t] = { project: r.project, updatedAt: r.updatedAt };
    }
  }
  return { projects, pending };
}

/** Leave-or-replace confirmation; "started"/"written" are the steps after choosing to download. */
type Guard = { type: ProgramType; intent: Intent; stage: "ask" | "started" | "written"; busy?: boolean; error?: string };

export function App() {
  const [init] = useState(initialState);
  const [route, setRoute] = useState(parseHash);
  const { tab, sub } = route;
  const [projects, setProjects] = useState(init.projects);
  const [pending, setPending] = useState(init.pending);
  const [savedIds, setSavedIds] = useState<Partial<Record<Design["type"], string>>>({});
  const [guard, setGuard] = useState<Guard | null>(null);

  // Event handlers registered once read the latest state through these.
  const projectsRef = useRef(projects);
  projectsRef.current = projects;
  const routeRef = useRef(route);
  routeRef.current = route;

  const update = (t: ProgramType, fn: (p: Project) => Project) => setProjects((ps) => ({ ...ps, [t]: fn(ps[t]) }));

  useEffect(() => {
    const hash = hashOf(route);
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }, [route]);
  useEffect(() => {
    // A draft waiting for "¿Recuperar?" is not overwritten until the student answers.
    for (const t of TYPES) if (!pending[t]) storeDraft(t, draftOf(projects[t]));
  }, [projects, pending]);

  // The browser's own prompt on close, reload or leaving the site; only while there is something to lose.
  const warnOnUnload = shouldWarnOnUnload(projects);
  useEffect(() => {
    if (!warnOnUnload) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    addEventListener("beforeunload", onUnload);
    return () => removeEventListener("beforeunload", onUnload);
  }, [warnOnUnload]);

  const perform = (intent: Intent) => {
    if (intent.kind === "tab") setRoute((r) => ({ tab: intent.to, sub: (intent.sub as SubTab | undefined) ?? r.sub }));
    else if (intent.kind === "open") {
      const t = intent.design.type;
      update(t, () => project(intent.design, intent.source));
      setSavedIds((s) => ({ ...s, [t]: intent.id }));
      setRoute({ tab: t, sub: "cohete" });
    } else {
      update(intent.type, () => fresh(intent.type));
      setSavedIds((s) => ({ ...s, [intent.type]: undefined }));
    }
  };

  /** Every navigation and replacement goes through here, so the check lives in one place. */
  const request = (intent: Intent) => {
    const t = guardFor(routeRef.current.tab, intent, projectsRef.current);
    if (t) setGuard({ type: t, intent, stage: "ask" });
    else perform(intent);
  };
  const requestRef = useRef(request);
  requestRef.current = request;

  useEffect(() => {
    // Back/forward or a typed address: same check, and the address goes back while the dialog is open.
    const onHash = () => {
      const target = parseHash();
      const cur = routeRef.current;
      if (target.tab === cur.tab) { setRoute(target); return; }
      history.replaceState(null, "", hashOf(cur));
      requestRef.current({ kind: "tab", to: target.tab, sub: target.sub });
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  /** Saves a snapshot of the design as it is now; edits made meanwhile stay pending. */
  const exportProject = async (t: ProgramType) => {
    const p = projectsRef.current[t];
    update(t, (q) => ({ ...q, exporting: fingerprint(p.design), error: null }));
    const out = await exportSnapshot(p.design, designFileName(p.design), saveProjectFile);
    update(t, (q) => afterExport(q, out));
    return out;
  };

  const downloadFromGuard = async () => {
    if (!guard) return;
    setGuard({ ...guard, busy: true, error: undefined });
    const out = await exportProject(guard.type);
    if (out.ok) setGuard({ ...guard, stage: out.source === "written" ? "written" : "started", busy: false });
    else setGuard({ ...guard, busy: false, error: out.cancelled ? undefined : `No se pudo crear el archivo (${out.error}). Tus cambios siguen aquí; intenta de nuevo.` });
  };
  const leaveWithoutSaving = () => {
    if (!guard) return;
    update(guard.type, discard);
    perform(guard.intent);
    setGuard(null);
  };
  const continueAfterSave = () => {
    if (!guard) return;
    perform(guard.intent);
    setGuard(null);
  };

  const restoring = TYPES.find((t) => pending[t]);
  const resolveDraft = (t: ProgramType, recover: boolean) => {
    if (recover) update(t, () => pending[t]!.project);
    setPending((p) => ({ ...p, [t]: undefined }));
  };

  const workspace = (t: ProgramType) => {
    const p = projects[t];
    return (
      <Workspace
        design={p.design}
        onChange={(d) => update(t, (q) => ({ ...q, design: d, error: null }))}
        sub={sub}
        onSub={(s) => setRoute((r) => ({ ...r, sub: s }))}
        savedId={savedIds[t]}
        onSaved={(id) => setSavedIds((s) => ({ ...s, [t]: id }))}
        onDownload={() => exportProject(t)}
        exporting={p.exporting !== null}
        exportError={p.error}
        onNew={() => request({ kind: "new", type: t })}
        onHome={() => request({ kind: "tab", to: "inicio" })}
      />
    );
  };

  return (
    <>
      <header className="site-header">
        <div className="topbar">
          <a className="tec-home" href="#inicio" onClick={(e) => { e.preventDefault(); request({ kind: "tab", to: "inicio" }); }} aria-label="Tecnológico de Monterrey · Inicio">
            <img className="tec-logo" src={`${import.meta.env.BASE_URL}brand/logo-tec-azul.png`} alt="Tecnológico de Monterrey" />
          </a>
          <SaveIndicator tab={tab} projects={projects} />
          <nav className="main-nav" role="tablist" aria-label="Secciones de la aplicación">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => tab !== t.id && request({ kind: "tab", to: t.id })}>
                {t.logo && <img className="tab-logo" src={logoUrl(t.logo)} alt="" />}
                {t.label}
              </button>
            ))}
          </nav>
        </div>
        <div className={`site-hero ${tab === "inicio" ? "" : "compact"}`}>
          <h1>Rocket Physics Lab <span>Sinaloa</span></h1>
          {tab === "inicio" && <p>Diseña tu cohete, simula su vuelo y descubre la física detrás de cada vuelo.</p>}
        </div>
      </header>
      <main>
        {tab === "inicio" && <StartScreen onPick={(type) => request({ kind: "tab", to: type, sub: "cohete" })} />}
        {tab === "estes" && workspace("estes")}
        {tab === "water" && workspace("water")}
        {tab === "designs" && <Designs onOpen={(design, id, source) => request({ kind: "open", design, id, source })} />}
        {tab === "about" && <About />}
      </main>
      <footer>
        Rocket Physics Lab Sinaloa · Tecnológico de Monterrey, Campus Sinaloa · Software libre (GPL-3.0). Especificaciones de productos: Estes Industries.
      </footer>

      {guard && guard.stage === "ask" && (
        <Dialog
          title="¿Quieres guardar tu simulación antes de salir?"
          onCancel={() => !guard.busy && setGuard(null)}
          actions={<>
            <button type="button" className="btn" onClick={() => setGuard(null)} disabled={guard.busy}>Cancelar</button>
            <button type="button" className="btn danger" onClick={leaveWithoutSaving} disabled={guard.busy}>Salir sin guardar</button>
            <button type="button" className="btn primary" onClick={downloadFromGuard} disabled={guard.busy}>
              {guard.busy ? "Preparando archivo…" : "Descargar simulación"}
            </button>
          </>}
        >
          <p>Realizaste cambios en tu cohete que todavía no has descargado. Si sales sin guardar, podrías perder tu trabajo.</p>
          <p className="hint">{PROGRAMS[guard.type].name}: «{projects[guard.type].design.name}». «Salir sin guardar» regresa el diseño a tu último archivo.</p>
          {guard.error && <div className="alert error">{guard.error}</div>}
        </Dialog>
      )}
      {guard && guard.stage === "started" && (
        <Dialog
          title="Descarga iniciada"
          onCancel={() => setGuard(null)}
          actions={<>
            <button type="button" className="btn" onClick={() => setGuard(null)}>Permanecer en el simulador</button>
            <button type="button" className="btn primary" onClick={continueAfterSave}>Ya guardé mi archivo, continuar</button>
          </>}
        >
          <p>Tu archivo se ha preparado para descargarse. Comprueba que esté guardado en tu computadora antes de salir.</p>
          <p className="hint">Búscalo en tu carpeta de Descargas como <b>{designFileName(projects[guard.type].baseline.design)}</b>. El navegador no le avisa a esta página si la descarga terminó.</p>
        </Dialog>
      )}
      {guard && guard.stage === "written" && (
        <Dialog
          title="Archivo guardado"
          onCancel={() => setGuard(null)}
          actions={<>
            <button type="button" className="btn" onClick={() => setGuard(null)}>Permanecer en el simulador</button>
            <button type="button" className="btn primary" onClick={continueAfterSave}>Continuar</button>
          </>}
        >
          <p>El navegador confirmó que tu simulación se escribió en tu computadora.</p>
        </Dialog>
      )}
      {!guard && restoring && (
        <Dialog
          title="¿Recuperar tu trabajo sin descargar?"
          onCancel={() => resolveDraft(restoring, false)}
          actions={<>
            <button type="button" className="btn danger" onClick={() => resolveDraft(restoring, false)}>Descartar borrador</button>
            <button type="button" className="btn primary" onClick={() => resolveDraft(restoring, true)}>Recuperar diseño</button>
          </>}
        >
          <p>
            Encontramos cambios en tu diseño de <b>{PROGRAMS[restoring].name}</b> («{pending[restoring]!.project.design.name}»)
            {pending[restoring]!.updatedAt && <> del {new Date(pending[restoring]!.updatedAt!).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</>}
            {" "}que no descargaste en un archivo.
          </p>
          <p className="hint">Este borrador vive solo en este navegador y puede borrarse en cualquier momento. Después de recuperarlo, descárgalo para guardarlo de verdad.</p>
        </Dialog>
      )}
    </>
  );
}

const STATUS_HELP: Record<SaveStatus, string> = {
  clean: "El diseño coincide con tu último archivo (o es un diseño nuevo sin cambios).",
  dirty: "Hay cambios que no están en ningún archivo. Usa «Descargar» para guardarlos en tu computadora.",
  preparing: "Se está generando el archivo del proyecto.",
  started: "El navegador recibió el archivo. Comprueba que esté en tu carpeta de Descargas.",
  written: "El navegador confirmó que el archivo se escribió en tu computadora.",
  error: "No se pudo crear el archivo. Tus cambios siguen aquí; intenta descargar de nuevo.",
};

/** Save state of the open simulator; on other pages, only the simulators with unsaved work. */
function SaveIndicator({ tab, projects }: { tab: Tab; projects: Record<ProgramType, Project> }) {
  const inWorkspace = tab === "estes" || tab === "water";
  const shown = inWorkspace ? [tab] : TYPES.filter((t) => isDirty(projects[t]) || projects[t].exporting !== null);
  return (
    <div className="save-status" role="status" aria-live="polite">
      {shown.map((t) => {
        const s = saveStatus(projects[t]);
        return (
          <span key={t} className={`save-pill ${s}`} title={STATUS_HELP[s]}>
            <span className="save-dot" aria-hidden="true" />
            {!inWorkspace && `${PROGRAMS[t].name}: `}{STATUS_TEXT[s]}
          </span>
        );
      })}
    </div>
  );
}
