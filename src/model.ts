// Design model shared by the UI and the physics. Lengths in millimetres, masses in grams,
// pressures in psi (the unit of the lab's compressor gauge). Physics converts to SI.
import { DEFAULT_MOTOR, type MotorId, type MotorTest, type ThrustModel } from "./motor";
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
  /** tests: the static tests the student uploaded (saved with the project); testId: which one the "measured" model uses (MEAN_TEST = all). */
  motor: { id: MotorId; mass: number; propellant: number; thrust: ThrustModel; burnDrag: boolean; coastDrag: boolean; fallDrag: boolean; included?: boolean; tests?: MotorTest[]; testId?: string };
  sheet: PaperSheet;
  motorMount: { mass: number; material?: MountMaterial }; // printed mount at the aft end (older designs: PLA)
  /**
   * Inside the nose (Estes unless another brand is given). position: its centre, from the nose tip. It rests on the plug
   * screwed into the end of the nose's sleeve, or further toward the tip if something fills the gap (e.g. cotton, added
   * as an extra mass).
   */
  altimeter: { included: boolean; mass: number; position: number; brand?: string };
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

/** Whether a Rocket Tec design carries its motor (older designs always do). Without it there is no flight. */
export const hasMotor = (d: Design) => d.type !== "estes" || d.motor.included !== false;

/** Estes altimeter size from its manual: 55 × 18 mm, including the clip tab. */
export const ALTIMETER_MM = { length: 55, height: 18, tab: 9 };

/** What an extra mass can be; the first is the default. Each one is drawn as it looks inside the rocket. */
export const EXTRA_KINDS = ["Papel retardante", "Algodón", "Plastilina", "Pegamento", "Cinta", "Masa X"] as const;

/**
 * The printed motor mount (Pieza 04 PortaMotor A), the one part the students may not make or change, so it sets the
 * rocket's diameter. Measured on its SolidWorks drawing and STL files (mm):
 * - sleeve: the front part, 25 mm long and 27 mm across, goes inside the opalina tube (taped on it);
 * - behindTube: the aft part sticks out 36 mm behind the tube, as wide as the body (28 mm), with 4 rails 90° apart that
 *   reach 33 mm across, each with a T slot for a fin;
 * - centroid: its centre of mass, measured from its aft end. PLA AERO is printed 5 mm shorter (a shorter sleeve).
 *   Its STL draws the sleeve 26 mm across on purpose: PLA AERO foams as it prints and the printed sleeve comes out
 *   27 mm, like the PLA one, so both are 27 mm here.
 * - motorDepth: the motor goes 33 mm into it from the aft end (up to its stop); the rest sticks out behind.
 * - fins: the 4 rails hold 4 fins, 1.95 mm thick, whose 35 mm tab slides into the rail's slot. Their leading edge sits at
 *   the front of the rails and their trailing edge is square to the body, so the students only choose the root chord,
 *   the tip chord and the span: the rest follows.
 */
export const MOTOR_MOUNT = {
  diameter: 28,
  sleeveDiameter: 27,
  behindTube: 36,
  railDiameter: 33,
  railWidth: 6,
  motorDepth: 33,
  fins: { count: 4, thickness: 1.95, tab: 35, profile: "square" as FinProfile },
  pla: { length: 61, centroid: 26.3 },
  "pla-aero": { length: 56, centroid: 22.3 },
} as const;

/**
 * The Rocket Tec nose's sleeve (shoulder), behind its base and inside the opalina tube: 26 mm across, so it sits loose
 * in the 27 mm tube and the motor's ejection charge can push the nose out, and 30 mm long. Printed with a 1 mm wall
 * (24 mm inside). It is fixed: the students design the nose in front of it.
 */
export const NOSE_SLEEVE = { diameter: 26, inner: 24, length: 30 } as const;

/** Where the altimeter's centre sits resting on the nose's plug (mm from the tip): the end of the sleeve, half its length ahead. */
export const altimeterRest = (d: Design) => d.nose.length + NOSE_SLEEVE.length - ALTIMETER_MM.length / 2;
/** The gap between the plug and the altimeter (mm): how far the altimeter was moved toward the tip. */
export const plugGap = (d: EstesDesign) => Math.max(altimeterRest(d) - d.altimeter.position, 0);
/** Loose cotton in the 24 mm sleeve weighs about 0.03 g/cm³. */
export const COTTON_DENSITY = 0.03;
/** Mass of loose cotton filling `length` mm of the sleeve (g): an estimate until it is weighed. */
export const cottonEstimate = (length: number) => Math.round(((Math.PI / 4) * NOSE_SLEEVE.inner ** 2 * length * COTTON_DENSITY) / 1000 * 100) / 100;

/**
 * What a Rocket Tec design cannot choose, because the motor mount sets it: the diameter (nose and body), and the fins'
 * count, thickness, edge, sweep and place. Applied to every change and to designs opened from older versions.
 */
export function fitToMotorMount(d: Design): Design {
  if (d.type !== "estes") return d.body.diameter === d.nose.diameter ? d : { ...d, body: { ...d.body, diameter: d.nose.diameter } };
  const m = MOTOR_MOUNT;
  const f = d.fins;
  const rootChord = Math.max(f.rootChord, m.fins.tab);
  const tipChord = Math.min(Math.max(f.tipChord, 0), rootChord);
  const fins: FinSet = {
    ...f,
    count: f.count > 0 ? m.fins.count : 0,
    rootChord,
    tipChord,
    // Trailing edge square to the body: the tip starts where the root ends minus the tip chord.
    sweep: rootChord - tipChord,
    thickness: m.fins.thickness,
    profile: m.fins.profile,
    // Leading edge at the front of the rails (where the mount leaves the tube): measured from the aft end.
    offsetFromAft: m.behindTube - rootChord,
  };
  const same = (Object.keys(fins) as (keyof FinSet)[]).every((k) => fins[k] === f[k]);
  const diameterOk = d.nose.diameter === m.diameter && d.body.diameter === m.diameter;
  // The altimeter rests on the plug at the end of the nose's sleeve: never behind it.
  const rest = altimeterRest(d);
  const altimeterOk = d.altimeter.position <= rest;
  if (same && diameterOk && altimeterOk) return d;
  return {
    ...d,
    nose: { ...d.nose, diameter: m.diameter },
    body: { ...d.body, diameter: m.diameter },
    fins,
    altimeter: altimeterOk ? d.altimeter : { ...d.altimeter, position: rest },
  };
}

/** Masses weighed in the Campus Sinaloa lab (g). */
export const WEIGHED = { altimeter: 12, parachute: 4, motorLoaded: 8, motorBurnt: 5 };

/**
 * The printed parts weighed in the lab (g), in each material, with the default measures: Ojiva B (120 mm with its
 * sleeve), the motor mount, and the set of 4 fins of 70 / 10 / 50 mm.
 */
export const WEIGHED_PRINTS = {
  nose: { pla: 14, "pla-aero": 7 },
  motorMount: { pla: 16, "pla-aero": 8 },
  fins: { pla: 8, "pla-aero": 4 },
} as const;

/**
 * The mass to show after a part changes material: the lab's mass in the new one if the part still had the lab's mass
 * in the old one; a mass the team weighed or typed stays.
 */
export function massForMaterial(part: keyof typeof WEIGHED_PRINTS, mass: number, from: NoseMaterial | undefined, to: NoseMaterial) {
  const table = WEIGHED_PRINTS[part] as Partial<Record<NoseMaterial, number>>;
  const was = table[from ?? "pla"];
  const next = table[to];
  return was !== undefined && next !== undefined && Math.abs(mass - was) < 1e-9 ? next : mass;
}

// Rocket Tec defaults: the V10 PLA parts (Ojiva B, 28 mm body, PortaMotor A - PLA), rolled opalina body, A10-3T motor,
// Estes 24" printed parachute and Estes altimeter in the nose. The motor, parachute and altimeter masses were weighed
// in the lab, and so were the printed parts (WEIGHED_PRINTS); each team replaces them with what its own parts weigh.
export function newEstesDesign(): EstesDesign {
  const sheet: PaperSheet = { orientation: "long", gsm: 120, thickness: 0.15 };
  return {
    type: "estes",
    name: "Mi cohete Rocket Tec",
    // Ojiva B, the one printed for the students: 120 mm in all, 90 mm in front of its 30 mm sleeve (an 80 mm ellipse
    // and a 10 mm collar).
    nose: { shape: "elliptical", material: "pla", length: 120 - NOSE_SLEEVE.length, diameter: MOTOR_MOUNT.diameter, mass: WEIGHED_PRINTS.nose.pla },
    body: { length: sheetLength(sheet), diameter: MOTOR_MOUNT.diameter, mass: Math.round(sheetMass(sheet) * 10) / 10 },
    sheet,
    // The lab's fin (70 / 10 / 50 mm), 4 in the mount's rails; the mass is the whole set's.
    fins: { count: 0, rootChord: 70, tipChord: 10, span: 50, sweep: 60, thickness: 1.95, profile: "square", offsetFromAft: -34, mass: WEIGHED_PRINTS.fins.pla, material: "pla" },
    motorMount: { mass: WEIGHED_PRINTS.motorMount.pla, material: "pla" },
    // A new rocket starts with no altimeter, no parachute and no extra masses: the team adds what it carries.
    recovery: { kind: "none", diameter: 610, cd: 0.75, mass: WEIGHED.parachute, position: 170, deployment: "ejection", shape: "circular", lineLength: 610, chuteModel: "linear" },
    // Resting on the nose's plug: its centre half its length (27.5 mm) ahead of the end of the 120 mm nose.
    altimeter: { included: false, mass: WEIGHED.altimeter, position: 120 - ALTIMETER_MM.length / 2, brand: "Estes" },
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

