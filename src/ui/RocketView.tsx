import { ALTIMETER_MM, hasMotor, type Design } from "../model";
import { motorFor } from "../motor";
import { chuteProperties } from "../physics/parachute";
import { layout, noseRadius, waterFill } from "../physics/geometry";
import type { Stability } from "../physics/geometry";
import { format } from "./fields";

/** Side view of the rocket, nose to the left, with CM and CP markers. */
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

  const motor = d.type === "estes" && hasMotor(d) ? motorFor(d.motor) : undefined;
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
          <MotorCasing x={X(l.bodyEnd - motor.length)} y={cy} width={motor.length * scale} height={motor.diameter * scale} name={motor.name} />
        )}
        {d.type === "estes" && d.altimeter.included && (
          <Altimeter x={X(d.altimeter.position)} y={cy} scale={scale} />
        )}
        {d.recovery.kind === "parachute" && (
          <PackedChute x={X(d.recovery.position)} y={cy} scale={scale} {...packedChute(d)} />
        )}
        {/* Extra masses, numbered M1, M2… at their centre */}
        {d.extras.map((e, i) => {
          const ex = X(e.position), ey = cy + rb * scale + 18;
          return (
            <g key={i} className="extra-tag">
              <title>{`M${i + 1}: ${e.name} · ${format(e.mass, 1)} g`}</title>
              <ExtraShape name={e.name} mass={e.mass} x={ex} y={cy} scale={scale} inner={rb - 0.8} outer={rb} />
              <rect x={ex - 22} y={ey - 13} width={44} height={26} rx={13} fill="#5b6270" stroke="#fff" strokeWidth={2} />
              <text x={ex} y={ey + 6.5} textAnchor="middle" fontSize={18} fontWeight={800} fill="#fff">M{i + 1}</text>
            </g>
          );
        })}
        <g fontSize={16} fill="#5b6270" textAnchor="middle">
          <text x={X(d.nose.length * 0.55)} y={Y(d.nose.diameter / 2) - 8}>Ojiva</text>
          <text x={X((l.bodyStart + Math.min(l.bodyEnd, l.finLeading)) / 2)} y={Y(rb) - 8}>{d.type === "water" ? "Botella" : "Cuerpo"}</text>
          {f.count > 0 && <text x={X(le + f.sweep + f.tipChord / 2)} y={Y(rb + f.span) - 8}>Aletas</text>}
          {/* Inside the body, just over the motor casing (below the rocket it sat on a fin). */}
          {motor && <text x={X(l.bodyEnd - motor.length / 2)} y={Y(motor.diameter / 2) - 5} fontSize={14} fontWeight={700} fill="#6e5034">Motor</text>}
          {water && <text x={X((water.surface + l.length) / 2)} y={Y(-rb) + 20}>Agua</text>}
        </g>
        <Marker x={X(loaded.cg)} y={cy} kind="cg" />
        {Math.abs(empty.cg - loaded.cg) > 1 && <Marker x={X(empty.cg)} y={cy} kind="cg-empty" />}
        <Marker x={X(loaded.cp)} y={cy} kind="cp" />
        {/* Names over the markers: CM in black, CP in red */}
        <text x={X(loaded.cg)} y={cy - 17} textAnchor="middle" fontSize={18} fontWeight={800} fill="#1a1a1a">CM</text>
        <text x={X(loaded.cp)} y={cy - 17} textAnchor="middle" fontSize={18} fontWeight={800} fill="#b3261e">CP</text>
        <line x1={X(0)} x2={X(l.length)} y1={height - 22} y2={height - 22} stroke="#5b6270" strokeWidth={1} />
        <text x={X(l.length / 2)} y={height - 2} textAnchor="middle" fontSize={20} fill="#5b6270">{format(l.length / 10, 1)} cm</text>
      </svg>
      <div className="legend">
        <span><Swatch kind="cg" /> Centro de masa <b>{format(loaded.cg / 10, 1)} cm</b>{d.type === "water" ? " (con agua)" : " (con motor)"}</span>
        {Math.abs(empty.cg - loaded.cg) > 1 && <span><Swatch kind="cg-empty" /> CM {d.type === "water" ? "sin agua" : "motor quemado"} <b>{format(empty.cg / 10, 1)} cm</b></span>}
        <span><Swatch kind="cp" /> Centro de presión <b>{format(loaded.cp / 10, 1)} cm</b></span>
        {d.recovery.kind === "parachute" && <span><span style={{ color: "#e0701b" }}>▬</span> Paracaídas (doblado)</span>}
        {water && <span><span style={{ color: "#7fb4e6" }}>■</span> Agua</span>}
        {d.type === "estes" && d.altimeter.included && <span><span style={{ color: "#1a1a1a" }}>■</span> Altímetro</span>}
        {d.extras.length > 0 && (
          <span>
            <b className="extra-chip">M</b> Masas adicionales: {d.extras.map((e, i) => `M${i + 1} ${e.name} (${format(e.mass, 1)} g)`).join(" · ")}
          </span>
        )}
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


/** The Estes altimeter seen from the front, to scale (px per mm), centred on (x, y). */
function Altimeter({ x, y, scale: s }: { x: number; y: number; scale: number }) {
  const { length, height, tab } = ALTIMETER_MM;
  const left = x - (length / 2) * s;
  const bx = left + tab * s; // where the case starts, after the clip tab
  const bw = (length - tab) * s;
  const top = y - (height / 2) * s;
  const lcd = { x: bx + 25 * s, w: 18 * s, h: 11 * s };
  return (
    <g aria-label="Altímetro Estes">
      {/* Clip tab with its attachment hole */}
      <path
        d={`M${bx + 2 * s},${y - 5 * s} L${left + 2 * s},${y - 5 * s} Q${left},${y - 5 * s} ${left},${y - 3 * s} L${left},${y + 3 * s} Q${left},${y + 5 * s} ${left + 2 * s},${y + 5 * s} L${bx + 2 * s},${y + 5 * s} Z`}
        fill="#24272d"
        stroke="#0b0c0e"
        strokeWidth={1}
      />
      <circle cx={left + 4 * s} cy={y} r={1.8 * s} fill="#f3f1ec" stroke="#0b0c0e" strokeWidth={0.8} />
      {/* Case */}
      <rect x={bx} y={top} width={bw} height={height * s} rx={3.2 * s} fill="#1b1d22" stroke="#0b0c0e" strokeWidth={1.2} />
      <rect x={bx + 1.2 * s} y={top + 1.2 * s} width={bw - 2.4 * s} height={height * s * 0.38} rx={2.2 * s} fill="#ffffff" opacity={0.07} />
      {/* Estes oval */}
      <ellipse cx={bx + 9 * s} cy={y} rx={6.6 * s} ry={2.7 * s} fill="#f4f4f4" />
      <text x={bx + 9.6 * s} y={y + 1 * s} textAnchor="middle" fontSize={3 * s} fontWeight={900} fontStyle="italic" fill="#1b1d22">ESTES</text>
      {/* Button */}
      <circle cx={bx + 19.5 * s} cy={y} r={3.4 * s} fill="#c4c8cf" stroke="#0b0c0e" strokeWidth={0.8} />
      <circle cx={bx + 19.5 * s} cy={y} r={2.1 * s} fill="#2a2d33" />
      {/* LCD */}
      <rect x={lcd.x} y={y - lcd.h / 2} width={lcd.w} height={lcd.h} rx={1.2 * s} fill="#0e0f12" />
      <rect x={lcd.x + 1 * s} y={y - lcd.h / 2 + 1 * s} width={lcd.w - 2 * s} height={lcd.h - 2 * s} rx={0.6 * s} fill="#d6dccf" />
      <text x={lcd.x + lcd.w / 2} y={y + 2.4 * s} textAnchor="middle" fontSize={6.6 * s} fontFamily="ui-monospace, Consolas, monospace" fontWeight={700} fill="#24262a">0000</text>
    </g>
  );
}

/**
 * Size of the parachute folded and rolled into the body: a roll a bit narrower than the tube, as long as its
 * canopy area needs (plastic folded loosely takes about 0.12 mm of thickness per layer).
 */
function packedChute(d: Design) {
  const inner = d.body.diameter - 1.5;
  const diameter = Math.min(inner * 0.82, 30);
  const volume = chuteProperties(d).area * 1e6 * 0.12; // mm³
  const length = Math.min(Math.max(volume / (Math.PI * (diameter / 2) ** 2), 18), 160);
  return { length, diameter };
}

/** The Estes printed parachute folded into a roll: orange and white checks, with its shroud lines wrapped around it. */
function PackedChute({ x, y, scale: s, length, diameter }: { x: number; y: number; scale: number; length: number; diameter: number }) {
  const w = length * s, h = diameter * s;
  const left = x - w / 2, top = y - h / 2;
  const cell = Math.max(h / 3.2, 4);
  const wraps = Math.max(Math.round(length / 22), 2);
  return (
    <g aria-label="Paracaídas doblado">
      <defs>
        <pattern id="chute-checks" width={cell * 2} height={cell * 2} patternUnits="userSpaceOnUse" patternTransform={`translate(${left} ${top}) skewX(-28)`}>
          <rect width={cell * 2} height={cell * 2} fill="#ffffff" />
          <rect width={cell} height={cell} fill="#ec6b16" />
          <rect x={cell} y={cell} width={cell} height={cell} fill="#ec6b16" />
        </pattern>
        <linearGradient id="chute-shade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.45} />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="0.75" stopColor="#000000" stopOpacity={0.12} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.32} />
        </linearGradient>
      </defs>
      {/* The roll */}
      <rect x={left} y={top} width={w} height={h} rx={h * 0.32} fill="url(#chute-checks)" stroke="#b4500f" strokeWidth={1} />
      <rect x={left} y={top} width={w} height={h} rx={h * 0.32} fill="url(#chute-shade)" />
      {/* Folds of the plastic */}
      <g stroke="#b4500f" strokeWidth={0.8} opacity={0.55} fill="none">
        <path d={`M${left + w * 0.18},${top + 1} q${h * 0.12},${h / 2} 0,${h - 2}`} />
        <path d={`M${left + w * 0.82},${top + 1} q${-h * 0.12},${h / 2} 0,${h - 2}`} />
      </g>
      {/* Shroud lines wrapped around the roll */}
      <g stroke="#f7f7f7" strokeWidth={1.4} opacity={0.95}>
        {Array.from({ length: wraps }, (_, i) => {
          const cx = left + (w * (i + 1)) / (wraps + 1);
          return <line key={i} x1={cx - h * 0.18} y1={top + 0.5} x2={cx + h * 0.18} y2={top + h - 0.5} />;
        })}
      </g>
      <g stroke="#5b6270" strokeWidth={0.6} opacity={0.6}>
        {Array.from({ length: wraps }, (_, i) => {
          const cx = left + (w * (i + 1)) / (wraps + 1);
          return <line key={i} x1={cx - h * 0.18 + 1.2} y1={top + 0.5} x2={cx + h * 0.18 + 1.2} y2={top + h - 0.5} />;
        })}
      </g>
    </g>
  );
}

/** The Estes motor as it looks: a kraft paper casing with green print, the clay cap forward and the clay nozzle aft. */
function MotorCasing({ x, y, width: w, height: h, name }: { x: number; y: number; width: number; height: number; name: string }) {
  const top = y - h / 2;
  const cap = Math.max(h * 0.16, 2);
  return (
    <g aria-label={`Motor ${name}`}>
      <defs>
        <linearGradient id="kraft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b88f62" />
          <stop offset="0.3" stopColor="#d9b88d" />
          <stop offset="0.55" stopColor="#c9a173" />
          <stop offset="1" stopColor="#8f6a43" />
        </linearGradient>
      </defs>
      <rect x={x} y={top} width={w} height={h} rx={1.5} fill="url(#kraft)" stroke="#6e5034" strokeWidth={0.8} />
      {/* Clay cap (forward) and nozzle (aft) */}
      <rect x={x} y={top} width={cap} height={h} fill="#e9e4da" stroke="#6e5034" strokeWidth={0.6} />
      <rect x={x + w - cap} y={top} width={cap} height={h} fill="#d8d2c6" stroke="#6e5034" strokeWidth={0.6} />
      <rect x={x + w - cap} y={y - h * 0.14} width={cap} height={h * 0.28} fill="#4a3a2c" />
      {/* Green print */}
      <text x={x + w * 0.46} y={y + h * 0.1} textAnchor="middle" fontSize={h * 0.36} fontWeight={800} fill="#2f8f3a">{name}</text>
      <text x={x + w * 0.46} y={y + h * 0.36} textAnchor="middle" fontSize={h * 0.15} fontWeight={700} fill="#2f8f3a" opacity={0.85}>MODEL ROCKET ENGINE</text>
    </g>
  );
}

/** Each extra mass drawn as it looks: wadding paper, a lump of clay, glue, tape around the body, or a generic mass. */
function ExtraShape({ name, mass, x, y, scale: s, inner, outer }: { name: string; mass: number; x: number; y: number; scale: number; inner: number; outer: number }) {
  const r = inner * s; // inner radius in px
  switch (name) {
    case "Papel retardante": {
      // A crumpled wad of recovery paper filling the tube, about 25 mm long.
      const w = 25 * s, h = r * 1.8;
      const pts = [[-0.5, -0.3], [-0.38, -0.5], [-0.1, -0.42], [0.12, -0.5], [0.4, -0.44], [0.5, -0.15], [0.44, 0.2], [0.5, 0.42], [0.2, 0.5], [-0.05, 0.4], [-0.3, 0.5], [-0.5, 0.3], [-0.44, 0]];
      const poly = pts.map(([px, py]) => `${(x + px * w).toFixed(1)},${(y + py * h).toFixed(1)}`).join(" ");
      return (
        <g>
          <polygon points={poly} fill="#f6d3d9" stroke="#c98a95" strokeWidth={1} strokeLinejoin="round" />
          <g stroke="#c98a95" strokeWidth={0.8} fill="none" opacity={0.8}>
            <path d={`M${x - w * 0.3},${y - h * 0.3} l${w * 0.18},${h * 0.25} l${w * 0.12},${-h * 0.15} l${w * 0.2},${h * 0.3}`} />
            <path d={`M${x - w * 0.35},${y + h * 0.2} l${w * 0.2},${-h * 0.12} l${w * 0.15},${h * 0.2} l${w * 0.25},${-h * 0.1}`} />
          </g>
        </g>
      );
    }
    case "Plastilina": {
      // A lump of modelling clay (about 1.7 g/cm³), sized by its mass.
      const rad = Math.min(Math.cbrt(((mass / 1.7) * 1000 * 3) / (4 * Math.PI)), inner) * s;
      return (
        <g>
          <path
            d={`M${x - rad},${y} C${x - rad},${y - rad * 1.1} ${x + rad * 0.9},${y - rad * 1.05} ${x + rad},${y - rad * 0.1} C${x + rad * 1.05},${y + rad} ${x - rad * 0.8},${y + rad * 1.1} ${x - rad},${y} Z`}
            fill="#3f9b4b"
            stroke="#24622d"
            strokeWidth={1}
          />
          <ellipse cx={x - rad * 0.35} cy={y - rad * 0.4} rx={rad * 0.3} ry={rad * 0.16} fill="#ffffff" opacity={0.35} />
        </g>
      );
    }
    case "Pegamento":
      // A ring of glue on the inside wall, 4 mm wide, with a drip.
      return (
        <g>
          <rect x={x - 2 * s} y={y - outer * s} width={4 * s} height={outer * 2 * s} rx={1.5 * s} fill="#f2d16b" opacity={0.75} stroke="#c9a227" strokeWidth={0.8} />
          <path d={`M${x},${y + outer * s - 1} q${2 * s},${4 * s} 0,${6 * s} q${-2 * s},${-2 * s} 0,${-6 * s} Z`} fill="#f2d16b" stroke="#c9a227" strokeWidth={0.8} />
        </g>
      );
    case "Cinta":
      // A band of tape around the outside of the body, 18 mm wide.
      return (
        <g>
          <rect x={x - 9 * s} y={y - outer * s - 1.5} width={18 * s} height={outer * 2 * s + 3} fill="#9fb3c8" opacity={0.6} stroke="#5b7a99" strokeWidth={0.8} />
          <line x1={x - 9 * s} x2={x + 9 * s} y1={y - outer * s * 0.3} y2={y - outer * s * 0.3} stroke="#ffffff" strokeWidth={1.5} opacity={0.5} />
        </g>
      );
    default:
      // Masa X (or anything else): a small dark block marked with an X.
      return (
        <g>
          <rect x={x - 6 * s} y={y - 6 * s} width={12 * s} height={12 * s} rx={1.5 * s} fill="#4a4f59" stroke="#1a1a1a" strokeWidth={1} />
          <text x={x} y={y + 3.5 * s} textAnchor="middle" fontSize={10 * s} fontWeight={800} fill="#fff">X</text>
        </g>
      );
  }
}
