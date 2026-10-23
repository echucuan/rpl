import { useEffect, useId, useState, type ReactNode } from "react";

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

interface NumFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  min?: number;
  max?: number;
  digits?: number;
  className?: string;
  title?: string;
}

/** Number input that tolerates partial typing and only reports valid values within range. */
export function NumField({ label, value, onChange, unit, min, max, digits = 2, className, title }: NumFieldProps) {
  const id = useId();
  const [text, setText] = useState(() => format(value, digits));
  const parsed = parseNumber(text);
  const valid = parsed !== null && (min === undefined || parsed >= min) && (max === undefined || parsed <= max);

  useEffect(() => {
    // Follow external changes (catalog picks, kits) unless the text already means this value.
    if (parseNumber(text) !== value) setText(format(value, digits));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <label className={`field ${valid ? "" : "invalid"} ${className ?? ""}`} htmlFor={id} title={title}>
      <span>{label}</span>
      <span className="control">
        <input
          id={id}
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseNumber(e.target.value);
            if (n !== null && (min === undefined || n >= min) && (max === undefined || n <= max)) onChange(n);
          }}
          onBlur={() => setText(format(value, digits))}
        />
        {unit && <span className="unit">{unit}</span>}
      </span>
    </label>
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

export function SelectField<T extends string>({ label, value, options, onChange, className }: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <label className={`field ${className ?? ""}`} htmlFor={id}>
      <span>{label}</span>
      <span className="control">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
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

export function Section({ title, summary, children, open = true }: { title: string; summary?: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="panel" open={open}>
      <summary>
        {title}
        {summary && <small>{summary}</small>}
      </summary>
      <div className="panel-body">{children}</div>
    </details>
  );
}
