import { A10_SPECS } from "./motor";

// Design model shared by the UI and the physics. Lengths in millimetres, masses in grams,
// pressures in psi (the unit of the lab's compressor gauge). Physics converts to SI.

export type NoseShape = "ogive" | "conical" | "elliptical" | "parabolic";
export type FinProfile = "square" | "rounded" | "airfoil";

export interface NoseCone {
  shape: NoseShape;
  length: number; // exposed length, without shoulder
  diameter: number;
  mass: number;
}

export interface BodyTube {
  length: number;
  diameter: number; // outside diameter
  mass: number;
}

/** Rocket Tec body: a letter-size sheet of opalina (cardstock) rolled into a tube. */
export const LETTER = { width: 215.9, length: 279.4 }; // mm

export interface PaperSheet {
  /** "long": the 27.9 cm side becomes the tube length; "short": the 21.6 cm side. */
  orientation: "long" | "short";
  gsm: number; // g/m², paper weight printed on the package
  thickness: number; // mm, one sheet
}

export const sheetLength = (s: PaperSheet) => (s.orientation === "long" ? LETTER.length : LETTER.width);
export const sheetWrap = (s: PaperSheet) => (s.orientation === "long" ? LETTER.width : LETTER.length);
export const sheetMass = (s: PaperSheet) => (s.gsm * LETTER.width * LETTER.length) / 1e6; // g, the whole sheet

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
  /** Always the Estes A10-3T; the masses can be corrected with a scale. */
  motor: { mass: number; propellant: number };
  sheet: PaperSheet;
  motorMount: { mass: number }; // printed PLA mount at the aft end
  altimeter: { included: boolean; mass: number; position: number }; // Estes altimeter, inside the nose
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

// Rocket Tec defaults: PLA nose, fins and motor mount, rolled opalina body, A10-3T motor,
// Estes 24" printed parachute and Estes altimeter in the nose. Masses are estimates to be
// replaced by what each team weighs.
export function newEstesDesign(): EstesDesign {
  const sheet: PaperSheet = { orientation: "long", gsm: 225, thickness: 0.25 };
  return {
    type: "estes",
    name: "Mi cohete Rocket Tec",
    nose: { shape: "ogive", length: 80, diameter: 32, mass: 7 },
    body: { length: sheetLength(sheet), diameter: 32, mass: Math.round(sheetMass(sheet) * 10) / 10 },
    sheet,
    fins: { count: 3, rootChord: 60, tipChord: 25, span: 40, sweep: 35, thickness: 2, profile: "rounded", offsetFromAft: 0, mass: 8 },
    motorMount: { mass: 4 },
    recovery: { kind: "parachute", diameter: 610, cd: 0.75, mass: 9, position: 130, deployment: "ejection" },
    altimeter: { included: true, mass: 5, position: 55 },
    extras: [],
    launch: { ...CULIACAN },
    motor: { mass: A10_SPECS.mass, propellant: A10_SPECS.propellant },
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

