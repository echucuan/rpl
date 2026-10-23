import type { Design, EstesDesign, FinProfile, NoseShape, WaterDesign } from "../model";
import { KITS, MAX_PRESSURE_PSI } from "../model";
import {
  MOTORS, MOUNT_DIAMETERS, bodyTubeMass, impulseClass, motorById, noseConeMass, noseShapeOf, parachuteMass, partLabel, partsOf, type Part,
} from "../catalog";
import { finArea, layout, noseProperties } from "../physics/geometry";
import { NumField, Section, Segmented, SelectField, TextField, format } from "./fields";

type Update = (fn: (d: Design) => Design) => void;

const SHAPES: { value: NoseShape; label: string }[] = [
  { value: "ogive", label: "Ojival" },
  { value: "conical", label: "Cónica" },
  { value: "parabolic", label: "Parabólica" },
  { value: "elliptical", label: "Elíptica" },
];

const PROFILES: { value: FinProfile; label: string }[] = [
  { value: "square", label: "Cuadrado (sin lijar)" },
  { value: "rounded", label: "Redondeado" },
  { value: "airfoil", label: "Perfil aerodinámico" },
];

const NOSES = partsOf("noseCone").sort((a, b) => (a.outsideDiameter ?? 0) - (b.outsideDiameter ?? 0));
const TUBES = partsOf("bodyTube").sort((a, b) => (a.outsideDiameter ?? 0) - (b.outsideDiameter ?? 0) || (a.length ?? 0) - (b.length ?? 0));
const CHUTES = partsOf("parachute").sort((a, b) => (a.diameter ?? 0) - (b.diameter ?? 0));

function CatalogPicker({ label, parts, current, describe, onPick }: {
  label: string;
  parts: Part[];
  current?: string;
  describe: (p: Part) => string;
  onPick: (p: Part | null) => void;
}) {
  const index = parts.findIndex((p) => p.description === current);
  return (
    <SelectField
      className="full"
      label={label}
      value={index >= 0 ? String(index) : current ? "kit" : "own"}
      options={[
        { value: "own", label: "Pieza propia o impresa (escribe medidas y peso)" },
        ...(current && index < 0 ? [{ value: "kit", label: current }] : []),
        ...parts.map((p, i) => ({ value: String(i), label: describe(p) })),
      ]}
      onChange={(v) => {
        if (v === "kit") return;
        onPick(v === "own" ? null : parts[Number(v)]);
      }}
    />
  );
}

const mm = (v?: number) => `Ø ${format(v ?? 0, 1)} mm`;

export function DesignForm({ design: d, update, onLoadKit }: { design: Design; update: Update; onLoadKit?: (d: EstesDesign) => void }) {
  const l = layout(d);
  const set = <K extends keyof Design>(key: K, patch: Partial<Design[K]>) =>
    update((p) => ({ ...p, [key]: { ...(p[key] as object), ...patch } }) as Design);
  const isWater = d.type === "water";

  return (
    <div className="form">
      <Section title="Diseño">
        <TextField className="full" label="Nombre del cohete" value={d.name} onChange={(name) => update((p) => ({ ...p, name }))} />
        {!isWater && onLoadKit && (
          <SelectField
            className="full"
            label="Empezar desde un kit Estes"
            value=""
            options={[{ value: "", label: "Elegir kit…" }, ...KITS.map((k, i) => ({ value: String(i), label: k.name }))]}
            onChange={(v) => v !== "" && onLoadKit(KITS[Number(v)].design())}
          />
        )}
        <p className="hint full">
          Largo total: <b>{format(l.length / 10, 1)} cm</b>. Las posiciones se miden desde la punta de la nariz, en milímetros.
        </p>
      </Section>

      <Section title="Nariz" summary={`${format(d.nose.mass, 1)} g`}>
        <CatalogPicker
          label="Origen"
          parts={NOSES}
          current={d.nose.catalog}
          describe={(p) => `${partLabel(p)} · ${mm(p.outsideDiameter)}`}
          onPick={(p) => set("nose", p
            ? { catalog: p.description, shape: noseShapeOf(p), length: p.length ?? d.nose.length, diameter: p.outsideDiameter ?? d.nose.diameter, mass: round(noseConeMass(p)) }
            : { catalog: undefined })}
        />
        <SelectField label="Forma" value={d.nose.shape} options={SHAPES} onChange={(shape) => set("nose", { shape })} />
        <NumField label="Largo (sin hombro)" unit="mm" min={5} value={d.nose.length} onChange={(length) => set("nose", { length })} />
        <NumField label="Diámetro" unit="mm" min={5} value={d.nose.diameter} onChange={(diameter) => set("nose", { diameter })} />
        <NumField label="Masa" unit="g" min={0} value={d.nose.mass} onChange={(mass) => set("nose", { mass })} />
        {!d.nose.catalog && <p className="hint full">Superficie exterior: {format(noseProperties(d.nose.shape, d.nose.length, d.nose.diameter).surface / 100, 0)} cm². Pesa la pieza impresa en la báscula.</p>}
        {Math.abs(d.nose.diameter - d.body.diameter) > 0.5 && <p className="hint full">⚠ La nariz ({format(d.nose.diameter)} mm) y el {isWater ? "cuerpo" : "tubo"} ({format(d.body.diameter)} mm) no tienen el mismo diámetro.</p>}
      </Section>

      {d.type === "estes" ? <TubeSection d={d} set={set} /> : <BottleSection d={d} update={update} />}

      <Section title="Aletas" summary={`${d.fins.count} · ${format(d.fins.mass, 1)} g`}>
        <NumField label="Número de aletas" min={1} max={8} digits={0} value={d.fins.count} onChange={(count) => set("fins", { count: Math.round(count) })} />
        <SelectField label="Borde" value={d.fins.profile} options={PROFILES} onChange={(profile) => set("fins", { profile })} />
        <NumField label="Cuerda en la raíz" unit="mm" min={1} value={d.fins.rootChord} onChange={(rootChord) => set("fins", { rootChord })} title="Largo de la aleta pegada al cuerpo" />
        <NumField label="Cuerda en la punta" unit="mm" min={0} value={d.fins.tipChord} onChange={(tipChord) => set("fins", { tipChord })} />
        <NumField label="Altura (envergadura)" unit="mm" min={1} value={d.fins.span} onChange={(span) => set("fins", { span })} />
        <NumField label="Barrido" unit="mm" value={d.fins.sweep} onChange={(sweep) => set("fins", { sweep })} title="Distancia del borde de ataque en la raíz al de la punta" />
        <NumField label="Grosor" unit="mm" min={0.1} value={d.fins.thickness} onChange={(thickness) => set("fins", { thickness })} />
        <NumField label="Separación de la cola" unit="mm" value={d.fins.offsetFromAft} onChange={(offsetFromAft) => set("fins", { offsetFromAft })} title={isWater ? "Del inicio del hombro de la botella al borde de salida; negativo si la aleta baja sobre el hombro" : "Del extremo del tubo al borde de salida de la aleta"} />
        <NumField label="Masa del juego completo" unit="g" min={0} value={d.fins.mass} onChange={(mass) => set("fins", { mass })} />
        <p className="hint full">Volumen del juego: {format((d.fins.count * finArea(d.fins) * d.fins.thickness) / 1000, 1)} cm³. Si aún no las imprimes, multiplica por la densidad de tu PLA Aero; después pésalas.</p>
      </Section>

      {d.type === "estes" ? <MotorSection d={d} update={update} /> : <WaterSection d={d} update={update} />}

      <Section title="Recuperación" summary={d.recovery.kind === "parachute" ? `${format(d.recovery.diameter / 10, 0)} cm` : "sin paracaídas"}>
        <div className="full">
          <Segmented
            value={d.recovery.kind}
            options={[{ value: "parachute", label: "Paracaídas" }, { value: "none", label: "Sin paracaídas" }]}
            onChange={(kind) => set("recovery", { kind })}
          />
        </div>
        {d.recovery.kind === "parachute" && (
          <>
            <CatalogPicker
              label="Paracaídas"
              parts={CHUTES}
              current={d.recovery.catalog}
              describe={(p) => partLabel(p)}
              onPick={(p) => set("recovery", p ? { catalog: p.description, diameter: p.diameter ?? d.recovery.diameter, mass: round(parachuteMass(p)) } : { catalog: undefined })}
            />
            <NumField label="Diámetro" unit="mm" min={10} value={d.recovery.diameter} onChange={(diameter) => set("recovery", { diameter })} />
            <NumField label="Coef. de arrastre" min={0.1} max={2.5} value={d.recovery.cd} onChange={(cd) => set("recovery", { cd })} title="0.8 para paracaídas de plástico Estes" />
            <NumField label="Masa" unit="g" min={0} value={d.recovery.mass} onChange={(mass) => set("recovery", { mass })} />
            <NumField label="Posición" unit="mm" min={0} value={d.recovery.position} onChange={(position) => set("recovery", { position })} />
            {isWater ? (
              <SelectField
                className="full"
                label="Se abre"
                value={d.recovery.deployment === "ejection" ? "apogee" : d.recovery.deployment}
                options={[{ value: "apogee", label: "En el punto más alto (apogeo)" }, { value: "none", label: "No se abre (prueba balística)" }]}
                onChange={(deployment) => set("recovery", { deployment })}
              />
            ) : (
              <p className="hint full">Se abre con la carga de eyección del motor, al terminar el retardo.</p>
            )}
          </>
        )}
      </Section>

      <Section title="Masas adicionales" summary={`${d.extras.length}`} open={d.extras.length > 0}>
        {d.extras.map((e, i) => (
          <div className="extra-row" key={i}>
            <TextField label="Qué es" value={e.name} onChange={(name) => update((p) => ({ ...p, extras: p.extras.map((x, j) => (j === i ? { ...x, name } : x)) }))} />
            <NumField label="Masa" unit="g" min={0} value={e.mass} onChange={(mass) => update((p) => ({ ...p, extras: p.extras.map((x, j) => (j === i ? { ...x, mass } : x)) }))} />
            <NumField label="Posición" unit="mm" min={0} value={e.position} onChange={(position) => update((p) => ({ ...p, extras: p.extras.map((x, j) => (j === i ? { ...x, position } : x)) }))} />
            <button type="button" className="icon-btn" aria-label="Quitar" onClick={() => update((p) => ({ ...p, extras: p.extras.filter((_, j) => j !== i) }))}>✕</button>
          </div>
        ))}
        <div className="full">
          <button type="button" className="btn small" onClick={() => update((p) => ({ ...p, extras: [...p.extras, { name: isWater ? "Lastre" : "Altímetro", mass: 10, position: Math.round(l.bodyStart + 20) }] }))}>
            + Agregar masa
          </button>
        </div>
        <p className="hint full">Altímetro, lastre, cuerda elástica, algodón, soporte del motor… Cualquier cosa que viaje en el cohete.</p>
      </Section>

      <Section title="Lanzamiento" open={false}>
        <NumField label="Altitud del sitio" unit="m" value={d.launch.altitude} onChange={(altitude) => set("launch", { altitude })} />
        <NumField label="Temperatura" unit="°C" min={-20} max={50} value={d.launch.temperature} onChange={(temperature) => set("launch", { temperature })} />
        <NumField label="Largo de la guía" unit="m" min={0} max={5} value={d.launch.guideLength} onChange={(guideLength) => set("launch", { guideLength })} />
        <NumField
          label="Cd fijo (opcional)"
          min={0}
          max={3}
          value={d.cdOverride ?? 0}
          onChange={(v) => update((p) => ({ ...p, cdOverride: v > 0 ? v : undefined }))}
          title="Deja 0 para que RPL calcule el arrastre"
        />
        <p className="hint full">Valores de Culiacán por defecto. El lanzamiento siempre es vertical.</p>
      </Section>
    </div>
  );
}

const round = (v: number) => Math.round(v * 10) / 10;

function TubeSection({ d, set }: { d: EstesDesign; set: <K extends keyof Design>(key: K, patch: Partial<Design[K]>) => void }) {
  return (
    <Section title="Tubo del cuerpo" summary={`${format(d.body.mass, 1)} g`}>
      <CatalogPicker
        label="Origen"
        parts={TUBES}
        current={d.body.catalog}
        describe={(p) => `${partLabel(p)} · ${mm(p.outsideDiameter)}`}
        onPick={(p) => {
          if (!p) return set("body", { catalog: undefined, massPerMm: undefined });
          const mass = bodyTubeMass(p);
          set("body", { catalog: p.description, length: p.length ?? d.body.length, diameter: p.outsideDiameter ?? d.body.diameter, mass: round(mass), massPerMm: mass / (p.length ?? 1) });
        }}
      />
      <NumField
        label="Largo"
        unit="mm"
        min={10}
        value={d.body.length}
        onChange={(length) => set("body", d.body.massPerMm ? { length, mass: round(d.body.massPerMm * length) } : { length })}
        title={d.body.massPerMm ? "Si cortas el tubo, la masa se ajusta sola" : undefined}
      />
      <NumField label="Diámetro exterior" unit="mm" min={5} value={d.body.diameter} onChange={(diameter) => set("body", { diameter })} />
      <NumField label="Masa" unit="g" min={0} value={d.body.mass} onChange={(mass) => set("body", { mass, massPerMm: undefined })} />
    </Section>
  );
}

function BottleSection({ d, update }: { d: WaterDesign; update: Update }) {
  const setW = (fn: (w: WaterDesign) => WaterDesign) => update((p) => fn(p as WaterDesign));
  return (
    <Section title="Botella Topo Chico 1.5 L" summary={`${format(d.water.bottleMass, 0)} g vacía`}>
      <NumField label="Volumen de la botella" unit="L" min={0.2} max={3} value={d.water.bottleVolume} onChange={(bottleVolume) => setW((p) => ({ ...p, water: { ...p.water, bottleVolume } }))} />
      <NumField label="Masa de la botella vacía" unit="g" min={0} value={d.water.bottleMass} onChange={(bottleMass) => setW((p) => ({ ...p, water: { ...p.water, bottleMass } }))} />
      <NumField label="Diámetro" unit="mm" min={20} value={d.body.diameter} onChange={(diameter) => setW((p) => ({ ...p, body: { ...p.body, diameter } }))} />
      <NumField label="Largo de la parte recta" unit="mm" min={10} value={d.body.length} onChange={(length) => setW((p) => ({ ...p, body: { ...p.body, length } }))} />
      <NumField label="Largo del hombro y cuello" unit="mm" min={1} value={d.tail.length} onChange={(length) => setW((p) => ({ ...p, tail: { ...p.tail, length } }))} />
      <NumField label="Diámetro del cuello" unit="mm" min={5} value={d.tail.aftDiameter} onChange={(aftDiameter) => setW((p) => ({ ...p, tail: { ...p.tail, aftDiameter } }))} />
      <NumField className="full" label="Piezas impresas sobre la botella (coples, porta-paracaídas)" unit="g" min={0} value={d.body.mass} onChange={(mass) => setW((p) => ({ ...p, body: { ...p.body, mass } }))} />
      <p className="hint full">Las medidas de la botella son aproximadas: mide una botella real y corrígelas.</p>
    </Section>
  );
}

function MotorSection({ d, update }: { d: EstesDesign; update: Update }) {
  const motor = motorById(d.motor.id);
  const available = MOTORS.filter((m) => m.diameter === d.motor.mountDiameter);
  const setMotor = (patch: Partial<EstesDesign["motor"]>) => update((p) => ({ ...(p as EstesDesign), motor: { ...(p as EstesDesign).motor, ...patch } }));
  const pickMotor = (id: string) => {
    const m = motorById(id);
    if (!m) return;
    const delay = m.delays.includes(d.motor.delay) ? d.motor.delay : (m.delays.find((x) => x > 0) ?? m.delays[0] ?? 0);
    setMotor({ id, delay });
  };
  return (
    <Section title="Motor Estes" summary={motor ? `${motor.name}-${d.motor.delay}` : "sin motor"}>
      <SelectField
        label="Soporte de motor"
        value={String(d.motor.mountDiameter)}
        options={MOUNT_DIAMETERS.map((m) => ({ value: String(m), label: `${m} mm` }))}
        onChange={(v) => {
          const mountDiameter = Number(v);
          const first = MOTORS.find((m) => m.diameter === mountDiameter)!;
          setMotor({ mountDiameter, id: first.id, delay: first.delays.find((x) => x > 0) ?? first.delays[0] ?? 0 });
        }}
      />
      <SelectField
        label="Motor"
        value={d.motor.id}
        options={available.map((m) => ({ value: m.id, label: `${m.name} · ${format(m.totalImpulse, 1)} N·s` }))}
        onChange={pickMotor}
      />
      <SelectField
        label="Retardo de eyección"
        value={String(d.motor.delay)}
        options={(motor?.delays ?? [0]).map((x) => ({ value: String(x), label: x === 0 ? "0 s (sin eyección, primera etapa)" : `${x} s` }))}
        onChange={(v) => setMotor({ delay: Number(v) })}
      />
      {motor && (
        <p className="hint full">
          Clase {impulseClass(motor.totalImpulse)} · impulso total {format(motor.totalImpulse, 1)} N·s · empuje promedio {format(motor.averageThrust, 1)} N
          · empuje máximo {format(motor.maxThrust, 1)} N · combustión {format(motor.burnTime, 2)} s · masa {format(motor.mass[0], 1)} g
          ({format(motor.mass[0] - motor.mass[motor.mass.length - 1], 1)} g de propelente). {motor.diameter}×{motor.length} mm.
        </p>
      )}
    </Section>
  );
}

function WaterSection({ d, update }: { d: WaterDesign; update: Update }) {
  const setWater = (patch: Partial<WaterDesign["water"]>) => update((p) => ({ ...(p as WaterDesign), water: { ...(p as WaterDesign).water, ...patch } }));
  const maxWater = Math.round(d.water.bottleVolume * 0.9 * 100) / 100;
  return (
    <Section title="Agua y presión" summary={`${format(d.water.waterVolume, 2)} L · ${format(d.water.pressure, 0)} psi`}>
      <NumField label="Agua" unit="L" min={0} max={maxWater} value={d.water.waterVolume} onChange={(waterVolume) => setWater({ waterVolume })} />
      <NumField label="Presión (manómetro)" unit="psi" min={0} max={MAX_PRESSURE_PSI} digits={0} value={d.water.pressure} onChange={(pressure) => setWater({ pressure })} />
      <div className="slider">
        <span className="hint">Agua</span>
        <input type="range" min={0} max={maxWater} step={0.05} value={d.water.waterVolume} onChange={(e) => setWater({ waterVolume: Number(e.target.value) })} aria-label="Agua en litros" />
      </div>
      <div className="slider">
        <span className="hint">Presión</span>
        <input type="range" min={0} max={MAX_PRESSURE_PSI} step={5} value={d.water.pressure} onChange={(e) => setWater({ pressure: Number(e.target.value) })} aria-label="Presión en psi" />
      </div>
      <NumField label="Boquilla (boca de la botella)" unit="mm" min={4} max={30} value={d.water.nozzleDiameter} onChange={(nozzleDiameter) => setWater({ nozzleDiameter })} />
      <p className="hint full">
        Límite de seguridad: {MAX_PRESSURE_PSI} psi. Las botellas se debilitan con cada lanzamiento: cerca del límite usa botellas sin golpes ni rayones.
      </p>
    </Section>
  );
}
