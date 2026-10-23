import type { Design } from "../model";
import type { FlightResult } from "../physics/simulate";
import type { MassItem } from "../physics/geometry";
import { DesignForm } from "./DesignForm";
import { RocketView } from "./RocketView";
import { format } from "./fields";
import type { SubTab } from "./Workspace";

const G0 = 9.80665;

interface Props {
  design: Design; // live, for the form
  shown: Design; // deferred, matching `result`
  result: FlightResult | string;
  onChange: (d: Design) => void;
  onGo: (s: SubTab) => void;
}

export function RocketTab({ design, shown, result, onChange, onGo }: Props) {
  const r = typeof result === "string" ? null : result;
  return (
    <div className="designer">
      <DesignForm design={design} update={(fn) => onChange(fn(design))} />
      <div className="results">
        {!r && <div className="card"><div className="alert error">{result as string}</div></div>}
        {r && (
          <>
            <div className="card rocket-card">
              <div className="card-head">
                <div>
                  <h2>{shown.name}</h2>
                  <p className="hint">{shown.type === "water" ? "Cohete de agua · botella de " + format(shown.water.bottleVolume, 1) + " L" : "Rocket Tec · motor Estes A10-3T"} · {format(r.liftoffMass, 1)} g al despegar</p>
                </div>
                <button type="button" className="btn primary" onClick={() => onGo("graficas")}>Ver gráficas del vuelo →</button>
              </div>
              <RocketView design={shown} loaded={r.stabilityLoaded} empty={r.stabilityEmpty} />
            </div>

            <div className="two-col">
              <div className="card">
                <div className="card-head">
                  <h2>Estabilidad</h2>
                  <button type="button" className="link" onClick={() => onGo("estabilidad")}>¿Cómo se calcula?</button>
                </div>
                <StabilityGauge loaded={r.stabilityLoaded.margin} empty={r.stabilityEmpty.margin} water={shown.type === "water"} />
                <p className="hint" style={{ marginTop: 8 }}>
                  El centro de presión está <b>{format((r.stabilityLoaded.cp - r.stabilityLoaded.cg) / 10, 1)} cm</b> {r.stabilityLoaded.cp >= r.stabilityLoaded.cg ? "detrás" : "delante"} del
                  centro de gravedad {shown.type === "water" ? "con el agua cargada" : "con el motor lleno"}. Para que el cohete vuele derecho, el CP debe quedar
                  detrás del CG entre 1 y 2 diámetros del cuerpo (calibres).
                </p>
              </div>
              <div className="card">
                <div className="card-head"><h2>¿Dónde está la masa?</h2></div>
                <MassBudget items={r.massItems} />
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h2>Vuelo en resumen</h2>
                <button type="button" className="link" onClick={() => onGo("graficas")}>Ver todas las gráficas</button>
              </div>
              <div className="kpis">
                <div className="kpi hero"><div className="label">Altura máxima</div><div className="value">{format(r.apogee.h, 1)}<small>m</small></div><div className="sub">a los {format(r.apogee.t, 1)} s</div></div>
                <div className="kpi"><div className="label">Velocidad máxima</div><div className="value">{format(r.maxVelocity, 1)}<small>m/s</small></div><div className="sub">{format(r.maxVelocity * 3.6, 0)} km/h</div></div>
                <div className="kpi"><div className="label">Aceleración máxima</div><div className="value">{format(r.maxAcceleration / G0, 1)}<small>g</small></div></div>
                <div className="kpi"><div className="label">Aterriza a</div><div className="value">{format(r.descentRate, 1)}<small>m/s</small></div><div className="sub">{r.landing ? `después de ${format(r.landing.t, 0)} s` : ""}</div></div>
              </div>
              {r.warnings.length > 0 && (
                <div className="alerts" style={{ marginTop: 12 }}>
                  {r.warnings.map((w, i) => <div key={i} className={`alert ${w.level}`}>{w.text}</div>)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Horizontal scale of the stability margin with the recommended zone highlighted. */
function StabilityGauge({ loaded, empty, water }: { loaded: number; empty: number; water: boolean }) {
  const min = -1, max = 4, w = 380, h = 74, pad = 16;
  const X = (v: number) => pad + ((Math.min(Math.max(v, min), max) - min) / (max - min)) * (w - 2 * pad);
  const zones = [
    { from: min, to: 1, color: "#f6c9c6", label: "Inestable" },
    { from: 1, to: 2, color: "#bfe3cb", label: "Recomendado" },
    { from: 2, to: 3, color: "#e2efd9", label: "Estable" },
    { from: 3, to: max, color: "#fde7c2", label: "Sobreestable" },
  ];
  const marker = (v: number, filled: boolean, label: string, above: boolean) => (
    <g>
      <path d={above ? `M${X(v)},34 l-7,-11 h14 Z` : `M${X(v)},46 l-7,11 h14 Z`} fill={filled ? "#1a1a1a" : "#fff"} stroke="#1a1a1a" strokeWidth={1.5} />
      <text x={X(v)} y={above ? 16 : 70} textAnchor="middle" fontSize={12} fill="#1a1a1a">{label} {format(v, 2)}</text>
    </g>
  );
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} className="gauge" role="img" aria-label={`Margen de estabilidad ${format(loaded, 2)} calibres`}>
      {zones.map((z) => (
        <g key={z.label}>
          <rect x={X(z.from)} y={34} width={X(z.to) - X(z.from)} height={12} fill={z.color} />
          <text x={(X(z.from) + X(z.to)) / 2} y={h + 14} textAnchor="middle" fontSize={11} fill="#5b6270">{z.label}</text>
        </g>
      ))}
      {[-1, 0, 1, 2, 3, 4].map((v) => <text key={v} x={X(v)} y={h + 1} textAnchor="middle" fontSize={10} fill="#5b6270">{v}</text>)}
      {marker(loaded, true, water ? "Con agua" : "Motor lleno", true)}
      {marker(empty, false, water ? "Sin agua" : "Motor quemado", false)}
    </svg>
  );
}

const PALETTE = ["#0039a6", "#e0701b", "#1d7a3e", "#7a4fb0", "#b3261e", "#0f8a9d", "#a35f2a", "#5b6270", "#c9a227"];

function MassBudget({ items }: { items: MassItem[] }) {
  const total = items.reduce((s, i) => s + i.mass, 0);
  const sorted = [...items].sort((a, b) => b.mass - a.mass);
  return (
    <div>
      <div className="mass-bar" role="img" aria-label="Distribución de la masa">
        {sorted.map((i, k) => (
          <span key={i.name + k} style={{ width: `${(i.mass / total) * 100}%`, background: PALETTE[k % PALETTE.length] }} title={`${i.name}: ${format(i.mass, 1)} g`} />
        ))}
      </div>
      <table className="summary">
        <tbody>
          {sorted.map((i, k) => (
            <tr key={i.name + k}>
              <td><span className="dot" style={{ background: PALETTE[k % PALETTE.length] }} />{i.name}</td>
              <td className="num">{format(i.mass, 1)} g</td>
              <td className="num">{format((i.mass / total) * 100, 0)} %</td>
            </tr>
          ))}
          <tr><td><b>Total</b></td><td className="num"><b>{format(total, 1)} g</b></td><td /></tr>
        </tbody>
      </table>
    </div>
  );
}
