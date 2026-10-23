// Estes motors and parts extracted from OpenRocket's databases (see scripts/extract-openrocket-data.mjs).
import motorsData from "./data/motors.json";
import partsData from "./data/parts.json";
import type { NoseShape } from "./model";
import { noseProperties } from "./physics/geometry";

export interface Motor {
  id: string;
  name: string;
  diameter: number; // mm
  length: number; // mm
  delays: number[]; // s; 0 means a booster motor without ejection charge
  totalImpulse: number; // N·s
  averageThrust: number; // N
  maxThrust: number; // N
  burnTime: number; // s
  propellant: string;
  time: number[]; // s
  thrust: number[]; // N
  mass: number[]; // g, total motor mass at each time point
}

export interface Part {
  kind: "bodyTube" | "noseCone" | "parachute" | "launchLug" | "engineBlock" | "centeringRing" | "tubeCoupler";
  partNumber: string;
  description: string;
  material: string;
  density: number; // kg/m³ (bulk), kg/m² (surface)
  insideDiameter?: number; // mm
  outsideDiameter?: number;
  length?: number;
  shoulderDiameter?: number;
  shoulderLength?: number;
  diameter?: number;
  lineLength?: number;
  thickness?: number;
  shape?: string;
  filled?: boolean;
  lineCount?: number;
  lineDensity?: number; // kg/m
  mass?: number; // g, when the database states it
}

export const MOTORS = motorsData as Motor[];
export const PARTS = partsData as Part[];

export function motorById(id: string): Motor | undefined {
  return MOTORS.find((m) => m.id === id);
}

export const MOUNT_DIAMETERS = [...new Set(MOTORS.map((m) => m.diameter))].sort((a, b) => a - b);

/** NAR impulse class letter (A, B, C...) from total impulse. */
export function impulseClass(totalImpulse: number): string {
  const letters = "ABCDEFG";
  let limit = 2.5;
  for (const l of letters) {
    if (totalImpulse <= limit) return l;
    limit *= 2;
  }
  return "H+";
}

export const partsOf = (kind: Part["kind"]) => PARTS.filter((p) => p.kind === kind && !/tail cone|nozzle/i.test(p.description));

/** Readable label: the description without the trailing part number. */
export function partLabel(p: Part): string {
  return p.description.replace(/,?\s*PN\s+[\w/ ]+$/, "");
}

const GRAMS_PER_KG_MM3 = 1e-6; // (kg/m³)·mm³ → g

export function bodyTubeMass(p: Part, length = p.length ?? 0): number {
  if (p.mass !== undefined && length === p.length) return p.mass;
  const od = p.outsideDiameter ?? 0, id = p.insideDiameter ?? od;
  return (Math.PI / 4) * (od * od - id * id) * length * p.density * GRAMS_PER_KG_MM3;
}

export function noseShapeOf(p: Part): NoseShape {
  const s = p.shape ?? "";
  if (s.includes("conical")) return "conical";
  if (s.includes("ellip")) return "elliptical";
  if (s.includes("parabol") || s.includes("haack") || s.includes("power")) return "parabolic";
  return "ogive";
}

export function noseConeMass(p: Part): number {
  if (p.mass !== undefined) return p.mass;
  const d = p.outsideDiameter ?? 0, length = p.length ?? 0;
  const props = noseProperties(noseShapeOf(p), length, d);
  const shoulderD = p.shoulderDiameter ?? d, shoulderL = p.shoulderLength ?? 0;
  if (p.filled) {
    const shoulder = (Math.PI / 4) * shoulderD * shoulderD * shoulderL;
    return (props.volume + shoulder) * p.density * GRAMS_PER_KG_MM3;
  }
  const wall = p.thickness ?? 1.5; // Estes plastic nose cones are roughly 1–2 mm thick
  const shoulder = Math.PI * shoulderD * shoulderL;
  return (props.surface + shoulder) * wall * p.density * GRAMS_PER_KG_MM3;
}

export function parachuteMass(p: Part): number {
  if (p.mass !== undefined) return p.mass;
  const d = (p.diameter ?? 0) / 1000;
  const canopy = (Math.PI / 4) * d * d * p.density * 1000;
  const lines = (p.lineCount ?? 0) * ((p.lineLength ?? 0) / 1000) * (p.lineDensity ?? 0) * 1000;
  return canopy + lines;
}

/** Mass of an annular part (engine block, centering ring, coupler, launch lug). */
export function ringMass(p: Part): number {
  if (p.mass !== undefined) return p.mass;
  const od = p.outsideDiameter ?? 0, id = p.insideDiameter ?? 0;
  return (Math.PI / 4) * (od * od - id * id) * (p.length ?? 0) * p.density * GRAMS_PER_KG_MM3;
}

export function partMass(p: Part): number {
  switch (p.kind) {
    case "bodyTube": return bodyTubeMass(p);
    case "noseCone": return noseConeMass(p);
    case "parachute": return parachuteMass(p);
    default: return ringMass(p);
  }
}
