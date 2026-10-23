import { useMemo, useState } from "react";
import type { Design } from "../model";
import { motorById } from "../catalog";
import { layout } from "../physics/geometry";
import type { FlightResult } from "../physics/simulate";
import { NumField, Segmented, SelectField, format } from "./fields";
import { LineChart, type Series } from "./LineChart";
import { flightMarkers, flightSpans, series, thin } from "./phases";
import { PhaseTimeline } from "./PhaseTimeline";
import { guessColumn, parseTable, realSeries, type Table } from "./realData";
import { downloadFile, fileSafe } from "./storage";
import { downloadMatlab } from "./matlab";
import type { SubTab } from "./Workspace";

const BLUE = "#0039a6";
const ORANGE = "#e0701b";
const G0 = 9.80665;

export interface Comparison {
  altimeter: number;
  altimeterUnit: "m" | "ft";
  csv: { name: string; table: Table; timeCol: number; altCol: number; accelCol: number; altUnit: "m" | "ft" } | null;
}

function Kpi({ label, value, unit, sub, hero }: { label: string; value: string; unit?: string; sub?: string; hero?: boolean }) {
  return (
    <div className={`kpi ${hero ? "hero" : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}{unit && <small>{unit}</small>}</div>
      {sub && <div className="sub">{sub}</div>}
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
  const [range, setRange] = useState<"ascent" | "all">("ascent");
  const xMax = range === "ascent" ? Math.min(r.apogee.t * 1.25 + 0.2, r.samples[r.samples.length - 1].t) : undefined;
  const { csv } = comparison;
  const simLiftoff = r.samples.find((s) => s.h > 0.5)?.t ?? 0;
  const real = useMemo(() => (csv ? realSeries(csv.table, csv.timeCol, csv.altCol, csv.accelCol, csv.altUnit, simLiftoff) : null), [csv, simLiftoff]);
  const spans = useMemo(() => flightSpans(r), [r]);
  const markers = useMemo(() => flightMarkers(r), [r]);

  const charts = useMemo(() => {
    const shown = thin(r);
    const burnEnd = (r.burnout?.t ?? 0) * 1.3 + 0.02;
    const altitude: Series[] = [{ label: "Simulación", points: series(shown, (s) => s.h), color: BLUE }];
    const acceleration: Series[] = [{ label: "Simulación", points: series(shown, (s) => s.a), color: BLUE }];
    if (real && typeof real !== "string") {
      altitude.push({ label: "Vuelo real", points: real.altitude, color: ORANGE });
      if (real.acceleration.length) acceleration.push({ label: "Vuelo real (sensor)", points: real.acceleration, color: ORANGE });
    }
    return {
      altitude,
      velocity: [{ label: "Simulación", points: series(shown, (s) => s.v), color: BLUE }],
      acceleration,
      thrust: [{ label: "Empuje", points: r.samples.filter((s) => s.t <= burnEnd).map((s) => ({ x: s.t, y: s.thrust })), color: "#a35f2a", fill: true }],
      burnEnd,
    };
  }, [r, real]);

  const l = layout(d);
  const motor = d.type === "estes" ? motorById(d.motor.id) : undefined;
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
      <div className="print-only"><h2 style={{ color: BLUE }}>Rocket Physics Lab · {d.name}</h2></div>

      <div className="card">
        <div className="card-head">
          <h2>Resultados de la simulación · {d.name}</h2>
          <div className="btn-row no-print">
            <button type="button" className="btn small" onClick={exportCsv}>Descargar datos (CSV)</button>
            <button type="button" className="btn small" onClick={() => downloadMatlab(d, r)}>Descargar script de MATLAB</button>
            <button type="button" className="btn small" onClick={() => window.print()}>Imprimir o guardar PDF</button>
          </div>
        </div>
        <div className="kpis">
          <Kpi hero label="Altura máxima" value={format(r.apogee.h, 1)} unit="m" sub={`${format(r.apogee.h / 0.3048, 0)} ft`} />
          <Kpi label="Tiempo al apogeo" value={format(r.apogee.t, 2)} unit="s" />
          <Kpi label="Velocidad máxima" value={format(r.maxVelocity, 1)} unit="m/s" sub={`${format(r.maxVelocity * 3.6, 0)} km/h · Mach ${format(r.maxMach, 2)}`} />
          <Kpi label="Aceleración máxima" value={format(r.maxAcceleration / G0, 1)} unit="g" sub={`${format(r.maxAcceleration, 0)} m/s²`} />
          <Kpi label="Al salir de la guía" value={r.guideExit ? format(r.guideExit.v, 1) : "–"} unit="m/s" sub={`guía de ${format(d.launch.guideLength, 2)} m`} />
          <Kpi label={d.type === "water" ? "Se acaba el agua y el aire" : "Fin del empuje"} value={r.burnout ? format(r.burnout.t, r.burnout.t < 0.5 ? 3 : 2) : "–"} unit="s" sub={r.burnout ? `a ${format(r.burnout.h, 1)} m y ${format(r.burnout.v, 1)} m/s` : undefined} />
          <Kpi label="Se abre el paracaídas" value={r.ejection ? format(r.ejection.t, 2) : "No"} unit={r.ejection ? "s" : undefined} sub={r.ejection ? `a ${format(r.ejection.h, 1)} m, ${format(Math.abs(r.ejection.v), 1)} m/s` : undefined} />
          <Kpi label="Velocidad de aterrizaje" value={format(r.descentRate, 1)} unit="m/s" sub={r.landing ? `vuelo de ${format(r.landing.t, 1)} s` : undefined} />
          {motor && r.idealDelay !== null && (
            <Kpi label="Retardo ideal" value={format(r.idealDelay, 1)} unit="s" sub={`el más cercano: ${motor.name}-${closest(motor.delays.filter((x) => x > 0), r.idealDelay) ?? "–"}`} />
          )}
          <Kpi label="Empuje / peso" value={format(r.thrustToWeight, 1)} sub={d.type === "estes" ? "con empuje promedio" : "al despegar"} />
        </div>
        {r.warnings.length > 0 && (
          <div className="alerts" style={{ marginTop: 12 }}>
            {r.warnings.map((w, i) => <div key={i} className={`alert ${w.level}`}>{w.text}</div>)}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Gráficas del vuelo</h2>
          <Segmented value={range} options={[{ value: "ascent", label: "Ascenso" }, { value: "all", label: "Todo el vuelo" }]} onChange={setRange} />
        </div>
        <p className="hint" style={{ marginBottom: 8 }}>
          Las franjas de color marcan las cuatro fases del vuelo y las líneas punteadas, los eventos. Haz clic en una fase para ver cómo se calcula.
        </p>
        <PhaseTimeline result={r} onPick={(id) => onLesson(`fase${id}` as SubTab)} />
        <div className="charts">
          <div><LineChart title="Altura h(t)" xLabel="Tiempo (s)" yLabel="Altura (m)" series={charts.altitude} spans={spans} markers={markers} xMax={xMax} /></div>
          <div><LineChart title="Velocidad v(t)" xLabel="Tiempo (s)" yLabel="Velocidad (m/s)" series={charts.velocity} spans={spans} markers={markers} xMax={xMax} /></div>
          <div><LineChart title="Aceleración a(t)" xLabel="Tiempo (s)" yLabel="Aceleración (m/s²)" series={charts.acceleration} spans={spans} markers={markers} xMax={xMax} /></div>
          <div><LineChart title={d.type === "water" ? "Empuje del agua y el aire T(t)" : `Empuje del motor ${motor?.name ?? ""} T(t)`} xLabel="Tiempo (s)" yLabel="Empuje (N)" series={charts.thrust} xMax={charts.burnEnd} /></div>
        </div>
      </div>

      <div className="card">
        <h2>Comparar con el vuelo real</h2>
        <div className="compare-grid">
          <div>
            <p className="hint" style={{ marginBottom: 8 }}>Altímetro Estes: escribe la altura máxima que marcó.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8 }}>
              <NumField label="Altura medida" min={0} value={comparison.altimeter} onChange={(altimeter) => onComparison({ ...comparison, altimeter })} unit={comparison.altimeterUnit} />
              <SelectField label="Unidad" value={comparison.altimeterUnit} options={[{ value: "ft", label: "pies (ft)" }, { value: "m", label: "metros" }]} onChange={(altimeterUnit) => onComparison({ ...comparison, altimeterUnit })} />
            </div>
            {comparison.altimeter > 0 && (
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
                    {csv.name}: altura máxima real <b>{format(real.apogee, 1)} m</b> · diferencia{" "}
                    <b>{err(real.apogee) >= 0 ? "+" : ""}{format(err(real.apogee), 1)} %</b>. El despegue real se alineó con el simulado.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Resumen del diseño</h2>
        <table className="summary">
          <tbody>
            <tr><td>Largo total</td><td className="val">{format(l.length / 10, 1)} cm</td></tr>
            <tr><td>Diámetro</td><td className="val">{format(l.refDiameter, 1)} mm</td></tr>
            <tr><td>Nariz</td><td className="val">{d.nose.catalog ?? "propia"} · {format(d.nose.length)} mm · {format(d.nose.mass, 1)} g</td></tr>
            {d.type === "estes"
              ? <tr><td>Tubo</td><td className="val">{d.body.catalog ?? "propio"} · {format(d.body.length)} mm · {format(d.body.mass, 1)} g</td></tr>
              : <tr><td>Botella</td><td className="val">{format(d.water.bottleVolume, 2)} L · {format(d.water.bottleMass, 0)} g · {format(d.water.waterVolume, 2)} L de agua a {format(d.water.pressure, 0)} psi</td></tr>}
            <tr><td>Aletas</td><td className="val">{d.fins.count} · raíz {format(d.fins.rootChord)} / punta {format(d.fins.tipChord)} / altura {format(d.fins.span)} mm · {format(d.fins.mass, 1)} g</td></tr>
            {motor && d.type === "estes" && <tr><td>Motor</td><td className="val">{motor.name}-{d.motor.delay} · {format(motor.totalImpulse, 1)} N·s</td></tr>}
            <tr><td>Paracaídas</td><td className="val">{d.recovery.kind === "parachute" ? `${format(d.recovery.diameter / 10, 0)} cm · ${format(d.recovery.mass, 1)} g` : "ninguno"}</td></tr>
            {d.extras.map((e, i) => <tr key={i}><td>{e.name}</td><td className="val">{format(e.mass, 1)} g a {format(e.position)} mm</td></tr>)}
            <tr><td>Sitio</td><td className="val">{format(d.launch.altitude, 0)} m s.n.m. · {format(d.launch.temperature, 0)} °C · guía {format(d.launch.guideLength, 2)} m</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function closest(values: number[], target: number): number | undefined {
  return values.reduce<number | undefined>((best, v) => (best === undefined || Math.abs(v - target) < Math.abs(best - target) ? v : best), undefined);
}
