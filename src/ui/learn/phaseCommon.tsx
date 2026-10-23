import { useMemo, type ReactNode } from "react";
import type { Design } from "../../model";
import { air } from "../../physics/atmosphere";
import type { FlightResult, Sample } from "../../physics/simulate";
import { format } from "../fields";
import { LineChart, type Series } from "../LineChart";
import { PhaseTimeline } from "../PhaseTimeline";
import { PHASE_SOLID, flightMarkers, flightPhases, flightSpans, nearest, series, type Phase, type PhaseId } from "../phases";
import { Eq } from "./common";

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

export function PhaseHeader({ result, id, onPick, intro }: { result: FlightResult; id: PhaseId; onPick: (id: PhaseId) => void; intro: ReactNode }) {
  const ph = phaseOf(result, id);
  return (
    <div className="lesson-head card">
      <div className="method-strip" aria-label="Metodología">
        <span className="chip fisica">1 Física</span>
        <span className="arrow">→</span>
        <span className="chip matematicas">2 Matemáticas</span>
        <span className="arrow">→</span>
        <span className="chip computacion">3 Computación (MATLAB)</span>
      </div>
      <h2><span className="phase-title-num" style={{ background: PHASE_SOLID[id] }}>{id}</span> Fase {id}: {ph.name}</h2>
      <p>{intro}</p>
      <PhaseTimeline result={result} active={id} onPick={onPick} />
      {ph.note && <div className={`alert ${ph.exists ? "info" : "warning"}`} style={{ marginTop: 10 }}>{ph.note}</div>}
    </div>
  );
}

/** Values at the start and end of the phase and what changed. */
export function PhaseFacts({ result, id }: { result: FlightResult; id: PhaseId }) {
  const ph = phaseOf(result, id);
  if (!ph.exists) return null;
  const a = nearest(result.samples, ph.from), b = nearest(result.samples, ph.to);
  const dt = b.t - a.t, dv = b.v - a.v, dh = b.h - a.h;
  return (
    <div className="card">
      <h2>¿Qué cambió en esta fase?</h2>
      <div className="facts">
        <table className="summary">
          <thead><tr><th /><th className="num">t (s)</th><th className="num">h (m)</th><th className="num">v (m/s)</th><th className="num">a (m/s²)</th><th className="num">m (g)</th></tr></thead>
          <tbody>
            <tr><td>Inicio</td><td className="num">{format(a.t, 3)}</td><td className="num">{format(a.h, 1)}</td><td className="num">{format(a.v, 2)}</td><td className="num">{format(a.a, 1)}</td><td className="num">{format(a.mass * 1000, 1)}</td></tr>
            <tr><td>Fin</td><td className="num">{format(b.t, 3)}</td><td className="num">{format(b.h, 1)}</td><td className="num">{format(b.v, 2)}</td><td className="num">{format(b.a, 1)}</td><td className="num">{format(b.mass * 1000, 1)}</td></tr>
          </tbody>
        </table>
        <div className="fact-eqs">
          <Eq block tex={String.raw`\Delta t = ${dt.toFixed(3)}\ \text{s} \qquad \Delta v = ${dv >= 0 ? "+" : ""}${dv.toFixed(2)}\ \text{m/s} \qquad \Delta h = ${dh >= 0 ? "+" : ""}${dh.toFixed(1)}\ \text{m}`} />
          <Eq block tex={String.raw`\bar a = \frac{\Delta v}{\Delta t} = ${(dt > 0 ? dv / dt : 0).toFixed(2)}\ \text{m/s}^2 \quad \Rightarrow \quad \text{la velocidad ${dv >= 0 ? "aumenta" : "disminuye"}}`} />
        </div>
      </div>
    </div>
  );
}

/** a(t), v(t) and h(t) zoomed to the phase, with the rest of the flight for context. */
export function PhaseCharts({ result, id, extra }: { result: FlightResult; id: PhaseId; extra?: { title: string; yLabel: string; series: Series[] } }) {
  const ph = phaseOf(result, id);
  const pad = Math.max((ph.to - ph.from) * 0.15, 0.02);
  const xMin = Math.max(ph.from - pad, 0), xMax = ph.to + pad;
  const shown = useMemo(() => result.samples.filter((s) => s.t >= xMin && s.t <= xMax), [result, xMin, xMax]);
  const spans = useMemo(() => flightSpans(result), [result]);
  const markers = useMemo(() => flightMarkers(result), [result]);
  if (!ph.exists) return null;
  const color = PHASE_SOLID[id];
  return (
    <div className="card">
      <h2>Gráficas de la fase {id}</h2>
      <div className="charts">
        <LineChart title="Aceleración a(t)" xLabel="Tiempo (s)" yLabel="Aceleración (m/s²)" series={[{ label: "a", points: series(shown, (s) => s.a), color }]} spans={spans} markers={markers} xMin={xMin} xMax={xMax} />
        <LineChart title="Velocidad v(t)" xLabel="Tiempo (s)" yLabel="Velocidad (m/s)" series={[{ label: "v", points: series(shown, (s) => s.v), color }]} spans={spans} markers={markers} xMin={xMin} xMax={xMax} />
        <LineChart title="Altura h(t)" xLabel="Tiempo (s)" yLabel="Altura (m)" series={[{ label: "h", points: series(shown, (s) => s.h), color }]} spans={spans} markers={markers} xMin={xMin} xMax={xMax} />
        {extra && <LineChart title={extra.title} xLabel="Tiempo (s)" yLabel={extra.yLabel} series={extra.series} spans={spans} markers={markers} xMin={xMin} xMax={xMax} />}
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

export function MissingPhase({ id, children }: { id: PhaseId; children: ReactNode }) {
  return (
    <div className="card missing-phase">
      <h2>En este vuelo no hay fase {id}</h2>
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
