// Design model shared by the UI and the physics. Lengths in millimetres, masses in grams,
// pressures in psi (the unit of the lab's compressor gauge). Physics converts to SI.

export type NoseShape = "ogive" | "conical" | "elliptical" | "parabolic";
export type FinProfile = "square" | "rounded" | "airfoil";

export interface NoseCone {
  shape: NoseShape;
  length: number; // exposed length, without shoulder
  diameter: number;
  mass: number;
  catalog?: string; // Estes part description, when picked from the catalog
}

export interface BodyTube {
  length: number;
  diameter: number; // outside diameter
  mass: number;
  catalog?: string;
  massPerMm?: number; // set for catalog tubes so cutting the tube rescales its mass
}

/** Diameter reduction behind the body: the bottle shoulder and neck of a water rocket. */
export interface Tail {
  length: number;
  aftDiameter: number;
}

export interface FinSet {
  count: number;
  rootChord: number;
  tipChord: number;
  span: number; // height from the body surface
  sweep: number; // axial distance from root leading edge to tip leading edge
  thickness: number;
  profile: FinProfile;
  offsetFromAft: number; // distance from the body's aft end to the root trailing edge (negative = behind it)
  mass: number; // whole fin set
}

export type Deployment = "ejection" | "apogee" | "none";

export interface Recovery {
  kind: "parachute" | "none";
  diameter: number;
  cd: number;
  mass: number;
  position: number; // from nose tip
  catalog?: string;
  /** Estes rockets deploy at the motor's ejection charge; water rockets at apogee or never. */
  deployment: Deployment;
}

export interface ExtraMass {
  name: string;
  mass: number;
  position: number; // centre of mass, from nose tip
}

export interface LaunchSite {
  altitude: number; // m above sea level
  temperature: number; // °C
  guideLength: number; // m
}

interface DesignBase {
  name: string;
  nose: NoseCone;
  body: BodyTube;
  fins: FinSet;
  recovery: Recovery;
  extras: ExtraMass[];
  launch: LaunchSite;
  cdOverride?: number; // replaces the estimated drag coefficient when set
}

export interface EstesDesign extends DesignBase {
  type: "estes";
  motor: { id: string; delay: number; mountDiameter: number };
}

export interface WaterDesign extends DesignBase {
  type: "water";
  tail: Tail; // bottle shoulder and neck
  water: {
    bottleVolume: number; // L
    bottleMass: number; // g, empty bottle (counted separately from the printed parts)
    waterVolume: number; // L
    pressure: number; // psi gauge
    nozzleDiameter: number; // mm
  };
}

export type Design = EstesDesign | WaterDesign;

/** Hard limit agreed for the lab's 1.5 L Topo Chico bottles and 12 V compressor. */
export const MAX_PRESSURE_PSI = 90;
export const PSI = 6894.757; // Pa

export const CULIACAN: LaunchSite = { altitude: 55, temperature: 30, guideLength: 0.9 };

export function newEstesDesign(): EstesDesign {
  return {
    type: "estes",
    name: "Mi cohete Estes",
    nose: { shape: "ogive", length: 70, diameter: 24.8, mass: 8 },
    body: { length: 250, diameter: 24.8, mass: 12 },
    fins: { count: 3, rootChord: 60, tipChord: 30, span: 45, sweep: 30, thickness: 2.5, profile: "square", offsetFromAft: 0, mass: 9 },
    recovery: { kind: "parachute", diameter: 305, cd: 0.8, mass: 8, position: 110, deployment: "ejection" },
    extras: [{ name: "Soporte de motor, cuerda y algodón", mass: 8, position: 280 }],
    launch: { ...CULIACAN },
    motor: { id: "C6", delay: 5, mountDiameter: 18 },
  };
}

// Default 1.5 L Topo Chico PET bottle. Dimensions are estimates until measured on a real bottle.
export function newWaterDesign(): WaterDesign {
  return {
    type: "water",
    name: "Mi cohete de agua",
    nose: { shape: "ogive", length: 120, diameter: 88, mass: 35 },
    body: { length: 230, diameter: 88, mass: 0 },
    tail: { length: 90, aftDiameter: 28 },
    fins: { count: 3, rootChord: 160, tipChord: 60, span: 110, sweep: 100, thickness: 3, profile: "rounded", offsetFromAft: -70, mass: 50 },
    recovery: { kind: "parachute", diameter: 457, cd: 0.8, mass: 15, position: 100, deployment: "apogee" },
    // The water sits at the aft end, so water rockets usually need ballast in the nose.
    extras: [{ name: "Lastre en la nariz (plastilina)", mass: 80, position: 70 }],
    launch: { altitude: 55, temperature: 30, guideLength: 0.5 },
    water: { bottleVolume: 1.5, bottleMass: 40, waterVolume: 0.5, pressure: 60, nozzleDiameter: 21.5 },
  };
}

// Approximate published specifications; students should weigh and measure their own kit.
export const KITS: { name: string; note: string; design: () => EstesDesign }[] = [
  {
    name: "Estes Alpha III",
    note: "Aprox. 31 cm de largo, tubo BT-50, unos 34 g sin motor. Motores recomendados: A8-3, B4-4, B6-4, C6-5.",
    design: () => ({
      ...newEstesDesign(),
      name: "Alpha III",
      nose: { shape: "ogive", length: 65, diameter: 24.8, mass: 6, catalog: "Kit Alpha III" },
      body: { length: 247, diameter: 24.8, mass: 7, catalog: "Kit Alpha III" },
      fins: { count: 3, rootChord: 64, tipChord: 25, span: 45, sweep: 40, thickness: 2.5, profile: "rounded", offsetFromAft: 0, mass: 10 },
      recovery: { kind: "parachute", diameter: 305, cd: 0.8, mass: 5, position: 100, deployment: "ejection" },
      extras: [{ name: "Soporte de motor, cuerda y algodón", mass: 6, position: 270 }],
      motor: { id: "B6", delay: 4, mountDiameter: 18 },
    }),
  },
  {
    name: "Estes Big Bertha",
    note: "Aprox. 62 cm de largo, tubo BT-60, unos 60 g sin motor. Motores recomendados: B6-4, C6-5.",
    design: () => ({
      ...newEstesDesign(),
      name: "Big Bertha",
      nose: { shape: "ogive", length: 105, diameter: 41.6, mass: 12, catalog: "Kit Big Bertha" },
      body: { length: 510, diameter: 41.6, mass: 22, catalog: "Kit Big Bertha" },
      fins: { count: 4, rootChord: 100, tipChord: 50, span: 70, sweep: 50, thickness: 3.2, profile: "rounded", offsetFromAft: 0, mass: 12 },
      recovery: { kind: "parachute", diameter: 457, cd: 0.8, mass: 7, position: 150, deployment: "ejection" },
      extras: [{ name: "Soporte de motor, cuerda y algodón", mass: 7, position: 540 }],
      motor: { id: "C6", delay: 5, mountDiameter: 18 },
    }),
  },
];
