import { createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A note that opens in a small window while the pointer is over its field (or the field has the focus, e.g. on a
 * phone): explanations stay out of the form until they are wanted. It is drawn over the page, below the field (above
 * it when there is no room), so a scrolling form never cuts it.
 *
 * How every note behaves (WCAG 1.4.13, as in Google's modern-web-guidance "interest-triggered-tooltips"):
 * - it opens after a short pause under the pointer (at once with the keyboard focus, or when another note is open),
 *   so sweeping the mouse across a form does not flash a note on every field;
 * - the pointer can move onto the note and stay there (to read it, or with a magnifier) without it closing;
 * - Esc closes it, and only one note is open at a time;
 * - an ⓘ text (InfoTip) is a button: a click or a tap keeps its note open until a click elsewhere or Esc.
 * The native interestfor / popover="hint" / anchor positioning do this too, but not yet in Firefox and Safari.
 */
type NotePos = { left: number; top?: number; bottom?: number; arrow: number; side: "below" | "above" };

const NOTE_WIDTH = 360;
const OPEN_DELAY = 220; // ms under the pointer before a note opens
const CLOSE_DELAY = 160; // ms to reach the note with the pointer before it closes

/** Where a note opens for an element: under it, or over it when there is more room above; always inside the window. */
function notePosition(el: Element): NotePos {
  const r = el.getBoundingClientRect();
  const w = Math.min(NOTE_WIDTH, window.innerWidth - 16);
  const left = Math.min(Math.max(r.left, 8), window.innerWidth - w - 8);
  // The arrow points at the start of the field (its label), or at the middle of a short element.
  const arrow = Math.min(Math.max(r.left + Math.min(r.width / 2, 28) - left, 14), w - 14);
  const below = window.innerHeight - r.bottom;
  return below > 180 || below > r.top
    ? { left, top: r.bottom + 10, arrow, side: "below" }
    : { left, bottom: window.innerHeight - r.top + 10, arrow, side: "above" };
}

/** The note that is open now: opening another closes it. */
let openNote: { close: () => void } | null = null;

/** Opening, closing and keeping one note open, with the timing and the keys above. */
function useNoteWindow<T>() {
  const [shown, setShown] = useState<T | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const pinned = useRef(false);
  const self = useRef({ close: () => { pinned.current = false; setShown(null); } });
  const clear = () => window.clearTimeout(timer.current);
  const open = (value: T, now = false) => {
    clear();
    const go = () => {
      if (openNote && openNote !== self.current) openNote.close();
      openNote = self.current;
      setShown(value);
    };
    if (now || openNote) go();
    else timer.current = window.setTimeout(go, OPEN_DELAY);
  };
  const close = (now = false) => {
    clear();
    if (pinned.current && !now) return;
    const go = () => {
      if (openNote === self.current) openNote = null;
      pinned.current = false;
      setShown(null);
    };
    if (now) go();
    else timer.current = window.setTimeout(go, CLOSE_DELAY);
  };
  const pin = (value: T) => { pinned.current = true; open(value, true); };
  useEffect(() => {
    if (!shown) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") close(true); };
    const away = () => close(true);
    window.addEventListener("keydown", key);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);
  useEffect(() => () => { clear(); if (openNote === self.current) openNote = null; }, []);
  // On the note itself: the pointer can rest there without the note closing.
  const windowHandlers = { onMouseEnter: clear, onMouseLeave: () => close() };
  return { shown, open, close, pin, pinned, windowHandlers };
}

/**
 * The window every note of RPL opens in (the same look as "¿Dónde está la masa?"): a card with the name of what it
 * explains in blue, then the explanation, with a small arrow towards what it explains.
 */
function NoteWindow({ id, pos, heading, children, handlers }: { id?: string; pos: NotePos; heading?: ReactNode; children: ReactNode; handlers?: { onMouseEnter: () => void; onMouseLeave: () => void } }) {
  return createPortal(
    <div
      className={`note-window ${pos.side}`}
      id={id}
      role="tooltip"
      style={{ left: pos.left, top: pos.top, bottom: pos.bottom, ["--arrow-x" as string]: `${pos.arrow}px` }}
      {...handlers}
    >
      {heading && <div className="note-title">{heading}</div>}
      <div className="note-body">{children}</div>
    </div>,
    document.body,
  );
}

/** A label without its 🔒 / ⓘ marks, as the heading of its note. */
const cleanLabel = (label: string) => label.replace(/[🔒ⓘ]/gu, "").trim();

export function useNote(note: ReactNode, heading?: ReactNode) {
  const ref = useRef<HTMLElement | null>(null);
  const id = useId();
  const w = useNoteWindow<NotePos>();
  const at = () => (ref.current && note ? notePosition(ref.current) : null);
  const show = (now: boolean) => { const p = at(); if (p) w.open(p, now); };
  // A click elsewhere closes a note kept open with a click.
  useEffect(() => {
    if (!w.shown) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || (t instanceof Element && t.closest(".note-window"))) return;
      w.close(true);
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.shown]);
  const popup = note && w.shown ? <NoteWindow id={id} pos={w.shown} heading={heading} handlers={w.windowHandlers}>{note}</NoteWindow> : null;
  return {
    ref,
    popup,
    describedBy: w.shown ? id : undefined,
    open: !!w.shown,
    /** Keep the note open (a click on an ⓘ), or close it if it was kept open. */
    toggle: () => { if (w.shown && w.pinned.current) w.close(true); else { const p = at(); if (p) w.pin(p); } },
    handlers: note ? { onMouseEnter: () => show(false), onMouseLeave: () => w.close(), onFocus: () => show(true), onBlur: () => w.close() } : {},
  };
}

/** The ⓘ after a label that has a note (a 🔒 already says there is one). */
const noteMark = (label: string, note: ReactNode) => (note && !label.includes("🔒") ? <span className="note-mark" aria-hidden="true"> ⓘ</span> : null);

/**
 * A bit of text with a note, for notes that belong to no field: the pointer or the focus shows it, and a click or a
 * tap keeps it open (a "toggletip").
 */
export function InfoTip({ children, note, heading, className }: { children: ReactNode; note: ReactNode; heading?: ReactNode; className?: string }) {
  const n = useNote(note, heading);
  return (
    <button
      type="button"
      ref={n.ref as React.RefObject<HTMLButtonElement>}
      className={`info-tip ${className ?? ""}`}
      aria-expanded={n.open}
      onClick={n.toggle}
      {...n.handlers}
    >
      {children}<span className="note-mark" aria-hidden="true"> ⓘ</span>
      {n.popup}
    </button>
  );
}

/**
 * A button that does something on its own (go to a step, show a section) and whose explanation is a hint: it opens
 * in a note while the pointer rests on the button or the button has the focus, instead of a line of small text that
 * is always there. The note describes the button (aria-describedby, role="tooltip") and toggles nothing, so the
 * button gets no aria-expanded (Google's "interest-triggered-tooltips": a hint whose trigger does something else).
 */
export function NoteButton({ note, heading, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { note: ReactNode; heading?: ReactNode }) {
  const tip = useNote(note, heading);
  return (
    <button type="button" {...rest} ref={tip.ref as React.RefObject<HTMLButtonElement>} aria-describedby={tip.describedBy} {...tip.handlers}>
      {children}
      {tip.popup}
    </button>
  );
}

/** Inside a Cohete step only a few sections show: all of them open, not an accordion. */
export const SectionsOpen = createContext(false);

/** Accepts both "0.5" and "0,5" (Spanish decimal comma). */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "" || t === "-" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function format(n: number, digits = 1): string {
  return n.toLocaleString("es-MX", { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/**
 * Units a student can switch to. The design always keeps the base unit (mm, g, m); a field shows the chosen one.
 * The choice is shared by every field of the same kind (all lengths, all masses) and remembered in this browser.
 */
const UNIT_SETS: Record<string, { unit: string; factor: number; digits: number; step: number }[]> = {
  mm: [
    { unit: "mm", factor: 1, digits: 1, step: 1 },
    { unit: "cm", factor: 10, digits: 2, step: 0.1 },
    { unit: "in", factor: 25.4, digits: 3, step: 0.05 },
  ],
  g: [
    { unit: "g", factor: 1, digits: 2, step: 0.1 },
    { unit: "oz", factor: 28.349523125, digits: 3, step: 0.01 },
  ],
  m: [
    { unit: "m", factor: 1, digits: 2, step: 1 },
    { unit: "ft", factor: 0.3048, digits: 1, step: 1 },
  ],
};
/** Step of the up/down controls for units that cannot be switched. */
const STEPS: Record<string, number> = { "°C": 1, s: 0.1, L: 0.1, kg: 0.05, psi: 5 };

const UNITS_KEY = "rpl-units";
const unitListeners = new Set<() => void>();
let unitPrefs: Record<string, string> = (() => {
  try {
    return JSON.parse(localStorage.getItem(UNITS_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
})();
function setUnitPref(base: string, unit: string) {
  unitPrefs = { ...unitPrefs, [base]: unit };
  try {
    localStorage.setItem(UNITS_KEY, JSON.stringify(unitPrefs));
  } catch {
    /* private window: the choice lasts until the page closes */
  }
  unitListeners.forEach((l) => l());
}
const subscribeUnits = (l: () => void) => {
  unitListeners.add(l);
  return () => unitListeners.delete(l);
};

/** Rounds away float noise (0.1 + 0.2) to the step's decimals. */
const snap = (v: number, step: number) => {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number(v.toFixed(decimals));
};

interface NumFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  digits?: number;
  className?: string;
  /** Its note, in the window that opens over the field. */
  title?: ReactNode;
  /** A fixed figure (e.g. the motor's mass from its data sheet): shown, never edited. */
  readOnly?: boolean;
}

/**
 * Number input that tolerates partial typing and only reports valid values within range. Lengths, masses and
 * heights can be shown in another unit (the value given and reported stays in the base unit), and the − / +
 * controls (or the ↑ ↓ keys, Shift for ×10) move it one step; holding a control keeps stepping.
 */
export function NumField({ label, value, onChange, unit, min, max, digits = 2, className, title, readOnly }: NumFieldProps) {
  const id = useId();
  const note = useNote(title, cleanLabel(label));
  const prefs = useSyncExternalStore(subscribeUnits, () => unitPrefs);
  const options = unit ? UNIT_SETS[unit] : undefined;
  const shown = options?.find((o) => o.unit === prefs[unit!]) ?? options?.[0];
  const factor = shown?.factor ?? 1;
  const shownDigits = shown && shown.factor !== 1 ? shown.digits : digits;
  const step = shown?.step ?? (unit ? STEPS[unit] : undefined) ?? 1;
  const toBase = (n: number) => n * factor;
  const inRange = (base: number) => (min === undefined || base >= min - 1e-9) && (max === undefined || base <= max + 1e-9);

  const [text, setText] = useState(() => format(value / factor, shownDigits));
  const parsed = parseNumber(text);
  const valid = parsed !== null && inRange(toBase(parsed));

  useEffect(() => {
    // Follow external changes (e.g. a recomputed mass) unless the text already means this value.
    // A tolerance keeps converted values (kg ↔ L) from rewriting what the student is typing.
    const typed = parseNumber(text);
    if (typed === null || Math.abs(toBase(typed) - value) > 1e-6 * Math.max(1, Math.abs(value))) setText(format(value / factor, shownDigits));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  // A new unit rewrites the text in it.
  useEffect(() => setText(format(value / factor, shownDigits)), [factor]); // eslint-disable-line react-hooks/exhaustive-deps

  // The latest value, for the repeating control.
  const latest = useRef(value);
  latest.current = value;
  const bump = (dir: 1 | -1, times = 1) => {
    let next = toBase(snap(latest.current / factor + dir * step * times, step));
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    if (next === latest.current) return;
    latest.current = next;
    setText(format(next / factor, shownDigits));
    onChange(next);
  };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const hold = (dir: 1 | -1) => {
    bump(dir);
    const again = (delay: number) => { timer.current = setTimeout(() => { bump(dir); again(70); }, delay); };
    again(400);
  };
  const stepper = (dir: 1 | -1) => readOnly ? null : (
    <button
      type="button"
      className="step-btn"
      tabIndex={-1}
      aria-label={`${dir > 0 ? "Subir" : "Bajar"} ${label}`}
      disabled={dir > 0 ? max !== undefined && value >= max : min !== undefined && value <= min}
      onPointerDown={(e) => { e.preventDefault(); hold(dir); }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      {dir > 0 ? "+" : "−"}
    </button>
  );

  return (
    <div ref={note.ref as React.RefObject<HTMLDivElement>} className={`field ${valid ? "" : "invalid"} ${readOnly ? "readonly" : ""} ${className ?? ""}`} {...note.handlers}>
      {note.popup}
      <label htmlFor={id}>{label}{noteMark(label, title)}</label>
      <span className="control">
        {stepper(-1)}
        <input
          id={id}
          aria-describedby={note.describedBy}
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          readOnly={readOnly}
          aria-readonly={readOnly}
          value={text}
          onChange={(e) => {
            if (readOnly) return;
            setText(e.target.value);
            const n = parseNumber(e.target.value);
            if (n !== null && inRange(toBase(n))) onChange(toBase(n));
          }}
          onKeyDown={(e) => {
            if (readOnly) return;
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              bump(e.key === "ArrowUp" ? 1 : -1, e.shiftKey ? 10 : 1);
            }
          }}
          onBlur={() => setText(format(value / factor, shownDigits))}
        />
        {stepper(1)}
        {options && options.length > 1 ? (
          <select className="unit unit-select" aria-label={`Unidad de ${label}`} value={shown!.unit} onChange={(e) => setUnitPref(unit!, e.target.value)}>
            {options.map((o) => <option key={o.unit} value={o.unit}>{o.unit}</option>)}
          </select>
        ) : unit && <span className="unit">{unit}</span>}
      </span>
    </div>
  );
}

export function TextField({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  const id = useId();
  return (
    <label className={`field ${className ?? ""}`} htmlFor={id}>
      <span>{label}</span>
      <span className="control">
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      </span>
    </label>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange, className, title }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
  /** Its note, in the window that opens over the field. */
  title?: ReactNode;
}) {
  const id = useId();
  const note = useNote(title, cleanLabel(label));
  return (
    <label ref={note.ref as React.RefObject<HTMLLabelElement>} className={`field ${className ?? ""}`} htmlFor={id} {...note.handlers}>
      {note.popup}
      <span>{label}{noteMark(label, title)}</span>
      <span className="control">
        <select id={id} aria-describedby={note.describedBy} value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </span>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="group">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Section({ title, summary, warn, children, open = false }: { title: string; summary?: string; warn?: string; children: ReactNode; open?: boolean }) {
  const all = useContext(SectionsOpen);
  return (
    // Sections sharing a name form an accordion: opening one closes the others.
    <details
      className="panel"
      open={open || all}
      name={all ? undefined : "design-sections"}
      onToggle={(e) => {
        // When a long section above closes, the one just opened can jump off screen: bring its title back into view.
        const el = e.currentTarget;
        if (el.open && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start", behavior: "smooth" });
      }}
    >
      <summary>
        {title}
        {/* A problem inside shows even while the section is closed. */}
        {warn && <span className="section-warn" title={warn} role="img" aria-label={`Atención: ${warn}`}>⚠</span>}
        {summary && <small>{summary}</small>}
      </summary>
      <div className="panel-body">{children}</div>
    </details>
  );
}

/**
 * Every `title` in RPL (buttons, options, figures…) opens in the same note window instead of the browser's plain
 * tooltip: the text moves to `data-note` the first time the pointer or the focus reaches the element.
 */
export function NoteLayer() {
  const w = useNoteWindow<{ el: Element; pos: NotePos; text: string }>();
  // The element whose note is open or about to open.
  const current = useRef<Element | null>(null);
  useEffect(() => {
    const find = (t: EventTarget | null) => {
      const el = t instanceof Element ? t.closest("[title], [data-note]") : null;
      if (!el) return null;
      const title = el.getAttribute("title");
      if (title !== null) {
        el.removeAttribute("title");
        if (title.trim()) el.setAttribute("data-note", title);
      }
      return el.getAttribute("data-note") ? el : null;
    };
    const opener = (now: boolean) => (e: Event) => {
      const el = find(e.target);
      if (!el || el === current.current) return;
      current.current = el;
      w.open({ el, pos: notePosition(el), text: el.getAttribute("data-note")! }, now);
    };
    const onOver = opener(false);
    const onFocus = opener(true);
    const leave = (e: Event) => {
      const el = current.current;
      const next = (e as MouseEvent | FocusEvent).relatedTarget;
      if (!el || !(e.target instanceof Node && el.contains(e.target)) || (next instanceof Node && el.contains(next))) return;
      // Into its open note: keep it. Otherwise close it (after a moment, so the pointer can reach the note).
      if (next instanceof Element && next.closest(".note-window")) return;
      current.current = null;
      w.close(e.type === "focusout");
    };
    const down = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest(".note-window")) return;
      current.current = null;
      w.close(true);
    };
    document.addEventListener("mouseover", onOver);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("mouseout", leave);
    document.addEventListener("focusout", leave);
    document.addEventListener("pointerdown", down);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("mouseout", leave);
      document.removeEventListener("focusout", leave);
      document.removeEventListener("pointerdown", down);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shown = w.shown;
  // A note whose element left the page closes with it.
  if (!shown || !shown.el.isConnected) return null;
  return <NoteWindow pos={shown.pos} handlers={w.windowHandlers}>{shown.text}</NoteWindow>;
}
