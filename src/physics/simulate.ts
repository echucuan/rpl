// One-dimensional vertical flight (the lab launches straight up), integrated with RK4.
import type { Design } from "../model";
import { MAX_PRESSURE_PSI } from "../model";
import { A10_SPECS, a10Motor, type Motor } from "../motor";
import { air, G } from "./atmosphere";
import { dragModel } from "./drag";
import { centreOfMass, stability, structureItems, waterFill, type MassItem, type Stability } from "./geometry";
import { motorPropulsion, waterPropulsion, WATER_DENSITY, type Propulsion } from "./propulsion";

export interface Sample {
  t: number; // s
  h: number; // m
  v: number; // m/s
  a: number; // m/s²
  thrust: number; // N
  drag: number; // N
  mass: number; // kg
  cd: number; // drag coefficient of the rocket body (without parachute)
  density: number; // kg/m³ of the air at that height
  pressure?: number; // psi gauge inside the bottle (water rockets)
  water?: number; // L left in the bottle (water rockets)
}

/** Integration settings; the defaults are what the app uses. The teaching tabs vary them. */
export interface SimulationOptions {
  method?: "rk4" | "euler";
  /** Fixed time step (s). By default the step adapts to the flight phase. */
  dt?: number;
  /** Turns air resistance off (rocket and parachute), for comparison. */
  noDrag?: boolean;
  /** Stops at apogee (comparisons only need the ascent). */
  untilApogee?: boolean;
}

export interface FlightPoint {
  t: number;
  h: number;
  v: number;
}

export type WarningLevel = "error" | "warning" | "info";

export interface Warning {
  level: WarningLevel;
  text: string;
}

export interface FlightResult {
  samples: Sample[];
  liftoffMass: number; // g
  thrustToWeight: number; // peak thrust (motor) or initial thrust (water) over liftoff weight
  guideExit: FlightPoint | null;
  burnout: FlightPoint | null;
  apogee: FlightPoint;
  ejection: FlightPoint | null;
  landing: FlightPoint | null;
  maxVelocity: number;
  maxAcceleration: number; // m/s², kinematic
  maxMach: number;
  descentRate: number; // m/s near the ground
  /** Delay that would fire the ejection charge closest to apogee (Estes only). */
  idealDelay: number | null;
  stabilityLoaded: Stability;
  stabilityEmpty: Stability;
  /** Every mass at liftoff (structure plus loaded motor or water), for the mass budget. */
  massItems: MassItem[];
  warnings: Warning[];
}

interface Setup {
  propulsion: Propulsion;
  dryMass: number; // kg
  motor?: Motor;
  delay?: number;
  items: MassItem[];
  stabilityLoaded: Stability;
  stabilityEmpty: Stability;
}

function setup(d: Design, groundPressure: number, groundTemperature: number): Setup | string {
  const items = structureItems(d);
  const dry = centreOfMass(items).mass / 1000;
  if (d.type === "estes") {
    if (d.motor.propellant <= 0 || d.motor.propellant >= d.motor.mass) return "Revisa la masa del motor: el propelente debe ser menor que la masa total.";
    const motor = a10Motor(d.motor.mass, d.motor.propellant);
    const end = d.body.length + d.nose.length;
    const x = end - motor.length / 2;
    const loaded = [...items, { name: "Motor", mass: motor.mass[0], x }];
    const empty = [...items, { name: "Motor (quemado)", mass: motor.mass[motor.mass.length - 1], x }];
    return {
      propulsion: motorPropulsion(motor),
      dryMass: dry,
      motor,
      delay: motor.delay,
      items: loaded,
      stabilityLoaded: stability(d, loaded),
      stabilityEmpty: stability(d, empty),
    };
  }
  const water = Math.min(d.water.waterVolume, d.water.bottleVolume * 0.98);
  const loaded = water > 0 ? [...items, { name: "Agua", mass: water * WATER_DENSITY, x: waterFill(d, water).centroid }] : items;
  return {
    propulsion: waterPropulsion(d, groundPressure, groundTemperature),
    dryMass: dry,
    items: loaded,
    stabilityLoaded: stability(d, loaded),
    stabilityEmpty: stability(d, items),
  };
}

export function simulate(d: Design, options: SimulationOptions = {}): FlightResult | string {
  const { method = "rk4", noDrag = false } = options;
  if (d.type === "water") {
    if (d.water.pressure > MAX_PRESSURE_PSI) return `La presión máxima permitida es ${MAX_PRESSURE_PSI} psi.`;
    if (d.water.waterVolume >= d.water.bottleVolume) return "El agua no puede llenar toda la botella: debe quedar aire para empujarla.";
  }
  const site = d.launch;
  const ground = air(0, site.altitude, site.temperature);
  const s = setup(d, ground.pressure, ground.temperature);
  if (typeof s === "string") return s;
  const drag = dragModel(d, s.propulsion.exhaustDiameter);
  const chuteArea = d.recovery.kind === "parachute" ? (Math.PI / 4) * (d.recovery.diameter / 1000) ** 2 : 0;
  const chuteCdA = d.recovery.cd * chuteArea;

  let deployed = false;
  // state: [h, v, ...propulsion]
  const derivatives = (t: number, y: number[]) => {
    const [h, v] = y;
    const atm = air(Math.max(h, 0), site.altitude, site.temperature);
    const p = s.propulsion.evaluate(t, y.slice(2), atm.pressure);
    const mass = s.dryMass + p.mass;
    const speed = Math.abs(v);
    const mach = speed / atm.soundSpeed;
    const cd = noDrag ? 0 : drag.cd(speed, mach, atm.kinematicViscosity, p.active);
    const cdA = cd * drag.refArea + (deployed && !noDrag ? chuteCdA : 0);
    const dragForce = 0.5 * atm.density * v * v * cdA * Math.sign(v);
    let a = (p.thrust - dragForce) / mass - G;
    if (h <= 0 && v <= 0 && a < 0) a = 0; // resting on the pad
    return { dy: [v, a, ...p.derivative], a, thrust: p.thrust, drag: dragForce, mass, active: p.active, mach, cd, density: atm.density, p };
  };

  // One integration step from (t, y) of size dt.
  const step = (t: number, y: number[], dt: number): number[] => {
    const k1 = derivatives(t, y).dy;
    if (method === "euler") return y.map((v, i) => v + dt * k1[i]);
    const k2 = derivatives(t + dt / 2, y.map((v, i) => v + (dt / 2) * k1[i])).dy;
    const k3 = derivatives(t + dt / 2, y.map((v, i) => v + (dt / 2) * k2[i])).dy;
    const k4 = derivatives(t + dt, y.map((v, i) => v + dt * k3[i])).dy;
    return y.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  };

  const samples: Sample[] = [];
  let t = 0;
  let y = [0, 0, ...s.propulsion.initial];
  let first = derivatives(0, y);
  const liftoffMass = first.mass * 1000;
  const thrustToWeight = s.motor ? s.motor.maxThrust / (first.mass * G) : first.thrust / (first.mass * G);

  let guideExit: FlightPoint | null = null;
  let burnout: FlightPoint | null = null;
  let apogee: FlightPoint | null = null;
  let ejection: FlightPoint | null = null;
  let landing: FlightPoint | null = null;
  let maxVelocity = 0, maxAcceleration = 0, maxMach = 0;
  let lifted = false, wasActive = first.active, lastSample = -1;
  const ejectionTime = s.motor && s.delay && s.delay > 0 && d.recovery.deployment === "ejection" ? s.motor.time[s.motor.time.length - 1] + s.delay : null;

  const record = (t: number, y: number[], k: ReturnType<typeof derivatives>) =>
    samples.push({
      t, h: Math.max(y[0], 0), v: y[1], a: k.a, thrust: k.thrust, drag: k.drag, mass: k.mass, cd: k.cd, density: k.density,
      pressure: k.p.gaugePressure, water: k.p.waterVolume,
    });
  record(0, y, first);

  while (t < 600) {
    const dt = options.dt ?? (first.active ? (d.type === "water" ? 5e-5 : 5e-4) : deployed ? 0.01 : 2e-3);
    const next = step(t, y, dt);
    const prev = y;
    t += dt;
    y = next;
    if (y[0] <= 0 && !lifted) { y[0] = 0; y[1] = Math.max(y[1], 0); }
    first = derivatives(t, y);
    if (y[0] > 0.001) lifted = true;

    if (lifted && !guideExit && y[0] >= site.guideLength) guideExit = { t, h: y[0], v: y[1] };
    if (wasActive && !first.active) burnout = { t, h: y[0], v: y[1] };
    wasActive = first.active;
    maxVelocity = Math.max(maxVelocity, y[1]);
    if (!apogee) maxAcceleration = Math.max(maxAcceleration, first.a);
    maxMach = Math.max(maxMach, first.mach);

    if (lifted && !apogee && prev[1] > 0 && y[1] <= 0) {
      apogee = { t, h: y[0], v: 0 };
      if (d.recovery.kind === "parachute" && d.recovery.deployment === "apogee") { deployed = true; ejection = { ...apogee }; }
    }
    if (ejectionTime !== null && !ejection && t >= ejectionTime) {
      ejection = { t, h: y[0], v: y[1] };
      deployed = d.recovery.kind === "parachute";
    }
    const interval = first.active ? 0.002 : 0.02;
    if (t - lastSample >= interval || (options.dt ?? 0) >= interval) { record(t, y, first); lastSample = t; }
    if (apogee && options.untilApogee) break;
    if (lifted && y[0] <= 0 && y[1] < 0) {
      landing = { t, h: 0, v: y[1] };
      if (t > lastSample) record(t, y, first);
      break;
    }
    if (!lifted && t > 5) break; // never left the pad
  }

  const descentRate = landing ? Math.abs(landing.v) : 0;
  const result: FlightResult = {
    samples,
    liftoffMass,
    thrustToWeight,
    guideExit,
    burnout,
    apogee: apogee ?? { t: 0, h: 0, v: 0 },
    ejection,
    landing,
    maxVelocity,
    maxAcceleration,
    maxMach,
    descentRate,
    idealDelay: s.motor && burnout && apogee ? apogee.t - burnout.t : null,
    stabilityLoaded: s.stabilityLoaded,
    stabilityEmpty: s.stabilityEmpty,
    massItems: s.items,
    warnings: [],
  };
  result.warnings = warnings(d, result, lifted);
  return result;
}

function warnings(d: Design, r: FlightResult, lifted: boolean): Warning[] {
  const w: Warning[] = [];
  if (!lifted) {
    w.push({ level: "error", text: "El cohete no despega: el empuje es menor que su peso." });
    return w;
  }
  // Water leaves the bottle in a fraction of a second, so the coasting (empty) margin is what
  // matters; the loaded margin only matters if thrust lasts beyond the guide.
  const minMargin = d.type === "water" ? r.stabilityEmpty.margin : Math.min(r.stabilityLoaded.margin, r.stabilityEmpty.margin);
  if (minMargin < 1) w.push({ level: "error", text: `Inestable: el margen de estabilidad es ${minMargin.toFixed(2)} calibres (se recomienda entre 1 y 2). Mueve el centro de gravedad hacia la nariz o agranda las aletas.` });
  if (d.type === "water" && r.stabilityLoaded.margin < 1 && r.burnout) {
    // A thrust phase of a few tenths of a second leaves no time for the rocket to turn.
    const pastGuide = r.burnout.h > d.launch.guideLength;
    w.push({
      level: r.burnout.t > 0.2 && pastGuide ? "warning" : "info",
      text: `Con el agua adentro el margen es ${r.stabilityLoaded.margin.toFixed(2)} calibres, porque el agua queda en la cola. El empuje dura solo ${(r.burnout.t * 1000).toFixed(0)} ms${pastGuide ? ` (termina a ${r.burnout.h.toFixed(1)} m, ya fuera de la guía)` : ", todavía dentro de la guía"}; lo que más importa es el margen sin agua.`,
    });
  }
  else if (Math.max(r.stabilityLoaded.margin, r.stabilityEmpty.margin) > 3) w.push({ level: "warning", text: "Sobreestable (más de 3 calibres): con viento tenderá a girar contra él." });
  // For the A10-3T, Estes states the limit as a maximum liftoff mass (checked below) instead of a thrust-to-weight ratio.
  if (r.guideExit && r.guideExit.v < 10) w.push({ level: "warning", text: `Sale de la guía a solo ${r.guideExit.v.toFixed(1)} m/s; abajo de 10 m/s las aletas todavía no estabilizan bien.` });
  if (d.recovery.kind === "none" || d.recovery.deployment === "none") w.push({ level: "warning", text: "Sin paracaídas: el cohete cae libremente. Revisa la zona de seguridad." });
  if (d.type === "estes" && d.recovery.kind === "parachute" && !r.ejection) w.push({ level: "error", text: "El cohete toca el suelo antes de que se active la eyección del motor." });
  if (d.type === "estes" && r.liftoffMass > A10_SPECS.maxLiftoffMass) w.push({ level: "error", text: `Pesa ${r.liftoffMass.toFixed(0)} g al despegar: Estes indica un máximo de ${A10_SPECS.maxLiftoffMass} g para el motor A10-3T. Aligera las piezas impresas.` });
  if (r.ejection && Math.abs(r.ejection.v) > 20) w.push({ level: "warning", text: `El paracaídas se abre a ${Math.abs(r.ejection.v).toFixed(0)} m/s: puede romperse o desprenderse. El retardo ideal sería ${r.idealDelay?.toFixed(1) ?? "-"} s y el del A10-3T es de 3 s: ajusta la masa o el arrastre.` });
  if (r.landing && d.recovery.kind === "parachute" && r.ejection && r.descentRate > 6) w.push({ level: "warning", text: `Aterriza a ${r.descentRate.toFixed(1)} m/s; arriba de 6 m/s puede dañarse. Usa un paracaídas más grande.` });
  if (r.maxMach > 0.7) w.push({ level: "info", text: "Velocidad cercana a la del sonido: el modelo de arrastre pierde precisión arriba de Mach 0.7." });
  return w;
}
