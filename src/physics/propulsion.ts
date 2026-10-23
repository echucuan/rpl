// Thrust sources: Estes motor thrust curves and the compressed-air water rocket.
import type { Motor } from "../catalog";
import type { WaterDesign } from "../model";
import { MAX_PRESSURE_PSI, PSI } from "../model";
import { GAMMA, R_AIR } from "./atmosphere";

export interface PropulsionState {
  thrust: number; // N
  mass: number; // kg of the propulsion system (motor, or water + air)
  active: boolean;
  derivative: number[]; // d/dt of the extra state
  gaugePressure?: number; // psi above ambient inside the bottle
  waterVolume?: number; // L left in the bottle
}

export interface Propulsion {
  initial: number[];
  /** Diameter (mm) of the exhaust, used for base drag while thrusting. */
  exhaustDiameter: number;
  evaluate(t: number, extra: number[], ambientPressure: number): PropulsionState;
}

function interpolate(xs: number[], ys: number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid; else hi = mid;
  }
  return ys[lo] + ((ys[hi] - ys[lo]) * (x - xs[lo])) / (xs[hi] - xs[lo]);
}

export function motorPropulsion(m: Motor): Propulsion {
  const end = m.time[m.time.length - 1];
  return {
    initial: [],
    exhaustDiameter: m.diameter * 0.5, // nozzle throat region of a black-powder motor
    evaluate(t) {
      const active = t < end;
      return {
        thrust: active ? interpolate(m.time, m.thrust, t) : 0,
        mass: interpolate(m.time, m.mass, t) / 1000,
        active,
        derivative: [],
      };
    },
  };
}

export const WATER_DENSITY = 997; // kg/m³
const NOZZLE_DISCHARGE = 0.97;

/**
 * Water rocket: air expands adiabatically while pushing water out of the nozzle (Bernoulli),
 * then the remaining compressed air escapes (choked or subsonic nozzle flow).
 * Extra state: [water volume m³, air mass kg].
 */
export function waterPropulsion(d: WaterDesign, ambientPressure: number, ambientTemperature: number): Propulsion {
  const w = d.water;
  const bottle = w.bottleVolume / 1000;
  const water0 = Math.min(Math.max(w.waterVolume / 1000, 0), bottle * 0.98);
  const gauge = Math.min(Math.max(w.pressure, 0), MAX_PRESSURE_PSI) * PSI;
  const p0 = ambientPressure + gauge;
  const air0 = bottle - water0;
  const rho0 = p0 / (R_AIR * ambientTemperature);
  const nozzleArea = (Math.PI / 4) * (w.nozzleDiameter / 1000) ** 2;
  const bottleArea = (Math.PI / 4) * (d.body.diameter / 1000) ** 2;
  const areaFactor = 1 - Math.min((nozzleArea / bottleArea) ** 2, 0.9);
  const criticalRatio = Math.pow((GAMMA + 1) / 2, GAMMA / (GAMMA - 1));

  return {
    initial: [water0, rho0 * air0],
    exhaustDiameter: w.nozzleDiameter,
    evaluate(_t, [waterVolume, airMass], pa) {
      const water = Math.max(waterVolume, 0);
      const airVolume = bottle - water;
      const rho = Math.max(airMass, 0) / airVolume;
      const p = p0 * Math.pow(rho / rho0, GAMMA);
      const mass = water * WATER_DENSITY + Math.max(airMass, 0);
      const info = { gaugePressure: Math.max(p - pa, 0) / PSI, waterVolume: water * 1000 };
      const none = { thrust: 0, mass, active: false, derivative: [0, 0], ...info };
      if (p <= pa * 1.0005) return none;

      if (water > 0) {
        const u = Math.sqrt((2 * (p - pa)) / (WATER_DENSITY * areaFactor));
        const flow = NOZZLE_DISCHARGE * nozzleArea * u; // m³/s
        return { thrust: WATER_DENSITY * flow * u, mass, active: true, derivative: [-flow, 0], ...info };
      }

      const temperature = p / (rho * R_AIR);
      let massFlow: number, thrust: number;
      if (p / pa >= criticalRatio) {
        const exitT = (2 * temperature) / (GAMMA + 1);
        const exitP = p / criticalRatio;
        const exitU = Math.sqrt(GAMMA * R_AIR * exitT);
        massFlow = NOZZLE_DISCHARGE * nozzleArea * (exitP / (R_AIR * exitT)) * exitU;
        thrust = massFlow * exitU + (exitP - pa) * nozzleArea;
      } else {
        const exitT = temperature * Math.pow(pa / p, (GAMMA - 1) / GAMMA);
        const exitU = Math.sqrt(((2 * GAMMA) / (GAMMA - 1)) * R_AIR * (temperature - exitT));
        massFlow = NOZZLE_DISCHARGE * nozzleArea * (pa / (R_AIR * exitT)) * exitU;
        thrust = massFlow * exitU;
      }
      return { thrust, mass, active: true, derivative: [0, -massFlow], ...info };
    },
  };
}
