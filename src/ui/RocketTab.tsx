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
                  <p className="hint">{format(r.liftoffMass, 1)} g al despegar</p>
                </div>
              </div>
              <RocketView design={shown} loaded={r.stabilityLoaded} empty={r.stabilityEmpty} />
            </div>

            <div className="card">
              <div className="card-head"><h2>¿Dónde está la masa?</h2></div>
              <MassBudget items={r.massItems} />
            </div>

            <div className="card">
              <div className="card-head">
                <h2>Vuelo en resumen</h2>
                <button type="button" className="link" onClick={() => onGo("graficas")}>Ver todas en Simulaciones</button>
              </div>
              <div className="kpis">
                <div className="kpi hero"><div className="label">{design.type === "estes" ? "Apogeo" : "Altura máxima"}</div><div className="value">{format(r.apogee.h, 1)}<small>m</small></div><div className="sub">a los {format(r.apogee.t, 1)} s</div></div>
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

/** Where each part sits in the design menus: Ojiva, Cuerpo, Porta motor, Motor, Aletas, then the Carga. */
const MENU_ORDER: [RegExp, number][] = [
  [/^Ojiva/, 0],
  [/^(Cuerpo|Piezas del cuerpo|Botella)/, 1],
  [/^Porta motor/, 2],
  [/^(Motor|Agua)/, 3],
  [/^Aletas/, 4],
  [/^Altímetro/, 5],
  [/^Paracaídas/, 6],
];
// Anything else is an extra mass: they go last, in the order of their list (the sort is stable).
const menuRank = (name: string) => MENU_ORDER.find(([re]) => re.test(name))?.[1] ?? 7;

const PALETTE = ["#0039a6", "#e0701b", "#1d7a3e", "#7a4fb0", "#b3261e", "#0f8a9d", "#a35f2a", "#5b6270", "#c9a227"];

function MassBudget({ items }: { items: MassItem[] }) {
  const total = items.reduce((s, i) => s + i.mass, 0);
  // Same order as the design menus; parts with no mass (e.g. no fins) are left out.
  const sorted = [...items].filter((i) => i.mass > 0).sort((a, b) => menuRank(a.name) - menuRank(b.name));
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
