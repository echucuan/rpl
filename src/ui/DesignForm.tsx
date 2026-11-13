import type { Design, EstesDesign, FinProfile, NoseShape, WaterDesign } from "../model";
import { LETTER, MAX_PRESSURE_PSI, WEIGHED, sheetLength, sheetMass, sheetWrap } from "../model";
import { makerName, motorFor, motorSpec, impulseClass } from "../motor";
import { MotorPicker } from "./MotorPicker";
import { finArea, layout, noseProperties } from "../physics/geometry";
import { WATER_DENSITY } from "../physics/propulsion";
import { CHUTE_SHAPES, chuteProperties, type ChuteShape } from "../physics/parachute";
import { NumField, Section, Segmented, SelectField, TextField, format } from "./fields";
import { ChuteDiagram } from "./ChuteDiagram";

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
            {format(d.nose.length, 0)} mm de la punta. Mide hasta 3,000 m (9,999 ft) y guarda el apogeo de 10 vuelos.
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
  const motor = motorFor(d.motor);
  const spec = motorSpec(d.motor.id);
  const setE = (fn: (p: EstesDesign) => EstesDesign) => update((p) => fn(p as EstesDesign));
  return (
    <Section title="Motor y porta motor" summary={`${makerName(spec.maker)} ${spec.name} · ${format(d.motor.mass + d.motorMount.mass, 1)} g`}>
      {/* For now the catalogue has a single motor; new ones appear here when they are added to motor.ts. */}
      <MotorPicker d={d} onChange={(next) => setE(() => next)} />
      <p className="hint full">Por ahora el reto usa solo el motor Estes A10-3T. Sus datos completos y la prueba estática están en la pestaña Motor.</p>
      {d.motor.thrust === "average" && <div className="alert warning full">Estás usando el <b>empuje promedio constante</b> ({format(motor.averageThrust, 2)} N durante {format(motor.burnTime, 2)} s): las predicciones no son tan correctas como con el empuje real. Se cambia en la pestaña Motor.</div>}
      <NumField
        label="Masa con combustible"
        unit="g"
        min={1}
        max={20}
        value={d.motor.mass}
        onChange={(mass) => setE((p) => ({ ...p, motor: { ...p.motor, mass, propellant: Math.max(mass - (p.motor.mass - p.motor.propellant), 0.1) } }))}
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
        Pierde {format(d.motor.propellant, 1)} g al quemarse (pesados en el laboratorio: {WEIGHED.motorLoaded} g nuevo y {WEIGHED.motorBurnt} g quemado). {spec.diameter} × {spec.length} mm ·
        clase {impulseClass(motor.totalImpulse)} · retardo de {spec.delay} s. Curva de empuje medida en la prueba de certificación: impulso{" "}
        {format(motor.totalImpulse, 2)} N·s, empuje máximo {format(motor.maxThrust, 1)} N, {format(motor.burnTime, 2)} s. {makerName(spec.maker)} publica valores nominales de{" "}
        {spec.rated.impulse} N·s, {spec.rated.maxThrust} N y {spec.rated.burnTime} s, y un máximo de {spec.rated.maxLiftoffMass} g de cohete al despegar.
      </p>
    </Section>
  );
}

const CHUTE_OPTIONS = (Object.keys(CHUTE_SHAPES) as ChuteShape[]).map((value) => ({ value, label: CHUTE_SHAPES[value].label }));

/** Rocket Tec parachute builder: shape, radius and shroud lines give the drag coefficient used in phase IV. */
function EstesChuteSection({ d, set }: { d: EstesDesign; set: Setter }) {
  const c = chuteProperties(d);
  const polygon = CHUTE_SHAPES[c.shape].sides > 0;
  return (
    <Section title="Paracaídas" summary={`${CHUTE_SHAPES[c.shape].label} · ${format(d.recovery.diameter / 10, 0)} cm · ${format(d.recovery.mass, 1)} g`}>
      <SelectField label="Geometría" value={c.shape} options={CHUTE_OPTIONS} onChange={(shape) => set("recovery", { shape })} />
      <NumField label="Radio" unit="mm" min={20} max={1000} value={d.recovery.diameter / 2} onChange={(r) => set("recovery", { diameter: r * 2 })}
        title={polygon ? "Del centro a una esquina (vértice) del polígono" : "Del centro a la orilla"} />
      <NumField label="Largo de los hilos" unit="mm" min={20} max={3000} value={d.recovery.lineLength ?? d.recovery.diameter} onChange={(lineLength) => set("recovery", { lineLength })}
        title="De la orilla del paracaídas al punto donde se juntan los hilos" />
      <NumField label="Masa (con cordones)" unit="g" min={0} value={d.recovery.mass} onChange={(mass) => set("recovery", { mass })} />
      <NumField label="Posición" unit="mm" min={0} value={d.recovery.position} onChange={(position) => set("recovery", { position })} />
      <ChuteDiagram shape={c.shape} radius={c.radius} lines={c.ratio * 2 * c.radius} area={c.area} factor={c.factor} />
      <div className="chute-cd full">
        <span>Coeficiente de arrastre</span>
        <b>C<sub>d</sub> = {format(c.cd0, 2)} × {format(c.factor, 3)} = {format(c.cd, 3)}</b>
        <small>
          C<sub>d,base</sub> de la forma {CHUTE_SHAPES[c.shape].label.toLowerCase()} ({format(c.cd0, 2)}) × factor de los hilos f(L/D) con L/D = {format(c.ratio, 2)}. Área plana{" "}
          {format(c.area * 1e4, 0)} cm². Se usa en la Fase IV.
        </small>
      </div>
      <p className="hint full">
        El Estes 24" del laboratorio es circular, de 61 cm de diámetro (radio de 305 mm), de plástico LDPE con cordones ya unidos y pesa {WEIGHED.parachute} g. Se abre con la carga de eyección
        del motor, {motorSpec(d.motor.id).delay} s después de que termina el empuje.
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
  // Students weigh the water, so the form uses kg; the model keeps litres (files stay compatible).
  const kgPerL = WATER_DENSITY / 1000;
  const waterKg = d.water.waterVolume * kgPerL;
  const setKg = (kg: number) => setWater({ waterVolume: kg / kgPerL });
  const maxKg = Math.round(d.water.bottleVolume * 0.9 * kgPerL * 100) / 100;
  return (
    <Section title="Agua y presión" summary={`${format(waterKg, 2)} kg · ${format(d.water.pressure, 0)} psi`}>
      <NumField label="Masa de agua" unit="kg" min={0} max={maxKg} digits={3} value={waterKg} onChange={setKg} title="Pésala en la báscula: 1 L de agua tiene una masa de casi 1 kg" />
      <NumField label="Presión (manómetro)" unit="psi" min={0} max={MAX_PRESSURE_PSI} digits={0} value={d.water.pressure} onChange={(pressure) => setWater({ pressure })} />
      <div className="slider">
        <span className="hint">Agua</span>
        <input type="range" min={0} max={maxKg} step={0.05} value={waterKg} onChange={(e) => setKg(Number(e.target.value))} aria-label="Masa de agua en kilogramos" />
      </div>
      <div className="slider">
        <span className="hint">Presión</span>
        <input type="range" min={0} max={MAX_PRESSURE_PSI} step={5} value={d.water.pressure} onChange={(e) => setWater({ pressure: Number(e.target.value) })} aria-label="Presión en psi" />
      </div>
      <NumField label="Boquilla (boca de la botella)" unit="mm" min={4} max={30} value={d.water.nozzleDiameter} onChange={(nozzleDiameter) => setWater({ nozzleDiameter })} />
      <p className="hint full">
        {format(waterKg, 3)} kg de agua ocupan {format(d.water.waterVolume, 3)} L; quedan {format(Math.max(d.water.bottleVolume - d.water.waterVolume, 0), 3)} L de aire
        a presión. Límite de seguridad: {MAX_PRESSURE_PSI} psi. Las botellas se debilitan con cada lanzamiento: cerca del límite usa botellas sin golpes ni rayones.
      </p>
    </Section>
  );
}
