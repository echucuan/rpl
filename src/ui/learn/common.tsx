import katex from "katex";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/** LaTeX equation rendered with KaTeX. */
export function Eq({ tex, block = false }: { tex: string; block?: boolean }) {
  const html = useMemo(() => katex.renderToString(tex, { displayMode: block, throwOnError: false, strict: false }), [tex, block]);
  return block ? <div className="eq" dangerouslySetInnerHTML={{ __html: html }} /> : <span dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Number with units formatted for equations (decimal point, thin space before the unit). */
export function n(v: number, digits = 2): string {
  if (!Number.isFinite(v)) return "\\text{–}";
  return v.toFixed(digits);
}

type Stage = "fisica" | "matematicas" | "computacion";

const STAGES: Record<Stage, { n: number; title: string; question: string }> = {
  fisica: { n: 1, title: "Física", question: "¿Qué está pasando y qué leyes lo gobiernan?" },
  matematicas: { n: 2, title: "Matemáticas", question: "¿Cómo se escribe como ecuaciones?" },
  computacion: { n: 3, title: "Computación", question: "¿Cómo lo resuelve la computadora?" },
};

/** Rocket Tec explains what each stage of the methodology is for. */
const STAGES_ESTES: Record<Stage, string> = {
  fisica: "Observamos cómo cambia el movimiento del cohete: su posición y su velocidad (rapidez y dirección). Identificamos las fuerzas, decidimos qué simplificar y aplicamos la ley que predice esos cambios: la segunda ley de Newton.",
  matematicas: "Convertimos las leyes de la física en ecuaciones diferenciales y, con las condiciones iniciales, las resolvemos (de forma analítica o numérica) para obtener modelos, como v(t) y s(t), que predicen el movimiento.",
  computacion: "Usamos la computadora para evaluar y graficar los modelos, resolver con métodos numéricos lo que no tiene fórmula y comparar las predicciones con la simulación y con las mediciones reales.",
};

/** Which program the lesson belongs to ("water" or "estes"); set by the workspace. */
export const LessonTypeContext = createContext<"water" | "estes" | null>(null);

export function StageBlock({ stage, children }: { stage: Stage; children: ReactNode }) {
  const s = STAGES[stage];
  const estes = useContext(LessonTypeContext) === "estes";
  return (
    <section className={`stage stage-${stage}`}>
      <header>
        <span className="stage-n">{s.n}</span>
        <div>
          <h3>{s.title}</h3>
          {estes ? <p className="stage-explain">{STAGES_ESTES[stage]}</p> : <p>{s.question}</p>}
        </div>
      </header>
      <div className="stage-body">{children}</div>
    </section>
  );
}

export function LessonHeader({ title, intro }: { title: string; intro: ReactNode }) {
  return (
    <div className="lesson-head card">
      <h2>{title}</h2>
      <p>{intro}</p>
    </div>
  );
}

/** "Con tu cohete" box: the student's own numbers plugged into the equations. */
export function YourRocket({ children }: { children: ReactNode }) {
  return (
    <div className="your-rocket">
      <div className="your-rocket-title">Con los números de tu cohete</div>
      {children}
    </div>
  );
}

/** MATLAB code shown in the Computación stage, with a button to copy it. */
/** MATLAB code with a copy button. `scroll`: a whole script in one window of fixed height that scrolls. */
export function Code({ children, title = "MATLAB", scroll = false }: { children: string; title?: string; scroll?: boolean }) {
  const code = children.trim();
  const [copied, setCopied] = useState<"" | "ok" | "error">("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied("ok");
    } catch {
      // Older browsers or blocked clipboard permission: copy through a hidden text area.
      const area = document.createElement("textarea");
      area.value = code;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      setCopied(document.execCommand("copy") ? "ok" : "error");
      area.remove();
    }
    setTimeout(() => setCopied(""), 2000);
  };
  return (
    <figure className="code-block">
      <div className="code-head">
        <figcaption>{title}</figcaption>
        <button type="button" className={`copy-btn ${copied === "ok" ? "done" : ""}`} onClick={copy}>
          {copied === "ok" ? "✓ Copiado" : copied === "error" ? "No se pudo copiar" : "Copiar código"}
        </button>
      </div>
      <pre className={`code ${scroll ? "scroll" : ""}`} tabIndex={scroll ? 0 : undefined}><code>{code}</code></pre>
    </figure>
  );
}

export function Think({ children }: { children: ReactNode }) {
  return (
    <div className="think">
      <b>Para pensar</b>
      {children}
    </div>
  );
}

/** One step of a worked derivation: a short title and its explanation with equations. */
export interface DerivationStep {
  title: ReactNode;
  body: ReactNode;
}

/**
 * Compact view of an analytic solution: the differential equation, an arrow and the function that solves it.
 * "Ver el procedimiento" opens a full-screen view (like the charts' zoom) that reveals the worked steps one at a time.
 */
export function DerivationZoom({ title, ode, result, steps, note }: { title: string; ode: string; result: string; steps: DerivationStep[]; note?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(1);
  const all = shown >= steps.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      else if (e.key === "ArrowRight" || e.key === "PageDown") setShown((k) => Math.min(k + 1, steps.length));
      else if (e.key === "ArrowLeft" || e.key === "PageUp") setShown((k) => Math.max(k - 1, 1));
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, steps.length]);

  // Keep the newest step in view while revealing.
  useEffect(() => {
    if (open && shown > 1) document.querySelector(`.dz-modal .dz-step:nth-child(${shown})`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [open, shown]);

  const summary = (
    <div className="dz-summary">
      <div className="dz-box">
        <span className="dz-label">Ecuación diferencial</span>
        <Eq block tex={ode} />
      </div>
      <span className="dz-arrow" aria-hidden="true">⟹</span>
      <div className="dz-box dz-result">
        <span className="dz-label">Solución</span>
        <Eq block tex={result} />
      </div>
    </div>
  );

  const list = (count: number) => (
    <ol className="dz-steps">
      {steps.slice(0, count).map((s, i) => (
        <li key={i} className="dz-step">
          <h5><span className="dz-n">{i + 1}</span> {s.title}</h5>
          {s.body}
        </li>
      ))}
    </ol>
  );

  return (
    <div className="dz">
      {summary}
      {note}
      <div className="dz-open no-print">
        <button type="button" className="chart-tool" onClick={() => { setShown(1); setOpen(true); }} title="Ver cómo se llega a la solución, paso por paso, en pantalla completa">
          ⤢ Ver el procedimiento paso a paso ({steps.length} pasos)
        </button>
      </div>
      <div className="print-only">{list(steps.length)}</div>
      {open && (
        <div className="dz-modal derivation" role="dialog" aria-modal="true" aria-label={title}>
          <div className="dz-head">
            <h3>{title}</h3>
            <button type="button" className="chart-tool" onClick={() => setOpen(false)} title="Cerrar (Esc)">✕ Cerrar</button>
          </div>
          <div className="dz-body">
            {summary}
            {list(shown)}
          </div>
          <div className="dz-foot">
            <span className="dz-count">Paso {shown} de {steps.length}</span>
            <button type="button" className="chart-tool" onClick={() => setShown((k) => Math.max(k - 1, 1))} disabled={shown <= 1}>◂ Anterior</button>
            <button type="button" className="chart-tool dz-next" onClick={() => setShown((k) => Math.min(k + 1, steps.length))} disabled={all}>Siguiente paso ▸</button>
            <button type="button" className="chart-tool" onClick={() => setShown(steps.length)} disabled={all}>Mostrar todo</button>
            <span className="dz-help">← → para avanzar · Esc para cerrar</span>
          </div>
        </div>
      )}
    </div>
  );
}
