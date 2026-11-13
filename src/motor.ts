// Solid motors for Rocket Tec. For now the catalogue holds a single motor, the Estes A10-3T
// (13 mm × 45 mm, 3 s delay); new motors are added to MOTORS and MAKERS and every screen offers them.
//
// Each motor has two thrust curves:
//   - certified: the NAR certification static test (published on ThrustCurve.org). The simulator uses it.
//   - maker: the curve drawn on the manufacturer's product page, read point by point from the drawing.
// Masses: Estes publishes 8.2 g loaded and 3.5 g of propellant; the designs default to the masses
// weighed in the lab (see WEIGHED in model.ts), and both stay editable.

/**
 * How the simulation models the thrust:
 *   - real: the certified thrust curve, point by point.
 *   - average: a constant force equal to the average thrust (same impulse and burn time). Simpler for hand
 *     calculations, less accurate: it has no initial peak. The simplified model also ignores the propellant
 *     burnt, so the motor mass (and the rocket's weight) stays constant.
 */
export type ThrustModel = "real" | "average";

export interface Motor {
  name: string;
  model: ThrustModel;
  diameter: number; // mm
  length: number; // mm
  delay: number; // s
  totalImpulse: number; // N·s, from the curve
  averageThrust: number; // N
  maxThrust: number; // N
  burnTime: number; // s
  time: number[]; // s
  thrust: number[]; // N
  mass: number[]; // g, total motor mass at each time point
}

const TIME = [0, 0.016, 0.04, 0.062, 0.078, 0.096, 0.122, 0.138, 0.162, 0.18, 0.198, 0.212, 0.224, 0.238, 0.268, 0.292, 0.324, 0.364, 0.396, 0.446, 0.49, 0.574, 0.676, 0.782, 0.886, 0.98, 1.006, 1.038, 1.05, 1.06];
const THRUST = [0, 0.492, 0.752, 0.962, 2.051, 2.858, 4.611, 6.054, 8.1, 9.502, 9.74, 8.204, 4.53, 2.054, 1.414, 1.385, 1.067, 1.099, 0.957, 0.995, 0.901, 0.909, 0.909, 1.031, 1.048, 1.029, 0.995, 1.049, 0.741, 0];

export const A10_SPECS = {
  name: "A10-3T",
  diameter: 13,
  length: 45,
  delay: 3,
  mass: 8.2, // g, Estes
  propellant: 3.5, // g, Estes
  ratedImpulse: 2.5, // N·s, Estes nominal
  ratedMaxThrust: 13, // N, Estes nominal
  ratedBurnTime: 0.8, // s, Estes nominal
  maxLiftoffMass: 85, // g, Estes "max lift weight"
};

export type MotorId = "A10-3T";
export type MakerId = "estes";

export interface Curve {
  time: number[]; // s
  thrust: number[]; // N
  source: string;
}

/** Everything known about a motor model, as published by its manufacturer and its certification. */
export interface MotorSpec {
  id: MotorId;
  maker: MakerId;
  name: string;
  /** Product page with the manufacturer's data. */
  url: string;
  diameter: number; // mm
  length: number; // mm, used for the rocket geometry
  delay: number; // s
  /** Values printed by the manufacturer (nominal). */
  rated: {
    impulse: number; // N·s
    maxThrust: number; // N
    burnTime: number; // s
    maxLiftoffMass: number; // g ("max lift weight")
    mass: number; // g, loaded motor
    propellant: number; // g
    lengthText: string; // as printed, e.g. "1.8 in (4.6 cm)"
  };
  certified: Curve;
  makerCurve: Curve;
}

// Estes A10 drawing on estesrockets.com, read point by point (its "10" label sits on the 12 N line).
const ESTES_A10_TIME = [0, 0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14, 0.155, 0.165, 0.172, 0.18, 0.19, 0.2, 0.21, 0.22, 0.235, 0.26, 0.5, 0.79, 0.805, 0.82, 0.835];
const ESTES_A10_THRUST = [0, 0.4, 1, 1.8, 2.9, 4.4, 6.4, 9, 11.3, 12.7, 12.8, 11.5, 8.5, 5.5, 3, 1.8, 1.3, 1.15, 1.1, 1.1, 1, 0.5, 0];

export const MOTORS: Record<MotorId, MotorSpec> = {
  "A10-3T": {
    id: "A10-3T",
    maker: "estes",
    name: A10_SPECS.name,
    url: "https://estesrockets.com/products/a10-3t-engines",
    diameter: A10_SPECS.diameter,
    length: A10_SPECS.length,
    delay: A10_SPECS.delay,
    rated: {
      impulse: A10_SPECS.ratedImpulse,
      maxThrust: A10_SPECS.ratedMaxThrust,
      burnTime: A10_SPECS.ratedBurnTime,
      maxLiftoffMass: A10_SPECS.maxLiftoffMass,
      mass: A10_SPECS.mass,
      propellant: A10_SPECS.propellant,
      lengthText: "1.8 in (4.6 cm)",
    },
    certified: { time: TIME, thrust: THRUST, source: "Prueba de certificación de la NAR (ThrustCurve.org)" },
    makerCurve: { time: ESTES_A10_TIME, thrust: ESTES_A10_THRUST, source: "Gráfica de Estes (leída punto por punto, aproximada)" },
  },
};

export const MAKERS: { id: MakerId; name: string; motors: MotorId[] }[] = [{ id: "estes", name: "Estes", motors: ["A10-3T"] }];

export const DEFAULT_MOTOR: MotorId = "A10-3T";

export const makerName = (id: MakerId) => MAKERS.find((m) => m.id === id)?.name ?? id;

/** The spec of a motor id, falling back to the default for unknown ids (e.g. a file from a newer version). */
export const motorSpec = (id: string | undefined): MotorSpec => MOTORS[id as MotorId] ?? MOTORS[DEFAULT_MOTOR];

/** Area under a thrust curve (trapezoid rule), N·s. */
export function curveImpulse(c: { time: number[]; thrust: number[] }): number {
  let total = 0;
  for (let i = 1; i < c.time.length; i++) total += ((c.thrust[i - 1] + c.thrust[i]) / 2) * (c.time[i] - c.time[i - 1]);
  return total;
}

/**
 * The selected motor with the given loaded and propellant masses (g), using its certified curve.
 * Propellant burns in proportion to the impulse already delivered, so the mass curve follows the thrust curve.
 */
export function motorFor({ id, mass, propellant, thrust: model = "real" }: { id?: string; mass: number; propellant: number; thrust?: ThrustModel }): Motor {
  const spec = motorSpec(id);
  const real = spec.certified;
  const realImpulse = curveImpulse(real);
  const realBurn = real.time[real.time.length - 1];
  // Constant thrust: a two-point table [0, t_b] at the average thrust, so interpolation gives the same force all the burn.
  const { time, thrust } = model === "average"
    ? { time: [0, realBurn], thrust: [realImpulse / realBurn, realImpulse / realBurn] }
    : real;
  const cum = [0];
  for (let i = 1; i < time.length; i++) cum.push(cum[i - 1] + ((thrust[i - 1] + thrust[i]) / 2) * (time[i] - time[i - 1]));
  const total = cum[cum.length - 1];
  const burnTime = time[time.length - 1];
  return {
    name: spec.name,
    model,
    diameter: spec.diameter,
    length: spec.length,
    delay: spec.delay,
    totalImpulse: total,
    averageThrust: total / burnTime,
    maxThrust: Math.max(...thrust),
    burnTime,
    time,
    thrust,
    // Simplified model: the propellant burnt is ignored, so the motor keeps its loaded mass.
    mass: model === "average" ? cum.map(() => mass) : cum.map((c) => mass - (propellant * c) / total),
  };
}

/** Average thrust of a motor's certified curve: impulse / burn time (N). */
export function averageThrust(spec: MotorSpec): { force: number; burnTime: number; impulse: number } {
  const impulse = curveImpulse(spec.certified);
  const burnTime = spec.certified.time[spec.certified.time.length - 1];
  return { force: impulse / burnTime, burnTime, impulse };
}

/** Points to draw a motor's thrust table, closing the rectangle of the constant-thrust model at both ends. */
export function thrustPoints(m: Pick<Motor, "time" | "thrust" | "model">): { x: number; y: number }[] {
  const pts = m.time.map((x, i) => ({ x, y: m.thrust[i] }));
  if (m.model !== "average") return pts;
  return [{ x: 0, y: 0 }, ...pts, { x: m.time[m.time.length - 1], y: 0 }];
}

/** The A10-3T with the given masses (kept for the tests and older code). */
export const a10Motor = (mass = A10_SPECS.mass, propellant = A10_SPECS.propellant): Motor => motorFor({ id: "A10-3T", mass, propellant });

/** NAR impulse class letter (A, B, C...) from total impulse. */
export function impulseClass(totalImpulse: number): string {
  let limit = 2.5;
  for (const l of "ABCDEFG") {
    if (totalImpulse <= limit) return l;
    limit *= 2;
  }
  return "H+";
}
