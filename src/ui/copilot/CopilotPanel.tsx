import type Anthropic from "@anthropic-ai/sdk";
import { useEffect, useRef, useState } from "react";
import type { Design } from "../../model";
import { Mascot, type MascotMood } from "../mascot/Mascot";
import { CopilotError, MAX_MESSAGES, ask, type Phase } from "./conversation";
import { COPILOT_GROUPS } from "./groups";
import { OPEN_ROCKY } from "./openRocky";
import { RichText } from "./RichText";
import "./copilot.css";

const GROUP_KEY = "rpl.copilot.group";
/** The group remembered in this browser, if it is still one of the current groups. */
const readGroup = () => {
  try {
    const g = localStorage.getItem(GROUP_KEY) ?? "";
    return (COPILOT_GROUPS as readonly string[]).includes(g) ? g : "";
  } catch {
    return "";
  }
};
const saveGroup = (g: string) => {
  try { g ? localStorage.setItem(GROUP_KEY, g) : localStorage.removeItem(GROUP_KEY); } catch { /* private mode */ }
};

interface Bubble {
  from: "me" | "bot";
  text: string;
  error?: boolean;
}

const SUGGESTIONS: Record<"estes" | "water" | "none", string[]> = {
  estes: ["¿Mi cohete es estable?", "¿Qué pasa si agrando las aletas?", "¿Qué retardo de eyección me conviene?"],
  water: ["¿Cuánta agua le pongo?", "¿Qué pasa con menos presión?", "¿Mi cohete es estable?"],
  none: ["¿Qué es el centro de presión?", "¿Cómo funciona un motor Estes?", "¿Por qué vuela un cohete de agua?"],
};

const TOOL_LABEL: Record<string, string> = {
  ver_diseno: "Revisando tu diseño…",
  simular_cambio: "Simulando el cambio…",
  ver_leccion: "Leyendo tu lección…",
};

/** Floating mascot button + chat panel. `design` is the rocket open in the current tab (null elsewhere). */
export function CopilotPanel({ design }: { design: Design | null }) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(readGroup);
  const [history, setHistory] = useState<Anthropic.MessageParam[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [mood, setMood] = useState<MascotMood>("idle");
  const abort = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const moodTimer = useRef<number>(0);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [bubbles, status]);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open, group]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    // Rocky's guide (#rocky) opens the chat, sometimes with an example question ready to send.
    const onOpen = (e: Event) => {
      setOpen(true);
      const q = (e as CustomEvent<string | undefined>).detail;
      if (q) setDraft(q);
    };
    addEventListener(OPEN_ROCKY, onOpen);
    return () => removeEventListener(OPEN_ROCKY, onOpen);
  }, []);

  const flashMood = (m: MascotMood, ms: number) => {
    setMood(m);
    clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(() => setMood("idle"), ms);
  };

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setDraft("");
    setBusy(true);
    clearTimeout(moodTimer.current);
    setMood("thinking");
    setBubbles((b) => [...b, { from: "me", text: q }, { from: "bot", text: "" }]);
    const ctrl = new AbortController();
    abort.current = ctrl;
    const append = (t: string) =>
      setBubbles((b) => {
        const last = b.at(-1)!;
        return [...b.slice(0, -1), { ...last, text: last.text + t }];
      });
    const onPhase = (p: Phase, tool?: string) => {
      setMood(p === "writing" ? "talking" : "thinking");
      setStatus(p === "tool" ? TOOL_LABEL[tool ?? ""] ?? "Trabajando…" : p === "waiting" ? "Pensando…" : "");
    };
    try {
      const next = await ask([...history, { role: "user", content: q }], group, design, { onPhase, onText: append }, ctrl.signal);
      setHistory(next);
      flashMood("happy", 1800);
    } catch (e) {
      if (ctrl.signal.aborted) {
        setBubbles((b) => b.filter((x, i) => !(i === b.length - 1 && !x.text)));
        setMood("idle");
      } else {
        const err = e instanceof CopilotError ? e : new CopilotError("Algo salió mal. Intenta de nuevo.", "other");
        setBubbles((b) => [...b.slice(0, -1), { from: "bot", text: err.message, error: true }]);
        flashMood("confused", 4000);
        if (err.kind === "group") {
          // The saved group is no longer valid: pick again, then the question is sent again.
          pickGroup("");
          setBubbles((b) => b.slice(0, -2));
          setDraft(q);
        }
      }
    } finally {
      setBusy(false);
      setStatus("");
      abort.current = null;
    }
  }

  function restart() {
    abort.current?.abort();
    setHistory([]);
    setBubbles([]);
    setMood("idle");
  }

  function pickGroup(g: string) {
    saveGroup(g);
    setGroup(g);
    if (g) setMood("idle");
  }

  const full = history.length >= MAX_MESSAGES;
  const kind = design?.type ?? "none";
  const greeting = design
    ? `¡Hola! Soy Rocky, tu copiloto. Puedo revisar tu cohete «${design.name}», simular cambios y explicarte la física. ¿Qué quieres saber?`
    : "¡Hola! Soy Rocky, tu copiloto. Abre Rocket Tec o Rocket Challenge para que revise tu cohete, o pregúntame sobre la física del vuelo.";

  return (
    <>
      <button
        className={`cp-fab${open ? " open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="copilot-panel"
        aria-label={open ? "Cerrar a Rocky" : "Hablar con Rocky"}
      >
        <Mascot size={58} mood={open ? mood : "idle"} title="" />
      </button>

      {open && (
        <section
          id="copilot-panel"
          className="cp-panel"
          aria-label="Rocky, tu copiloto"
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
          <header className="cp-head">
            <div className="cp-avatar"><Mascot size={38} mood={mood} title="" /></div>
            <div className="cp-title">
              <strong>Rocky</strong>
              <small>
                {busy ? status || "Escribiendo…" : group ? `Grupo ${group}${design ? ` · ${design.name}` : ""}` : "Pregúntame sobre cohetes"}
              </small>
            </div>
            {group && !busy && (
              <button className="cp-icon cp-group" onClick={() => pickGroup("")} title="Cambiar de grupo" aria-label={`Grupo ${group}. Cambiar de grupo`}>
                {group}
              </button>
            )}
            <a className="cp-icon cp-help" href="#rocky" title="Guía de Rocky" aria-label="Guía de Rocky">?</a>
            {bubbles.length > 0 && <button className="cp-icon" onClick={restart} title="Nueva conversación" aria-label="Nueva conversación">↺</button>}
            <button className="cp-icon" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
          </header>

          {!group ? (
            <div className="cp-code">
              <Mascot size={110} mood="happy" title="" />
              <p id="cp-group-q">¡Hola! ¿En qué <b>grupo</b> estás?</p>
              <div className="cp-groups" role="group" aria-labelledby="cp-group-q">
                {COPILOT_GROUPS.map((g) => (
                  <button key={g} onClick={() => pickGroup(g)}>{g}</button>
                ))}
              </div>
              <a className="cp-guide" href="#rocky">¿Primera vez? Mira cómo trabajo</a>
            </div>
          ) : (
            <>
              <div className="cp-list" ref={list} aria-live="polite">
                <div className="cp-msg bot"><RichText text={greeting} /></div>
                {bubbles.map((b, i) => (
                  <div key={i} className={`cp-msg ${b.from}${b.error ? " error" : ""}`}>
                    {b.text ? (b.from === "bot" ? <RichText text={b.text} /> : b.text) : <span className="cp-dots" aria-label="Pensando"><i /><i /><i /></span>}
                  </div>
                ))}
                {busy && status && bubbles.at(-1)?.text && <div className="cp-status">{status}</div>}
                {bubbles.length === 0 && (
                  <div className="cp-suggest">
                    {SUGGESTIONS[kind].map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
                  </div>
                )}
                {full && (
                  <div className="cp-status">
                    Esta conversación ya es muy larga. <button className="link" onClick={restart}>Empieza una nueva</button>
                  </div>
                )}
              </div>
              <form className="cp-input" onSubmit={(e) => { e.preventDefault(); send(draft); }}>
                <textarea
                  ref={input}
                  rows={1}
                  value={draft}
                  maxLength={1500}
                  disabled={full}
                  placeholder={full ? "Empieza una conversación nueva" : "Escribe tu pregunta…"}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(draft);
                    }
                  }}
                  aria-label="Tu pregunta"
                />
                {busy ? (
                  <button type="button" className="btn" onClick={() => abort.current?.abort()}>Detener</button>
                ) : (
                  <button type="submit" className="btn primary" disabled={!draft.trim() || full}>Enviar</button>
                )}
              </form>
              <p className="cp-foot">Rocky puede equivocarse: compruébalo con el simulador y tu profesor.</p>
            </>
          )}
        </section>
      )}
    </>
  );
}
