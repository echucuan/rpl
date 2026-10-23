import type { Design, EstesDesign, FinProfile, NoseShape, WaterDesign } from "../model";
import { LETTER, MAX_PRESSURE_PSI, WEIGHED, sheetLength, sheetMass, sheetWrap } from "../model";
import { A10_SPECS, a10Motor, impulseClass } from "../motor";
import { finArea, layout, noseProperties } from "../physics/geometry";
import { NumField, Section, Segmented, SelectField, TextField, format } from "./fields";

type Update = (fn: (d: Design) => Design) => void;
type Setter = <K extends keyof Design>(key: K, patch: Partial<Design[K]>) => void;

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

const round = (v: number) => Math.round(v * 10) / 10;

export function DesignForm({ design: d, update }: { design: Design; update: Update }) {
  const l = layout(d);
  const set: Setter = (key, patch) => update((p) => ({ ...p, [key]: { ...(p[key] as object), ...patch } }) as Design);
  const isWater = d.type === "water";
  const pla = isWater ? "" : " (PLA)";

  return (
    <div className="form">
      <Section title="Diseño">
        <TextField className="full" label="Nombre del cohete" value={d.name} onChange={(name) => update((p) => ({ ...p, name }))} />
        <p className="hint full">
          Largo total: <b>{format(l.length / 10, 1)} cm</b>. Las posiciones se miden desde la punta de la nariz, en milímetros.
        </p>
      </Section>

      <Section title={`Nariz${pla}`} summary={`${format(d.nose.mass, 1)} g`}>
        <SelectField label="Forma" value={d.nose.shape} options={SHAPES} onChange={(shape) => set("nose", { shape })} />
        <NumField label="Largo (sin hombro)" unit="mm" min={5} value={d.nose.length} onChange={(length) => set("nose", { length })} />
        <NumField label="Diámetro" unit="mm" min={5} value={d.nose.diameter} onChange={(diameter) => set("nose", { diameter })} />
        <NumField label="Masa" unit="g" min={0} value={d.nose.mass} onChange={(mass) => set("nose", { mass })} />
        <p className="hint full">
          Superficie exterior: {format(noseProperties(d.nose.shape, d.nose.length, d.nose.diameter).surface / 100, 0)} cm². Pesa la pieza impresa en la báscula{isWater ? "" : " (sin el altímetro)"}.
        </p>
        {Math.abs(d.nose.diameter - d.body.diameter) > 0.5 && <p className="hint full">⚠ La nariz ({format(d.nose.diameter)} mm) y el cuerpo ({format(d.body.diameter)} mm) no tienen el mismo diámetro.</p>}
      </Section>

      {d.type === "estes" && <AltimeterSection d={d} update={update} />}
      {d.type === "estes" ? <PaperSection d={d} update={update} /> : <BottleSection d={d} update={update} />}

      <Section title={`Aletas${pla}`} summary={`${d.fins.count} · ${format(d.fins.mass, 1)} g`}>
        <NumField label="Número de aletas" min={1} max={8} digits={0} value={d.fins.count} onChange={(count) => set("fins", { count: Math.round(count) })} />
        <SelectField label="Borde" value={d.fins.profile} options={PROFILES} onChange={(profile) => set("fins", { profile })} />
        <NumField label="Cuerda en la raíz" unit="mm" min={1} value={d.fins.rootChord} onChange={(rootChord) => set("fins", { rootChord })} title="Largo de la aleta pegada al cuerpo" />
        <NumField label="Cuerda en la punta" unit="mm" min={0} value={d.fins.tipChord} onChange={(tipChord) => set("fins", { tipChord })} />
        <NumField label="Altura (envergadura)" unit="mm" min={1} value={d.fins.span} onChange={(span) => set("fins", { span })} />
        <NumField label="Barrido" unit="mm" value={d.fins.sweep} onChange={(sweep) => set("fins", { sweep })} title="Distancia del borde de ataque en la raíz al de la punta" />
        <NumField label="Grosor" unit="mm" min={0.1} value={d.fins.thickness} onChange={(thickness) => set("fins", { thickness })} />
        <NumField
          label="Separación de la cola"
          unit="mm"
          value={d.fins.offsetFromAft}
          onChange={(offsetFromAft) => set("fins", { offsetFromAft })}
          title={isWater ? "Del inicio del hombro de la botella al borde de salida; negativo si la aleta baja sobre el hombro" : "Del extremo del cuerpo al borde de salida de la aleta"}
        />
        <NumField label="Masa del juego completo" unit="g" min={0} value={d.fins.mass} onChange={(mass) => set("fins", { mass })} />
        <p className="hint full">Volumen del juego: {format((d.fins.count * finArea(d.fins) * d.fins.thickness) / 1000, 1)} cm³. Si aún no las imprimes, multiplica por la densidad de tu PLA Aero; después pésalas.</p>
      </Section>

      {d.type === "estes" ? <MotorSection d={d} update={update} /> : <WaterSection d={d} update={update} />}

      {d.type === "estes" ? <EstesChuteSection d={d} set={set} /> : (
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
              <NumField label="Diámetro" unit="mm" min={10} value={d.recovery.diameter} onChange={(diameter) => set("recovery", { diameter })} />
              <NumField label="Coef. de arrastre" min={0.1} max={2.5} value={d.recovery.cd} onChange={(cd) => set("recovery", { cd })} title="Entre 0.75 y 0.8 para paracaídas de plástico" />
              <NumField label="Masa" unit="g" min={0} value={d.recovery.mass} onChange={(mass) => set("recovery", { mass })} />
              <NumField label="Posición" unit="mm" min={0} value={d.recovery.position} onChange={(position) => set("recovery", { position })} />
              <SelectField
                className="full"
                label="Se abre"
                value={d.recovery.deployment === "ejection" ? "apogee" : d.recovery.deployment}
                options={[{ value: "apogee", label: "En el punto más alto (apogeo)" }, { value: "none", label: "No se abre (prueba balística)" }]}
                onChange={(deployment) => set("recovery", { deployment })}
              />
            </>
          )}
        </Section>
      )}

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
          <button
            type="button"
            className="btn small"
            onClick={() => update((p) => ({ ...p, extras: [...p.extras, { name: isWater ? "Lastre" : "Cuerda elástica y algodón", mass: isWater ? 10 : 3, position: Math.round(l.bodyStart + 20) }] }))}
          >
            + Agregar masa
          </button>
        </div>
        <p className="hint full">{isWater ? "Lastre, coples, cinta…" : "Cuerda elástica, algodón protector, pegamento, cinta…"} Cualquier cosa que viaje en el cohete.</p>
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

function AltimeterSection({ d, update }: { d: EstesDesign; update: Update }) {
  const set = (patch: Partial<EstesDesign["altimeter"]>) => update((p) => ({ ...(p as EstesDesign), altimeter: { ...(p as EstesDesign).altimeter, ...patch } }));
  return (
    <Section title="Altímetro Estes (dentro de la nariz)" summary={d.altimeter.included ? `${format(d.altimeter.mass, 1)} g` : "sin altímetro"}>
      <div className="full">
        <Segmented
          value={d.altimeter.included ? "yes" : "no"}
          options={[{ value: "yes", label: "Con altímetro" }, { value: "no", label: "Sin altímetro" }]}
          onChange={(v) => set({ included: v === "yes" })}
        />
      </div>
      {d.altimeter.included && (
        <>
          <NumField label="Masa" unit="g" min={0} value={d.altimeter.mass} onChange={(mass) => set({ mass })} />
          <NumField label="Posición de su centro" unit="mm" min={0} value={d.altimeter.position} onChange={(position) => set({ position })} />
          <p className="hint full">
            Pesado en el laboratorio con su batería: {WEIGHED.altimeter} g; si el tuyo pesa distinto, corrígelo. Va dentro de la nariz, así que su centro queda entre {format(d.nose.length * 0.4, 0)} y{" "}
            {format(d.nose.length, 0)} mm de la punta. Mide hasta 3,000 m (9,999 ft) y guarda la altura máxima de 10 vuelos.
          </p>
        </>
      )}
    </Section>
  );
}

function PaperSection({ d, update }: { d: EstesDesign; update: Update }) {
  const setE = (fn: (p: EstesDesign) => EstesDesign) => update((p) => fn(p as EstesDesign));
  // Changing the sheet recomputes the body's length and mass; the mass can then be replaced by a weighed value.
  const setSheet = (patch: Partial<EstesDesign["sheet"]>) =>
    setE((p) => {
      const sheet = { ...p.sheet, ...patch };
      return { ...p, sheet, body: { ...p.body, length: sheetLength(sheet), mass: round(sheetMass(sheet)) } };
    });
  const wraps = sheetWrap(d.sheet) / (Math.PI * d.body.diameter);
  return (
    <Section title="Cuerpo de opalina" summary={`${format(d.body.length / 10, 1)} cm · ${format(d.body.mass, 1)} g`}>
      <SelectField
        className="full"
        label="Cómo se enrolla la hoja carta (21.6 × 27.9 cm)"
        value={d.sheet.orientation}
        options={[
          { value: "long", label: `Tubo de ${format(LETTER.length / 10, 1)} cm de largo (se enrolla el lado de ${format(LETTER.width / 10, 1)} cm)` },
          { value: "short", label: `Tubo de ${format(LETTER.width / 10, 1)} cm de largo (se enrolla el lado de ${format(LETTER.length / 10, 1)} cm)` },
        ]}
        onChange={(orientation) => setSheet({ orientation })}
      />
      <NumField label="Diámetro exterior del tubo" unit="mm" min={14} max={68} value={d.body.diameter} onChange={(diameter) => setE((p) => ({ ...p, body: { ...p.body, diameter } }))} />
      <NumField label="Gramaje de la opalina" unit="g/m²" min={60} max={400} digits={0} value={d.sheet.gsm} onChange={(gsm) => setSheet({ gsm })} />
      <NumField
        className="full"
        label="Masa del tubo"
        unit="g"
        min={0}
        value={d.body.mass}
        onChange={(mass) => setE((p) => ({ ...p, body: { ...p.body, mass } }))}
        title="Se calcula con el gramaje; si pesas el tubo terminado, escribe aquí su masa"
      />
      <p className="hint full">
        La hoja da <b>{format(wraps, 1)} vueltas</b> alrededor del tubo{wraps < 1.15 ? " ⚠ casi no traslapa: usa un diámetro menor" : ""}. Hoja completa:{" "}
        {format(sheetMass(d.sheet), 1)} g con {d.sheet.gsm} g/m². Si le pones pegamento o cinta, pesa el tubo terminado y escribe su masa.
      </p>
    </Section>
  );
}

function MotorSection({ d, update }: { d: EstesDesign; update: Update }) {
  const motor = a10Motor(d.motor.mass, d.motor.propellant);
  const setE = (fn: (p: EstesDesign) => EstesDesign) => update((p) => fn(p as EstesDesign));
  return (
    <Section title="Motor Estes A10-3T y porta motor" summary={`A10-3T · ${format(d.motor.mass + d.motorMount.mass, 1)} g`}>
      <NumField
        label="Masa con combustible"
        unit="g"
        min={1}
        max={20}
        value={d.motor.mass}
        onChange={(mass) => setE((p) => ({ ...p, motor: { mass, propellant: Math.max(mass - (p.motor.mass - p.motor.propellant), 0.1) } }))}
        title="Motor nuevo, antes de encenderlo"
      />
      <NumField
        label="Masa ya quemado"
        unit="g"
        min={0.5}
        max={20}
        value={round(d.motor.mass - d.motor.propellant)}
        onChange={(burnt) => setE((p) => ({ ...p, motor: { ...p.motor, propellant: Math.max(p.motor.mass - burnt, 0.1) } }))}
        title="El mismo motor después del vuelo (casquillo vacío)"
      />
      <NumField className="full" label="Porta motor impreso (PLA)" unit="g" min={0} value={d.motorMount.mass} onChange={(mass) => setE((p) => ({ ...p, motorMount: { mass } }))} />
      <p className="hint full">
        Pierde {format(d.motor.propellant, 1)} g al quemarse (pesados en el laboratorio: {WEIGHED.motorLoaded} g nuevo y {WEIGHED.motorBurnt} g quemado). 13 × 45 mm ·
        clase {impulseClass(motor.totalImpulse)} · retardo de {A10_SPECS.delay} s. Curva de empuje medida en la prueba de certificación: impulso{" "}
        {format(motor.totalImpulse, 2)} N·s, empuje máximo {format(motor.maxThrust, 1)} N, {format(motor.burnTime, 2)} s. Estes publica valores nominales de{" "}
        {A10_SPECS.ratedImpulse} N·s, {A10_SPECS.ratedMaxThrust} N y {A10_SPECS.ratedBurnTime} s, y un máximo de {A10_SPECS.maxLiftoffMass} g de cohete al despegar.
      </p>
    </Section>
  );
}

function EstesChuteSection({ d, set }: { d: EstesDesign; set: Setter }) {
  return (
    <Section title={'Paracaídas Estes 24" impreso'} summary={`61 cm · ${format(d.recovery.mass, 1)} g`}>
      <NumField label="Masa (con cordones)" unit="g" min={0} value={d.recovery.mass} onChange={(mass) => set("recovery", { mass })} />
      <NumField label="Posición" unit="mm" min={0} value={d.recovery.position} onChange={(position) => set("recovery", { position })} />
      <NumField label="Coef. de arrastre" min={0.3} max={1.5} value={d.recovery.cd} onChange={(cd) => set("recovery", { cd })} title="Entre 0.75 y 0.8 para paracaídas planos de plástico" />
      <p className="hint full">
        61 cm de diámetro, plástico LDPE con cordones ya unidos. Pesado en el laboratorio: {WEIGHED.parachute} g. Se abre con la carga de eyección del motor, {A10_SPECS.delay} s después de que
        termina el empuje.
      </p>
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
