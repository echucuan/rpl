import type { Design } from "../model";
import { useMemo } from "react";
import { designStatics, type FlightResult } from "../physics/simulate";
import { layout, type MassItem } from "../physics/geometry";
import { DesignForm, type RocketPart } from "./DesignForm";
import { RocketView } from "./RocketView";
import { format } from "./fields";
import { stabilityStatus } from "./stabilityStatus";
import type { SubTab } from "./Workspace";

const G0 = 9.80665;

interface Props {
  design: Design; // live, for the form
  shown: Design; // deferred, matching `result`
  result: FlightResult | string;
  onChange: (d: Design) => void;
  onGo: (s: SubTab) => void;
  /** The Cohete step: only its sections show in the form. */
  part?: RocketPart;
}

export function RocketTab({ design, shown, result, onChange, onGo, part }: Props) {
  const r = typeof result === "string" ? null : result;
  // The drawing and the masses also show when there is no flight (e.g. a rocket without its motor).
  const statics = useMemo(() => (r ? { items: r.massItems, loaded: r.stabilityLoaded, empty: r.stabilityEmpty, mass: r.liftoffMass } : designStatics(shown)), [r, shown]);
  const s = typeof statics === "string" ? null : statics;
  return (
    <div className={`designer${part ? " stepped" : ""}`}>
      <DesignForm design={design} part={part} update={(fn) => onChange(fn(design))} />
      <div className="results">
        {!s && <div className="card"><div className="alert error">{result as string}</div></div>}
        {s && (
          <>
            <div className="card rocket-card">
              <div className="card-head">
                <div>
                  {/* The name is edited right here, on the rocket's own card. */}
                  <h2 className="name-edit">
                    <input aria-label="Nombre del cohete" title="Haz clic para cambiar el nombre" value={design.name} placeholder="Ponle nombre a tu cohete" onChange={(e) => onChange({ ...design, name: e.target.value })} />
                    <span aria-hidden="true">✎</span>
                  </h2>
                  <p className="hint">{format(s.mass, 1)} g{r ? " al despegar" : ""}</p>
                </div>
                {(() => {
                  const st = stabilityStatus(shown.type, s.loaded, s.empty);
                  return (
                    <button type="button" className={`stab-chip big ${st.level}`} onClick={() => onGo("estabilidad")} title="Ver el paso Estabilidad">
                      {st.label}<small>{st.detail}</small>
                    </button>
                  );
                })()}
              </div>
              <RocketView design={shown} loaded={s.loaded} empty={s.empty} />
            </div>

            {part ? (
              // By steps: the rocket's figures as tiles, like the flight's; the mass breakdown opens over its tile.
              <div className="card">
                <div className="card-head"><h2>Tu cohete</h2></div>
                <div className="kpis">
                  <div className="kpi hero mass-kpi" tabIndex={0} aria-describedby="mass-pop">
                    <div className="label">Masa ⓘ</div>
                    <div className="value">{format(s.mass, 1)}<small>g</small></div>
                    <div className="sub">al despegar</div>
                    <div className="card mass-pop" id="mass-pop" role="tooltip">
                      <div className="card-head"><h2>¿Dónde está la masa?</h2></div>
                      <MassBudget items={s.items} />
                    </div>
                  </div>
                  <div className="kpi"><div className="label">Largo</div><div className="value">{format(layout(shown).length / 10, 1)}<small>cm</small></div></div>
                  <div className="kpi"><div className="label">Centro de masa</div><div className="value">{format(s.loaded.cg / 10, 1)}<small>cm</small></div><div className="sub">desde la punta</div></div>
                  <div className="kpi"><div className="label">Centro de presión</div><div className="value">{format(s.loaded.cp / 10, 1)}<small>cm</small></div><div className="sub">desde la punta</div></div>
                </div>
              </div>
            ) : (
            <div className="card">
              <div className="card-head"><h2>¿Dónde está la masa?</h2></div>
              <MassBudget items={s.items} />
            </div>
            )}

            <div className="card">
              <div className="card-head">
                <h2>Vuelo en resumen</h2>
              </div>
              {!r && <div className="alert error">{result as string}</div>}
              {r && (<>
              <div className="kpis">
                <div className="kpi hero"><div className="label">{design.type === "estes" ? "Apogeo" : "Altura máxima"}</div><div className="value">{format(r.apogee.h, 1)}<small>m</small></div><div className="sub">a los {format(r.apogee.t, 1)} s</div></div>
                <div className="kpi"><div className="label">Velocidad máxima</div><div className="value">{format(r.maxVelocity, 1)}<small>m/s</small></div><div className="sub">{format(r.maxVelocity * 3.6, 0)} km/h</div></div>
                <div className="kpi"><div className="label">Aceleración máxima</div><div className="value">{format(r.maxAcceleration / G0, 1)}<small>g</small></div></div>
                <div className="kpi"><div className="label">Aterriza a</div><div className="value">{format(r.descentRate, 1)}<small>m/s</small></div><div className="sub">{r.landing ? `después de ${format(r.landing.t, 0)} s` : ""}</div></div>
              </div>
              {!part && r.warnings.length > 0 && (
                <div className="alerts" style={{ marginTop: 12 }}>
                  {r.warnings.map((w, i) => <div key={i} className={`alert ${w.level}`}>{w.text}</div>)}
                </div>
              )}
              </>)}
            </div>
            {/* By steps the warnings stay out: the room goes to the rocket (the stability chip stays on the card). */}
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
  [/^Algodón/, 5.5],
  [/^Paracaídas/, 6],
];
// Anything else is an extra mass: they go last, in the order of their list (the sort is stable).
const menuRank = (name: string) => MENU_ORDER.find(([re]) => re.test(name))?.[1] ?? 7;

const PALETTE = ["#0039a6", "#e0701b", "#1d7a3e", "#7a4fb0", "#b3261e", "#0f8a9d", "#a35f2a", "#5b6270", "#c9a227"];

/** The masses in the order of the design menus, each with its colour (parts with no mass, e.g. no fins, left out). */
export function massRows(items: MassItem[]) {
  const total = items.reduce((s, i) => s + i.mass, 0);
  const sorted = [...items].filter((i) => i.mass > 0).sort((a, b) => menuRank(a.name) - menuRank(b.name));
  return { total, rows: sorted.map((i, k) => ({ ...i, color: PALETTE[k % PALETTE.length], share: i.mass / total })) };
}

export function MassBudget({ items }: { items: MassItem[] }) {
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
