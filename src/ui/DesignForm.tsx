import { useEffect, useState, type ReactNode } from "react";
import type { Design, EstesDesign, FinProfile, NoseShape, WaterDesign } from "../model";
import { ALTIMETER_MM, EXTRA_KINDS, hasMotor, LETTER, MAX_PRESSURE_PSI, MOUNT_MATERIALS, NOSE_MATERIALS, OPALINA_GSM, WEIGHED, noseMaterialLabel, sheetLength, sheetMass, sheetWrap } from "../model";
import { makerName, motorFor, motorSpec, impulseClass } from "../motor";
import { MotorPicker } from "./MotorPicker";
import { finArea, layout, noseRadius } from "../physics/geometry";
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

export function DesignForm({ design: d, update: rawUpdate }: { design: Design; update: Update }) {
  // The parachute and the extra masses are placed from the rocket base, so they keep that distance when the rocket
  // gets longer or shorter.
  const update: Update = (fn) =>
    rawUpdate((p) => {
      const n = fn(p);
      const grew = layout(n).length - layout(p).length;
      return grew
        ? { ...n, recovery: { ...n.recovery, position: n.recovery.position + grew }, extras: n.extras.map((e) => ({ ...e, position: e.position + grew })) }
        : n;
    });
  const set: Setter = (key, patch) => update((p) => ({ ...p, [key]: { ...(p[key] as object), ...patch } }) as Design);
  const isWater = d.type === "water";

  return (
    <div className="form">
      <Section title="Diseño" summary={d.name}>
        <TextField className="full" label="Nombre del cohete" value={d.name} onChange={(name) => update((p) => ({ ...p, name }))} />
      </Section>

      <Section title="Ojiva" summary={`${noseMaterialLabel(d.nose.material)} · ${format(d.nose.mass, 1)} g`}>
        <SelectField label="Material" value={d.nose.material ?? "pla"} options={NOSE_MATERIALS} onChange={(material) => set("nose", { material })} />
        <SelectField label="Forma" value={d.nose.shape} options={SHAPES} onChange={(shape) => set("nose", { shape })} />
        <NumField
          label="Largo (sin hombro)"
          unit="mm"
          min={5}
          value={d.nose.length}
          // The altimeter is placed from the nose base, so it moves with the base when the nose gets longer or shorter.
          onChange={(length) => update((p) => ({ ...p, nose: { ...p.nose, length }, ...(p.type === "estes" ? { altimeter: { ...p.altimeter, position: p.altimeter.position + length - p.nose.length } } : {}) }) as Design)}
        />
        <NumField label="Diámetro" unit="mm" min={5} value={d.nose.diameter} onChange={(diameter) => set("nose", { diameter })} />
        <NumField label="Masa" unit="g" min={0} value={d.nose.mass} onChange={(mass) => set("nose", { mass })} />
        {Math.abs(d.nose.diameter - d.body.diameter) > 0.5 && <p className="hint full">⚠ La ojiva ({format(d.nose.diameter)} mm) y el cuerpo ({format(d.body.diameter)} mm) no tienen el mismo diámetro.</p>}
      </Section>

      {d.type === "estes" ? <PaperSection d={d} update={update} /> : <BottleSection d={d} update={update} />}

      {d.type === "estes" ? <MotorSection d={d} update={update} /> : <WaterSection d={d} update={update} />}

      <Section title="Aletas" summary={d.fins.count > 0 ? `${noseMaterialLabel(d.fins.material)} · ${d.fins.count} · ${format(d.fins.mass, 1)} g` : "sin aletas"}>
        <div className="full">
          <Segmented
            value={d.fins.count > 0 ? "yes" : "no"}
            options={[{ value: "no", label: "Sin aletas" }, { value: "yes", label: "Con aletas" }]}
            onChange={(v) => set("fins", { count: v === "yes" ? 4 : 0 })}
          />
        </div>
        {d.fins.count > 0 && (
          <>
            <SelectField label="Material" value={d.fins.material ?? "pla"} options={MOUNT_MATERIALS} onChange={(material) => set("fins", { material })} />
            <NumField label="Número de aletas" min={1} max={8} digits={0} value={d.fins.count} onChange={(count) => set("fins", { count: Math.round(count) })} />
            <FinSketch />
            <NumField label="A · Cuerda en la raíz" unit="mm" min={1} value={d.fins.rootChord} onChange={(rootChord) => set("fins", { rootChord })} title="Largo de la aleta pegada al cuerpo" />
            <NumField label="B · Cuerda en la punta" unit="mm" min={0} value={d.fins.tipChord} onChange={(tipChord) => set("fins", { tipChord })} />
            <NumField label="C · Altura (envergadura)" unit="mm" min={1} value={d.fins.span} onChange={(span) => set("fins", { span })} />
            <NumField label="D · Barrido" unit="mm" value={d.fins.sweep} onChange={(sweep) => set("fins", { sweep })} title="Distancia del borde de ataque en la raíz al de la punta" />
            <SelectField label="Borde" value={d.fins.profile} options={PROFILES} onChange={(profile) => set("fins", { profile })} />
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
          </>
        )}
      </Section>

      {/* Everything the rocket carries: altimeter, parachute and any extra mass. */}
      <Section title="Carga" summary={`${format(cargoMass(d), 1)} g`}>
      {d.type === "estes" && <AltimeterSection d={d} update={update} />}

      {d.type === "estes" ? <EstesChuteSection d={d} set={set} /> : (
        <Block title="Recuperación" summary={d.recovery.kind === "parachute" ? `${format(d.recovery.diameter / 10, 0)} cm` : "sin paracaídas"}>
          <div className="full">
            <Segmented
              value={d.recovery.kind}
              options={[{ value: "none", label: "Sin paracaídas" }, { value: "parachute", label: "Con paracaídas" }]}
              onChange={(kind) => set("recovery", { kind })}
            />
          </div>
          {d.recovery.kind === "parachute" && (
            <>
              <NumField label="Diámetro" unit="mm" min={10} value={d.recovery.diameter} onChange={(diameter) => set("recovery", { diameter })} />
              <NumField label="Coef. de arrastre" min={0.1} max={2.5} value={d.recovery.cd} onChange={(cd) => set("recovery", { cd })} title="Entre 0.75 y 0.8 para paracaídas de plástico" />
              <NumField label="Masa" unit="g" min={0} value={d.recovery.mass} onChange={(mass) => set("recovery", { mass })} />
              <ChutePosition d={d} onChange={(position) => set("recovery", { position })} />
              <SelectField
                className="full"
                label="Se abre"
                value={d.recovery.deployment === "ejection" ? "apogee" : d.recovery.deployment}
                options={[{ value: "apogee", label: "En el punto más alto (apogeo)" }, { value: "none", label: "No se abre (prueba balística)" }]}
                onChange={(deployment) => set("recovery", { deployment })}
              />
            </>
          )}
        </Block>
      )}

      <Block title="Masas adicionales" summary={d.extras.length ? `${d.extras.length} · ${format(d.extras.reduce((s, e) => s + e.mass, 0), 1)} g` : "sin masas"}>
        <div className="full">
          <Segmented
            value={d.extras.length > 0 ? "yes" : "no"}
            options={[{ value: "no", label: "Sin masas adicionales" }, { value: "yes", label: "Con masas adicionales" }]}
            onChange={(v) => update((p) => ({ ...p, extras: v === "no" ? [] : p.extras.length ? p.extras : [newExtra(p)] }))}
          />
        </div>
        {d.extras.map((e, i) => (
          <div className="extra-row" key={i}>
            <SelectField
              label="Qué es"
              value={e.name}
              options={[
                ...EXTRA_KINDS.map((k) => ({ value: k as string, label: k as string })),
                // A mass saved with another name keeps it until it is changed.
                ...((EXTRA_KINDS as readonly string[]).includes(e.name) ? [] : [{ value: e.name, label: e.name }]),
              ]}
              onChange={(name) => update((p) => ({ ...p, extras: p.extras.map((x, j) => (j === i ? { ...x, name } : x)) }))}
            />
            <NumField label="Masa" unit="g" min={0} value={e.mass} onChange={(mass) => update((p) => ({ ...p, extras: p.extras.map((x, j) => (j === i ? { ...x, mass } : x)) }))} />
            <NumField
              label="Desde la base"
              unit="mm"
              min={0}
              max={layout(d).length}
              value={round(layout(d).length - e.position)}
              onChange={(fromBase) => update((p) => ({ ...p, extras: p.extras.map((x, j) => (j === i ? { ...x, position: layout(p).length - fromBase } : x)) }))}
              title="Distancia del extremo trasero del cohete (por donde sale el motor) al centro de esta masa"
            />
            <button type="button" className="icon-btn" aria-label="Quitar" onClick={() => update((p) => ({ ...p, extras: p.extras.filter((_, j) => j !== i) }))}>✕</button>
          </div>
        ))}
        {d.extras.length > 0 && (
          <div className="full">
            <button
              type="button"
              className="btn small"
              onClick={() => update((p) => ({ ...p, extras: [...p.extras, newExtra(p)] }))}
            >
              + Agregar masa
            </button>
          </div>
        )}
        <p className="hint full">{isWater ? "Lastre, coples, cinta…" : "Papel retardante, cuerda elástica, pegamento, cinta…"} Cualquier cosa que viaje en el cohete.</p>
      </Block>
      </Section>

      <Section title="Lanzamiento" summary={d.launch.latitude !== undefined && d.launch.longitude !== undefined ? `${d.launch.latitude.toFixed(4)}, ${d.launch.longitude.toFixed(4)}` : undefined}>
        <LaunchLocation d={d} set={(patch) => set("launch", patch)} />
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
  const brand = d.altimeter.brand?.trim() || "Estes";
  const estes = brand.toLowerCase() === "estes";
  return (
    <Block title="Altímetro" summary={d.altimeter.included ? `${brand} · ${format(d.altimeter.mass, 1)} g` : "sin altímetro"}>
      <div className="full">
        <Segmented
          value={d.altimeter.included ? "yes" : "no"}
          options={[{ value: "no", label: "Sin altímetro" }, { value: "yes", label: "Con altímetro" }]}
          onChange={(v) => set({ included: v === "yes" })}
        />
      </div>
      {d.altimeter.included && (
        <>
          <TextField className="full" label="Marca" value={d.altimeter.brand ?? "Estes"} onChange={(b) => set({ brand: b })} />
          <div className="full alt-row">
          <NumField label="Masa" unit="g" min={0} value={d.altimeter.mass} onChange={(mass) => set({ mass })} />
          <NumField
            label="Distancia desde la base de la ojiva"
            unit="mm"
            min={0}
            max={d.nose.length}
            value={round(d.nose.length - d.altimeter.position)}
            onChange={(fromBase) => set({ position: d.nose.length - fromBase })}
            title="De la base de la ojiva (donde se une con el cuerpo) al centro del altímetro, medido hacia la punta"
          />
          </div>
          <p className="hint full">
            {estes ? <>El Estes del laboratorio pesa {WEIGHED.altimeter} g con su batería; si el tuyo pesa distinto, corrígelo. </> : <>Pesa tu altímetro con su batería. </>}
            Va dentro de la ojiva: mide de la base de la ojiva (donde se une con el cuerpo) al centro del altímetro, hacia la punta; en esta ojiva cabe de 0 a {altimeterMaxFromBase(d)} mm.
            {estes ? " Mide hasta 3,000 m (9,999 ft) y guarda el apogeo de 10 vuelos." : ""}
          </p>
          {estes && !altimeterFits(d) && (
            <p className="hint full">⚠ El altímetro Estes mide {ALTIMETER_MM.length} × {ALTIMETER_MM.height} mm y en esa posición no cabe dentro de la ojiva: acércalo a la base.</p>
          )}
        </>
      )}
    </Block>
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
    <Section title="Cuerpo" summary={`Opalina ${d.sheet.gsm} g · ${format(d.body.length / 10, 1)} cm · ${format(d.body.mass, 1)} g`}>
      <SelectField
        label="Material"
        value={String(d.sheet.gsm)}
        options={[
          ...OPALINA_GSM.map((g) => ({ value: String(g), label: `Opalina ${g} g` })),
          // A design saved before the choice was limited keeps its own paper weight until it is changed.
          ...((OPALINA_GSM as readonly number[]).includes(d.sheet.gsm) ? [] : [{ value: String(d.sheet.gsm), label: `Opalina ${d.sheet.gsm} g (diseño anterior)` }]),
        ]}
        onChange={(gsm) => setSheet({ gsm: Number(gsm) })}
      />
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
  const on = hasMotor(d);
  return (
    <>
    <Section title="Porta motor" summary={`${noseMaterialLabel(d.motorMount.material)} · ${format(d.motorMount.mass, 1)} g`}>
      <SelectField label="Material" value={d.motorMount.material ?? "pla"} options={MOUNT_MATERIALS} onChange={(material) => setE((p) => ({ ...p, motorMount: { ...p.motorMount, material } }))} />
      <NumField label="Masa" unit="g" min={0} value={d.motorMount.mass} onChange={(mass) => setE((p) => ({ ...p, motorMount: { ...p.motorMount, mass } }))} />
    </Section>

    <Section title="Motor" summary={on ? `${makerName(spec.maker)} ${spec.name} · ${format(d.motor.mass, 1)} g` : "sin motor"}>
      <div className="full">
        <Segmented
          value={on ? "yes" : "no"}
          options={[{ value: "no", label: "Sin motor" }, { value: "yes", label: "Con motor" }]}
          onChange={(v) => setE((p) => ({ ...p, motor: { ...p.motor, included: v === "yes" } }))}
        />
      </div>
      {!on && <p className="hint full">Sin motor el cohete no vuela: puedes revisar sus masas y su estabilidad, pero las fases y las simulaciones necesitan el motor.</p>}
      {on && (
        <>
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
          <p className="hint full">
            Pierde {format(d.motor.propellant, 1)} g al quemarse (pesados en el laboratorio: {WEIGHED.motorLoaded} g nuevo y {WEIGHED.motorBurnt} g quemado). {spec.diameter} × {spec.length} mm ·
            clase {impulseClass(motor.totalImpulse)} · retardo de {spec.delay} s. Curva de empuje medida en la prueba de certificación: impulso{" "}
            {format(motor.totalImpulse, 2)} N·s, empuje máximo {format(motor.maxThrust, 1)} N, {format(motor.burnTime, 2)} s. {makerName(spec.maker)} publica valores nominales de{" "}
            {spec.rated.impulse} N·s, {spec.rated.maxThrust} N y {spec.rated.burnTime} s, y un máximo de {spec.rated.maxLiftoffMass} g de cohete al despegar.
          </p>
        </>
      )}
    </Section>
    </>
  );
}

const CHUTE_OPTIONS = (Object.keys(CHUTE_SHAPES) as ChuteShape[]).map((value) => ({ value, label: CHUTE_SHAPES[value].label }));

/** Rocket Tec parachute builder: shape, radius and shroud lines give the drag coefficient used in phase IV. */
function EstesChuteSection({ d, set }: { d: EstesDesign; set: Setter }) {
  const c = chuteProperties(d);
  const polygon = CHUTE_SHAPES[c.shape].sides > 0;
  const on = d.recovery.kind === "parachute";
  return (
    <Block title="Paracaídas" summary={on ? `${CHUTE_SHAPES[c.shape].label} · ${format(d.recovery.diameter / 10, 0)} cm · ${format(d.recovery.mass, 1)} g` : "sin paracaídas"}>
      <div className="full">
        <Segmented
          value={d.recovery.kind}
          options={[{ value: "none", label: "Sin paracaídas" }, { value: "parachute", label: "Con paracaídas" }]}
          onChange={(kind) => set("recovery", { kind })}
        />
      </div>
      {on && (<>
      <SelectField label="Geometría" value={c.shape} options={CHUTE_OPTIONS} onChange={(shape) => set("recovery", { shape })} />
      <NumField label="Radio" unit="mm" min={20} max={1000} value={d.recovery.diameter / 2} onChange={(r) => set("recovery", { diameter: r * 2 })}
        title={polygon ? "Del centro a una esquina (vértice) del polígono" : "Del centro a la orilla"} />
      <NumField label="Largo de los hilos" unit="mm" min={20} max={3000} value={d.recovery.lineLength ?? d.recovery.diameter} onChange={(lineLength) => set("recovery", { lineLength })}
        title="De la orilla del paracaídas al punto donde se juntan los hilos" />
      <NumField label="Masa (con cordones)" unit="g" min={0} value={d.recovery.mass} onChange={(mass) => set("recovery", { mass })} />
      <ChutePosition d={d} onChange={(position) => set("recovery", { position })} />
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
      </>)}
    </Block>
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

/** A labelled sketch of one fin, so the A–D measurements are not mixed up (a fixed drawing, not to scale). */
function FinSketch() {
  // Body surface along the bottom, nose to the left. Root 70→220, tip 170→230 at the top.
  const root = { from: 70, to: 220, y: 128 }, tip = { from: 170, to: 230, y: 44 };
  const dimY = 22, cX = 262, aY = 166;
  return (
    <figure className="fin-sketch full">
      <svg viewBox="0 0 320 184" role="img" aria-label="Aleta: A cuerda en la raíz, B cuerda en la punta, C altura, D barrido">
        <defs>
          <marker id="fs-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="currentColor" />
          </marker>
        </defs>
        {/* Body tube */}
        <rect x={10} y={root.y} width={300} height={18} className="fs-body" />
        <text x={16} y={root.y + 13} className="fs-note">← ojiva</text>
        <text x={304} y={root.y + 13} className="fs-note" textAnchor="end">cola →</text>
        {/* Fin */}
        <path d={`M${root.from},${root.y} L${tip.from},${tip.y} L${tip.to},${tip.y} L${root.to},${root.y} Z`} className="fs-fin" />
        {/* Extension lines */}
        <g className="fs-ext">
          <line x1={root.from} y1={root.y} x2={root.from} y2={dimY - 6} />
          <line x1={tip.from} y1={tip.y} x2={tip.from} y2={dimY - 6} />
          <line x1={tip.to} y1={tip.y} x2={tip.to} y2={dimY - 6} />
          <line x1={tip.to} y1={tip.y} x2={cX + 6} y2={tip.y} />
          <line x1={root.to} y1={root.y} x2={cX + 6} y2={root.y} />
          <line x1={root.from} y1={root.y + 18} x2={root.from} y2={aY + 6} />
          <line x1={root.to} y1={root.y + 18} x2={root.to} y2={aY + 6} />
        </g>
        {/* Dimensions */}
        <g className="fs-dim">
          <line x1={root.from} y1={aY} x2={root.to} y2={aY} markerStart="url(#fs-arrow)" markerEnd="url(#fs-arrow)" />
          <line x1={root.from} y1={dimY} x2={tip.from} y2={dimY} markerStart="url(#fs-arrow)" markerEnd="url(#fs-arrow)" />
          <line x1={tip.from} y1={dimY} x2={tip.to} y2={dimY} markerStart="url(#fs-arrow)" markerEnd="url(#fs-arrow)" />
          <line x1={cX} y1={tip.y} x2={cX} y2={root.y} markerStart="url(#fs-arrow)" markerEnd="url(#fs-arrow)" />
        </g>
        <g className="fs-label">
          <text x={(root.from + root.to) / 2} y={aY - 5}>A</text>
          <text x={(tip.from + tip.to) / 2} y={dimY - 5}>B</text>
          <text x={cX + 13} y={(tip.y + root.y) / 2 + 5}>C</text>
          <text x={(root.from + tip.from) / 2} y={dimY - 5}>D</text>
        </g>
      </svg>
      <figcaption>
        <b>A</b> cuerda en la raíz (pegada al cuerpo) · <b>B</b> cuerda en la punta · <b>C</b> altura desde el cuerpo · <b>D</b> barrido: del borde de ataque en la raíz al de la punta
      </figcaption>
    </figure>
  );
}

/** One part inside a section (the parts of the Carga), with its own title and grid. */
function Block({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  return (
    <fieldset className="sub-block full">
      <legend>{title}{summary && <small>{summary}</small>}</legend>
      <div className="sub-grid">{children}</div>
    </fieldset>
  );
}

/** What the rocket carries: altimeter (Rocket Tec), parachute and extra masses. */
function cargoMass(d: Design) {
  const altimeter = d.type === "estes" && d.altimeter.included ? d.altimeter.mass : 0;
  const chute = d.recovery.kind === "parachute" ? d.recovery.mass : 0;
  return altimeter + chute + d.extras.reduce((s, e) => s + e.mass, 0);
}

/** Whether the Estes altimeter (55 × 18 mm) fits inside the nose with its centre at `position` (from the tip). */
function altimeterFits(d: EstesDesign, position = d.altimeter.position) {
  const front = position - ALTIMETER_MM.length / 2;
  if (front < 0) return false;
  const wall = 1; // printed wall, mm
  const inside = (x: number) => (x >= d.nose.length ? d.body.diameter / 2 : noseRadius(d.nose.shape, x, d.nose.length, d.nose.diameter / 2)) - wall;
  return inside(front) >= ALTIMETER_MM.height / 2;
}

/** The farthest the altimeter centre can sit from the nose base (toward the tip) and still fit, in whole mm. */
function altimeterMaxFromBase(d: EstesDesign) {
  let best = 0;
  for (let fromBase = 0; fromBase <= d.nose.length; fromBase++) if (altimeterFits(d, d.nose.length - fromBase)) best = fromBase;
  return best;
}

/**
 * A new extra mass with a typical value for the program. Rocket Tec: the fire-retardant paper (wadding) that protects
 * the parachute, 150 mm from the rocket base. Water rockets: ballast just inside the body.
 */
function newExtra(d: Design) {
  if (d.type === "water") return { name: "Lastre", mass: 10, position: Math.round(layout(d).bodyStart + 20) };
  return { name: EXTRA_KINDS[0] as string, mass: 3, position: layout(d).length - 150 };
}

/** Where the parachute sits, measured from the rocket base (its aft end) to the centre of the folded parachute. */
function ChutePosition({ d, onChange }: { d: Design; onChange: (position: number) => void }) {
  const length = layout(d).length;
  return (
    <NumField
      label="Distancia desde la base del cohete"
      unit="mm"
      min={0}
      max={length}
      value={round(length - d.recovery.position)}
      onChange={(fromBase) => onChange(length - fromBase)}
      title="Del extremo trasero del cohete (por donde sale el motor) al centro del paracaídas doblado"
    />
  );
}

/**
 * Where the rocket is launched: GPS from the device (best on a phone at the site) or typed by hand, with a map link
 * to check it. The phone usually also knows the altitude, which the flight does use (air density).
 */
function LaunchLocation({ d, set }: { d: Design; set: (patch: Partial<Design["launch"]>) => void }) {
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "ok" | "error"; text: string }>({ kind: "idle", text: "" });
  const { latitude: lat, longitude: lon } = d.launch;
  const has = lat !== undefined && lon !== undefined;

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setStatus({ kind: "error", text: "Este navegador no puede leer la ubicación. Escribe las coordenadas a mano." });
      return;
    }
    setStatus({ kind: "busy", text: "Buscando la señal de GPS…" });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const patch: Partial<Design["launch"]> = { latitude: round6(coords.latitude), longitude: round6(coords.longitude) };
        if (coords.altitude !== null) patch.altitude = Math.round(coords.altitude);
        set(patch);
        setStatus({
          kind: "ok",
          text:
            `Listo, con precisión de ±${Math.round(coords.accuracy)} m.` +
            (coords.altitude !== null ? ` También se puso la altitud: ${Math.round(coords.altitude)} m.` : " Este dispositivo no dio la altitud; escríbela a mano."),
        });
      },
      (e) =>
        setStatus({
          kind: "error",
          text:
            e.code === e.PERMISSION_DENIED
              ? "No se dio permiso para usar la ubicación. Actívalo en el navegador o escribe las coordenadas a mano."
              : e.code === e.TIMEOUT
                ? "El GPS tardó demasiado. Intenta al aire libre o escribe las coordenadas a mano."
                : "No se pudo obtener la ubicación. Escribe las coordenadas a mano.",
        }),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  return (
    <div className="full launch-location">
      <div className="launch-location-head">
        <button type="button" className="btn small" onClick={locate} disabled={status.kind === "busy"}>
          📍 {status.kind === "busy" ? "Buscando…" : "Usar mi ubicación"}
        </button>
        {has && (
          <a className="link" href={`https://www.google.com/maps?q=${lat},${lon}`} target="_blank" rel="noopener noreferrer">
            Ver en el mapa ↗
          </a>
        )}
      </div>
      {status.text && <p className={`hint ${status.kind === "error" ? "launch-error" : ""}`} role="status">{status.text}</p>}
      <div className="launch-coords">
        <CoordField label="Latitud" value={lat} min={-90} max={90} onChange={(latitude) => set({ latitude })} />
        <CoordField label="Longitud" value={lon} min={-180} max={180} onChange={(longitude) => set({ longitude })} />
      </div>
      <p className="hint">
        Mejor en el sitio, desde el celular: presiona el botón y acepta el permiso. Sin estar ahí: en Google Maps haz clic derecho sobre el lugar; el
        primer renglón son las coordenadas (se copian con un clic). Grados decimales, por ejemplo 24.8091 y −107.3940.
      </p>
    </div>
  );
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** A latitude or longitude in decimal degrees; empty means not set. Keeps what is being typed ("-", "24."). */
function CoordField({ label, value, min, max, onChange }: { label: string; value?: number; min: number; max: number; onChange: (v: number | undefined) => void }) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    const typed = Number(text.replace("−", "-").replace(",", "."));
    if (value === undefined ? text.trim() !== "" && !Number.isFinite(typed) : typed !== value) setText(value === undefined ? "" : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const parsed = text.trim() === "" ? undefined : Number(text.replace("−", "-").replace(",", "."));
  const valid = parsed === undefined || (Number.isFinite(parsed) && parsed >= min && parsed <= max);
  return (
    <label className={`field ${valid ? "" : "invalid"}`}>
      <span>{label}</span>
      <span className="control">
        <input
          inputMode="decimal"
          value={text}
          placeholder="—"
          onChange={(e) => {
            setText(e.target.value);
            const v = e.target.value.trim() === "" ? undefined : Number(e.target.value.replace("−", "-").replace(",", "."));
            if (v === undefined || (Number.isFinite(v) && v >= min && v <= max)) onChange(v);
          }}
        />
        <span className="unit">°</span>
      </span>
    </label>
  );
}
