import type { Design } from "../model";
import { a10Motor } from "../motor";
import { layout, noseRadius, waterFill } from "../physics/geometry";
import type { Stability } from "../physics/geometry";
import { format } from "./fields";

/** Side view of the rocket, nose to the left, with CG and CP markers. */
export function RocketView({ design: d, loaded, empty }: { design: Design; loaded: Stability; empty: Stability }) {
  const l = layout(d);
  const f = d.fins;
  const r = l.refDiameter / 2;
  const halfHeight = Math.max(r, d.body.diameter / 2 + f.span) + 6;
  const width = 1000;
  const scale = (width - 40) / l.length;
  const height = Math.max(2 * halfHeight * scale + 110, 190);
  const cy = height / 2 - 6;
  const X = (x: number) => 20 + x * scale;
  const Y = (y: number) => cy - y * scale;

  // Outline: nose profile, body, tail (top half, then mirrored)
  const top: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const x = (i / 40) * d.nose.length;
    top.push([x, noseRadius(d.nose.shape, x, d.nose.length, d.nose.diameter / 2)]);
  }
  top.push([l.bodyStart, d.body.diameter / 2], [l.bodyEnd, d.body.diameter / 2]);
  if (l.tailLength > 0) top.push([l.length, l.aftDiameter / 2]);
  const outline = [...top, ...[...top].reverse().map(([x, y]) => [x, -y] as [number, number])]
    .map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(" ");

  const rb = d.body.diameter / 2;
  const le = l.finLeading;
  const fin = (sign: 1 | -1) => [
    [le, rb], [le + f.sweep, rb + f.span], [le + f.sweep + f.tipChord, rb + f.span], [le + f.rootChord, rb],
  ].map(([x, y]) => `${X(x).toFixed(1)},${Y(sign * y).toFixed(1)}`).join(" ");

  const motor = d.type === "estes" ? a10Motor(d.motor.mass, d.motor.propellant) : undefined;
  const water = d.type === "water" && d.water.waterVolume > 0 ? waterFill(d, d.water.waterVolume) : null;

  return (
    <div className="rocket-view">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Vista lateral de ${d.name}`}>
        <defs>
          <clipPath id="hull"><polygon points={outline} /></clipPath>
        </defs>
        {f.count > 0 && <polygon points={fin(1)} fill="#c9d6ef" stroke="#0039a6" strokeWidth={1.5} />}
        {f.count > 1 && <polygon points={fin(-1)} fill="#c9d6ef" stroke="#0039a6" strokeWidth={1.5} />}
        <polygon points={outline} fill={d.type === "water" ? "#eef6f1" : "#f3f1ec"} stroke="#1a1a1a" strokeWidth={1.5} />
        {water && (
          <rect x={X(water.surface)} y={Y(l.refDiameter)} width={X(l.length) - X(water.surface)} height={l.refDiameter * 2 * scale} fill="#7fb4e6" opacity={0.75} clipPath="url(#hull)" />
        )}
        <line x1={X(l.bodyStart)} x2={X(l.bodyStart)} y1={Y(rb)} y2={Y(-rb)} stroke="#1a1a1a" strokeWidth={1} opacity={0.4} />
        {motor && (
          <rect x={X(l.bodyEnd - motor.length)} y={Y(motor.diameter / 2)} width={motor.length * scale} height={motor.diameter * scale} fill="#a35f2a" opacity={0.55} stroke="#6b3a14" strokeDasharray="4 3" />
        )}
        {d.type === "estes" && d.altimeter.included && (
          <rect x={X(d.altimeter.position) - 9} y={cy - 5} width={18} height={10} rx={2} fill="#1a1a1a" opacity={0.75} />
        )}
        {d.recovery.kind === "parachute" && (
          <circle cx={X(d.recovery.position)} cy={cy} r={Math.max(Math.min(rb * scale * 0.55, 14), 4)} fill="#e0701b" opacity={0.75} />
        )}
        <g fontSize={16} fill="#5b6270" textAnchor="middle">
          <text x={X(d.nose.length * 0.55)} y={Y(d.nose.diameter / 2) - 8}>Nariz</text>
          <text x={X((l.bodyStart + Math.min(l.bodyEnd, l.finLeading)) / 2)} y={Y(rb) - 8}>{d.type === "water" ? "Botella" : "Cuerpo de opalina"}</text>
          {f.count > 0 && <text x={X(le + f.sweep + f.tipChord / 2)} y={Y(rb + f.span) - 8}>Aletas</text>}
          {motor && <text x={X(l.bodyEnd - motor.length / 2)} y={Y(-rb) + 20}>Motor {motor.name}</text>}
          {water && <text x={X((water.surface + l.length) / 2)} y={Y(-rb) + 20}>Agua</text>}
        </g>
        <Marker x={X(loaded.cg)} y={cy} kind="cg" />
        {Math.abs(empty.cg - loaded.cg) > 1 && <Marker x={X(empty.cg)} y={cy} kind="cg-empty" />}
        <Marker x={X(loaded.cp)} y={cy} kind="cp" />
        <line x1={X(0)} x2={X(l.length)} y1={height - 22} y2={height - 22} stroke="#5b6270" strokeWidth={1} />
        <text x={X(l.length / 2)} y={height - 2} textAnchor="middle" fontSize={20} fill="#5b6270">{format(l.length / 10, 1)} cm</text>
      </svg>
      <div className="legend">
        <span><Swatch kind="cg" /> Centro de gravedad <b>{format(loaded.cg / 10, 1)} cm</b>{d.type === "water" ? " (con agua)" : " (con motor)"}</span>
        {Math.abs(empty.cg - loaded.cg) > 1 && <span><Swatch kind="cg-empty" /> CG {d.type === "water" ? "sin agua" : "motor quemado"} <b>{format(empty.cg / 10, 1)} cm</b></span>}
        <span><Swatch kind="cp" /> Centro de presión <b>{format(loaded.cp / 10, 1)} cm</b></span>
        {d.recovery.kind === "parachute" && <span><span style={{ color: "#e0701b" }}>●</span> Paracaídas</span>}
        {water && <span><span style={{ color: "#7fb4e6" }}>■</span> Agua</span>}
        {d.type === "estes" && d.altimeter.included && <span><span style={{ color: "#1a1a1a" }}>■</span> Altímetro</span>}
      </div>
    </div>
  );
}

function Marker({ x, y, kind }: { x: number; y: number; kind: "cg" | "cg-empty" | "cp" }) {
  const s = 11;
  if (kind === "cp") {
    return (
      <g>
        <circle cx={x} cy={y} r={s} fill="#fff" stroke="#b3261e" strokeWidth={2.5} />
        <circle cx={x} cy={y} r={3.5} fill="#b3261e" />
      </g>
    );
  }
  const empty = kind === "cg-empty";
  return (
    <g opacity={empty ? 0.6 : 1}>
      <circle cx={x} cy={y} r={s} fill="#fff" stroke="#1a1a1a" strokeWidth={2} strokeDasharray={empty ? "3 2" : undefined} />
      <path d={`M${x},${y} L${x + s},${y} A${s},${s} 0 0,0 ${x},${y - s} Z M${x},${y} L${x - s},${y} A${s},${s} 0 0,0 ${x},${y + s} Z`} fill="#1a1a1a" />
    </g>
  );
}

function Swatch({ kind }: { kind: "cg" | "cg-empty" | "cp" }) {
  return (
    <svg width={16} height={16} viewBox="-12 -12 24 24" style={{ verticalAlign: "-3px" }} aria-hidden>
      <Marker x={0} y={0} kind={kind} />
    </svg>
  );
}
