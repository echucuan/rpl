// Drag coefficient build-up (subsonic), following the component method used by OpenRocket:
// skin friction + nose and fin pressure drag + base drag, referenced to the body cross-section.
import type { Design, FinProfile } from "../model";
import { layout, wettedAreas } from "./geometry";

/** Surface roughness height (m): painted paper tubes and smooth PLA prints are both ~60 µm. */
const ROUGHNESS = 60e-6;

/** Pressure drag of the fin edges per unit frontal area (leading + trailing edge). */
const FIN_EDGE_CD: Record<FinProfile, number> = { square: 0.97, rounded: 0.18, airfoil: 0.03 };

export interface DragModel {
  refArea: number; // m²
  /** Drag coefficient at the given speed (m/s), Mach number and kinematic viscosity (m²/s). */
  cd(speed: number, mach: number, viscosity: number, thrusting: boolean): number;
}

export function dragModel(d: Design, motorDiameterMm = 0): DragModel {
  const l = layout(d);
  const refD = l.refDiameter / 1000;
  const refArea = (Math.PI / 4) * refD * refD;
  const length = l.length / 1000;
  const wet = wettedAreas(d);
  const fineness = length / refD;
  const f = d.fins;
  const meanChord = (f.rootChord + f.tipChord) / 2;
  const bodyFactor = (1 + 1 / (2 * fineness)) * (wet.body / 1e6);
  const finFactor = (1 + (2 * f.thickness) / Math.max(meanChord, 1)) * (wet.fins / 1e6);
  const roughCf = 0.032 * Math.pow(ROUGHNESS / length, 0.2);

  // Fin leading-edge sweep angle: drag of the leading edge scales with cos²Λ.
  const sweepAngle = Math.atan2(f.sweep, Math.max(f.span, 1e-6));
  const finFrontal = (f.count * f.thickness * f.span) / 1e6;
  const finPressure = (FIN_EDGE_CD[f.profile] * Math.cos(sweepAngle) ** 2 * finFrontal) / refArea;

  // Conical noses have a small subsonic pressure drag; rounded shapes essentially none.
  const halfAngle = Math.atan2(d.nose.diameter / 2, d.nose.length);
  const nosePressure = d.nose.shape === "conical" ? 0.8 * Math.sin(halfAngle) ** 2 : 0;

  const aftArea = (Math.PI / 4) * (l.aftDiameter / 1000) ** 2;
  const motorArea = (Math.PI / 4) * (motorDiameterMm / 1000) ** 2;

  return {
    refArea,
    cd(speed, mach, viscosity, thrusting) {
      if (d.cdOverride !== undefined && d.cdOverride > 0) return d.cdOverride;
      const re = Math.max(speed, 0.1) * length / viscosity;
      const turbulentCf = re < 1e4 ? 1.48e-2 : 1 / (1.5 * Math.log(re) - 5.6) ** 2;
      const cf = Math.max(turbulentCf, roughCf) * (1 - 0.1 * mach * mach);
      const friction = (cf * (bodyFactor + finFactor)) / refArea;
      // The exhaust fills the motor's nozzle area while thrusting, which removes that part of the base drag.
      const baseArea = Math.max(aftArea - (thrusting ? motorArea : 0), 0);
      const base = ((0.12 + 0.13 * mach * mach) * baseArea) / refArea;
      return friction + nosePressure + finPressure + base;
    },
  };
}
