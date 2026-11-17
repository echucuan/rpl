import { useMemo, useState, type ReactNode } from "react";
import { CATALOG, CHALLENGE, catalogClass, fullName, thrustCurveUrl, type CatalogMotor } from "../../motorCatalog";
import { MOTORS } from "../../motor";
import { SelectField, format } from "../fields";
import { LineChart, type Series } from "../LineChart";

export type Spec = { label: string; value: string; unit: string; alt?: ReactNode; tone?: string };

export function SpecList({ items }: { items: Spec[] }) {
  return (
    <dl className="motor-specs">
      {items.map((s) => (
        <div key={s.label} className={s.tone}>
          <dt>{s.label}</dt>
          <dd>{s.value}{s.unit && <small>{s.unit}</small>}</dd>
          <span className="motor-alt">{s.alt ?? " "}</span>
        </div>
      ))}
    </dl>
  );
}

const PURPLE = "#6b3fa0";
/** Inner diameter of the challenge's motor mount: only 13 mm motors fit. */
const MOUNT_BORE = 13;

const CLASSES = ["A", "B", "C", "D"] as const;
const byClass = (c: string) => CATALOG.filter((m) => catalogClass(m) === c);
/** The delay a motor starts with: the challenge's 3 s if it has it, otherwise the middle one (not the booster). */
const startDelay = (m: CatalogMotor) => (m.delays.includes(CHALLENGE.delay) ? CHALLENGE.delay : m.delays.filter((x) => x > 0)[Math.floor(m.delays.filter((x) => x > 0).length / 2)] ?? m.delays[0]);

/** NAR impulse range of a class letter: A is 1.26–2.5 N·s and each next letter doubles it. */
export function classRange(letter: string): string {
  const i = "ABCDEFG".indexOf(letter);
  if (i < 0) return "";
  const hi = 2.5 * 2 ** i;
  return `${format(hi / 2 + 0.01, 2)} a ${format(hi, 2)} N·s`;
}

const delayText = (s: number) => (s === 0 ? "sin carga de eyección: es para la primera etapa de un cohete de dos etapas" : `el paracaídas sale ${s} s después de apagarse`);

/**
 * "Elige tu motor": the Estes motors of classes A to D, with their thrust curve, to compare them with the A10-3T.
 * Only for looking: the design keeps the challenge's A10-3T (the only one that fits the 13 mm motor mount), so
 * nothing chosen here is saved. `challengeKey` is the A10-3T's main figures (with the check of the
 * student's rocket against its maximum lift-off mass).
 */
export function MotorExplorer({ challengeKey }: { challengeKey: Spec[] }) {
  const [name, setName] = useState(CHALLENGE.name);
  const [delay, setDelay] = useState(CHALLENGE.delay);
  const m = CATALOG.find((x) => x.name === name) ?? CATALOG[0];
  const letter = catalogClass(m);
  const isChallenge = m.name === CHALLENGE.name && delay === CHALLENGE.delay;
  const a10 = MOTORS["A10-3T"];

  const pick = (next: CatalogMotor) => {
    setName(next.name);
    setDelay(startDelay(next));
  };

  const fits = m.diameter <= MOUNT_BORE;
  const keySpecs: Spec[] = isChallenge
    ? challengeKey
    : [
        { label: "Clase de impulso", value: letter, unit: "", alt: classRange(letter) },
        { label: "Impulso total", value: format(m.impulse, 2), unit: "N·s", alt: `${format(m.impulse / MOTORS["A10-3T"].rated.impulse, 1)} × el A10-3T` },
        { label: "Empuje máximo", value: format(m.maxThrust, 1), unit: "N" },
        { label: "Empuje promedio", value: format(m.averageThrust, 1), unit: "N" },
        { label: "Duración del empuje", value: format(m.burnTime, 2), unit: "s" },
        { label: "Retardo", value: String(delay), unit: "s", alt: delayText(delay) },
      ];
  // Its measures: whether it fits the motor mount, its length and masses.
  const sheet: Spec[] = [
    { label: "Diámetro", value: String(m.diameter), unit: "mm", alt: fits ? "✓ cabe en tu porta motor" : `✗ no cabe: tu porta motor es de ${MOUNT_BORE} mm`, tone: fits ? "ok" : "bad" },
    { label: "Longitud", value: format(m.length / 10, 1), unit: "cm" },
    { label: "Masa del motor", value: format(m.mass, 1), unit: "g" },
    { label: "Masa del propelente", value: format(m.propellant, 1), unit: "g", alt: `retardos a la venta: ${m.delays.join(" · ")} s` },
  ];
  const series = useMemo<Series[]>(() => {
    const curve = (c: { time: number[]; thrust: number[] }) => c.time.map((x, i) => ({ x, y: c.thrust[i] }));
    if (m.name === CHALLENGE.name)
      return [
        { label: "Certificación NAR", points: curve(a10.certified), color: PURPLE, fill: true },
        { label: "Gráfica de Estes", points: curve(a10.makerCurve), color: "#5b6270", dashed: true },
      ];
    return [
      { label: `Estes ${m.name}`, points: curve(m), color: PURPLE, fill: true, bold: true },
      { label: "A10-3T (motor del reto)", points: curve(a10.certified), color: "#5b6270", dashed: true },
    ];
  }, [m, a10]);
  const xMax = Math.ceil((Math.max(m.burnTime, 1.06) + 0.15) * 10) / 10;

  return (
    <>
      <div className="explorer-top">
        <div className="form-grid motor-choice explorer-picks">
          <SelectField label="Fabricante" value="estes" options={[{ value: "estes", label: "Estes" }]} onChange={() => {}} />
          <SelectField
            label="Clase"
            value={letter}
            options={CLASSES.map((c) => ({ value: c, label: `${c} · ${classRange(c)}` }))}
            onChange={(c) => pick(byClass(c)[0])}
          />
          <SelectField
            label="Motor"
            value={m.name}
            options={byClass(letter).map((x) => ({ value: x.name, label: `${x.name} · ${x.diameter} mm` }))}
            onChange={(n) => pick(CATALOG.find((x) => x.name === n)!)}
          />
          <SelectField
            label="Retardo"
            value={String(delay)}
            options={m.delays.map((s) => ({ value: String(s), label: s === 0 ? "0 s (sin eyección)" : `${s} s` }))}
            onChange={(s) => setDelay(Number(s))}
          />
        </div>
        {isChallenge ? (
          <p className="explorer-note ok">
            <span><b>Estes {fullName(m, delay)}: el motor del reto.</b> Con él vuela tu cohete en todo el simulador.</span>
            <small>Datos de Estes (<a href={a10.url} target="_blank" rel="noreferrer">página del motor</a>); curva de la NAR. Cada motor real es un poco distinto: por eso lo mides en la prueba estática.</small>
          </p>
        ) : (
          <div className="explorer-note">
            <p>
              <span><b>Solo para comparar.</b> Tu cohete vuela con el <b>Estes A10-3T</b>: el que cabe en tu porta motor y el que se guarda en tu diseño.</span>
              <small>Datos y curva: {m.source} (<a href={thrustCurveUrl(m)} target="_blank" rel="noreferrer">ficha del {m.name}</a>).</small>
            </p>
            <button type="button" className="btn" onClick={() => pick(CATALOG.find((x) => x.name === CHALLENGE.name)!)}>Ver el A10-3T</button>
          </div>
        )}
      </div>

      <div className="explorer-body stage-cols stage-fill">
        <div className="motor-sheet">
          <section className="motor-group perf key-specs explorer-key"><SpecList items={keySpecs} /></section>
          <section className="motor-group body explorer-measures"><SpecList items={sheet} /></section>
        </div>
        <LineChart title={`Curva de empuje: Estes ${fullName(m, delay)}`} xLabel="Tiempo desde el encendido (s)" yLabel="Empuje (N)" series={series} xMin={0} xMax={xMax} height="fill" />
      </div>
    </>
  );
}
