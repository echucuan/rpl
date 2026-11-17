import { useMemo, useRef, useState, type ReactNode } from "react";
import type { EstesDesign } from "../../model";
import { MEAN_TEST, averageThrust, curveImpulse, impulseClass, makerName, measuredCurve, motorSpec, type MotorTest, type ThrustModel } from "../../motor";
import { simulate, type FlightResult } from "../../physics/simulate";
import { InfoTip, SelectField, format } from "../fields";
import { LineChart, type Series } from "../LineChart";
import { MotorExplorer, classRange, type Spec } from "./MotorExplorer";
import { parseTable } from "../realData";
import { analyzeStaticTest, guessStaticColumns, STATIC_TEST_TEMPLATE, type ForceUnit, type StaticTestResult, type TimeUnit } from "../staticTest";
import { downloadFile } from "../storage";
import type { SubTab } from "../Workspace";
import { Eq } from "./common";
import { useStage } from "../stage";

/** Colour of Rocket Tec's phase 0 (no flight phase uses it). */
export const STATIC_TEST_COLOR = "#6b3fa0";

const r = String.raw;

/** Colour of the constant average thrust (also used in phase I). */
export const AVERAGE_COLOR = "#e0701b";

export const THRUST_MODEL_TIPS: Record<ThrustModel, string> = {
  real: "Usa la curva de certificación de la NAR, punto por punto: el motor tal como lo certificaron.",
  average: "Usa una fuerza constante igual al empuje promedio (mismo impulso y misma duración) y una masa constante (se ignora el combustible quemado). Simplifica los cálculos a mano, pero las predicciones no serán tan correctas: el modelo no tiene el pico inicial del motor.",
  measured: "Usa la curva de tu propia prueba estática (o el promedio de tus pruebas): el vuelo se calcula con el motor que tú mediste.",
};

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
/** How far from the certified motor: within 10 % is a match, within 25 % worth a look, beyond that something is off. */
const tone = (v: number) => (!Number.isFinite(v) ? "" : Math.abs(v) <= 10 ? "ok" : Math.abs(v) <= 25 ? "warn" : "bad");

/** One colour per uploaded test, kept on every chart; the mean of several tests is drawn in dark ink. */
const TEST_COLORS = ["#b3261e", "#0f8a9d", "#c9a227", "#1d7a3e", "#a35f2a", "#7a4fb0"];
const MEAN_COLOR = "#1f2430";
const testColor = (i: number) => TEST_COLORS[i % TEST_COLORS.length];


const newId = () => `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

type Good = { test: MotorTest; result: StaticTestResult };

/** The four pages of "Prueba tu motor", like the flight phases: Elige, Prueba, Compara, Decide. */
export type MotorPart = 1 | 2 | 3 | 4;

/** The short status under each motor step in the menu. */
export function motorStepNotes(d: EstesDesign): Record<MotorPart, string> {
  const spec = motorSpec(d.motor.id);
  const runs = (d.motor.tests ?? []).map((t) => analyzeStaticTest(t)).filter((x): x is StaticTestResult => typeof x !== "string");
  const impulse = runs.length ? runs.reduce((s, x) => s + x.impulse, 0) / runs.length : null;
  const used = d.motor.thrust === "average" ? "empuje promedio" : d.motor.thrust === "measured" && runs.length ? "tu prueba" : "certificación NAR";
  return {
    1: `${makerName(spec.maker)} ${spec.name} · clase ${impulseClass(spec.rated.impulse)}`,
    2: runs.length ? `✓ ${runs.length} ${runs.length === 1 ? "prueba" : "pruebas"}` : "sube tu prueba estática",
    3: impulse !== null ? `clase ${impulseClass(impulse)} · ${signed(pct(impulse, curveImpulse(spec.certified)))}` : "tu curva contra la NAR",
    4: `simulas con: ${used}`,
  };
}

/**
 * Phase 0 of Rocket Tec, "Prueba tu motor": choose the motor, measure it on the load cell, compare it with the
 * certified motor and decide which thrust the simulation uses. The tests are saved with the project.
 */
export function StaticTestLesson({ design: d, part, onChange, onGo }: {
  design: EstesDesign;
  part: MotorPart;
  onChange: (d: EstesDesign) => void;
  onGo: (s: SubTab) => void;
}) {
  const spec = motorSpec(d.motor.id);
  const maker = makerName(spec.maker);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [chart, setChart] = useState<"force" | "temp">("force");
  const input = useRef<HTMLInputElement>(null);
  const tests = useMemo(() => d.motor.tests ?? [], [d.motor.tests]);
  const analyses = useMemo(() => tests.map((t) => ({ test: t, result: analyzeStaticTest(t) })), [tests]);
  const good = analyses.filter((a): a is Good => typeof a.result !== "string");
  const avgOf = (k: "impulse" | "maxThrust" | "burnTime" | "averageThrust") => good.reduce((s, a) => s + a.result[k], 0) / good.length;
  const mean = good.length ? { impulse: avgOf("impulse"), maxThrust: avgOf("maxThrust"), burnTime: avgOf("burnTime"), averageThrust: avgOf("averageThrust") } : null;
  const spread = good.length > 1 && mean
    ? ((Math.max(...good.map((a) => a.result.impulse)) - Math.min(...good.map((a) => a.result.impulse))) / mean.impulse) * 100
    : null;

  const avg = averageThrust(spec);
  const model: ThrustModel = d.motor.thrust === "average" ? "average" : d.motor.thrust === "measured" && good.length ? "measured" : "real";
  const testId = d.motor.testId && (d.motor.testId === MEAN_TEST || good.some((a) => a.test.id === d.motor.testId)) ? d.motor.testId : MEAN_TEST;
  const setMotor = (patch: Partial<EstesDesign["motor"]>) => onChange({ ...d, motor: { ...d.motor, ...patch } });
  const setModel = (thrust: ThrustModel) => thrust !== model && setMotor({ thrust });

  // The same rocket with each thrust model, to show what each choice changes.
  const hasGood = good.length > 0;
  const predictions = useMemo(() => {
    const run = (thrust: ThrustModel) => {
      const res = simulate({ ...d, motor: { ...d.motor, thrust, testId } });
      return typeof res === "string" ? null : res;
    };
    return { real: run("real"), average: run("average"), measured: hasGood ? run("measured") : null };
  }, [d, testId, hasGood]);

  const certified = {
    impulse: curveImpulse(spec.certified),
    maxThrust: Math.max(...spec.certified.thrust),
    burnTime: spec.certified.time[spec.certified.time.length - 1],
  };
  const rows = [
    { label: "Impulso total", unit: "N·s", digits: 2, cert: certified.impulse, maker: spec.rated.impulse, own: mean?.impulse },
    { label: "Empuje máximo", unit: "N", digits: 1, cert: certified.maxThrust, maker: spec.rated.maxThrust, own: mean?.maxThrust },
    { label: "Duración del empuje", unit: "s", digits: 2, cert: certified.burnTime, maker: spec.rated.burnTime, own: mean?.burnTime },
    { label: "Empuje promedio", unit: "N", digits: 2, cert: certified.impulse / certified.burnTime, maker: spec.rated.impulse / spec.rated.burnTime, own: mean?.averageThrust },
  ];
  const impulseDiff = mean ? pct(mean.impulse, certified.impulse) : NaN;
  const ownClass = mean ? impulseClass(mean.impulse) : null;

  const lastBurn = good.length ? Math.max(...good.map((a) => a.result.burnTime)) : 0;
  const xMax = Math.max(1.1, lastBurn + 0.3);
  const meanCurve = good.length > 1 ? measuredCurve(tests, MEAN_TEST) : null;
  const forceSeries = useMemo<Series[]>(() => {
    const s: Series[] = [
      { label: `Fabricante (${maker})`, points: spec.makerCurve.time.map((x, i) => ({ x, y: spec.makerCurve.thrust[i] })), color: STATIC_TEST_COLOR, fill: true },
      { label: "Certificación NAR", points: spec.certified.time.map((x, i) => ({ x, y: spec.certified.thrust[i] })), color: "#5b6270", dashed: true },
      { label: "Empuje promedio constante", points: [{ x: 0, y: 0 }, { x: 0, y: avg.force }, { x: avg.burnTime, y: avg.force }, { x: avg.burnTime, y: 0 }], color: AVERAGE_COLOR },
    ];
    const several = analyses.filter((a) => typeof a.result !== "string").length > 1;
    analyses.forEach((a, i) => {
      if (typeof a.result !== "string") s.push({ label: a.test.name, points: a.result.force.filter((p) => p.x >= -0.1 && p.x <= xMax), color: testColor(i), thin: several });
    });
    if (meanCurve) s.push({ label: "Promedio de tus pruebas", points: meanCurve.time.map((x, i) => ({ x, y: meanCurve.thrust[i] })), color: MEAN_COLOR, bold: true });
    return s;
  }, [spec, maker, analyses, meanCurve, xMax, avg.force, avg.burnTime]);
  // Decide: the thrust each choice puts in the calculations, the chosen one in front.
  const usedCurve = hasGood ? measuredCurve(tests, testId) : null;
  const decideSeries = useMemo<Series[]>(() => {
    const options: { id: ThrustModel; label: string; color: string; points: { x: number; y: number }[] }[] = [
      { id: "real", label: "Certificación NAR", color: "#5b6270", points: spec.certified.time.map((x, i) => ({ x, y: spec.certified.thrust[i] })) },
      { id: "average", label: "Empuje promedio", color: AVERAGE_COLOR, points: [{ x: 0, y: 0 }, { x: 0, y: avg.force }, { x: avg.burnTime, y: avg.force }, { x: avg.burnTime, y: 0 }] },
    ];
    if (usedCurve) options.unshift({ id: "measured", label: testId === MEAN_TEST && good.length > 1 ? "Mi prueba (promedio)" : "Mi prueba", color: MEAN_COLOR, points: usedCurve.time.map((x, i) => ({ x, y: usedCurve.thrust[i] })) });
    const chosen = options.find((o) => o.id === model);
    return [
      ...options.filter((o) => o !== chosen).map((o) => ({ label: o.label, points: o.points, color: o.color, dashed: true, thin: true })),
      ...(chosen ? [{ label: `${chosen.label} (la que usas)`, points: chosen.points, color: chosen.color, fill: true, bold: true }] : []),
    ];
  }, [spec, avg.force, avg.burnTime, usedCurve, model, testId, good.length]);
  // Prueba: right after uploading, the readings as read (to catch a wrong column or unit), the certified curve behind.
  const readSeries: Series[] = [
    { label: "Certificación NAR", points: spec.certified.time.map((x, i) => ({ x, y: spec.certified.thrust[i] })), color: "#5b6270", dashed: true, thin: true },
    ...analyses.flatMap((a, i) => (typeof a.result !== "string" ? [{ label: a.test.name, points: a.result.force.filter((p) => p.x >= -0.1 && p.x <= xMax), color: testColor(i) }] : [])),
  ];
  const tempSeries: Series[] = analyses.flatMap((a, i) =>
    typeof a.result !== "string" && a.result.temperature.length > 1 ? [{ label: a.test.name, points: a.result.temperature, color: testColor(i) }] : [],
  );

  const addFiles = async (files: FileList | File[]) => {
    setError("");
    const added: MotorTest[] = [];
    const problems: string[] = [];
    for (const f of Array.from(files)) {
      const table = parseTable(await f.text());
      if (typeof table === "string") { problems.push(`${f.name}: ${table}`); continue; }
      added.push({ id: newId(), name: f.name.replace(/\.(csv|txt|tsv)$/i, ""), table, ...guessStaticColumns(table.headers) });
    }
    if (problems.length) setError(problems.join(" "));
    if (added.length) {
      setMotor({ tests: [...tests, ...added] });
      // A file whose columns could not be read opens its column choices right away.
      const bad = added.find((t) => typeof analyzeStaticTest(t) === "string");
      setEditing(bad ? bad.id : null);
    }
  };
  const updateTest = (id: string, patch: Partial<MotorTest>) => setMotor({ tests: tests.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const removeTest = (id: string) => {
    const rest = tests.filter((t) => t.id !== id);
    setMotor({
      tests: rest.length ? rest : undefined,
      testId: d.motor.testId === id ? MEAN_TEST : d.motor.testId,
      // Without tests there is nothing to fly with: back to the certified curve.
      thrust: d.motor.thrust === "measured" && !rest.length ? "real" : d.motor.thrust,
    });
    if (editing === id) setEditing(null);
  };

  const liftoff = predictions.real?.liftoffMass ?? null;
  const tooHeavy = liftoff !== null && liftoff > spec.rated.maxLiftoffMass;
  const letter = impulseClass(spec.rated.impulse);
  const keySpecs: Spec[] = [
    { label: "Clase de impulso", value: letter, unit: "", alt: classRange(letter) },
    { label: "Impulso total", value: format(spec.rated.impulse, 2), unit: "N·s" },
    { label: "Empuje máximo", value: format(spec.rated.maxThrust, 1), unit: "N" },
    { label: "Duración del empuje", value: format(spec.rated.burnTime, 2), unit: "s" },
    { label: "Retardo", value: String(spec.delay), unit: "s", alt: `el paracaídas sale ${spec.delay} s después de apagarse` },
    {
      label: "Masa máxima al despegar",
      value: String(spec.rated.maxLiftoffMass),
      unit: "g",
      alt: liftoff === null ? undefined : `tu cohete: ${format(liftoff, 1)} g ${tooHeavy ? "⚠ pesa demasiado" : "✓"}`,
      tone: liftoff === null ? undefined : tooHeavy ? "bad" : "ok",
    },
  ];

  // Every page of the step in the same window: see src/ui/stage.tsx.
  const stage = useStage(part);

  const HEADS: Record<MotorPart, { title: string; text: ReactNode }> = {
    1: {
      title: "Elige tu motor",
      text: <>Explora los motores Estes de clase A a D, su curva de empuje y sus retardos, y compáralos con el A10-3T, el de tu cohete.</>,
    },
    2: {
      title: "Prueba estática",
      text: <>Enciendes tu motor sujeto a un banco y una celda de carga mide cuánto empuja en cada instante.</>,
    },
    3: { title: "Compara", text: <>Tu curva encima de la certificada: ¿qué clase de motor tienes y qué tanto se parece al {spec.name}?</> },
    4: { title: "Decide", text: <>¿Con qué empuje simulamos tu vuelo? Tu elección se usa en todo el simulador.</> },
  };

  return (
    <div className="lesson static-test">
      <div className="lesson-head card step-head">
        <h2><span className="phase-title-num" style={{ background: STATIC_TEST_COLOR }}>{part}</span> {HEADS[part].title}</h2>
        <p>{HEADS[part].text}</p>
      </div>

      {part === 1 && (
      <div ref={stage} className="card prose-wide motor-explorer step-stage">
        <MotorExplorer challengeKey={keySpecs} />
      </div>
      )}

      {part === 2 && (
      <div ref={stage} className="card prose-wide step-stage">
        {!tests.length && (
          <p className="why-note">
            <b>¿Por qué importa?</b> Cada motor real empuja un poco distinto de lo que publica el fabricante, y de ese empuje
            dependen la altura, la velocidad y el momento en que se abre el paracaídas. Hazla con seguridad y sube las lecturas:
            un archivo CSV por motor.
          </p>
        )}
        <div className={`stage-fill ${tests.length ? "mide-grid stage-cols" : "mide-empty"}`}>
        <div className="mide-left">
        <div className="tips-row">
        <details className="more safety" open={!tests.length}>
          <summary>⚠️ Antes de encender: seguridad</summary>
          <ul>
            <li>Solo con el profesor presente, en un lugar abierto y lejos de material que arda.</li>
            <li>El motor bien sujeto al banco de pruebas, con la tobera apuntando lejos de las personas.</li>
            <li>Encendido <b>eléctrico</b> a distancia (al menos 5 m) y cuenta regresiva en voz alta.</li>
            <li>Lentes de seguridad para todos; extintor o cubeta con agua a la mano.</li>
            <li>Si no enciende, espera 60 s antes de acercarte. Al terminar el motor queda muy caliente: no lo toques.</li>
          </ul>
        </details>
        <details className="more" open={!tests.length}>
          <summary>📏 Cómo tomar buenos datos</summary>
          <ul>
            <li><b>Tara</b> la celda de carga con el motor ya montado, antes de encender.</li>
            <li>Toma <b>al menos 100 lecturas por segundo</b> (mejor 500 o más): el pico dura menos de 0.1 s.</li>
            <li>Empieza a grabar <b>1 s antes</b> del encendido y sigue <b>1 s después</b> de que termine el empuje.</li>
            <li>Escribe las unidades en el encabezado, por ejemplo <code>Tiempo (ms)</code>, <code>Fuerza (g)</code>, <code>Temperatura (°C)</code>.</li>
            <li>Si pruebas varios motores, sube un archivo por cada uno: así ves cuánto cambian entre sí.</li>
          </ul>
        </details>
        </div>

        <div className="mide-upload">
        <div
          className={`dropzone${dragging ? " over" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files); }}
        >
          <span className="dropzone-icon" aria-hidden="true">📈</span>
          <b>{tests.length ? "Agrega otra prueba" : "Sube tu prueba estática"}</b>
          <span>Arrastra aquí tu archivo CSV o haz clic para elegirlo. Puedes subir varios.</span>
          <input ref={input} type="file" accept=".csv,.txt,.tsv,text/csv" multiple hidden onChange={(e) => { if (e.target.files?.length) void addFiles(e.target.files); e.target.value = ""; }} />
        </div>
        <div className="btn-row" style={{ marginTop: 8 }}>
          <button type="button" className="btn small" onClick={() => downloadFile("prueba-estatica.csv", STATIC_TEST_TEMPLATE, "text/csv")}>Descargar plantilla CSV</button>
          <span className="hint">Columnas: tiempo, fuerza y, si la mediste, temperatura. Se puede guardar desde Excel.</span>
        </div>
        </div>
        {good.length > 0 && <LineChart title="Así se leyeron tus pruebas" xLabel="Tiempo desde el encendido (s)" yLabel="Empuje (N)" series={readSeries} xMin={-0.1} xMax={xMax} height="fill" />}
        </div>
        <div className="mide-right stage-scroll">
        {error && <div className="alert error" style={{ marginTop: 8 }}>{error}</div>}

        {analyses.length > 0 && (
          <ul className="test-list">
            {analyses.map(({ test, result }, i) => {
              const columns = test.table.headers.map((h, k) => ({ value: String(k), label: h }));
              return (
                <li key={test.id} className={typeof result === "string" ? "bad" : ""}>
                  <div className="test-row">
                    <span className="test-dot" style={{ background: testColor(i) }} aria-hidden="true" />
                    <span className="test-name">
                      <b>{test.name}</b>
                      <small>
                        {typeof result === "string"
                          ? `⚠ ${result}`
                          : `✓ ${test.table.rows.length} lecturas · impulso ${format(result.impulse, 2)} N·s · clase ${impulseClass(result.impulse)} · empuje máximo ${format(result.maxThrust, 1)} N`}
                      </small>
                    </span>
                    <button type="button" className="btn small" aria-expanded={editing === test.id} onClick={() => setEditing(editing === test.id ? null : test.id)}>Columnas</button>
                    <button type="button" className="btn small" onClick={() => removeTest(test.id)} aria-label={`Quitar ${test.name}`}>Quitar</button>
                  </div>
                  {editing === test.id && (
                    <div className="form-grid">
                      <SelectField label="Columna de tiempo" value={String(test.timeCol)} options={columns} onChange={(v) => updateTest(test.id, { timeCol: Number(v) })} />
                      <SelectField label="Unidad de tiempo" value={test.timeUnit} options={TIME_UNITS} onChange={(timeUnit) => updateTest(test.id, { timeUnit })} />
                      <SelectField label="Columna de fuerza" value={String(test.forceCol)} options={columns} onChange={(v) => updateTest(test.id, { forceCol: Number(v) })} />
                      <SelectField label="Unidad de fuerza" value={test.forceUnit} options={FORCE_UNITS} onChange={(forceUnit) => updateTest(test.id, { forceUnit })} />
                      <SelectField label="Columna de temperatura" value={String(test.tempCol)} options={[{ value: "-1", label: "(no medí temperatura)" }, ...columns]} onChange={(v) => updateTest(test.id, { tempCol: Number(v) })} />
                      {typeof result !== "string" && (
                        <p className="hint full">{result.flipped && <>Tu sensor marcó el empuje como fuerza negativa (así miden los sensores PASCO al empujarlos): le cambiamos el signo. </>}Le restamos la lectura en reposo (tara) de {format(result.tare, 3)} N y movimos el tiempo para que el encendido (la primera lectura arriba del 5 % del empuje máximo) quede en t = 0.</p>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {tests.length > 0 && <p className="hint">Tus pruebas se guardan con el diseño y en el archivo que descargas.</p>}
        </div>
        </div>
      </div>
      )}

      {part === 3 && (
        <>
      <div ref={stage} className="card step-stage">
        {mean && ownClass && (
          <div className={`motor-verdict ${tone(impulseDiff)}`}>
            <span className="motor-verdict-class" aria-hidden="true">{ownClass}</span>
            <div>
              <b>Tu motor es clase {ownClass}</b> ({format(mean.impulse, 2)} N·s{good.length > 1 ? `, promedio de ${good.length} pruebas` : ""}; la clase {ownClass} va de {classRange(ownClass)}).{" "}
              {tone(impulseDiff) === "bad"
                ? <>⚠ Muy distinto del {spec.name} certificado ({signed(impulseDiff)}): revisa la tara, las unidades y las lecturas por segundo.</>
                : <>{tone(impulseDiff) === "ok" ? "✓" : "≈"} Se comporta como un {spec.name} certificado ({signed(impulseDiff)}).</>}
              {spread !== null && <> Entre tus pruebas el impulso cambia {format(spread, 0)} %.</>}
            </div>
          </div>
        )}
        {!mean && (
          <p className="hint">
            Sube tu prueba para ver tu curva encima de la certificada y la del fabricante.{" "}
            <button type="button" className="link" onClick={() => onGo("motor2")}>Ir a Prueba</button>
          </p>
        )}
        <div className="cmp-grid stage-cols stage-fill">
        <div className="cmp-chart">
        {tempSeries.length > 0 && (
          <div className="thrust-model chart-range" role="group" aria-label="Gráfica">
            <button type="button" className={`btn small ${chart === "force" ? "primary" : ""}`} aria-pressed={chart === "force"} onClick={() => setChart("force")}>Empuje</button>
            <button type="button" className={`btn small ${chart === "temp" ? "primary" : ""}`} aria-pressed={chart === "temp"} onClick={() => setChart("temp")}>Temperatura</button>
          </div>
        )}
        {chart === "temp" && tempSeries.length > 0
          ? <LineChart title="Temperatura del motor" xLabel="Tiempo desde el encendido (s)" yLabel="Temperatura (°C)" series={tempSeries} height="fill" />
          : <LineChart title={`Empuje del motor ${spec.name}: F(t)`} xLabel="Tiempo desde el encendido (s)" yLabel="Empuje (N)" series={forceSeries} xMin={good.length ? -0.1 : 0} xMax={xMax} height="fill" />}
        {chart === "temp" && good.length === 1 && good[0].result.startTemperature !== null && (
          <p className="hint">
            Empezó en <b>{format(good[0].result.startTemperature ?? 0, 1)} °C</b> y llegó a <b>{format(good[0].result.maxTemperature ?? 0, 1)} °C</b>
            {good[0].result.maxTemperatureTime !== null && <> a los {format(good[0].result.maxTemperatureTime, 2)} s del encendido</>}; el empuje terminó a los{" "}
            {format(good[0].result.burnTime, 2)} s. ¿Se calentó mientras empujaba o después?
          </p>
        )}
        </div>
        <div className="cmp-side stage-scroll">

        <div className="table-scroll">
          <table className="summary compare-table">
            <thead>
              <tr><th /><th className="num">Certificación NAR</th><th className="num">{good.length > 1 ? "Tus pruebas" : "Tu prueba"}</th><th className="num">Diferencia</th><th className="num muted">Fabricante</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const diff = row.own !== undefined ? pct(row.own, row.cert) : NaN;
                return (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td className="num">{format(row.cert, row.digits)} {row.unit}</td>
                    <td className="num"><b>{row.own !== undefined ? `${format(row.own, row.digits)} ${row.unit}` : "–"}</b></td>
                    <td className="num"><span className={`diff ${tone(diff)}`}>{signed(diff)}</span></td>
                    <td className="num muted">{format(row.maker, row.digits)} {row.unit}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          Diferencia contra la certificación: <span className="diff ok">hasta 10 %</span> <span className="diff warn">hasta 25 %</span> <span className="diff bad">más de 25 %</span>.
        </p>
        <div className="chart-key">
          <b>¿Qué muestra la gráfica?</b>
          <ul>
            {good.length > 0 && <li><i style={{ background: good.length > 1 ? MEAN_COLOR : testColor(0) }} />{good.length > 1 ? "Promedio de tus pruebas (sin tara, encendido en t = 0)" : "Tu prueba (sin tara, encendido en t = 0)"}</li>}
            <li><i className="dashed" style={{ borderColor: "#5b6270" }} />Certificación NAR: la referencia oficial</li>
            <li><i style={{ background: STATIC_TEST_COLOR }} />Fabricante: gráfica de {maker}, aproximada</li>
            <li><i style={{ background: AVERAGE_COLOR }} />Empuje promedio: mismo impulso, fuerza constante</li>
          </ul>
          <span>El área bajo cada curva es el <b>impulso total</b>: define la clase (la letra).</span>
        </div>
        <p className="cmp-tips">
        <InfoTip heading="¿De dónde vienen las diferencias?" note={<>
        <p>
          La calibración de la celda, las lecturas por segundo, la temperatura del motor y que cada motor fabricado es distinto.
        </p>
        <p>
          El área bajo la curva es el <b>impulso total</b>: <Eq tex={r`I = \int_0^{t_b} F\,dt`} />, y su tamaño define la clase del motor (la letra). Fíjate en la forma: un pico fuerte para despegar y después un empuje bajo y casi constante.
        </p>
        </>}>¿De dónde vienen las diferencias?</InfoTip>
        </p>
        </div>
        </div>
      </div>
        </>
      )}

      {part === 4 && (
      <div ref={stage} className="card prose-wide step-stage">
        <div className="decide-grid stage-cols stage-fill">
        <div>
        <div className="thrust-model three" role="group" aria-label="Modelo de empuje para todos los cálculos">
          {([
            { id: "measured", title: "Mi prueba", sub: good.length ? "el motor que mediste" : "sube una prueba primero" },
            { id: "real", title: "Certificación NAR", sub: "la curva oficial del motor" },
            { id: "average", title: "Empuje promedio", sub: "fuerza constante, más simple" },
          ] as { id: ThrustModel; title: string; sub: string }[]).map((o) => (
            <button key={o.id} type="button" className={`btn ${model === o.id ? "primary" : ""}`} aria-pressed={model === o.id} title={THRUST_MODEL_TIPS[o.id]} disabled={o.id === "measured" && !good.length} onClick={() => setModel(o.id)}>
              {o.title}<small>{o.sub}</small>
            </button>
          ))}
        </div>
        {model === "measured" && good.length > 1 && (
          <div className="form-grid">
            <SelectField
              label="¿Cuál prueba?"
              value={testId}
              options={[{ value: MEAN_TEST, label: `Promedio de mis ${good.length} pruebas` }, ...good.map((a) => ({ value: a.test.id, label: a.test.name }))]}
              onChange={(v) => setMotor({ testId: v })}
            />
          </div>
        )}
        <LineChart title="El empuje que usarán tus cálculos" xLabel="Tiempo desde el encendido (s)" yLabel="Empuje (N)" series={decideSeries} xMin={0} xMax={Math.max(1.1, (usedCurve?.time.at(-1) ?? 0) + 0.15)} height="fill" />
        </div>
        <div>
        {predictions.real && predictions.average && (
          <div className="table-scroll">
            <table className="summary">
              <thead>
                <tr>
                  <th>Predicción con tu cohete</th>
                  {predictions.measured && <th className={`num ${model === "measured" ? "in-use" : ""}`}>Mi prueba</th>}
                  <th className={`num ${model === "real" ? "in-use" : ""}`}>Certificación NAR</th>
                  <th className={`num ${model === "average" ? "in-use" : ""}`}>Empuje promedio</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Apogeo", unit: "m", digits: 1, get: (x: FlightResult) => x.apogee.h },
                  { label: "Velocidad máxima", unit: "m/s", digits: 1, get: (x: FlightResult) => x.maxVelocity },
                  { label: "Tiempo hasta el apogeo", unit: "s", digits: 2, get: (x: FlightResult) => x.apogee.t },
                  { label: "Velocidad al salir de la guía", unit: "m/s", digits: 1, get: (x: FlightResult) => x.guideExit?.v ?? NaN },
                ].map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    {predictions.measured && <td className={`num ${model === "measured" ? "in-use" : ""}`}>{format(row.get(predictions.measured), row.digits)} {row.unit}</td>}
                    <td className={`num ${model === "real" ? "in-use" : ""}`}>{format(row.get(predictions.real!), row.digits)} {row.unit}</td>
                    <td className={`num ${model === "average" ? "in-use" : ""}`}>{format(row.get(predictions.average!), row.digits)} {row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <details className="more" open={!(predictions.real && predictions.average)}>
          <summary>Para profundizar: ¿qué es el empuje promedio?</summary>
          <p>
            Para simplificar el modelo matemático podemos cambiar la curva por una <b>fuerza constante</b>: el empuje promedio, que da el mismo
            impulso en el mismo tiempo. Así la segunda ley de Newton se resuelve con una fuerza que no cambia durante el empuje.
          </p>
          <Eq block tex={r`\bar F = \frac{I}{t_b} = \frac{${format(avg.impulse, 2)}\ \text{N·s}}{${format(avg.burnTime, 2)}\ \text{s}} = \mathbf{${format(avg.force, 2)}\ N} \qquad T(t) = \begin{cases} \bar F & 0 \le t < t_b \\ 0 & t \ge t_b \end{cases}`} />
        </details>
        <p className="hint">
          Tu elección se aplica a <b>todos los cálculos</b>: el vuelo, las gráficas, las fases I a IV y el script de MATLAB. Se guarda en tu proyecto.
        </p>
        {model === "average" && (
          <div className="alert warning">Estás usando el <b>empuje promedio</b>: los cálculos son más sencillos, pero las predicciones no son tan correctas como con una curva real.</div>
        )}
        </div>
        </div>
      </div>
      )}
    </div>
  );
}
