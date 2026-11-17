import { useMemo, useState, type CSSProperties } from "react";
import type { Design } from "../model";
import { motorFor } from "../motor";
import type { FlightResult } from "../physics/simulate";
import { NumField, Segmented, SelectField, format } from "./fields";
import { LineChart, type Series } from "./LineChart";
import { QTY, flightMarkers, flightSpans, posAxis, posTitle, series, thin } from "./phases";
import { FlightBadge } from "./FlightBadge";
import { forceSeriesTec } from "./learn/phaseCommon";
import { guessColumn, parseTable, realSeries, type Table } from "./realData";
import { downloadFile, fileSafe } from "./storage";
import { downloadMatlab } from "./matlab";
import type { SubTab } from "./Workspace";
import { useStage } from "./stage";

const BLUE = "#0039a6";

/** The four parts of Simulaciones, one at a time. */
type SimPart = "revision" | "graficas" | "resultados" | "real";
const SIM_PARTS: { id: SimPart; n: number; title: string; hint: string }[] = [
  { id: "revision", n: 1, title: "Revisión", hint: "Go / No-Go del vuelo" },
  { id: "graficas", n: 2, title: "Simulaciones", hint: "Gráficas del vuelo" },
  { id: "resultados", n: 3, title: "Resultados", hint: "Números y diseño" },
  { id: "real", n: 4, title: "Vuelo real", hint: "Altímetro y sensor" },
];
const ORANGE = "#e0701b";
const G0 = 9.80665;

export interface Comparison {
  altimeter: number;
  altimeterUnit: "m" | "ft";
  /** Times read from the launch video (Rocket Challenge), s; 0 = not entered. */
  apogeeTime: number;
  descentTime: number;
  csv: { name: string; table: Table; timeCol: number; altCol: number; accelCol: number; altUnit: "m" | "ft" } | null;
}

type Q = "F" | "a" | "v" | "s" | "n";
interface Card { label: string; value: string; unit?: string; sub?: string }

/** One flight result: the card takes the colour of its quantity (as in the phase lessons). */
function FlightCard({ q, label, value, unit, sub }: Card & { q: Q }) {
  return (
    <div className={`change-card q-${q}`}>
      <div className="change-head"><span>{label}</span></div>
      <div className="change-value">{value}{unit && <small>{unit}</small>}</div>
      {sub && <div className="change-span">{sub}</div>}
    </div>
  );
}

/** The flight in numbers, grouped by quantity: forces → acceleration → velocities → positions → times. */
function FlightResults({ d, r, motor }: { d: Design; r: FlightResult; motor?: { name: string; delay: number } }) {
  const maxThrust = Math.max(...r.samples.map((s) => s.thrust));
  const weight = r.samples[0].mass * G0;
  const maxDrag = Math.max(...r.samples.map((s) => Math.abs(s.drag)));
  const quick = (t: number) => format(t, t < 0.5 ? 3 : 2);
  const groups: { q: Q; title: string; cards: Card[] }[] = [
    {
      q: "F", title: "Fuerzas",
      cards: [
        { label: d.type === "water" ? "Empuje máximo del agua" : "Empuje máximo", value: format(maxThrust, 1), unit: "N" },
        { label: "Peso al despegar", value: format(weight, 2), unit: "N", sub: `masa de ${format(r.samples[0].mass * 1000, 0)} g` },
        { label: "Arrastre máximo", value: format(maxDrag, 2), unit: "N" },
        { label: "Empuje / peso", value: format(r.thrustToWeight, 1), sub: d.type === "estes" ? "con el empuje máximo" : "al despegar" },
      ],
    },
    {
      q: "a", title: "Aceleraciones",
      cards: [{ label: "Aceleración máxima", value: format(r.maxAcceleration, 0), unit: "m/s²", sub: `${format(r.maxAcceleration / G0, 1)} g` }],
    },
    {
      q: "v", title: "Velocidades",
      cards: [
        { label: "Al salir de la guía", value: r.guideExit ? format(r.guideExit.v, 1) : "–", unit: "m/s", sub: `guía de ${format(d.launch.guideLength, 2)} m` },
        { label: "Velocidad máxima", value: format(r.maxVelocity, 1), unit: "m/s", sub: `${format(r.maxVelocity * 3.6, 0)} km/h · Mach ${format(r.maxMach, 2)}` },
        ...(r.ejection ? [{ label: "Al abrir el paracaídas", value: format(Math.abs(r.ejection.v), 1), unit: "m/s" }] : []),
        { label: "Velocidad de aterrizaje", value: format(r.descentRate, 1), unit: "m/s" },
      ],
    },
    {
      q: "s", title: "Posiciones",
      cards: [
        ...(r.burnout ? [{ label: d.type === "water" ? "Altura al acabarse el agua" : "Altura al fin del empuje", value: format(r.burnout.h, 1), unit: "m" }] : []),
        { label: d.type === "estes" ? "Apogeo" : "Altura máxima", value: format(r.apogee.h, 1), unit: "m", sub: `${format(r.apogee.h / 0.3048, 0)} ft` },
        ...(r.ejection ? [{ label: "Altura al abrir el paracaídas", value: format(r.ejection.h, 1), unit: "m" }] : []),
      ],
    },
    {
      q: "n", title: "Tiempos",
      cards: [
        { label: d.type === "water" ? "Se acaba el agua y el aire" : "Fin del empuje", value: r.burnout ? quick(r.burnout.t) : "–", unit: r.burnout ? "s" : undefined },
        { label: "Tiempo al apogeo", value: format(r.apogee.t, 2), unit: "s" },
        { label: "Se abre el paracaídas", value: r.ejection ? format(r.ejection.t, 2) : "No", unit: r.ejection ? "s" : undefined },
        ...(motor && r.idealDelay !== null ? [{ label: "Retardo ideal", value: format(r.idealDelay, 1), unit: "s", sub: `el ${motor.name} tiene ${motor.delay} s` }] : []),
        ...(r.landing ? [{ label: "Duración del vuelo", value: format(r.landing.t, 1), unit: "s" }] : []),
      ],
    },
  ];
  return (
    <div className="flight-results">
      {groups.map((g) => (
        <section key={g.q} className={`flight-group q-${g.q}`}>
          <h3>{g.title}</h3>
          <div className="flight-cards">
            {g.cards.map((c) => <FlightCard key={c.label} q={g.q} {...c} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

interface Props {
  design: Design;
  result: FlightResult;
  comparison: Comparison;
  onComparison: (c: Comparison) => void;
  onLesson: (s: SubTab) => void;
}

export function GraphsTab({ design: d, result: r, comparison, onComparison, onLesson }: Props) {
  const [csvError, setCsvError] = useState("");
  const [range, setRange] = useState<"ascent" | "all">("all");
  const [part, setPart] = useState<SimPart>("revision");
  // Every part has the same one-screen window (the stage), so switching parts never changes the size of the page.
  const chartsStage = useStage<HTMLDivElement>(part);
  const resultsStage = useStage<HTMLDivElement>(part);
  const realStage = useStage<HTMLDivElement>(part);
  // Picking a part places the page like a step button: the row of phases at the top, the part below it.
  const pick = (p: SimPart) => {
    setPart(p);
    const row = document.querySelector(".menu-row.phases");
    if (row) scrollTo({ top: row.getBoundingClientRect().top + scrollY - 8 });
  };
  const xMax = range === "ascent" ? Math.min(r.apogee.t * 1.25 + 0.2, r.samples[r.samples.length - 1].t) : undefined;
  const { csv } = comparison;
  const simLiftoff = r.samples.find((s) => s.h > 0.5)?.t ?? 0;
  const real = useMemo(() => (csv ? realSeries(csv.table, csv.timeCol, csv.altCol, csv.accelCol, csv.altUnit, simLiftoff) : null), [csv, simLiftoff]);
  const spans = useMemo(() => flightSpans(r, d.type), [r, d.type]);
  const markers = useMemo(() => flightMarkers(r), [r]);

  // Rocket Tec: one colour per quantity (s, v, dv/dt), the same as in the lessons.
  const tec = d.type === "estes";
  const charts = useMemo(() => {
    const shown = thin(r);
    const burnEnd = (r.burnout?.t ?? 0) * 1.3 + 0.02;
    // Rocket Tec labels each curve with its quantity and colour, as in the phase lessons.
    const altitude: Series[] = [{ label: tec ? "s" : "Simulación", points: series(shown, (s) => s.h), color: tec ? QTY.s : BLUE }];
    const acceleration: Series[] = [{ label: tec ? "dv/dt" : "Simulación", points: series(shown, (s) => s.a), color: tec ? QTY.a : BLUE }];
    if (real && typeof real !== "string") {
      altitude.push({ label: "Vuelo real", points: real.altitude, color: ORANGE });
      if (real.acceleration.length) acceleration.push({ label: "Vuelo real (sensor)", points: real.acceleration, color: ORANGE });
    }
    return {
      altitude,
      velocity: [{ label: tec ? "v" : "Simulación", points: series(shown, (s) => s.v), color: tec ? QTY.v : BLUE }],
      forces: forceSeriesTec(shown),
      acceleration,
      thrust: [{ label: "Empuje", points: r.samples.filter((s) => s.t <= burnEnd).map((s) => ({ x: s.t, y: s.thrust })), color: QTY.T, fill: true }],
      burnEnd,
    };
  }, [r, real, tec]);

  const motor = d.type === "estes" ? motorFor(d.motor) : undefined;
  const altimeterM = comparison.altimeterUnit === "ft" ? comparison.altimeter * 0.3048 : comparison.altimeter;
  const err = (v: number) => ((v - r.apogee.h) / r.apogee.h) * 100;

  const exportCsv = () => {
    const header = "tiempo_s,altura_m,velocidad_m_s,aceleracion_m_s2,empuje_N,arrastre_N,masa_kg,cd";
    const body = r.samples.map((s) => [s.t, s.h, s.v, s.a, s.thrust, s.drag, s.mass, s.cd].map((v) => v.toFixed(4)).join(",")).join("\n");
    downloadFile(`${fileSafe(d.name)}-simulacion.csv`, `${header}\n${body}\n`, "text/csv");
  };

  const loadCsv = async (file: File) => {
    setCsvError("");
    const table = parseTable(await file.text());
    if (typeof table === "string") { setCsvError(table); return; }
    const h = table.headers;
    onComparison({
      ...comparison,
      csv: {
        name: file.name,
        table,
        timeCol: guessColumn(h, [/tiempo|time/i], 0),
        altCol: guessColumn(h, [/altitud|altitude|altura|height/i], Math.min(1, h.length - 1)),
        accelCol: guessColumn(h, [/acel|accel/i], -1),
        altUnit: h.some((x) => /\(ft\)|feet|pies/i.test(x)) ? "ft" : "m",
      },
    });
  };
  const setCsv = (patch: Partial<NonNullable<Comparison["csv"]>>) => csv && onComparison({ ...comparison, csv: { ...csv, ...patch } });
  const columnOptions = (csv?.table.headers ?? []).map((h, i) => ({ value: String(i), label: h }));

  return (
    <div className="results wide">
      <div className="print-only"><h2 style={{ color: BLUE }}>Rocket Physics Lab Sinaloa · {d.name}</h2></div>

      <div className="lesson-head card phase-head no-print">
        <h2 className="visually-hidden">Simulaciones del vuelo</h2>
        <nav className="stage-tabs" aria-label="Partes de Simulaciones" style={{ "--tabs": SIM_PARTS.length } as CSSProperties}>
          {SIM_PARTS.map((t) => (
            <button key={t.id} type="button" className={`stage-tab sim-${t.id}`} aria-current={part === t.id ? "step" : undefined} onClick={() => pick(t.id)}>
              <span className="stage-n">{t.n}</span>
              <span className="stage-tab-text"><b>{t.title}</b><small>{t.hint}</small></span>
            </button>
          ))}
        </nav>
      </div>

      <div className="sim-part" hidden={part !== "revision"}>
        <FlightBadge design={d} result={r} onGo={onLesson} page={part} />
      </div>

      <div className="sim-part" hidden={part !== "resultados"}>
      <div className="card step-stage sim-results" ref={resultsStage}>
        <div className="card-head">
          <h2>Resultados de la simulación · {d.name}</h2>
          <div className="btn-row no-print">
            <button type="button" className="btn small" onClick={exportCsv}>Descargar datos (CSV)</button>
            <button type="button" className="btn small" onClick={() => downloadMatlab(d, r)}>Descargar script de MATLAB</button>
            <button type="button" className="btn small" onClick={() => window.print()}>Imprimir o guardar PDF</button>
          </div>
        </div>
        <FlightResults d={d} r={r} motor={motor} />
        {r.warnings.length > 0 && (
          <div className="alerts" style={{ marginTop: 12 }}>
            {r.warnings.map((w, i) => <div key={i} className={`alert ${w.level}`}>{w.text}</div>)}
          </div>
        )}
      </div>
      </div>

      <div className="sim-part" hidden={part !== "graficas"}>
      <div className="card step-stage sim-charts" ref={chartsStage}>
        <div className="card-head">
          <h2>Simulaciones del vuelo</h2>
          <Segmented value={range} options={[{ value: "ascent", label: "Ascenso" }, { value: "all", label: "Todo el vuelo" }]} onChange={setRange} />
        </div>
        <p className="hint" style={{ marginBottom: 8 }}>
          Las franjas de color marcan las fases del vuelo y las líneas punteadas, los eventos. Para ver cómo se calcula una fase, elígela en la fila de fases.
        </p>
        <div className="charts fill stage-fill">
          {tec ? (
            <>
              {/* Same order and colours as the phase lessons: cause → effect. */}
              <LineChart title="Fuerzas y suma de fuerzas ΣF" xLabel="Tiempo (s)" yLabel="Fuerza (N)" series={charts.forces} spans={spans} markers={markers} xMax={xMax} height="fill" />
              <LineChart title="Aceleración dv/dt" xLabel="Tiempo (s)" yLabel="Aceleración (m/s²)" series={charts.acceleration} spans={spans} markers={markers} xMax={xMax} height="fill" />
              <LineChart title="Velocidad v(t)" xLabel="Tiempo (s)" yLabel="Velocidad (m/s)" series={charts.velocity} spans={spans} markers={markers} xMax={xMax} height="fill" />
              <LineChart title={posTitle(d.type)} xLabel="Tiempo (s)" yLabel={posAxis(d.type)} series={charts.altitude} spans={spans} markers={markers} xMax={xMax} height="fill" />
            </>
          ) : (
            <>
          <LineChart title={posTitle(d.type)} xLabel="Tiempo (s)" yLabel={posAxis(d.type)} series={charts.altitude} spans={spans} markers={markers} xMax={xMax} height="fill" />
          <LineChart title="Velocidad v(t)" xLabel="Tiempo (s)" yLabel="Velocidad (m/s)" series={charts.velocity} spans={spans} markers={markers} xMax={xMax} height="fill" />
          <LineChart title="Aceleración a(t)" xLabel="Tiempo (s)" yLabel="Aceleración (m/s²)" series={charts.acceleration} spans={spans} markers={markers} xMax={xMax} height="fill" />
          <LineChart title={d.type === "water" ? "Empuje del agua y el aire T(t)" : `Empuje del motor ${motor?.name ?? ""} T(t)${motor?.model === "average" ? " (empuje promedio constante)" : ""}`} xLabel="Tiempo (s)" yLabel="Empuje (N)" series={charts.thrust} xMax={charts.burnEnd} height="fill" />
            </>
          )}
        </div>
      </div>
      </div>

      <div className="sim-part" hidden={part !== "real"}>
      <div className="card step-stage sim-real-card" ref={realStage}>
        <h2>Comparar con el vuelo real</h2>
        <div className="compare-grid">
          <div>
            <p className="hint" style={{ marginBottom: 8 }}>
              {d.type === "water"
                ? "Sensor de altura: escribe la altura máxima que marcó. Del video, mide el tiempo hasta el apogeo y del apogeo al aterrizaje."
                : `Altímetro ${d.altimeter.brand?.trim() || "Estes"}: escribe el apogeo que marcó.`}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8 }}>
              <NumField label="Altura medida" min={0} value={comparison.altimeter} onChange={(altimeter) => onComparison({ ...comparison, altimeter })} unit={comparison.altimeterUnit} />
              <SelectField label="Unidad" value={comparison.altimeterUnit} options={[{ value: "ft", label: "pies (ft)" }, { value: "m", label: "metros" }]} onChange={(altimeterUnit) => onComparison({ ...comparison, altimeterUnit })} />
              {d.type === "water" && (
                <>
                  <NumField label="Tiempo hasta el apogeo (video)" unit="s" min={0} value={comparison.apogeeTime} onChange={(apogeeTime) => onComparison({ ...comparison, apogeeTime })} className="full-row" />
                  <NumField label="Tiempo del apogeo al aterrizaje (video)" unit="s" min={0} value={comparison.descentTime} onChange={(descentTime) => onComparison({ ...comparison, descentTime })} className="full-row" />
                </>
              )}
            </div>
            {d.type === "water" ? (
              <MeasuredVsSimulated
                rows={[
                  { label: "Altura máxima", unit: "m", digits: 1, real: altimeterM, sim: r.apogee.h },
                  { label: "Tiempo hasta el apogeo", unit: "s", digits: 2, real: comparison.apogeeTime, sim: r.apogee.t },
                  { label: "Del apogeo al aterrizaje", unit: "s", digits: 2, real: comparison.descentTime, sim: r.landing ? r.landing.t - r.apogee.t : NaN },
                ]}
              />
            ) : comparison.altimeter > 0 && (
              <p style={{ marginTop: 10 }}>
                Real: <b>{format(altimeterM, 1)} m</b> · simulado: <b>{format(r.apogee.h, 1)} m</b> · diferencia:{" "}
                <b>{err(altimeterM) >= 0 ? "+" : ""}{format(err(altimeterM), 1)} %</b>
              </p>
            )}
          </div>
          <div>
            <p className="hint" style={{ marginBottom: 8 }}>Sensor PASCO u otro: sube el archivo CSV exportado y se dibuja sobre las gráficas.</p>
            <input className="no-print" type="file" accept=".csv,.txt,.tsv,text/csv" onChange={(e) => e.target.files?.[0] && loadCsv(e.target.files[0])} />
            {csvError && <div className="alert error" style={{ marginTop: 8 }}>{csvError}</div>}
            {csv && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                <SelectField label="Columna de tiempo (s)" value={String(csv.timeCol)} options={columnOptions} onChange={(v) => setCsv({ timeCol: Number(v) })} />
                <SelectField label="Columna de altura" value={String(csv.altCol)} options={columnOptions} onChange={(v) => setCsv({ altCol: Number(v) })} />
                <SelectField label="Unidad de altura" value={csv.altUnit} options={[{ value: "m", label: "metros" }, { value: "ft", label: "pies" }]} onChange={(altUnit) => setCsv({ altUnit })} />
                <SelectField label="Columna de aceleración" value={String(csv.accelCol)} options={[{ value: "-1", label: "(ninguna)" }, ...columnOptions]} onChange={(v) => setCsv({ accelCol: Number(v) })} />
                {typeof real === "string" && <div className="alert error" style={{ gridColumn: "1 / -1" }}>{real}</div>}
                {real && typeof real !== "string" && (
                  <p style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {csv.name}: {d.type === "estes" ? "apogeo" : "altura máxima"} real <b>{format(real.apogee, 1)} m</b> · diferencia{" "}
                    <b>{err(real.apogee) >= 0 ? "+" : ""}{format(err(real.apogee), 1)} %</b>. El despegue real se alineó con el simulado.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}


/** Rocket Challenge: each measurement next to the prediction; rows without a measurement show only the prediction. */
function MeasuredVsSimulated({ rows }: { rows: { label: string; unit: string; digits: number; real: number; sim: number }[] }) {
  return (
    <table className="summary" style={{ marginTop: 10 }}>
      <thead><tr><th /><th className="num">Medido</th><th className="num">Simulado</th><th className="num">Diferencia</th></tr></thead>
      <tbody>
        {rows.map((x) => {
          const diff = x.real > 0 && x.sim > 0 ? ((x.real - x.sim) / x.sim) * 100 : null;
          return (
            <tr key={x.label}>
              <td>{x.label}</td>
              <td className="num">{x.real > 0 ? `${format(x.real, x.digits)} ${x.unit}` : "–"}</td>
              <td className="num">{Number.isFinite(x.sim) ? `${format(x.sim, x.digits)} ${x.unit}` : "–"}</td>
              <td className="num">{diff === null ? "–" : <b>{diff >= 0 ? "+" : ""}{format(diff, 1)} %</b>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
