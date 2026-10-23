// The only solid motor used in Rocket Tec: Estes A10-3T (13 mm × 45 mm, 3 s delay).
//
// Thrust curve: NAR certification static test (published on ThrustCurve.org), 30 points.
// Masses: Estes publishes 8.2 g loaded and 3.5 g of propellant; the designs default to the masses
// weighed in the lab (see WEIGHED in model.ts), and both stay editable.

export interface Motor {
  name: string;
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

/** Cumulative impulse at each table point (trapezoid rule). */
function cumulativeImpulse(): number[] {
  const out = [0];
  for (let i = 1; i < TIME.length; i++) out.push(out[i - 1] + ((THRUST[i - 1] + THRUST[i]) / 2) * (TIME[i] - TIME[i - 1]));
  return out;
}

/**
 * The A10-3T with the given loaded and propellant masses (g). Propellant burns in proportion to
 * the impulse already delivered, so the mass curve follows the thrust curve.
 */
export function a10Motor(mass = A10_SPECS.mass, propellant = A10_SPECS.propellant): Motor {
  const cum = cumulativeImpulse();
  const total = cum[cum.length - 1];
  const burnTime = TIME[TIME.length - 1];
  return {
    name: A10_SPECS.name,
    diameter: A10_SPECS.diameter,
    length: A10_SPECS.length,
    delay: A10_SPECS.delay,
    totalImpulse: total,
    averageThrust: total / burnTime,
    maxThrust: Math.max(...THRUST),
    burnTime,
    time: TIME,
    thrust: THRUST,
    mass: cum.map((c) => mass - (propellant * c) / total),
  };
}

/** NAR impulse class letter (A, B, C...) from total impulse. */
export function impulseClass(totalImpulse: number): string {
  let limit = 2.5;
  for (const l of "ABCDEFG") {
    if (totalImpulse <= limit) return l;
    limit *= 2;
  }
  return "H+";
}
