import type { Sample } from "../../physics/simulate";
import { G } from "../../physics/atmosphere";
import { format } from "../fields";

/** Free-body diagram: arrow lengths proportional to the forces at this instant. */
export function FreeBody({ sample: s }: { sample: Sample }) {
  const w = s.mass * G;
  const forces = [s.thrust, w, Math.abs(s.drag)];
  const max = Math.max(...forces, 1e-9);
  const L = (f: number) => 12 + (f / max) * 78;
  const cx = 80, top = 110, bottom = 175;
  const arrow = (x: number, y0: number, len: number, up: boolean, color: string, label: string) => (
    <g>
      <line x1={x} x2={x} y1={y0} y2={up ? y0 - len : y0 + len} stroke={color} strokeWidth={4} />
      <path d={up ? `M${x - 7},${y0 - len + 8} L${x},${y0 - len - 4} L${x + 7},${y0 - len + 8} Z` : `M${x - 7},${y0 + len - 8} L${x},${y0 + len + 4} L${x + 7},${y0 + len - 8} Z`} fill={color} />
      <text x={x + 10} y={up ? y0 - len / 2 : y0 + len / 2 + 4} fontSize={13} fill={color} fontWeight={700}>{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 180 290" className="fbd" role="img" aria-label="Diagrama de cuerpo libre">
      <path d={`M${cx},${top - 22} L${cx + 10},${top} L${cx + 10},${bottom} L${cx - 10},${bottom} L${cx - 10},${top} Z`} fill="#f3f1ec" stroke="#1a1a1a" />
      <path d={`M${cx - 10},${bottom - 20} l-11,20 h11 Z M${cx + 10},${bottom - 20} l11,20 h-11 Z`} fill="#c9d6ef" stroke="#0039a6" />
      {s.thrust > 0 && arrow(cx - 30, (top + bottom) / 2, L(s.thrust), true, "#a35f2a", "T")}
      {arrow(cx, bottom + 2, L(w), false, "#1a1a1a", "mg")}
      {Math.abs(s.drag) > 1e-3 && arrow(cx + 32, (top + bottom) / 2, L(Math.abs(s.drag)), s.v < 0, "#0039a6", "D")}
      <text x={4} y={14} fontSize={12} fill="#5b6270">v = {format(s.v, 1)} m/s {s.v >= 0 ? "↑" : "↓"}</text>
    </svg>
  );
}

export function CdBars({ parts }: { parts: { friction: number; nose: number; fins: number; base: number; total: number } }) {
  const rows = [
    { name: "Fricción con la superficie", v: parts.friction, color: "#0039a6" },
    { name: "Presión en la nariz", v: parts.nose, color: "#7a4fb0" },
    { name: "Bordes de las aletas", v: parts.fins, color: "#1d7a3e" },
    { name: "Base (cola)", v: parts.base, color: "#e0701b" },
  ];
  return (
    <div className="cd-bars">
      {rows.map((r) => (
        <div key={r.name} className="cd-row">
          <span>{r.name}</span>
          <span className="cd-track"><span style={{ width: `${(r.v / parts.total) * 100}%`, background: r.color }} /></span>
          <span className="num">{r.v.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
}
