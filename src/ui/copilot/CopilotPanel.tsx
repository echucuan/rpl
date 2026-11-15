import type Anthropic from "@anthropic-ai/sdk";
import { useEffect, useRef, useState } from "react";
import type { Design } from "../../model";
import { Mascot, type MascotMood } from "../mascot/Mascot";
import { CopilotError, MAX_MESSAGES, ask, type Phase } from "./conversation";
import { COPILOT_GROUPS } from "./groups";
import { OPEN_ROCKY } from "./openRocky";
import { readingSeconds } from "./readingTime";
import { RichText } from "./RichText";
import { RockyLaunch, genie, type Chute } from "./RockyLaunch";
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
  /** Answers only: seconds to read it, seconds read so far, whether it counts as read… */
  need?: number;
  done?: number;
  read?: boolean;
  /** …and whether a launch already used it. */
  spent?: boolean;
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
  const panel = useRef<HTMLElement>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const [closing, setClosing] = useState(false);
  const [launch, setLaunch] = useState<number | null>(null);
  const [chute, setChute] = useState<Chute>("off");
  const [flying, setFlying] = useState(false);
  /** Answers read since the last launch: what the easter egg on ✕ is worth. */
  const reads = bubbles.filter((b) => b.read && !b.spent).length;

  // Follow the conversation only while the student is already at the bottom: scrolling up to read
  // the start of a long answer must not be undone by new text or by the reading clock ticking.
  const atBottom = useRef(true);
  const lastText = bubbles.at(-1)?.text.length ?? 0;
  useEffect(() => {
    if (atBottom.current) list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [bubbles.length, lastText, status]);
  useEffect(() => {
    // A new question always brings the view down to it.
    if (bubbles.at(-1)?.from === "bot" && !bubbles.at(-1)?.text) {
      atBottom.current = true;
      list.current?.scrollTo({ top: list.current.scrollHeight });
    }
  }, [bubbles.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open, group]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    // Reading clock: the oldest unread answer counts down while the chat is open and on screen.
    if (!open || busy || closing) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setBubbles((bs) => {
        const i = bs.findIndex((b) => b.need && !b.read);
        if (i < 0) return bs;
        const b = bs[i];
        const done = (b.done ?? 0) + 1;
        const next = [...bs];
        next[i] = { ...b, done, read: done >= b.need! };
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [open, busy, closing]);
  useEffect(() => {
    // Phones: fit the sheet to the part of the screen that is really visible (iPhone keeps the page
    // height when its keyboard or toolbars appear), so the header with ✕ always stays on screen.
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const fit = () => {
      const el = panel.current;
      if (!el) return;
      el.style.setProperty("--cp-top", `${vv.offsetTop}px`);
      el.style.setProperty("--cp-h", `${vv.height}px`);
    };
    fit();
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
    return () => {
      vv.removeEventListener("resize", fit);
      vv.removeEventListener("scroll", fit);
    };
  }, [open, group]);
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
      setBubbles((b) => {
        const last = b.at(-1);
        return last?.from === "bot" && last.text ? [...b.slice(0, -1), { ...last, need: readingSeconds(last.text), done: 0 }] : b;
      });
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

  /** ✕: the window is sucked into Rocky's corner (Mac genie) and, if answers were read, Rocky launches. */
  async function closeWithShow() {
    if (closing) return;
    const n = reads;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (panel.current && !calm) {
      setClosing(true);
      const f = fab.current?.getBoundingClientRect();
      const target = f && f.width ? { x: f.left + f.width / 2, y: f.top + f.height / 2 } : { x: innerWidth - 54, y: innerHeight - 54 };
      await genie(panel.current, target);
    }
    setClosing(false);
    setOpen(false);
    if (n === 0 || calm) return;
    setBubbles((bs) => bs.map((b) => (b.read ? { ...b, spent: true } : b)));
    setLaunch(n);
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
        ref={fab}
        className={`cp-fab${open ? " open" : ""}${launch !== null ? " launching" : ""} fuel-${Math.min(reads, 3)}`}
        onClick={() => launch === null && !closing && setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="copilot-panel"
        aria-label={open ? "Cerrar a Rocky" : "Hablar con Rocky"}
      >
        {chute !== "off" && <Parachute state={chute} />}
        <Mascot size={58} mood={flying ? "talking" : open ? mood : "idle"} title="" />
      </button>
      {launch !== null && (
        <RockyLaunch fab={fab} reads={launch} onFlying={setFlying} onChute={setChute} onDone={() => setLaunch(null)} />
      )}

      {open && (
        <section
          id="copilot-panel"
          ref={panel}
          className={`cp-panel${closing ? " closing" : ""}`}
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
            <button className="cp-icon" onClick={closeWithShow} aria-label="Cerrar" title={reads ? "¿Listo para despegar?" : "Cerrar"}>✕</button>
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
              <div
                className="cp-list"
                ref={list}
                aria-live="polite"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                }}
              >
                <div className="cp-msg bot"><RichText text={greeting} /></div>
                {bubbles.map((b, i) => (
                  <div key={i} className={`cp-msg ${b.from}${b.error ? " error" : ""}`}>
                    {b.text ? (b.from === "bot" ? <RichText text={b.text} /> : b.text) : <span className="cp-dots" aria-label="Pensando"><i /><i /><i /></span>}
                    {b.need && (
                      <span className={`cp-read${b.read ? " done" : ""}`} title="Tiempo de lectura">
                        {b.read ? "✓" : `📖 ${b.need - (b.done ?? 0)} s`}
                      </span>
                    )}
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

/** Rocky's parachute, drawn above his button while he comes down. */
function Parachute({ state }: { state: Chute }) {
  return (
    <svg className={`cp-chute ${state}`} viewBox="0 0 80 64" aria-hidden="true">
      <path d="M4 26 C4 6 76 6 76 26 C70 22 64 22 58 26 C52 22 46 22 40 26 C34 22 28 22 22 26 C16 22 10 22 4 26 Z" fill="#E0701B" stroke="#072F70" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M22 26 C24 12 30 9 40 8 M58 26 C56 12 50 9 40 8" fill="none" stroke="#fff" strokeWidth="2" opacity=".7" />
      <path d="M4 26 L40 62 M22 26 L40 62 M40 26 L40 62 M58 26 L40 62 M76 26 L40 62" stroke="#072F70" strokeWidth="1.3" />
    </svg>
  );
}
