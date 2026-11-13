import { useMemo, useState } from "react";
import type { EstesDesign } from "../../model";
import { averageThrust, curveImpulse, impulseClass, makerName, motorSpec, type ThrustModel } from "../../motor";
import { simulate } from "../../physics/simulate";
import { SelectField, format } from "../fields";
import { LineChart, type Series } from "../LineChart";
import { MotorPicker } from "../MotorPicker";
import { parseTable } from "../realData";
import { analyzeStaticTest, guessStaticColumns, STATIC_TEST_TEMPLATE, type ForceUnit, type StaticTestFile, type TimeUnit } from "../staticTest";
import { downloadFile } from "../storage";
import type { SubTab } from "../Workspace";
import { Eq } from "./common";

/** Colour of Rocket Tec's phase 0 (no flight phase uses it). */
export const STATIC_TEST_COLOR = "#6b3fa0";

const r = String.raw;

/** Colour of the constant average thrust (also used in phase I). */
export const AVERAGE_COLOR = "#e0701b";

export const THRUST_MODEL_TIPS: Record<ThrustModel, string> = {
  real: "Usa la curva de empuje medida, punto por punto. Es la opción más precisa: las predicciones de todas las fases se calculan con el pico inicial y la cola del motor.",
  average: "Usa una fuerza constante igual al empuje promedio (mismo impulso y misma duración) y una masa constante (se ignora el combustible quemado). Simplifica los cálculos a mano, pero las predicciones no serán tan correctas como con el empuje real: el modelo no tiene el pico inicial del motor.",
};
const OZ = 28.3495; // g
const LBF = 4.448222; // N

const FORCE_UNITS: { value: ForceUnit; label: string }[] = [
  { value: "N", label: "newtons (N)" },
  { value: "gf", label: "gramos fuerza (g)" },
  { value: "kgf", label: "kilogramos fuerza (kg)" },
  { value: "lbf", label: "libras fuerza (lb)" },
];
const TIME_UNITS: { value: TimeUnit; label: string }[] = [
  { value: "s", label: "segundos (s)" },
  { value: "ms", label: "milisegundos (ms)" },
];

const pct = (measured: number, reference: number) => (reference > 0 ? ((measured - reference) / reference) * 100 : NaN);
const signed = (v: number) => (Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${format(v, 1)} %` : "–");

/**
 * Phase 0 of Rocket Tec: the motor's published data, its thrust curve and the static test.
 * The uploaded file lives in the workspace (not in the project file), like the flight data in Gráficas.
 */
export function StaticTestLesson({ design: d, onChange, file, onFile, onGo }: {
  design: EstesDesign;
  onChange: (d: EstesDesign) => void;
  file: StaticTestFile | null;
  onFile: (f: StaticTestFile | null) => void;
  onGo: (s: SubTab) => void;
}) {
  const spec = motorSpec(d.motor.id);
  const maker = makerName(spec.maker);
  const [error, setError] = useState("");
  const test = useMemo(() => (file ? analyzeStaticTest(file) : null), [file]);
  const ok = test && typeof test !== "string" ? test : null;
  const avg = averageThrust(spec);
  const model: ThrustModel = d.motor.thrust === "average" ? "average" : "real";
  const setModel = (thrust: ThrustModel) => thrust !== model && onChange({ ...d, motor: { ...d.motor, thrust } });
  // The same rocket with each thrust model, to show what the simplification costs.
  const predictions = useMemo(() => {
    const run = (thrust: ThrustModel) => {
      const res = simulate({ ...d, motor: { ...d.motor, thrust } });
      return typeof res === "string" ? null : res;
    };
    return { real: run("real"), average: run("average") };
  }, [d]);

  const certified = {
    impulse: curveImpulse(spec.certified),
    maxThrust: Math.max(...spec.certified.thrust),
    burnTime: spec.certified.time[spec.certified.time.length - 1],
  };
  const rows = [
    { label: "Impulso total", unit: "N·s", digits: 2, maker: spec.rated.impulse, cert: certified.impulse, own: ok?.impulse },
    { label: "Empuje máximo", unit: "N", digits: 1, maker: spec.rated.maxThrust, cert: certified.maxThrust, own: ok?.maxThrust },
    { label: "Duración del empuje", unit: "s", digits: 2, maker: spec.rated.burnTime, cert: certified.burnTime, own: ok?.burnTime },
    { label: "Empuje promedio", unit: "N", digits: 2, maker: spec.rated.impulse / spec.rated.burnTime, cert: certified.impulse / certified.burnTime, own: ok?.averageThrust },
  ];

  const xMax = Math.max(1.1, ok ? ok.burnTime + 0.3 : 0);
  const forceSeries = useMemo<Series[]>(() => {
    const s: Series[] = [
      { label: `Fabricante (${maker})`, points: spec.makerCurve.time.map((x, i) => ({ x, y: spec.makerCurve.thrust[i] })), color: STATIC_TEST_COLOR, fill: true },
      { label: "Certificación NAR (empuje real)", points: spec.certified.time.map((x, i) => ({ x, y: spec.certified.thrust[i] })), color: "#5b6270", dashed: true },
      { label: "Empuje promedio constante", points: [{ x: 0, y: 0 }, { x: 0, y: avg.force }, { x: avg.burnTime, y: avg.force }, { x: avg.burnTime, y: 0 }], color: AVERAGE_COLOR },
    ];
    if (ok) s.push({ label: "Tu prueba estática", points: ok.force.filter((p) => p.x >= -0.1 && p.x <= xMax), color: "#b3261e" });
    return s;
  }, [spec, maker, ok, xMax, avg.force, avg.burnTime]);

  const load = async (f: File) => {
    setError("");
    const table = parseTable(await f.text());
    if (typeof table === "string") { setError(table); return; }
    onFile({ name: f.name, table, ...guessStaticColumns(table.headers) });
  };
  const set = (patch: Partial<StaticTestFile>) => file && onFile({ ...file, ...patch });
  const columns = (file?.table.headers ?? []).map((h, i) => ({ value: String(i), label: h }));

  // The length is printed as "1.8 in (4.6 cm)": metric first, inches as the second unit.
  const len = /^(.*?)\s*\((.*)\)$/.exec(spec.rated.lengthText);
  type Spec = { label: string; value: string; unit: string; alt?: string };
  const groups: { title: string; tone: "perf" | "body"; items: Spec[] }[] = [
    {
      title: "Desempeño",
      tone: "perf",
      items: [
        { label: "Impulso total", value: format(spec.rated.impulse, 2), unit: "N·s" },
        { label: "Clase de impulso", value: impulseClass(spec.rated.impulse), unit: "" },
        { label: "Empuje máximo", value: format(spec.rated.maxThrust, 1), unit: "N", alt: `${format(spec.rated.maxThrust / LBF, 1)} lb` },
        { label: "Duración del empuje", value: format(spec.rated.burnTime, 2), unit: "s" },
        { label: "Retardo", value: String(spec.delay), unit: "s" },
      ],
    },
    {
      title: "Dimensiones y masas",
      tone: "body",
      items: [
        { label: "Diámetro", value: String(spec.diameter), unit: "mm" },
        len ? { label: "Longitud", value: len[2].replace(/\s*cm$/, ""), unit: "cm", alt: len[1] } : { label: "Longitud", value: spec.rated.lengthText, unit: "" },
        { label: "Masa del motor", value: format(spec.rated.mass, 1), unit: "g", alt: `${format(spec.rated.mass / OZ, 2)} oz` },
        { label: "Masa del propelente", value: format(spec.rated.propellant, 1), unit: "g", alt: `${format(spec.rated.propellant / OZ, 2)} oz` },
        { label: "Masa máxima del cohete al despegar", value: String(spec.rated.maxLiftoffMass), unit: "g", alt: `${format(spec.rated.maxLiftoffMass / OZ, 1)} oz` },
      ],
    },
  ];

  return (
    <div className="lesson static-test">
      <div className="lesson-head card">
        <h2><span className="phase-title-num" style={{ background: STATIC_TEST_COLOR }}>🔥</span> Motor: prueba estática</h2>
        <p>
          Antes de volar, se mide el motor. En una <b>prueba estática</b> el motor se sujeta a una <b>celda de carga</b> y se enciende sin que se mueva:
          la celda registra la fuerza (el empuje) muchas veces por segundo y un sensor mide la temperatura del motor. Así comprobamos con datos propios
          la curva de empuje que usa la simulación.
        </p>
        <ol className="steps">
          <li><b>Elige el motor</b> y revisa los datos que publica el fabricante.</li>
          <li><b>Mide:</b> haz la prueba estática y guarda las lecturas de tiempo, fuerza y temperatura en un archivo CSV.</li>
          <li><b>Compara:</b> sube el archivo y mira tu curva encima de la del fabricante.</li>
        </ol>
      </div>

      <div className="card prose-wide">
        <h2>El motor</h2>
        <div className="form-grid motor-choice">
          <MotorPicker d={d} onChange={onChange} />
        </div>
        <div className="motor-sheet">
          {groups.map((g) => (
            <section key={g.title} className={`motor-group ${g.tone}`}>
              <h3>{g.title}</h3>
              <dl className="motor-specs">
                {g.items.map((s) => (
                  <div key={s.label}>
                    <dt>{s.label}</dt>
                    <dd>{s.value}{s.unit && <small>{s.unit}</small>}</dd>
                    <span className="motor-alt">{s.alt ?? " "}</span>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <p className="hint">
          Datos publicados por {maker} en <a href={spec.url} target="_blank" rel="noreferrer">la página del motor</a>. Los valores del fabricante son
          nominales: cada motor real es un poco diferente.
        </p>
      </div>

      <div className="card">
        <h2>Empuje contra tiempo: F(t)</h2>
        <LineChart title={`Motor ${maker} ${spec.name}`} xLabel="Tiempo desde el encendido (s)" yLabel="Empuje (N)" series={forceSeries} xMin={ok ? -0.1 : 0} xMax={xMax} height={300} />
        <ul className="chart-notes">
          <li><b>Fabricante:</b> la gráfica de la página de {maker}, leída punto por punto (aproximada).</li>
          <li><b>Certificación NAR:</b> la prueba estática oficial del motor. Es el <b>empuje real</b> que usa el simulador.</li>
          <li><b>Empuje promedio constante:</b> un rectángulo con la misma área (el mismo impulso) y la misma duración que la curva NAR.</li>
          {ok && <li><b>Tu prueba estática:</b> tus lecturas sin la tara, con el encendido en t = 0.</li>}
        </ul>
        <p>
          El área bajo la curva es el <b>impulso total</b>: <Eq tex={r`I = \int_0^{t_b} F\,dt`} />. El empuje promedio es{" "}
          <Eq tex={r`\bar F = I / t_b`} />. Fíjate en la forma: un pico fuerte para despegar y después un empuje bajo y casi constante.
        </p>
      </div>

      <div className="card prose-wide">
        <h2>Empuje real o empuje promedio</h2>
        <p>
          Para simplificar el modelo matemático podemos cambiar la curva por una <b>fuerza constante</b>: el empuje promedio, que da el mismo
          impulso en el mismo tiempo. Así la segunda ley de Newton se resuelve con una fuerza que no cambia durante el empuje.
        </p>
        <Eq block tex={r`\bar F = \frac{I}{t_b} = \frac{${format(avg.impulse, 2)}\ \text{N·s}}{${format(avg.burnTime, 2)}\ \text{s}} = \mathbf{${format(avg.force, 2)}\ N} \qquad T(t) = \begin{cases} \bar F & 0 \le t < t_b \\ 0 & t \ge t_b \end{cases}`} />
        <div className="thrust-model" role="group" aria-label="Modelo de empuje para todos los cálculos">
          <button type="button" className={`btn ${model === "real" ? "primary" : ""}`} aria-pressed={model === "real"} title={THRUST_MODEL_TIPS.real} onClick={() => setModel("real")}>
            Utilizar el empuje real
          </button>
          <button type="button" className={`btn ${model === "average" ? "primary" : ""}`} aria-pressed={model === "average"} title={THRUST_MODEL_TIPS.average} onClick={() => setModel("average")}>
            Utilizar el empuje aproximado (promedio)
          </button>
        </div>
        <p className="hint">
          Tu elección se aplica a <b>todos los cálculos</b>: el vuelo, las gráficas, las fases I a IV y el script de MATLAB. Se guarda en tu proyecto
          y la puedes cambiar aquí cuando quieras.
        </p>
        {model === "average" && (
          <div className="alert warning">
            Estás usando el <b>empuje promedio</b>: los cálculos son más sencillos, pero las predicciones no son tan correctas como con el empuje real.
          </div>
        )}
        {predictions.real && predictions.average && (
          <div className="table-scroll" style={{ marginTop: 10 }}>
            <table className="summary">
              <thead><tr><th>Predicción con tu cohete</th><th className="num">Empuje real</th><th className="num">Empuje promedio</th><th className="num">Diferencia</th></tr></thead>
              <tbody>
                {[
                  { label: "Apogeo", unit: "m", digits: 1, a: predictions.real.apogee.h, b: predictions.average.apogee.h },
                  { label: "Velocidad máxima", unit: "m/s", digits: 1, a: predictions.real.maxVelocity, b: predictions.average.maxVelocity },
                  { label: "Tiempo hasta el apogeo", unit: "s", digits: 2, a: predictions.real.apogee.t, b: predictions.average.apogee.t },
                  { label: "Velocidad al salir de la guía", unit: "m/s", digits: 1, a: predictions.real.guideExit?.v ?? NaN, b: predictions.average.guideExit?.v ?? NaN },
                ].map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className="num">{format(row.a, row.digits)} {row.unit}</td>
                    <td className="num">{format(row.b, row.digits)} {row.unit}</td>
                    <td className="num">{signed(pct(row.b, row.a))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card prose-wide">
        <h2>Sube tu prueba estática</h2>
        <p>
          Un archivo CSV (se puede guardar desde Excel) con una columna de <b>tiempo</b>, una de <b>fuerza</b> y, si la mediste, una de{" "}
          <b>temperatura</b> en °C. Las unidades se reconocen por el encabezado, por ejemplo <code>Tiempo (ms)</code> o <code>Fuerza (g)</code>,
          y las puedes corregir abajo.
        </p>
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <input type="file" accept=".csv,.txt,.tsv,text/csv" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
          <button type="button" className="btn small" onClick={() => downloadFile("prueba-estatica.csv", STATIC_TEST_TEMPLATE, "text/csv")}>Descargar plantilla CSV</button>
          {file && <button type="button" className="btn small" onClick={() => { onFile(null); setError(""); }}>Quitar archivo</button>}
        </div>
        {error && <div className="alert error">{error}</div>}
        {file && (
          <>
            <div className="form-grid">
              <SelectField label="Columna de tiempo" value={String(file.timeCol)} options={columns} onChange={(v) => set({ timeCol: Number(v) })} />
              <SelectField label="Unidad de tiempo" value={file.timeUnit} options={TIME_UNITS} onChange={(timeUnit) => set({ timeUnit })} />
              <SelectField label="Columna de fuerza" value={String(file.forceCol)} options={columns} onChange={(v) => set({ forceCol: Number(v) })} />
              <SelectField label="Unidad de fuerza" value={file.forceUnit} options={FORCE_UNITS} onChange={(forceUnit) => set({ forceUnit })} />
              <SelectField label="Columna de temperatura" value={String(file.tempCol)} options={[{ value: "-1", label: "(no medí temperatura)" }, ...columns]} onChange={(v) => set({ tempCol: Number(v) })} />
            </div>
            {typeof test === "string" && <div className="alert error" style={{ marginTop: 8 }}>{test}</div>}
            {ok && (
              <p className="hint" style={{ marginTop: 8 }}>
                {file.name}: {file.table.rows.length} lecturas. Le restamos la lectura en reposo (tara) de {format(ok.tare, 3)} N y movimos el tiempo para que el
                encendido (la primera lectura arriba del 5 % del empuje máximo) quede en t = 0.
              </p>
            )}
          </>
        )}
        {!file && <p className="hint">Este archivo no se guarda en tu proyecto: si cierras la página, vuelve a subirlo.</p>}
      </div>

      <div className="card prose-wide">
        <h2>Fabricante, certificación y tu prueba</h2>
        <div className="table-scroll">
          <table className="summary">
            <thead>
              <tr><th /><th className="num">Fabricante</th><th className="num">Certificación NAR</th><th className="num">Tu prueba</th><th className="num">Diferencia con el fabricante</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td className="num">{format(row.maker, row.digits)} {row.unit}</td>
                  <td className="num">{format(row.cert, row.digits)} {row.unit}</td>
                  <td className="num">{row.own !== undefined ? `${format(row.own, row.digits)} ${row.unit}` : "–"}</td>
                  <td className="num">{row.own !== undefined ? signed(pct(row.own, row.maker)) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          {ok
            ? "¿De dónde pueden venir las diferencias? Piensa en la calibración de la celda de carga, cuántas lecturas por segundo toma, la temperatura del motor y que cada motor fabricado es distinto."
            : "Sube tu prueba para llenar la columna «Tu prueba»."}
        </p>
      </div>

      {ok && ok.temperature.length > 1 && (
        <div className="card">
          <h2>Temperatura contra tiempo</h2>
          <LineChart
            title="Temperatura del motor"
            xLabel="Tiempo desde el encendido (s)"
            yLabel="Temperatura (°C)"
            series={[{ label: "Tu medición", points: ok.temperature, color: "#b3261e" }]}
            height={240}
          />
          <p>
            Empezó en <b>{format(ok.startTemperature ?? 0, 1)} °C</b> y llegó a <b>{format(ok.maxTemperature ?? 0, 1)} °C</b>
            {ok.maxTemperatureTime !== null && <> a los {format(ok.maxTemperatureTime, 2)} s del encendido</>}. El empuje terminó a los{" "}
            {format(ok.burnTime, 2)} s: ¿se calentó el motor mientras empujaba o siguió subiendo la temperatura después?
          </p>
        </div>
      )}

      <div className="card prose-wide">
        <h2>Del motor al vuelo</h2>
        <p>
          {model === "real"
            ? "La simulación usa la curva de certificación para calcular cuánto empuja el motor en cada instante. Si tu prueba se parece a ella, puedes confiar en la predicción del vuelo; si no, ya sabes por dónde empezar a explicar las diferencias."
            : `La simulación está usando una fuerza constante de ${format(avg.force, 2)} N durante ${format(avg.burnTime, 2)} s. Compara tu prueba con el rectángulo: ¿en qué momentos tu motor empuja más y en cuáles menos?`}
        </p>
        <div className="btn-row">
          <button type="button" className="btn" onClick={() => onGo("cohete")}>Diseñar mi cohete</button>
        </div>
      </div>
    </div>
  );
}
