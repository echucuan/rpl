import { useId } from "react";
import { ALTIMETER_MM, COTTON_DENSITY, MOTOR_MOUNT, NOSE_SLEEVE, hasMotor, type Design, type MountMaterial } from "../model";
import { motorFor } from "../motor";
import { layout, noseRadius, packedChute, waterFill } from "../physics/geometry";
import type { Stability } from "../physics/geometry";
import { format } from "./fields";

/** A diameter marked on a zoomed view: where it is measured (mm from the tip) and how wide it is. */
export interface ZoomDim { x: number; diameter: number; label: string; main?: boolean }
/** A close-up of the drawing between two points (mm from the tip), with diameters marked. */
export interface RocketZoom { from: number; to: number; dims: ZoomDim[]; width?: number }

/**
 * Side view of the rocket, nose to the left, with CM and CP markers. With `zoom`, the very same drawing cropped to a
 * stretch of the rocket, without markers or legend, with the diameters marked where they are measured.
 */
export function RocketView({ design: d, loaded, empty, zoom }: { design: Design; loaded?: Stability; empty?: Stability; zoom?: RocketZoom }) {
  const l = layout(d);
  const f = d.fins;
  const hullId = useId();
  const motor = d.type === "estes" && hasMotor(d) ? motorFor(d.motor) : undefined;
  // The motor goes 33 mm into the mount; the rest sticks out behind the rocket.
  const motorFront = motor ? l.bodyEnd - MOTOR_MOUNT.motorDepth : 0;
  const r = l.refDiameter / 2;
  // Without fins their span leaves no room: the drawing hugs the body.
  const halfHeight = Math.max(r, d.body.diameter / 2 + (f.count > 0 ? f.span : 0)) + 6;
  const width = 1000;
  // Fins swept back past the tail (or forward past their root) stay in the drawing: it spans the whole outline.
  const finFrom = f.count > 0 ? Math.min(l.finLeading, l.finLeading + f.sweep) : 0;
  const finTo = f.count > 0 ? Math.max(l.finLeading + f.rootChord, l.finLeading + f.sweep + f.tipChord) : 0;
  const xMin = Math.min(0, finFrom), xMax = Math.max(l.length, finTo, motor ? motorFront + motor.length : 0);
  const scale = (width - 40) / (xMax - xMin);
  // Just the room the labels need: names above (32), the length line below (36).
  const height = Math.max(2 * halfHeight * scale + 72, 150);
  const cy = height / 2 - 4;
  const X = (x: number) => 20 + (x - xMin) * scale;
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

  const water = d.type === "water" && d.water.waterVolume > 0 ? waterFill(d, d.water.waterVolume) : null;

  // The close-up: px per drawing unit (k) once it is shown `zoom.width` px wide, and the crop around the body.
  const z = zoom && (() => {
    const shown = zoom.width ?? 330;
    const x0 = X(zoom.from), x1 = X(zoom.to);
    const k = shown / (x1 - x0);
    const top = Math.max(rb, d.type === "estes" ? MOTOR_MOUNT.railDiameter / 2 : 0) + 1;
    const y0 = Y(top) - 22 / k, y1 = Y(-top) + 6 / k;
    return { k, x0, x1, y0, y1, top, shown };
  })();
  const marks = !zoom && loaded && empty ? { loaded, empty } : null;

  return (
    <div className={zoom ? "rocket-zoom" : "rocket-view"}>
      <svg
        viewBox={z ? `${z.x0} ${z.y0} ${z.x1 - z.x0} ${z.y1 - z.y0}` : `0 0 ${width} ${height}`}
        width={z ? z.shown : undefined}
        role="img"
        aria-label={z ? `Acercamiento de ${d.name}: ${zoom!.dims.map((m) => m.label).join(", ")}` : `Vista lateral de ${d.name}`}
      >
        <defs>
          <clipPath id={hullId}><polygon points={outline} /></clipPath>
        </defs>
        {f.count > 0 && <polygon points={fin(1)} fill="#c9d6ef" stroke="#0039a6" strokeWidth={1.5} />}
        {f.count > 1 && <polygon points={fin(-1)} fill="#c9d6ef" stroke="#0039a6" strokeWidth={1.5} />}
        <polygon points={outline} fill={d.type === "water" ? "#eef6f1" : "#f3f1ec"} stroke="#1a1a1a" strokeWidth={1.5} />
        {water && (
          <rect x={X(water.surface)} y={Y(l.refDiameter)} width={X(l.length) - X(water.surface)} height={l.refDiameter * 2 * scale} fill="#7fb4e6" opacity={0.75} clipPath={`url(#${hullId})`} />
        )}
        <line x1={X(l.bodyStart)} x2={X(l.bodyStart)} y1={Y(rb)} y2={Y(-rb)} stroke="#1a1a1a" strokeWidth={1} opacity={0.4} />
        {d.type === "estes" && (
          <g aria-label="Manga de la ojiva">
            {/* The nose's sleeve inside the tube, seen through the opalina, and a vent hole on its collar */}
            <rect x={X(l.bodyStart)} y={Y(NOSE_SLEEVE.diameter / 2)} width={NOSE_SLEEVE.length * scale} height={NOSE_SLEEVE.diameter * scale} fill="#c9d6ef" opacity={0.35} stroke="#0039a6" strokeWidth={1} strokeDasharray="4 3" />
            {d.nose.length > 8 && <circle cx={X(l.bodyStart - 5)} cy={cy} r={1.5 * scale} fill="#ffffff" stroke="#5b6270" strokeWidth={1} />}
          </g>
        )}
        {l.tubeEnd < l.bodyEnd && <line x1={X(l.tubeEnd)} x2={X(l.tubeEnd)} y1={Y(rb)} y2={Y(-rb)} stroke="#1a1a1a" strokeWidth={1} opacity={0.4} />}
        {motor && (
          <MotorCasing x={X(motorFront)} y={cy} width={motor.length * scale} height={motor.diameter * scale} name={motor.name} />
        )}
        {d.type === "estes" && <MotorMount tubeEnd={X(l.tubeEnd)} aftEnd={X(l.bodyEnd)} y={cy} scale={scale} material={d.motorMount.material ?? "pla"} />}
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
        {marks && <>
        <g fontSize={16} fill="#5b6270" textAnchor="middle">
          <text x={X(d.nose.length * 0.55)} y={Y(d.nose.diameter / 2) - 8}>Ojiva</text>
          <text x={X((l.bodyStart + Math.min(l.bodyEnd, l.finLeading)) / 2)} y={Y(rb) - 8}>{d.type === "water" ? "Botella" : "Cuerpo"}</text>
          {f.count > 0 && <text x={X(le + f.sweep + f.tipChord / 2)} y={Y(rb + f.span) - 8}>Aletas</text>}
          {/* Inside the body, just over the motor casing (below the rocket it sat on a fin). */}
          {motor && <text x={X(motorFront + motor.length / 2)} y={Y(motor.diameter / 2) - 5} fontSize={14} fontWeight={700} fill="#6e5034">Motor</text>}
          {water && <text x={X((water.surface + l.length) / 2)} y={Y(-rb) + 20}>Agua</text>}
        </g>
        <Marker x={X(marks.loaded.cg)} y={cy} kind="cg" />
        {Math.abs(marks.empty.cg - marks.loaded.cg) > 1 && <Marker x={X(marks.empty.cg)} y={cy} kind="cg-empty" />}
        <Marker x={X(marks.loaded.cp)} y={cy} kind="cp" />
        {/* Names over the markers: CM in black, CP in red */}
        <text x={X(marks.loaded.cg)} y={cy - 17} textAnchor="middle" fontSize={18} fontWeight={800} fill="#1a1a1a">CM</text>
        <text x={X(marks.loaded.cp)} y={cy - 17} textAnchor="middle" fontSize={18} fontWeight={800} fill="#b3261e">CP</text>
        <line x1={X(0)} x2={X(l.length)} y1={height - 22} y2={height - 22} stroke="#5b6270" strokeWidth={1} />
        <text x={X(l.length / 2)} y={height - 2} textAnchor="middle" fontSize={20} fill="#5b6270">{format(l.length / 10, 1)} cm</text>
        </>}
        {z && zoom!.dims.map((m, i) => {
          // A dimension line across the rocket where the diameter is measured, its value over the drawing.
          const px = (v: number) => v / z.k;
          const color = m.main ? "#0039a6" : "#5b6270";
          const x = X(m.x), ya = Y(m.diameter / 2), yb = Y(-m.diameter / 2), head = px(5), labelY = Y(z.top) - px(6);
          return (
            <g key={i} stroke={color} fill={color}>
              <line x1={x} x2={x} y1={labelY + px(2)} y2={ya} strokeWidth={px(1)} strokeDasharray={`${px(2)} ${px(2)}`} opacity={0.7} />
              <line x1={x} x2={x} y1={ya + head} y2={yb - head} strokeWidth={px(m.main ? 1.8 : 1.4)} />
              <path d={`M${x} ${ya} l${-px(3.2)} ${head} h${px(6.4)} z`} stroke="none" />
              <path d={`M${x} ${yb} l${-px(3.2)} ${-head} h${px(6.4)} z`} stroke="none" />
              <line x1={x - px(5)} x2={x + px(5)} y1={ya} y2={ya} strokeWidth={px(1.2)} />
              <line x1={x - px(5)} x2={x + px(5)} y1={yb} y2={yb} strokeWidth={px(1.2)} />
              <text x={x} y={labelY} textAnchor="middle" fontSize={px(m.main ? 13 : 12)} fontWeight={700} stroke="#fff" strokeWidth={px(3)} paintOrder="stroke">{m.label}</text>
            </g>
          );
        })}
      </svg>
      {marks && <div className="legend">
        <span><Swatch kind="cg" /> Centro de masa <b>{format(marks.loaded.cg / 10, 1)} cm</b>{d.type === "water" ? " (con agua)" : " (con motor)"}</span>
        {Math.abs(marks.empty.cg - marks.loaded.cg) > 1 && <span><Swatch kind="cg-empty" /> CM {d.type === "water" ? "sin agua" : "motor quemado"} <b>{format(marks.empty.cg / 10, 1)} cm</b></span>}
        <span><Swatch kind="cp" /> Centro de presión <b>{format(marks.loaded.cp / 10, 1)} cm</b></span>
        {d.recovery.kind === "parachute" && <span><span style={{ color: "#e0701b" }}>▬</span> Paracaídas (doblado)</span>}
        {water && <span><span style={{ color: "#7fb4e6" }}>■</span> Agua</span>}
        {d.type === "estes" && (
          <span title="La única pieza que no se modifica: la imprime el laboratorio">
            <span style={{ color: (d.motorMount.material ?? "pla") === "pla" ? "#8a9098" : "#d8d2c4" }}>■</span> Porta motor {(d.motorMount.material ?? "pla") === "pla" ? "PLA" : "PLA AERO"} 🔒
          </span>
        )}
        {d.type === "estes" && d.altimeter.included && <span><span style={{ color: "#1a1a1a" }}>■</span> Altímetro</span>}
        {d.extras.length > 0 && (
          <span>
            <b className="extra-chip">M</b> Masas adicionales: {d.extras.map((e, i) => `M${i + 1} ${e.name} (${format(e.mass, 1)} g)`).join(" · ")}
          </span>
        )}
      </div>}
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


/** Cotton packed behind the altimeter: a white, fluffy filling between x0 and x1 (px), h px each side of the axis. */
function Cotton({ x0, x1, y, h }: { x0: number; x1: number; y: number; h: number }) {
  const w = x1 - x0;
  const n = Math.max(Math.round(w / (h * 0.7)), 1);
  const puffs = Array.from({ length: n * 3 }, (_, i) => {
    const col = i % n, row = Math.floor(i / n);
    return { cx: x0 + (w * (col + 0.5)) / n, cy: y + (row - 1) * h * 0.62, r: Math.min(w / n, h) * 0.55 };
  });
  return (
    <g aria-label="Algodón">
      <rect x={x0} y={y - h} width={w} height={h * 2} rx={Math.min(h, w) * 0.3} fill="#f7f9fc" stroke="#b9c2cf" strokeWidth={0.8} />
      {puffs.map((p, i) => <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill="#ffffff" stroke="#c9d1dc" strokeWidth={0.7} opacity={0.95} />)}
    </g>
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

/**
 * The printed motor mount (MOTOR_MOUNT), side view: its sleeve inside the tube (seen through it, dashed), the aft
 * part behind the tube with the two rails seen from the side (top and bottom, rounded at the front) and the one
 * facing us with its T slot for a fin. PLA is grey; PLA AERO is a matte off-white with the grain of the foamed plastic.
 */
function MotorMount({ tubeEnd, aftEnd, y, scale: s, material }: { tubeEnd: number; aftEnd: number; y: number; scale: number; material: MountMaterial }) {
  const m = MOTOR_MOUNT;
  const sleeve = (m[material].length - m.behindTube) * s;
  const r = (m.diameter / 2) * s, rs = (m.sleeveDiameter / 2) * s, rr = (m.railDiameter / 2) * s, hw = (m.railWidth / 2) * s;
  const len = aftEnd - tubeEnd;
  const fil = Math.min(2.5 * s, len / 4); // the rounded front corners
  const pla = material === "pla";
  const id = `mount-${material}`;
  const edge = pla ? "#4d5359" : "#8f877a";
  // Translucent, so the motor inside shows clearly through it.
  const see = 0.42;
  // A rail seen from the side: from the body surface (r) out to rr, rounded at its front corner.
  const sideRail = (sign: 1 | -1) =>
    `M${tubeEnd},${y - sign * r} L${tubeEnd},${y - sign * (rr - fil)} Q${tubeEnd},${y - sign * rr} ${tubeEnd + fil},${y - sign * rr} L${aftEnd},${y - sign * rr} L${aftEnd},${y - sign * r} Z`;
  // The T slot of the rail facing us: a narrow slot along it with the head of the T at the front.
  const slot = { x0: tubeEnd + 1.2 * s, head: 2.2 * s, stem: 0.7 * s, end: aftEnd - 1.2 * s };
  return (
    <g aria-label={`Porta motor ${pla ? "PLA" : "PLA AERO"}`}>
      <defs>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="0" y2="1">
          {pla ? (
            <>
              <stop offset="0" stopColor="#7d838b" />
              <stop offset="0.28" stopColor="#c3c7cc" />
              <stop offset="0.55" stopColor="#9a9fa6" />
              <stop offset="1" stopColor="#5f646b" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#cfc8b9" />
              <stop offset="0.28" stopColor="#f4f0e8" />
              <stop offset="0.55" stopColor="#e2dccf" />
              <stop offset="1" stopColor="#b5ad9d" />
            </>
          )}
        </linearGradient>
        {!pla && (
          <pattern id={`${id}-grain`} width={6} height={6} patternUnits="userSpaceOnUse">
            <circle cx={1} cy={1.5} r={0.55} fill="#8f877a" opacity={0.35} />
            <circle cx={4} cy={4.2} r={0.45} fill="#8f877a" opacity={0.3} />
            <circle cx={4.6} cy={0.8} r={0.35} fill="#ffffff" opacity={0.5} />
          </pattern>
        )}
      </defs>
      {/* Sleeve inside the tube, seen through the opalina */}
      <rect x={tubeEnd - sleeve} y={y - rs} width={sleeve} height={rs * 2} fill={pla ? "#9a9fa6" : "#e2dccf"} opacity={0.35} stroke={edge} strokeWidth={1} strokeDasharray="4 3" />
      {/* Aft part: the body of the mount */}
      <path
        d={`M${tubeEnd},${y - r + fil} Q${tubeEnd},${y - r} ${tubeEnd + fil},${y - r} L${aftEnd},${y - r} L${aftEnd},${y + r} L${tubeEnd + fil},${y + r} Q${tubeEnd},${y + r} ${tubeEnd},${y + r - fil} Z`}
        fill={`url(#${id}-shade)`}
        fillOpacity={see}
        stroke={edge}
        strokeWidth={1.2}
      />
      {/* Rails seen from the side */}
      <path d={sideRail(1)} fill={`url(#${id}-shade)`} fillOpacity={see} stroke={edge} strokeWidth={1.2} />
      <path d={sideRail(-1)} fill={`url(#${id}-shade)`} fillOpacity={see} stroke={edge} strokeWidth={1.2} />
      {/* The rail facing us, with its T slot */}
      <rect x={tubeEnd} y={y - hw} width={len} height={hw * 2} fill={pla ? "#8a9098" : "#d8d2c4"} fillOpacity={see} stroke={edge} strokeWidth={0.9} />
      <path
        d={`M${slot.x0},${y - slot.head} h${slot.head * 0.8} v${slot.head - slot.stem} H${slot.end} v${slot.stem * 2} H${slot.x0 + slot.head * 0.8} v${slot.head - slot.stem} h${-slot.head * 0.8} Z`}
        fill={pla ? "#3c4147" : "#7c7466"}
        fillOpacity={0.3}
        stroke={pla ? "#3c4147" : "#7c7466"}
        strokeWidth={0.8}
      />
      {!pla && <rect x={tubeEnd} y={y - rr} width={len} height={rr * 2} fill={`url(#${id}-grain)`} opacity={0.6} pointerEvents="none" />}
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
    case "Algodón": {
      // Loose cotton filling the tube: as long as its mass needs at COTTON_DENSITY (in the 24 mm sleeve).
      const length = Math.min(Math.max(((mass / COTTON_DENSITY) * 1000) / ((Math.PI / 4) * NOSE_SLEEVE.inner ** 2), 6), 80);
      return <Cotton x0={x - (length / 2) * s} x1={x + (length / 2) * s} y={y} h={Math.min(NOSE_SLEEVE.inner / 2, inner) * s} />;
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
