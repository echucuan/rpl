import type { Sample } from "../../physics/simulate";
import { G } from "../../physics/atmosphere";
import { format } from "../fields";
import { QTY } from "../phases";

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
    { name: "Presión en la ojiva", v: parts.nose, color: "#7a4fb0" },
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

const ROCKET_ICON = `${import.meta.env.BASE_URL}rocket-tec/cohete-isotipo.png`;
// The icon is 160 × 265 px: the nose tip is at y = 12 and the end of the fins at y = 192 (the flame is below).
const ICON = { w: 160, h: 265, tip: 12, tail: 192 };

/**
 * Rocket Tec free-body diagram: the "cohete sin denominación" icon with an XY frame at the centre of mass.
 * The three forces start at the centre of mass; their lengths are proportional to their size at this instant.
 * The icon is faded and blurred so the forces stand out; T, W and D all start exactly at the centre of mass.
 */
/** Largest force (T, W or |D|) over some samples: one arrow scale for the free-body diagram of a whole phase. */
export const forceScale = (samples: Sample[]) => samples.reduce((m, x) => Math.max(m, x.thrust, x.mass * G, Math.abs(x.drag)), 0);

export function RocketFreeBody({ sample: s, cgFraction, inverted = false, forceMax }: {
  sample: Sample; cgFraction: number;
  /** Nose down, for the fall in phases III and IV. */
  inverted?: boolean;
  /** Force (N) drawn with the longest arrow. Give the largest force of the whole phase so the arrows keep one scale
   *  as the slider moves; without it each instant is scaled to its own largest force. */
  forceMax?: number;
}) {
  const W = s.mass * G;
  const D = Math.abs(s.drag);
  const max = Math.max(forceMax ?? 0, s.thrust, W, D, 1e-9);
  const L = (f: number) => (f > 1e-6 ? 16 + (f / max) * 120 : 0);
  const scale = 1;
  const iconW = ICON.w * scale, iconH = ICON.h * scale;
  const cx = 160;
  const top = 80;
  const fromTop = (ICON.tip + (ICON.tail - ICON.tip) * Math.min(Math.max(cgFraction, 0), 1)) * scale;
  // Turned upside down the nose is at the bottom, so the centre of mass is measured from the icon's lower edge.
  const cgY = inverted ? top + iconH - fromTop : top + fromTop;
  // Every force starts exactly at the centre of mass. The arrow body stops where the head begins.
  const head = 16;
  const arrow = (len: number, up: boolean, color: string, label: string, side: "left" | "right" | "center") => {
    if (len <= 0) return null;
    const dir = up ? -1 : 1;
    const tip = cgY + dir * (len + head / 2);
    const base = tip - dir * head;
    const lx = side === "left" ? cx - 14 : side === "right" ? cx + 14 : cx;
    return (
      <g key={label}>
        <line x1={cx} x2={cx} y1={cgY} y2={base} stroke={color} strokeWidth={6} />
        <path d={`M${cx - 10},${base} L${cx},${tip} L${cx + 10},${base} Z`} fill={color} stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" />
        <text x={lx} y={side === "center" ? (up ? tip - 8 : tip + 22) : up ? tip + 16 : tip} fontSize={22} fontWeight={800} fontStyle="italic" fill={color} textAnchor={side === "left" ? "end" : side === "right" ? "start" : "middle"}
          stroke="#fff" strokeWidth={4} paintOrder="stroke">{label}</text>
      </g>
    );
  };
  const down = s.v < 0; // drag points up only while falling
  // W and D share the line through the CM while the rocket climbs: the longer one is drawn first so both stay visible.
  const vertical = [
    { len: L(s.thrust), up: true, color: QTY.T, label: "T", side: "left" as const },
    { len: L(W), up: false, color: QTY.W, label: "W", side: "left" as const },
    { len: L(D), up: down, color: QTY.D, label: "D", side: "right" as const },
  ].sort((a, b) => b.len - a.len);
  return (
    <svg viewBox="0 0 320 440" className="fbd fbd-rocket" role="img" aria-label="Diagrama de cuerpo libre del cohete con las fuerzas en el centro de masa">
      <defs>
        <filter id="fbd-soft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={2.2} />
        </filter>
      </defs>
      <image href={ROCKET_ICON} x={cx - iconW / 2} y={top} width={iconW} height={iconH} opacity={0.28} filter="url(#fbd-soft)"
        transform={inverted ? `rotate(180 ${cx} ${top + iconH / 2})` : undefined} />
      {/* XY reference frame at the centre of mass */}
      <g stroke="#5b6270" strokeWidth={1.2}>
        <line x1={cx - 110} x2={cx + 118} y1={cgY} y2={cgY} strokeDasharray="4 3" />
        <line x1={cx} x2={cx} y1={cgY + 150} y2={cgY - 150} strokeDasharray="4 3" />
      </g>
      <path d={`M${cx + 118},${cgY - 4} L${cx + 126},${cgY} L${cx + 118},${cgY + 4} Z`} fill="#5b6270" />
      <path d={`M${cx - 4},${cgY - 150} L${cx},${cgY - 158} L${cx + 4},${cgY - 150} Z`} fill="#5b6270" />
      <text x={cx + 129} y={cgY + 5} fontSize={15} fill="#5b6270" fontStyle="italic">x</text>
      <text x={cx + 8} y={cgY - 152} fontSize={15} fill="#5b6270" fontStyle="italic">y</text>
      {vertical.map((f) => arrow(f.len, f.up, f.color, f.label, f.side))}
      <circle cx={cx} cy={cgY} r={7} fill="#fff" stroke="#072f70" strokeWidth={2} />
      <path d={`M${cx},${cgY - 7} A7,7 0 0,1 ${cx + 7},${cgY} L${cx},${cgY} Z M${cx},${cgY + 7} A7,7 0 0,1 ${cx - 7},${cgY} L${cx},${cgY} Z`} fill="#072f70" />
      <text x={cx - 106} y={cgY - 8} fontSize={13} fontWeight={700} fill="#072f70">CM</text>
      <text x={6} y={18} fontSize={13} fill="#5b6270">v = {format(s.v, 1)} m/s {s.v >= 0 ? "↑" : "↓"}</text>
    </svg>
  );
}
