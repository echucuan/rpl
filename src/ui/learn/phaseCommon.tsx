import { useContext, useMemo, useState, type ReactNode } from "react";
import type { Design } from "../../model";
import { air } from "../../physics/atmosphere";
import type { FlightResult, Sample } from "../../physics/simulate";
import { format } from "../fields";
import { LineChart, type Series } from "../LineChart";
import { PHASE_SOLID, QTY, flightMarkers, flightPhases, flightSpans, nearest, phaseName, phaseNum, posAxis, posSym, posTitle, series, type Phase, type PhaseId } from "../phases";
import { useStage } from "../stage";
import { Eq, LessonDialog, StageTabContext, StageTabs } from "./common";

export function phaseOf(r: FlightResult, id: PhaseId): Phase {
  return flightPhases(r).find((p) => p.id === id)!;
}

/** Average air density, drag coefficient and mass over a phase (for hand estimates). */
export function phaseAverages(d: Design, samples: Sample[]) {
  const n = Math.max(samples.length, 1);
  const rho = samples.reduce((s, x) => s + x.density, 0) / n || air(0, d.launch.altitude, d.launch.temperature).density;
  const cd = samples.reduce((s, x) => s + x.cd, 0) / n;
  const mass = samples.reduce((s, x) => s + x.mass, 0) / n;
  return { rho, cd, mass };
}

export function PhaseHeader({ result, type, id, intro }: { result: FlightResult; type: Design["type"]; id: PhaseId; onPick: (id: PhaseId) => void; intro: ReactNode }) {
  const ph = phaseOf(result, id);
  const title = <>Fase {phaseNum(type, id)}: {phaseName(type, id)}</>;
  // Rocket Tec: the phase is marked in the row of phases, and its description opens over its button there;
  // the head keeps only the section buttons (the title stays for screen readers and for the focus).
  if (type === "estes") {
    return (
      <div className="lesson-head card phase-head">
        <h2 className="visually-hidden">{title}</h2>
        <StageTabs />
      </div>
    );
  }
  return (
    <div className="lesson-head card">
      <h2><span className="phase-title-num" style={{ background: PHASE_SOLID[id] }}>{phaseNum(type, id)}</span> {title}</h2>
      <p>{intro}</p>
      {ph.note && <div className={`alert ${ph.exists ? "info" : "warning"}`} style={{ marginTop: 10 }}>{ph.note}</div>}
      <StageTabs />
    </div>
  );
}

/** What happens in a Rocket Tec phase, with this flight's numbers: the note over the phase's button. */
export function phaseIntro(d: Design, res: FlightResult, id: PhaseId): ReactNode {
  if (d.type !== "estes") return null;
  const ph = phaseOf(res, id);
  if (id === 1) {
    const vMax = res.samples.reduce((m, s) => Math.max(m, s.v), 0);
    return <>Del encendido al fin del empuje ({format(ph.to, 2)} s): la única fase en la que una fuerza empuja hacia arriba, y la velocidad <b>aumenta</b> de 0 a casi {format(vMax, 0)} m/s.</>;
  }
  if (id === 2) {
    const v0 = nearest(res.samples, ph.from).v;
    const drag = d.motor.coastDrag !== false;
    return <>Sin empuje, el cohete sube por inercia y el peso{drag ? " y el arrastre lo frenan" : " lo frena"}: la velocidad <b>disminuye</b> de {format(v0, 1)} m/s a 0 en el <b>apogeo</b>, el punto más alto.</>;
  }
  if (id === 3) {
    const delay = res.ejection && res.burnout ? res.ejection.t - res.burnout.t : null;
    return ph.exists
      ? <>Del apogeo a la eyección: el cohete <b>cae</b> sin paracaídas mientras arde la carga de retardo, hasta que la <b>carga de eyección</b> lo separa{delay !== null ? ` (${format(delay, 0)} s después del empuje)` : ""}.</>
      : <>Del apogeo a la eyección. En este vuelo la eyección ocurre antes del apogeo, así que esta fase no existe.</>;
  }
  return ph.exists && d.recovery.kind === "parachute"
    ? <>La carga de eyección saca el <b>paracaídas</b>, que frena al cohete hasta su <b>velocidad terminal</b> y lo baja con rapidez constante hasta <b>aterrizar</b> (<Eq tex="s = 0" />).</>
    : <>Del momento en que se abre el paracaídas hasta que el cohete toca el suelo.</>;
}

/** Values at the start and end of the phase and what changed. */
export function PhaseFacts({ result, id, type }: { result: FlightResult; id: PhaseId; type?: Design["type"] }) {
  // Rocket Tec writes the acceleration as dv/dt (never "a").
  const dvdt = type === "estes";
  const S = posSym(type ?? "water");
  const ph = phaseOf(result, id);
  if (!ph.exists) return null;
  const a = nearest(result.samples, ph.from), b = nearest(result.samples, ph.to);
  const dt = b.t - a.t, dv = b.v - a.v, dh = b.h - a.h;
  if (type === "estes") return <ChangeFacts a={a} b={b} />;
  return (
    <div className="card">
      <h2>¿Qué cambió en esta fase?</h2>
      <div className="facts">
        <table className="summary">
          <thead><tr><th /><th className="num">t (s)</th><th className="num">{S} (m)</th><th className="num">v (m/s)</th><th className="num">{dvdt ? "dv/dt (m/s²)" : "a (m/s²)"}</th><th className="num">m (g)</th></tr></thead>
          <tbody>
            <tr><td>Inicio</td><td className="num">{format(a.t, 3)}</td><td className="num q-s">{format(a.h, 1)}</td><td className="num q-v">{format(a.v, 2)}</td><td className="num q-a">{format(a.a, 1)}</td><td className="num">{format(a.mass * 1000, 1)}</td></tr>
            <tr><td>Fin</td><td className="num">{format(b.t, 3)}</td><td className="num q-s">{format(b.h, 1)}</td><td className="num q-v">{format(b.v, 2)}</td><td className="num q-a">{format(b.a, 1)}</td><td className="num">{format(b.mass * 1000, 1)}</td></tr>
          </tbody>
        </table>
        <div className="fact-eqs">
          <Eq block tex={String.raw`\Delta t = ${dt.toFixed(3)}\ \text{s} \qquad \Delta v = ${dv >= 0 ? "+" : ""}${dv.toFixed(2)}\ \text{m/s} \qquad \Delta ${S} = ${dh >= 0 ? "+" : ""}${dh.toFixed(1)}\ \text{m}`} />
          <Eq block tex={String.raw`${dvdt ? String.raw`\overline{dv/dt}` : String.raw`\bar a`} = \frac{\Delta v}{\Delta t} = ${(dt > 0 ? dv / dt : 0).toFixed(2)}\ \text{m/s}^2 \quad \Rightarrow \quad \text{la velocidad ${dv >= 0 ? "aumenta" : "disminuye"}}`} />
        </div>
      </div>
    </div>
  );
}

/**
 * Rocket Tec: the study of change. The start and end of the phase in a small table, then one row of cards with
 * each change Δ (from → to) and the two rates of change Δs/Δt and Δv/Δt.
 */
function ChangeFacts({ a, b }: { a: Sample; b: Sample }) {
  const dt = b.t - a.t, ds = b.h - a.h, dv = b.v - a.v, dm = (b.mass - a.mass) * 1000;
  const sign = (x: number, d: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${format(Math.abs(x), d)}`;
  const trend = (x: number, eps: number) => (x > eps ? "up" : x < -eps ? "down" : "same");
  const word = (x: number, eps: number, up: string, down: string, same: string) => (x > eps ? up : x < -eps ? down : same);
  const changes = [
    { tex: String.raw`\Delta t`, q: "n", name: "Tiempo", value: sign(dt, 3), unit: "s", from: format(a.t, 3), to: format(b.t, 3), dir: "up", note: "dura la fase" },
    { tex: String.raw`\Delta s`, q: "s", name: "Posición", value: sign(ds, 1), unit: "m", from: format(a.h, 1), to: format(b.h, 1), dir: trend(ds, 0.05), note: word(ds, 0.05, "sube", "baja", "no se mueve") },
    { tex: String.raw`\Delta v`, q: "v", name: "Velocidad", value: sign(dv, 2), unit: "m/s", from: format(a.v, 2), to: format(b.v, 2), dir: trend(dv, 0.005), note: word(dv, 0.005, "aumenta", "disminuye", "no cambia") },
    { tex: String.raw`\Delta m`, q: "n", name: "Masa", value: sign(dm, 1), unit: "g", from: format(a.mass * 1000, 1), to: format(b.mass * 1000, 1), dir: trend(dm, 0.05), note: word(dm, 0.05, "aumenta", "disminuye", "constante") },
  ];
  const rates = dt > 0 ? [
    { tex: String.raw`\dfrac{\Delta s}{\Delta t}`, q: "v", name: "Velocidad promedio", value: format(ds / dt, 2), unit: "m/s" },
    { tex: String.raw`\dfrac{\Delta v}{\Delta t}`, q: "a", name: "Aceleración promedio", value: format(dv / dt, 2), unit: "m/s²" },
  ] : [];
  return (
    <div className="card change-facts">
      <h2>¿Qué cambió en esta fase?</h2>
      <table className="summary change-table">
        <thead><tr><th /><th className="num">t (s)</th><th className="num q-s">s (m)</th><th className="num q-v">v (m/s)</th><th className="num q-a">dv/dt (m/s²)</th><th className="num">m (g)</th></tr></thead>
        <tbody>
          <tr><td>Inicio</td><td className="num">{format(a.t, 3)}</td><td className="num q-s">{format(a.h, 1)}</td><td className="num q-v">{format(a.v, 2)}</td><td className="num q-a">{format(a.a, 1)}</td><td className="num">{format(a.mass * 1000, 1)}</td></tr>
          <tr><td>Fin</td><td className="num">{format(b.t, 3)}</td><td className="num q-s">{format(b.h, 1)}</td><td className="num q-v">{format(b.v, 2)}</td><td className="num q-a">{format(b.a, 1)}</td><td className="num">{format(b.mass * 1000, 1)}</td></tr>
        </tbody>
      </table>
      <div className="change-row" aria-label="Cambios en la fase">
        {changes.map((c) => (
          <div key={c.name} className={`change-card q-${c.q}`}>
            <div className="change-head"><Eq tex={c.tex} /><span>{c.name}</span></div>
            <div className="change-value">{c.value}<small>{c.unit}</small></div>
            <div className="change-span">{c.from} <span aria-hidden="true">→</span> {c.to}</div>
            <div className="change-note"><span className="change-arrow" aria-hidden="true">{c.dir === "up" ? "▲" : c.dir === "down" ? "▼" : "●"}</span> {c.note}</div>
          </div>
        ))}
        {rates.map((c) => (
          <div key={c.name} className={`change-card rate q-${c.q}`}>
            <div className="change-head"><Eq tex={c.tex} /><span>{c.name}</span></div>
            <div className="change-value">{c.value}<small>{c.unit}</small></div>
            <div className="change-span">razón de cambio</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** a(t), v(t) and h(t) zoomed to the phase, with the rest of the flight for context. */
export function PhaseCharts({ result, type, id, extra, merge = false, fill = false }: {
  result: FlightResult; type: Design["type"]; id: PhaseId;
  /** Extra chart; its series can be built from the samples on screen. */
  extra?: { title: string; yLabel: string; series: Series[] | ((samples: Sample[]) => Series[]) };
  /** Buttons to show this phase alone or joined with earlier ones: true joins the previous phase, a number starts at that phase. */
  merge?: boolean | PhaseId;
  /** Inside a stage: the four charts in a 2 × 2 grid that takes the height of the screen. */
  fill?: boolean;
}) {
  const ph = phaseOf(result, id);
  const prevId = (typeof merge === "number" ? merge : id - 1) as PhaseId;
  const prev = merge && prevId >= 1 && prevId < id ? phaseOf(result, prevId) : null;
  const canMerge = merge && !!prev?.exists;
  const [joined, setJoined] = useState(false);
  const pad = Math.max((ph.to - ph.from) * 0.15, 0.02);
  const [xMin, xMax] = !canMerge ? [Math.max(ph.from - pad, 0), ph.to + pad] : joined ? [prev!.from, ph.to] : [ph.from, ph.to];
  const shown = useMemo(() => result.samples.filter((s) => s.t >= xMin && s.t <= xMax), [result, xMin, xMax]);
  const spans = useMemo(() => flightSpans(result, type), [result, type]);
  const markers = useMemo(() => flightMarkers(result), [result]);
  const extraSeries = useMemo(() => (extra ? (typeof extra.series === "function" ? extra.series(shown) : extra.series) : []), [extra, shown]);
  if (!ph.exists) return null;
  // Rocket Tec: one colour per quantity; the water program keeps the colour of the phase.
  const tec = type === "estes";
  const color = PHASE_SOLID[id];
  const [ca, cv, cs] = tec ? [QTY.a, QTY.v, QTY.s] : [color, color, color];
  const n = phaseNum(type, id);
  // The joined phases, e.g. ["I", "II", "III"].
  const nums = prev ? Array.from({ length: id - prevId + 1 }, (_, i) => phaseNum(type, (prevId + i) as PhaseId)) : [n];
  const listed = nums.length > 2 ? `${nums.slice(0, -1).join(", ")} y ${nums[nums.length - 1]}` : nums.join(" y ");
  return (
    <div className={fill ? "phase-charts fill" : "card"}>
      {(!fill || canMerge) && (
        <div className="phase-charts-head">
          <h2>{canMerge && joined ? `Gráficas de las fases ${listed}` : `Gráficas de la fase ${n}`}</h2>
          {canMerge && (
            <div className="thrust-model chart-range" role="group" aria-label="Qué fases graficar">
              <button type="button" className={`btn small ${!joined ? "primary" : ""}`} aria-pressed={!joined} onClick={() => setJoined(false)}>Solo Fase {n}</button>
              <button type="button" className={`btn small ${joined ? "primary" : ""}`} aria-pressed={joined} onClick={() => setJoined(true)}>{nums.length > 2 ? `Fases ${nums.join(" + ")}` : `Fase ${nums[0]} + Fase ${nums[1]}`}</button>
            </div>
          )}
        </div>
      )}
      <div className={fill ? "charts fill" : "charts"}>
        {/* Rocket Tec follows the cause → effect order: forces, acceleration, velocity, position. */}
        {extra && type === "estes" && <LineChart title={extra.title} xLabel="Tiempo (s)" yLabel={extra.yLabel} series={extraSeries} spans={spans} markers={markers} xMin={xMin} xMax={xMax} height={fill ? "fill" : undefined} />}
        <LineChart title={type === "estes" ? "Aceleración dv/dt" : "Aceleración a(t)"} xLabel="Tiempo (s)" yLabel="Aceleración (m/s²)" series={[{ label: type === "estes" ? "dv/dt" : "a", points: series(shown, (s) => s.a), color: ca }]} spans={spans} markers={markers} xMin={xMin} xMax={xMax} yZero={canMerge} height={fill ? "fill" : undefined} />
        <LineChart title="Velocidad v(t)" xLabel="Tiempo (s)" yLabel="Velocidad (m/s)" series={[{ label: "v", points: series(shown, (s) => s.v), color: cv }]} spans={spans} markers={markers} xMin={xMin} xMax={xMax} height={fill ? "fill" : undefined} />
        <LineChart title={posTitle(type)} xLabel="Tiempo (s)" yLabel={posAxis(type)} series={[{ label: posSym(type), points: series(shown, (s) => s.h), color: cs }]} spans={spans} markers={markers} xMin={xMin} xMax={xMax} height={fill ? "fill" : undefined} />
        {extra && type !== "estes" && <LineChart title={extra.title} xLabel="Tiempo (s)" yLabel={extra.yLabel} series={extraSeries} spans={spans} markers={markers} xMin={xMin} xMax={xMax} height={fill ? "fill" : undefined} />}
      </div>
    </div>
  );
}

/** Forces T, mg and |D| over a time window. */
export function forceSeries(samples: Sample[]): Series[] {
  return [
    { label: "Empuje T", points: series(samples, (x) => x.thrust), color: "#a35f2a" },
    { label: "Peso mg", points: series(samples, (x) => x.mass * 9.80665), color: "#1a1a1a" },
    { label: "Arrastre |D|", points: series(samples, (x) => Math.abs(x.drag)), color: "#0039a6" },
  ];
}

/**
 * Rocket Tec forces with their sign (y axis up), as in the free-body diagram: T up (+), W down (−) and D against
 * the velocity. The sum of forces ΣF = m·dv/dt is the emphasised curve: it is what changes the motion.
 */
export function forceSeriesTec(samples: Sample[]): Series[] {
  return [
    { label: "ΣF (suma de fuerzas)", points: series(samples, (x) => x.mass * x.a), color: QTY.F, bold: true },
    { label: "Empuje T", points: series(samples, (x) => x.thrust), color: QTY.T, dashed: true, thin: true },
    { label: "Peso W", points: series(samples, (x) => -x.mass * 9.80665), color: QTY.W, dashed: true, thin: true },
    { label: "Arrastre D", points: series(samples, (x) => -x.drag), color: QTY.D, dashed: true, thin: true },
  ];
}

export function MissingPhase({ type, id, children }: { type: Design["type"]; id: PhaseId; children: ReactNode }) {
  return (
    <div className="card missing-phase">
      <h2>En este vuelo no hay fase {phaseNum(type, id)}</h2>
      {children}
    </div>
  );
}

/** Matrix literal for MATLAB, e.g. [0 0.012 0.03]. */
export function matlabVector(values: number[], digits = 4): string {
  const parts = values.map((v) => Number(v.toFixed(digits)).toString());
  const lines: string[] = [];
  for (let i = 0; i < parts.length; i += 10) lines.push(parts.slice(i, i + 10).join(" "));
  return `[${lines.join(" ...\n         ")}]`;
}

/** One number of the results card: the analytic value (big) and Euler's. q picks the quantity colour ("n": none). */
export interface MethodResult {
  q: "F" | "a" | "v" | "s" | "n";
  label: string;
  unit: string;
  analytic: number;
  euler: number;
  digits: number;
  /** KaTeX under the number. */
  sub: string;
  hero?: boolean;
}

/**
 * "Resultados de tu cohete", the first card of part 4 of each Rocket Tec phase: the model solved both ways, with
 * the analytic formulas of Matemáticas (big number) and with Euler using the same Δt as its MATLAB script.
 */
export function MethodResults({ cards, dt, note }: { cards: MethodResult[]; dt: number; note?: ReactNode }) {
  const diff = (num: number, ana: number) => {
    const p = ana !== 0 ? ((num - ana) / Math.abs(ana)) * 100 : 0;
    return Math.abs(p) < 0.05 ? "igual" : `${p > 0 ? "+" : ""}${format(p, 1)} %`;
  };
  return (
    <div className="card">
      <h2>Resultados de tu cohete</h2>
      <p className="hint">
        El número grande es el resultado <b>analítico</b> (las fórmulas de Matemáticas). Abajo, el <b>numérico</b>: el método de Euler con{" "}
        <Eq tex={String.raw`\Delta t = ${dt}\ \text{s}`} />, como en el script de MATLAB.
      </p>
      <div className="kpis big-results">
        {cards.map((c) => (
          <div key={c.label} className={`kpi ${c.q !== "n" ? `q-${c.q}` : ""} ${c.hero ? "hero" : ""}`}>
            <div className="label">{c.label}</div>
            <div className="value">{format(c.analytic, c.digits)}<small>{c.unit}</small></div>
            <div className="sub"><Eq tex={c.sub} /></div>
            <div className="kpi-methods">
              <span>Analítico <b>{format(c.analytic, c.digits)}</b></span>
              <span>Euler <b>{format(c.euler, c.digits)} <small>({diff(c.euler, c.analytic)})</small></b></span>
            </div>
          </div>
        ))}
      </div>
      {note && <p className="hint">{note}</p>}
    </div>
  );
}

/**
 * Parts 4 and 5 of a Rocket Tec phase, each one screen high (no scrolling): the charts of the phase, and the results
 * (the model solved both ways and what changed), with the questions to think about in a dialog.
 */
export function PhaseOutcome({ phase, charts, results, think }: { phase: string; charts: ReactNode; results: ReactNode; think: ReactNode }) {
  const tab = useContext(StageTabContext)?.stage;
  const g = useStage<HTMLElement>(tab);
  const r = useStage<HTMLElement>(tab);
  return (
    <>
      <section ref={g} className="stage stage-graficas outcome step-stage" aria-label={`Fase ${phase}: gráficas`}>
        {charts}
      </section>
      <section ref={r} className="stage stage-resultados outcome step-stage" aria-label={`Fase ${phase}: resultados`}>
        {results}
        <div className="outcome-think">
          <LessonDialog label={<>💭 Para pensar</>} title={`Fase ${phase}: para pensar`} className="btn">{think}</LessonDialog>
        </div>
      </section>
    </>
  );
}
