// Estes motors of classes A to D, to look at and compare in "Elige tu motor". Only for viewing: the challenge
// flies the A10-3T (the motor of MOTORS in motor.ts, the one that fits the 13 mm motor mount), so these never
// go into a design.
//
// Data: ThrustCurve.org (search and download API), the Estes motors in production. The thrust curve is the
// NAR certification when there is one with the right impulse, otherwise the curve shared by users.

import { MOTORS, impulseClass } from "./motor";

export interface CatalogMotor {
  /** Estes name without the delay, e.g. "B6"; the full name is `${name}-${delay}`. */
  name: string;
  diameter: number; // mm
  length: number; // mm
  /** Delays sold (s); 0 = booster, without ejection charge. */
  delays: number[];
  impulse: number; // N·s
  averageThrust: number; // N
  maxThrust: number; // N
  burnTime: number; // s
  mass: number; // g, loaded
  propellant: number; // g
  source: string;
  time: number[]; // s
  thrust: number[]; // N
}

const a10 = MOTORS["A10-3T"];

export const CATALOG: CatalogMotor[] = [
  {
    name: "A10", diameter: 13, length: 45, delays: [0, 3],
    // Masses as Estes publishes them (the same as the challenge motor's sheet); ThrustCurve lists 7 g and 3.6 g.
    impulse: 1.88, averageThrust: 1.78, maxThrust: 9.74, burnTime: 1.06, mass: a10.rated.mass, propellant: a10.rated.propellant,
    source: "Certificación NAR (ThrustCurve.org)",
    time: a10.certified.time,
    thrust: a10.certified.thrust,
  },
  {
    name: "A3", diameter: 13, length: 45, delays: [2, 4, 6],
    impulse: 2.22, averageThrust: 2.2, maxThrust: 5.83, burnTime: 1.01, mass: 8.5, propellant: 3.3,
    source: "Datos de usuarios (ThrustCurve.org)",
    time: [0, 0.024, 0.048, 0.086, 0.11, 0.14, 0.159, 0.18, 0.199, 0.215, 0.234, 0.258, 0.315, 0.441, 0.554, 0.605, 0.673, 0.764, 0.874, 0.931, 0.953, 0.966, 0.977, 0.993, 1.01],
    thrust: [0, 0.195, 0.899, 2.658, 4.183, 5.83, 5.395, 4.301, 3.635, 2.736, 2.267, 2.15, 2.072, 1.993, 2.033, 2.072, 1.954, 1.954, 2.072, 2.15, 2.072, 1.719, 1.173, 0.547, 0],
  },
  {
    name: "A8", diameter: 18, length: 70, delays: [0, 3, 5],
    impulse: 2.5, averageThrust: 3.18, maxThrust: 9.73, burnTime: 0.73, mass: 16.3, propellant: 3.3,
    source: "Certificación NAR (ThrustCurve.org)",
    time: [0, 0.041, 0.084, 0.127, 0.166, 0.192, 0.206, 0.226, 0.236, 0.247, 0.261, 0.277, 0.306, 0.351, 0.405, 0.467, 0.532, 0.589, 0.632, 0.652, 0.668, 0.684, 0.703, 0.73],
    thrust: [0, 0.512, 2.115, 4.358, 6.794, 8.588, 9.294, 9.73, 8.845, 7.179, 5.063, 3.717, 3.205, 2.884, 2.499, 2.371, 2.307, 2.371, 2.371, 2.243, 1.794, 1.153, 0.448, 0],
  },
  {
    name: "B4", diameter: 18, length: 70, delays: [2, 4, 6],
    impulse: 5, averageThrust: 4.17, maxThrust: 12.75, burnTime: 1.03, mass: 18.9, propellant: 6,
    source: "Datos de usuarios (ThrustCurve.org)",
    time: [0, 0.058, 0.102, 0.122, 0.15, 0.18, 0.199, 0.208, 0.216, 0.238, 0.245, 0.262, 0.293, 0.322, 0.357, 0.388, 0.416, 0.46, 0.502, 0.544, 0.575, 0.605, 0.674, 0.731, 0.88, 0.915, 0.96, 1, 1.047, 1.049],
    thrust: [0, 2.361, 2.921, 3.797, 5.866, 8.373, 9.882, 10.88, 11.367, 11.245, 10.832, 8.982, 6.134, 5.306, 4.917, 4.795, 4.746, 4.625, 4.576, 4.357, 4.503, 4.527, 4.552, 4.454, 4.454, 4.503, 4.406, 4.065, 2.556, 0],
  },
  {
    name: "B6", diameter: 18, length: 70, delays: [0, 2, 4, 6],
    impulse: 4.33, averageThrust: 5.03, maxThrust: 12.14, burnTime: 0.86, mass: 19.1, propellant: 5.6,
    source: "Certificación NAR (ThrustCurve.org)",
    time: [0, 0.036, 0.064, 0.082, 0.111, 0.135, 0.146, 0.172, 0.181, 0.191, 0.211, 0.239, 0.264, 0.275, 0.333, 0.394, 0.445, 0.556, 0.667, 0.723, 0.78, 0.793, 0.812, 0.833, 0.857],
    thrust: [0, 1.364, 2.727, 4.215, 6.694, 9.05, 9.545, 11.901, 12.149, 11.901, 9.174, 7.314, 6.074, 5.95, 5.207, 4.835, 4.835, 4.339, 4.587, 4.339, 4.339, 4.091, 2.603, 1.24, 0],
  },
  {
    name: "C5", diameter: 18, length: 70, delays: [3],
    impulse: 7.79, averageThrust: 3.91, maxThrust: 20.41, burnTime: 1.99, mass: 24.8, propellant: 11.3,
    source: "Certificación NAR (ThrustCurve.org)",
    time: [0, 0.005, 0.031, 0.063, 0.117, 0.151, 0.168, 0.174, 0.179, 0.199, 0.211, 0.217, 0.23, 0.234, 0.239, 0.252, 0.258, 0.265, 0.28, 0.296, 0.349, 0.438, 0.504, 0.611, 0.815, 0.97, 1.335, 1.598, 1.794, 1.96, 1.987, 1.992],
    thrust: [0, 1.422, 2.695, 5.503, 10.444, 14.374, 16.358, 16.471, 17.594, 18.604, 19.877, 20.401, 20.289, 18.679, 18.23, 13.813, 9.021, 6.588, 4.904, 4.08, 3.481, 2.995, 2.733, 2.807, 2.695, 2.695, 2.695, 2.658, 2.695, 2.733, 1.16, 0],
  },
  {
    name: "C6", diameter: 18, length: 70, delays: [0, 3, 5, 7],
    impulse: 8.82, averageThrust: 4.74, maxThrust: 14.09, burnTime: 1.86, mass: 24.1, propellant: 10.8,
    source: "Certificación NAR (ThrustCurve.org)",
    time: [0, 0.031, 0.092, 0.139, 0.192, 0.209, 0.231, 0.248, 0.292, 0.37, 0.475, 0.671, 0.702, 0.723, 0.85, 1.063, 1.211, 1.242, 1.303, 1.468, 1.656, 1.821, 1.834, 1.847, 1.86],
    thrust: [0, 0.946, 4.826, 9.936, 14.09, 11.446, 7.381, 6.151, 5.489, 4.921, 4.448, 4.258, 4.542, 4.164, 4.448, 4.353, 4.353, 4.069, 4.258, 4.353, 4.448, 4.448, 2.933, 1.325, 0],
  },
  {
    name: "C11", diameter: 24, length: 70, delays: [0, 3, 5, 7],
    impulse: 8.8, averageThrust: 10.86, maxThrust: 21.73, burnTime: 0.81, mass: 35.2, propellant: 12,
    source: "Datos de usuarios (ThrustCurve.org)",
    time: [0, 0.034, 0.066, 0.107, 0.145, 0.183, 0.214, 0.226, 0.256, 0.281, 0.298, 0.306, 0.323, 0.337, 0.358, 0.385, 0.413, 0.468, 0.539, 0.619, 0.683, 0.715, 0.726, 0.74, 0.758, 0.778, 0.795, 0.81],
    thrust: [0, 1.692, 3.782, 7.566, 10.946, 14.832, 17.618, 18.213, 20.107, 21.208, 21.73, 20.206, 17.321, 14.931, 13.236, 11.947, 11.65, 10.946, 10.45, 10.648, 10.648, 10.648, 10.053, 8.163, 5.773, 3.185, 1.394, 0],
  },
  {
    name: "D12", diameter: 24, length: 70, delays: [0, 3, 5, 7],
    impulse: 16.84, averageThrust: 10.21, maxThrust: 29.73, burnTime: 1.65, mass: 44, propellant: 21.1,
    source: "Datos de usuarios (ThrustCurve.org)",
    time: [0, 0.049, 0.116, 0.184, 0.237, 0.282, 0.297, 0.311, 0.322, 0.348, 0.386, 0.442, 0.546, 0.718, 0.879, 1.066, 1.257, 1.436, 1.59, 1.612, 1.65],
    thrust: [0, 2.569, 9.369, 17.275, 24.258, 29.73, 27.01, 22.589, 17.99, 14.126, 12.099, 10.808, 9.876, 9.306, 9.105, 8.901, 8.698, 8.31, 8.294, 4.613, 0],
  },
];

/** The challenge's motor, as it appears in the catalogue. */
export const CHALLENGE = { name: "A10", delay: 3 };

export const catalogClass = (m: CatalogMotor) => impulseClass(m.impulse);
export const fullName = (m: CatalogMotor, delay: number) => `${m.name}-${delay}${m.diameter === 13 ? "T" : ""}`;
export const thrustCurveUrl = (m: CatalogMotor) => `https://www.thrustcurve.org/motors/Estes/${m.name}/`;
