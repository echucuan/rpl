import { useEffect, useRef, useState, type ReactNode } from "react";
import { SheepLayer, useFallingSheep } from "./FallingSheep";

const ROCKET_ICON = `${import.meta.env.BASE_URL}rocket-tec/cohete-isotipo.png`;
// Icon: 160 × 265 px, nose tip at y = 12, end of the fins at y = 192. One caliber (body diameter) is about 46 px.
const ICON = { w: 160, h: 265, cx: 80, cg: 100, cal: 46 };
const SCALE = 0.82;
// Panel: the centre of gravity stays at the middle of the panel and the rocket turns around it.
const P = { w: 240, h: 300, x: 120, y: 150 };

/** One case: the stability margin in calibers (positive: CP behind the CM). */
interface Case {
  margin: number;
  damping: number;
  title: string;
  verdict: string;
  tone: "bad" | "warn" | "good";
  /** The student's own rocket (drawn with a badge). */
  mine?: boolean;
}

const cal = (m: number) => Math.abs(m).toFixed(2);

/** The fourth case: the rocket the student is building, with its own stability margin. */
function myCase(m: number): Case {
  const base = { margin: m, mine: true };
  if (m < -0.1) return { ...base, damping: 0.25, tone: "bad", title: `Tu cohete: CP ${cal(m)} cal delante del CM`,
    verdict: "Tu cohete es inestable: con una ráfaga se voltea. Mueve el CM hacia la ojiva (más peso adelante) o agranda las aletas." };
  if (m <= 0.1) return { ...base, damping: 2.5, tone: "warn", title: "Tu cohete: CP casi en el CM",
    verdict: "Tu cohete es neutro: el aire casi no lo endereza y vuela chueco. Necesita el CP más atrás: aletas más grandes o más peso en la ojiva." };
  if (m < 1) return { ...base, damping: 0.35, tone: "warn", title: `Tu cohete: CP ${cal(m)} cal detrás del CM`,
    verdict: "Tu cohete es estable, pero justo: se endereza despacio y una ráfaga lo hace cabecear mucho. Lo recomendado es de 1 a 2 calibres." };
  if (m <= 2) return { ...base, damping: 0.35, tone: "good", title: `Tu cohete: CP ${cal(m)} cal detrás del CM`,
    verdict: "Tu cohete es estable: con una ráfaga gira la ojiva hacia el viento y regresa a la vertical." };
  return { ...base, damping: 0.35, tone: "good", title: `Tu cohete: CP ${cal(m)} cal detrás del CM`,
    verdict: "Tu cohete es muy estable (sobreestable): se endereza rápido, pero apunta mucho hacia el viento y con viento fuerte se desvía de la vertical." };
}

const CASES: Case[] = [
  {
    margin: -1, damping: 0.25, tone: "bad",
    title: "CP delante del CM",
    verdict: "Inestable: el aire empuja la ojiva hacia donde sopla el viento y la torca lo voltea. Da vueltas sin control.",
  },
  {
    margin: 0, damping: 2.5, tone: "warn",
    title: "CP y CM en el mismo punto",
    verdict: "Neutro: el aire empuja justo en el CM, así que no hay torca que lo corrija. El golpe del viento lo deja inclinado y vuela chueco.",
  },
  {
    margin: 2, damping: 0.35, tone: "good",
    title: "CP 2 calibres detrás del CM",
    verdict: "Estable: el aire empuja la cola y la ojiva gira hacia el viento, como una veleta. Cuando el viento para, regresa a la vertical.",
  },
];

const K = 14; // restoring strength per caliber (1/s²)
const V_ROCKET = 20; // m/s: speed of the rocket through the air, to turn the wind into an angle
export const WIND_MAX = 10; // m/s at the ends of the slider
const KICK = 0.08; // rad/s per m/s of sudden change: the hit of the wind leans the nose downwind
const DT = 1 / 240;

/** Direction of the air the rocket meets (rad, the nose angle that faces it). Wind > 0 blows to the right. */
const airAngle = (wind: number) => -Math.atan(wind / V_ROCKET);

/** One step of θ'' = −K·margen·sin(θ − β) − c·θ' for every case (θ clockwise = nose to the right). */
function step(cases: Case[], th: number[], om: number[], wind: number, dt: number) {
  const air = airAngle(wind);
  for (let s = 0; s < dt; s += DT) {
    cases.forEach((c, i) => {
      const a = -K * c.margin * Math.sin(th[i] - air) - c.damping * om[i];
      om[i] += a * DT;
      th[i] += om[i] * DT;
    });
  }
}

const N_COLOR = "#c0262d"; // air force at the CP
const W_COLOR = "#111111"; // weight at the CM
const TAU_COLOR = "#0751b5"; // torque about the CM

const deg = (rad: number) => (rad * 180) / Math.PI;

function Panel({ c, theta, wind, clock, onExpand }: { c: Case; theta: number; wind: number; clock: number; onExpand?: () => void }) {
  const cpOffset = Math.max(-2.2, Math.min(3, c.margin)) * ICON.cal * SCALE; // px behind the CM along the body
  // Unit vectors in the panel (y points down): u along the body towards the nose, n perpendicular to its right.
  const u = { x: Math.sin(theta), y: -Math.cos(theta) };
  const nrm = { x: Math.cos(theta), y: Math.sin(theta) };
  const cp = { x: P.x - u.x * cpOffset, y: P.y - u.y * cpOffset };
  // Side force of the air at the CP: grows with the angle between the body and the air it meets (angle of attack).
  const air = airAngle(wind);
  const s = Math.sin(theta - air);
  const len = Math.min(70, Math.abs(s) * 110);
  const dir = Math.sign(s);
  const F = { x: nrm.x * len * dir, y: nrm.y * len * dir };
  const tip = { x: cp.x + F.x, y: cp.y + F.y };
  // N at the CP makes a torque about the CM: τ = r × N (r from the CM to the CP). In the panel y points down,
  // so τ > 0 turns the rocket clockwise.
  const tau = (cp.x - P.x) * F.y - (cp.y - P.y) * F.x;
  const TAU_MAX = 75 * 70;
  const showTau = Math.abs(tau) > 120;
  const sweep = Math.min(230, 40 + (Math.abs(tau) / TAU_MAX) * 200);
  const R_ARC = 30;
  const a0 = -90 - (Math.sign(tau) * sweep) / 2; // centred on the top of the CM
  const a1 = a0 + Math.sign(tau) * sweep;
  const pt = (a: number) => ({ x: P.x + R_ARC * Math.cos((a * Math.PI) / 180), y: P.y + R_ARC * Math.sin((a * Math.PI) / 180) });
  const arcStart = pt(a0);
  const arcEnd = pt(a1);
  const arc = `M${arcStart.x},${arcStart.y} A${R_ARC},${R_ARC} 0 ${sweep > 180 ? 1 : 0},${tau > 0 ? 1 : 0} ${arcEnd.x},${arcEnd.y}`;
  // The τ label sits just outside the arrow head.
  const tauLabel = { x: P.x + (R_ARC + 14) * Math.cos((a1 * Math.PI) / 180), y: P.y + (R_ARC + 14) * Math.sin((a1 * Math.PI) / 180) };
  const gust = Math.abs(wind) >= 0.5;
  const b = Math.sign(wind);
  const strength = Math.abs(wind) / WIND_MAX;
  const streak = (clock * 140) % 60;

  return (
    <figure className={`stab-panel ${c.tone}${c.mine ? " mine" : ""}`}>
      <svg viewBox={`0 0 ${P.w} ${P.h}`} role="img" aria-label={`${c.title}. ${c.verdict}`}>
        <defs>
          <marker id="stab-arrow-tau" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={TAU_COLOR} />
          </marker>
          <marker id="stab-arrow-n" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.5" markerHeight="3.5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={N_COLOR} />
          </marker>
          <marker id="stab-arrow-w" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.5" markerHeight="3.5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill={W_COLOR} />
          </marker>
          <marker id="stab-arrow-gust" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" fill="#3a86ff" />
          </marker>
        </defs>
        {/* Air streaks moving down: the rocket flies up through the air. */}
        {/* While the gust blows the air the rocket meets comes at an angle, so the streaks lean. */}
        <g transform={`rotate(${deg(air)} ${P.x} ${P.y})`}>
          {[-50, -5, 30, 75, 165, 210, 245, 290].map((x, i) =>
            [-1, 0, 1, 2, 3, 4, 5, 6].map((k) => (
              <line key={`${i}-${k}`} x1={x} x2={x} y1={k * 60 + streak - 60 + i * 13} y2={k * 60 + streak - 42 + i * 13} className="stab-streak" />
            )),
          )}
        </g>
        {gust && (
          // Wind arrows coming in from the side the gust blows from.
          <g className="stab-gust" opacity={0.35 + 0.65 * strength} transform={b < 0 ? `translate(${P.w} 0) scale(-1 1)` : undefined}>
            {[70, 150, 230].map((y, i) => (
              <path key={y} d={`M${4 + i * 6},${y} C${24 + i * 6},${y - 10} ${36 + i * 6},${y + 10} ${58 + i * 6},${y}`} fill="none" stroke="#3a86ff" strokeWidth="3.5" markerEnd="url(#stab-arrow-gust)" />
            ))}
          </g>
        )}
        {gust && (
          <text x={P.x} y="22" textAnchor="middle" className="stab-gust-label">{b > 0 ? `viento ${Math.abs(wind).toFixed(0)} m/s →` : `← viento ${Math.abs(wind).toFixed(0)} m/s`}</text>
        )}
        <g transform={`rotate(${deg(theta)} ${P.x} ${P.y})`}>
          <image className="stab-rocket" href={ROCKET_ICON} width={ICON.w} height={ICON.h}
            transform={`translate(${P.x - ICON.cx * SCALE} ${P.y - ICON.cg * SCALE}) scale(${SCALE})`} />
          {/* Centre of mass: the classic black and white quartered circle. */}
          <g className="stab-cg">
            <circle cx={P.x} cy={P.y} r="7" fill="#fff" stroke="#111" strokeWidth="1.5" />
            <path d={`M${P.x},${P.y} L${P.x + 7},${P.y} A7,7 0 0,0 ${P.x},${P.y - 7} z M${P.x},${P.y} L${P.x - 7},${P.y} A7,7 0 0,0 ${P.x},${P.y + 7} z`} fill="#111" />
          </g>
          <g className="stab-cp">
            <circle cx={P.x} cy={P.y + cpOffset} r={c.margin === 0 ? 11 : 7} fill="none" stroke="#c0262d" strokeWidth="2.5" />
            <circle cx={P.x} cy={P.y + cpOffset} r="2.5" fill="#c0262d" />
          </g>
          <text x={P.x - 12} y={P.y + 22} textAnchor="end" className="stab-tag">CM</text>
          <text x={P.x - 12} y={P.y + cpOffset + (c.margin === 0 ? -12 : 4)} textAnchor="end" className="stab-tag cp">CP</text>
        </g>
        {/* The weight always acts at the CM, straight down. */}
        <line x1={P.x} y1={P.y} x2={P.x} y2={P.y + 58} className="stab-w" markerEnd="url(#stab-arrow-w)" />
        <text x={P.x + 8} y={P.y + 62} className="stab-tag w">W</text>
        {len > 4 && (
          <g className="stab-forces">
            {/* N at the CP: where the air really pushes. */}
            <line x1={cp.x} y1={cp.y} x2={tip.x} y2={tip.y} className="stab-n" markerEnd="url(#stab-arrow-n)" />
            <text x={tip.x + Math.sign(F.x || 1) * 6} y={tip.y + 4} textAnchor={F.x >= 0 ? "start" : "end"} className="stab-tag n">N</text>
            {showTau && (
              <>
                <path d={arc} fill="none" stroke={TAU_COLOR} strokeWidth="2" strokeLinecap="round" markerEnd="url(#stab-arrow-tau)" />
                <text x={tauLabel.x} y={tauLabel.y + 5} textAnchor="middle" className="stab-tag tau">τ</text>
              </>
            )}
          </g>
        )}
        {len > 4 && !showTau && (
          <text x={P.x} y={P.y - 40} textAnchor="middle" className="stab-tag tau">τ = 0</text>
        )}
      </svg>
      <figcaption>
        {c.mine && <span className="stab-mine-badge">🚀 Tu cohete</span>}
        <b>{c.title}</b>
        <span>{c.verdict}</span>
      </figcaption>
      {onExpand && (
        <button type="button" className="stab-expand no-print" onClick={onExpand} title="Ver en pantalla completa" aria-label={`Ver en pantalla completa: ${c.title}`}>⤢</button>
      )}
    </figure>
  );
}

/** The same Rocket Tec rocket with three stability margins; the slider blows wind from either side. */
export function StabilityAnimation({ title, intro, margin }: { title?: string; intro?: ReactNode;
  /** Stability margin (calibers) of the student's rocket: adds a fourth panel with it. */
  margin?: number }) {
  const cases = margin === undefined ? CASES : [...CASES, myCase(margin)];
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [playing, setPlaying] = useState(!reduced);
  const [wind, setWind] = useState(0);
  const windRef = useRef(0);
  const sim = useRef({ th: cases.map(() => 0), om: cases.map(() => 0), clock: 0 });
  // The loop reads the cases through a ref, so a change of the design reaches it without restarting.
  const casesRef = useRef(cases);
  casesRef.current = cases;
  if (sim.current.th.length !== cases.length) {
    sim.current.th = cases.map((_, i) => sim.current.th[i] ?? 0);
    sim.current.om = cases.map((_, i) => sim.current.om[i] ?? 0);
  }
  const [, redraw] = useState(0);
  const last = useRef<number | null>(null);
  // Now and then a scared sheep tumbles past, bleating.
  const card = useRef<HTMLDivElement>(null);
  const { sheep, sound, setSound } = useFallingSheep(playing, card);

  useEffect(() => {
    if (!playing) { last.current = null; return; }
    let id = 0;
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : Math.min(0.05, (now - last.current) / 1000);
      last.current = now;
      const s = sim.current;
      step(casesRef.current, s.th, s.om, windRef.current, dt);
      s.clock += dt;
      redraw((n) => n + 1);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [playing]);

  const changeWind = (w: number) => {
    // A gust that gets stronger hits the rocket and leans its nose downwind (when it dies down there is no hit).
    if (Math.abs(w) > Math.abs(windRef.current)) sim.current.om = sim.current.om.map((o) => o + KICK * (w - windRef.current));
    windRef.current = w;
    setWind(w);
    if (!playing) redraw((n) => n + 1);
  };
  // Letting go of the slider ends the gust: it springs back to the centre in a quarter of a second.
  const springBack = useRef(0);
  const release = () => {
    cancelAnimationFrame(springBack.current);
    const from = windRef.current;
    if (from === 0) return;
    const t0 = performance.now();
    const ease = (now: number) => {
      const k = Math.min(1, (now - t0) / 250);
      changeWind(k >= 1 ? 0 : from * (1 - k) * (1 - k));
      if (k < 1) springBack.current = requestAnimationFrame(ease);
    };
    springBack.current = requestAnimationFrame(ease);
  };
  useEffect(() => () => cancelAnimationFrame(springBack.current), []);
  const reset = () => {
    sim.current = { th: cases.map(() => 0), om: cases.map(() => 0), clock: 0 };
    windRef.current = 0;
    setWind(0);
    setPlaying(true);
  };

  // Full screen view of one case (null: closed). Esc closes it and the arrows switch between cases.
  const [full, setFull] = useState<number | null>(null);
  useEffect(() => {
    if (full === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(null);
      else if (e.key === "ArrowRight" && !(e.target instanceof HTMLInputElement)) setFull((i) => (i === null ? i : (i + 1) % cases.length));
      else if (e.key === "ArrowLeft" && !(e.target instanceof HTMLInputElement)) setFull((i) => (i === null ? i : (i + cases.length - 1) % cases.length));
    };
    addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [full]);

  const s = sim.current;
  const from = wind > 0 ? "hacia la derecha" : wind < 0 ? "hacia la izquierda" : "sin viento";
  const slider = (
    <>
      <div className="stab-wind no-print">
        <span className="stab-wind-end">⬅ sopla a la izquierda</span>
        <input type="range" min={-WIND_MAX} max={WIND_MAX} step={0.5} value={wind}
          onPointerDown={() => cancelAnimationFrame(springBack.current)}
          onChange={(e) => changeWind(Number(e.target.value))}
          onPointerUp={release} onPointerCancel={release} onKeyUp={release} onBlur={release}
          aria-label="Viento lateral en metros por segundo" aria-valuetext={`${Math.abs(wind)} m/s ${from}`} />
        <span className="stab-wind-end">sopla a la derecha ➡</span>
        <output className="stab-wind-value">{wind === 0 ? "Sin viento" : `${Math.abs(wind).toFixed(1)} m/s ${from}`}</output>
      </div>
    </>
  );
  const legend = (
    <>
      <ul className="stab-legend">
        <li><svg width="34" height="10" aria-hidden="true"><line x1="2" y1="5" x2="29" y2="5" stroke={W_COLOR} strokeWidth="2" strokeLinecap="round" /><path d="M28.5,2.5 L33,5 L28.5,7.5 z" fill={W_COLOR} /></svg><span><b>W en el CM</b>: el peso del cohete</span></li>
        <li><svg width="34" height="10" aria-hidden="true"><line x1="2" y1="5" x2="29" y2="5" stroke={N_COLOR} strokeWidth="2" strokeLinecap="round" /><path d="M28.5,2.5 L33,5 L28.5,7.5 z" fill={N_COLOR} /></svg><span><b>N en el CP</b>: la fuerza del aire cuando el cohete va inclinado</span></li>
        <li><svg width="22" height="18" aria-hidden="true"><path d="M3,14 A8,8 0 1,1 17,12" fill="none" stroke={TAU_COLOR} strokeWidth="1.5" /><path d="M15.5,11 L18.5,13.5 L19,10 z" fill={TAU_COLOR} /></svg><span><b>τ = N·d</b>: la torca que N hace alrededor del CM (d es la distancia del CM al CP)</span></li>
      </ul>
    </>
  );
  const controls = (
    <>
      <div className="stab-controls no-print">
        <button type="button" className="btn small" onClick={() => setPlaying((p) => !p)}>{playing ? "⏸ Pausa" : "▶ Reproducir"}</button>
        <button type="button" className="btn small" onClick={reset}>↺ Enderezar los cohetes</button>
        <button type="button" className="btn small stab-sound" onClick={() => setSound(!sound)} aria-pressed={sound} title="Sonido de los borregos">{sound ? "🔊" : "🔇"} 🐏</button>
      </div>
    </>
  );

  return (
    <div className="card stab-anim" ref={card}>
      {title && <h2 className="stab-title">{title}</h2>}
      {intro && <p className="stab-intro">{intro}</p>}
      <h3>¿Qué pasa cuando sopla viento de lado?</h3>
      <p className="hint">
        Es el mismo cohete en los tres casos; solo cambia dónde queda el <b>centro de presión</b> (CP, donde empuja el aire) respecto al{" "}
        <b>centro de masa</b> (CM, el punto alrededor del cual gira). Las flechas son las fuerzas que siente el cohete.
        Arrastra la barra hacia un lado para soplar una ráfaga; al soltarla, el viento se detiene.
      </p>
      {slider}
      <div className="stab-panels">
        <SheepLayer sheep={full === null ? sheep : []} />
        {cases.map((c, i) => <Panel key={c.title} c={c} theta={s.th[i]} wind={wind} clock={s.clock} onExpand={() => setFull(i)} />)}
      </div>
      {legend}
      {controls}
      {full !== null && (
        <div className="stab-full" role="dialog" aria-modal="true" aria-label={`Pantalla completa: ${cases[full].title}`} onClick={(e) => e.target === e.currentTarget && setFull(null)}>
          <div className="stab-full-box">
            <div className="stab-full-head">
              <button type="button" className="btn small" onClick={() => setFull((full + cases.length - 1) % cases.length)} aria-label="Caso anterior">‹</button>
              <strong>{cases[full].title}</strong>
              <button type="button" className="btn small" onClick={() => setFull((full + 1) % cases.length)} aria-label="Caso siguiente">›</button>
              <button type="button" className="btn small stab-full-close" onClick={() => setFull(null)} aria-label="Cerrar pantalla completa">✕ Cerrar</button>
            </div>
            {slider}
            <div className="stab-full-stage">
              <Panel c={cases[full]} theta={s.th[full]} wind={wind} clock={s.clock} />
              <SheepLayer sheep={sheep} />
            </div>
            {legend}
            {controls}
          </div>
        </div>
      )}
    </div>
  );
}
