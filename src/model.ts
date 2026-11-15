// Design model shared by the UI and the physics. Lengths in millimetres, masses in grams,
// pressures in psi (the unit of the lab's compressor gauge). Physics converts to SI.
import { DEFAULT_MOTOR, type MotorId, type ThrustModel } from "./motor";
import type { ChuteShape } from "./physics/parachute";

export type NoseShape = "ogive" | "conical" | "elliptical" | "parabolic";
export type FinProfile = "square" | "rounded" | "airfoil";

export type NoseMaterial = "pla" | "pla-aero" | "opalina";
export const NOSE_MATERIALS: { value: NoseMaterial; label: string }[] = [
  { value: "pla", label: "PLA" },
  { value: "pla-aero", label: "PLA AERO" },
  { value: "opalina", label: "Opalina" },
];
/** The printed motor mount: PLA or PLA AERO. */
export type MountMaterial = "pla" | "pla-aero";
export const MOUNT_MATERIALS = NOSE_MATERIALS.filter((m): m is { value: MountMaterial; label: string } => m.value !== "opalina");
/** The nose cone material (older designs without one are PLA). */
export const noseMaterialLabel = (m?: NoseMaterial) => NOSE_MATERIALS.find((x) => x.value === (m ?? "pla"))!.label;

export interface NoseCone {
  shape: NoseShape;
  material?: NoseMaterial;
  length: number; // exposed length, without shoulder
  diameter: number;
  mass: number;
}

export interface BodyTube {
  length: number;
  diameter: number; // outside diameter
  mass: number;
}

/** The opalina the body can be made of, by paper weight (g/m²). */
export const OPALINA_GSM = [100, 120] as const;

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
  material?: MountMaterial; // printed in PLA or PLA AERO (older designs: PLA)
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
  /** Rocket Tec parachute builder: canopy shape and shroud line length (mm); the Cd is computed from them. */
  shape?: ChuteShape;
  lineLength?: number;
  /** Rocket Tec phase IV: the parachute force as f = −b·v ("linear") or ½ρ·Cd·A·v² ("quadratic"). */
  chuteModel?: "linear" | "quadratic";
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
  /** GPS position of the launch site (decimal degrees); a record only, the flight does not use it. */
  latitude?: number;
  longitude?: number;
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
  /** Motor from the catalogue (motor.ts); the masses can be corrected with a scale. */
  /**
   * thrust: the certified curve ("real") or a constant average force with constant mass ("average"), chosen in phase 0.
   * burnDrag: with the average thrust, whether air drag acts while the motor burns (phase I); the real model always has it.
   * coastDrag: whether air drag acts from burnout to apogee (phase II), with either thrust model.
   * fallDrag: whether air drag acts from apogee to the ejection (phase III, falling without the parachute).
   */
  motor: { id: MotorId; mass: number; propellant: number; thrust: ThrustModel; burnDrag: boolean; coastDrag: boolean; fallDrag: boolean };
  sheet: PaperSheet;
  motorMount: { mass: number; material?: MountMaterial }; // printed mount at the aft end (older designs: PLA)
  altimeter: { included: boolean; mass: number; position: number; brand?: string }; // inside the nose; Estes unless another brand is given
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

/** Estes altimeter size from its manual: 55 × 18 mm, including the clip tab. */
export const ALTIMETER_MM = { length: 55, height: 18, tab: 9 };

/** What an extra mass can be; the first is the default. Each one is drawn as it looks inside the rocket. */
export const EXTRA_KINDS = ["Papel retardante", "Plastilina", "Pegamento", "Cinta", "Masa X"] as const;

/** Masses weighed in the Campus Sinaloa lab (g). */
export const WEIGHED = { altimeter: 12, parachute: 4, motorLoaded: 8, motorBurnt: 5 };

// Rocket Tec defaults: PLA nose, fins and motor mount, rolled opalina body, A10-3T motor,
// Estes 24" printed parachute and Estes altimeter in the nose. The motor, parachute and
// altimeter masses were weighed in the lab; the printed parts are estimates for each team to replace.
export function newEstesDesign(): EstesDesign {
  const sheet: PaperSheet = { orientation: "long", gsm: 120, thickness: 0.15 };
  return {
    type: "estes",
    name: "Mi cohete Rocket Tec",
    nose: { shape: "ogive", length: 80, diameter: 32, mass: 7 },
    body: { length: sheetLength(sheet), diameter: 32, mass: Math.round(sheetMass(sheet) * 10) / 10 },
    sheet,
    fins: { count: 0, rootChord: 60, tipChord: 25, span: 40, sweep: 35, thickness: 2, profile: "rounded", offsetFromAft: 0, mass: 10.7, material: "pla" },
    motorMount: { mass: 4, material: "pla" },
    // A new rocket starts with no altimeter, no parachute and no extra masses: the team adds what it carries.
    recovery: { kind: "none", diameter: 610, cd: 0.75, mass: WEIGHED.parachute, position: 130, deployment: "ejection", shape: "circular", lineLength: 610, chuteModel: "linear" },
    altimeter: { included: false, mass: WEIGHED.altimeter, position: 65, brand: "Estes" }, // 15 mm from the nose base
    extras: [],
    launch: { ...CULIACAN },
    motor: { id: DEFAULT_MOTOR, thrust: "average", burnDrag: false, coastDrag: false, fallDrag: false, mass: WEIGHED.motorLoaded, propellant: WEIGHED.motorLoaded - WEIGHED.motorBurnt },
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
    extras: [{ name: "Lastre en la ojiva (plastilina)", mass: 80, position: 70 }],
    launch: { altitude: 55, temperature: 30, guideLength: 0.5 },
    // 0.5 kg of water: the form works in kg, the model in litres (density 997 kg/m³).
    water: { bottleVolume: 1.5, bottleMass: 40, waterVolume: 0.5 / 0.997, pressure: 60, nozzleDiameter: 21.5 },
  };
}

