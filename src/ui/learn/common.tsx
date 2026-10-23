import katex from "katex";
import { useMemo, useState, type ReactNode } from "react";

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

export function StageBlock({ stage, children }: { stage: Stage; children: ReactNode }) {
  const s = STAGES[stage];
  return (
    <section className={`stage stage-${stage}`}>
      <header>
        <span className="stage-n">{s.n}</span>
        <div>
          <h3>{s.title}</h3>
          <p>{s.question}</p>
        </div>
      </header>
      <div className="stage-body">{children}</div>
    </section>
  );
}

export function LessonHeader({ title, intro }: { title: string; intro: ReactNode }) {
  return (
    <div className="lesson-head card">
      <div className="method-strip" aria-label="Metodología">
        <span className="chip fisica">1 Física</span>
        <span className="arrow">→</span>
        <span className="chip matematicas">2 Matemáticas</span>
        <span className="arrow">→</span>
        <span className="chip computacion">3 Computación (MATLAB)</span>
      </div>
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
export function Code({ children, title = "MATLAB" }: { children: string; title?: string }) {
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
      <pre className="code"><code>{code}</code></pre>
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
