// Geometry, mass properties and Barrowman stability. Inputs in mm and g (design units).
import type { Design, FinSet, NoseShape } from "../model";

/** Radius of the nose cone at distance x from its tip. */
export function noseRadius(shape: NoseShape, x: number, length: number, radius: number): number {
  const u = Math.min(Math.max(x / length, 0), 1);
  switch (shape) {
    case "conical":
      return radius * u;
    case "ogive": {
      // tangent ogive
      const rho = (radius * radius + length * length) / (2 * radius);
      return Math.sqrt(Math.max(rho * rho - (length - x) ** 2, 0)) + radius - rho;
    }
    case "elliptical":
      return radius * Math.sqrt(Math.max(1 - (1 - u) ** 2, 0));
    case "parabolic":
      return radius * (2 * u - u * u);
  }
}

export interface Revolution {
  volume: number; // mm³
  surface: number; // mm², lateral
  surfaceCentroid: number; // mm from tip
}

export function noseProperties(shape: NoseShape, length: number, diameter: number): Revolution {
  const n = 200;
  const radius = diameter / 2;
  let volume = 0, surface = 0, moment = 0;
  for (let i = 0; i < n; i++) {
    const x0 = (i * length) / n, x1 = ((i + 1) * length) / n;
    const r0 = noseRadius(shape, x0, length, radius), r1 = noseRadius(shape, x1, length, radius);
    volume += (Math.PI / 3) * (x1 - x0) * (r0 * r0 + r0 * r1 + r1 * r1);
    const ds = Math.PI * (r0 + r1) * Math.hypot(x1 - x0, r1 - r0);
    surface += ds;
    moment += ds * (x0 + x1) / 2;
  }
  return { volume, surface, surfaceCentroid: moment / surface };
}

/** Barrowman centre-of-pressure location of a nose cone, as a fraction of its length. */
const NOSE_CP: Record<NoseShape, number> = { conical: 2 / 3, ogive: 0.466, elliptical: 0.333, parabolic: 0.5 };

export function finArea(f: FinSet): number {
  return ((f.rootChord + f.tipChord) / 2) * f.span; // one fin, mm²
}

/** Axial centroid of one fin measured from its root leading edge. */
function finCentroid(f: FinSet): number {
  const { rootChord: cr, tipChord: ct, sweep } = f;
  return (sweep * (cr + 2 * ct) + (cr * cr + cr * ct + ct * ct)) / (3 * (cr + ct));
}

/** Lateral area of a conical frustum. */
function frustumSurface(d1: number, d2: number, length: number): number {
  return Math.PI * ((d1 + d2) / 2) * Math.hypot(length, (d1 - d2) / 2);
}

export interface Layout {
  bodyStart: number;
  bodyEnd: number;
  length: number; // total, nose tip to aft end
  finLeading: number; // root leading edge from nose tip
  refDiameter: number;
  aftDiameter: number;
  tailLength: number;
}

export function layout(d: Design): Layout {
  const bodyStart = d.nose.length;
  const bodyEnd = bodyStart + d.body.length;
  const tailLength = d.type === "water" ? d.tail.length : 0;
  return {
    bodyStart,
    bodyEnd,
    length: bodyEnd + tailLength,
    finLeading: bodyEnd - d.fins.offsetFromAft - d.fins.rootChord,
    refDiameter: Math.max(d.nose.diameter, d.body.diameter),
    aftDiameter: d.type === "water" ? d.tail.aftDiameter : d.body.diameter,
    tailLength,
  };
}

export interface MassItem {
  name: string;
  mass: number; // g
  x: number; // mm from nose tip
}

/** Everything that flies except the motor or the water and air. */
export function structureItems(d: Design): MassItem[] {
  const l = layout(d);
  const nose = noseProperties(d.nose.shape, d.nose.length, d.nose.diameter);
  const items: MassItem[] = [
    { name: d.type === "estes" ? "Nariz (PLA)" : "Nariz", mass: d.nose.mass, x: nose.surfaceCentroid },
    { name: d.type === "water" ? "Piezas del cuerpo" : "Cuerpo de opalina", mass: d.body.mass, x: (l.bodyStart + l.bodyEnd) / 2 },
    { name: d.type === "estes" ? "Aletas (PLA)" : "Aletas", mass: d.fins.mass, x: l.finLeading + finCentroid(d.fins) },
  ];
  if (d.recovery.kind === "parachute") items.push({ name: d.type === "estes" ? "Paracaídas Estes 24\"" : "Paracaídas", mass: d.recovery.mass, x: d.recovery.position });
  if (d.type === "estes") {
    items.push({ name: "Porta motor (PLA)", mass: d.motorMount.mass, x: l.bodyEnd - 25 });
    if (d.altimeter.included) items.push({ name: "Altímetro Estes", mass: d.altimeter.mass, x: d.altimeter.position });
  }
  for (const e of d.extras) items.push({ name: e.name || "Masa extra", mass: e.mass, x: e.position });
  if (d.type === "water") {
    // Empty bottle: wall area of the cylinder and the shoulder, each at its own centroid.
    const cyl = Math.PI * d.body.diameter * d.body.length;
    const shoulder = frustumSurface(d.body.diameter, d.tail.aftDiameter, d.tail.length);
    const shoulderX = l.bodyEnd + d.tail.length * (d.body.diameter + 2 * d.tail.aftDiameter) / (3 * (d.body.diameter + d.tail.aftDiameter));
    items.push({ name: "Botella vacía", mass: d.water.bottleMass, x: (cyl * (l.bodyStart + l.bodyEnd) / 2 + shoulder * shoulderX) / (cyl + shoulder) });
  }
  return items.filter((i) => i.mass > 0);
}

/**
 * Centroid and surface position (mm from nose tip) of `liters` of water in the inverted bottle,
 * filling from the neck (aft end) upward.
 * The bottle interior is modelled as the shoulder frustum plus the cylinder, scaled so that the
 * geometric volume matches the nominal bottle volume.
 */
export function waterFill(d: Extract<Design, { type: "water" }>, liters: number): { centroid: number; surface: number } {
  const l = layout(d);
  const area = (x: number) => {
    const r = x >= l.bodyEnd
      ? (d.body.diameter + (d.tail.aftDiameter - d.body.diameter) * (x - l.bodyEnd) / d.tail.length) / 2
      : d.body.diameter / 2;
    return Math.PI * r * r;
  };
  const step = 0.5;
  let geometric = 0;
  for (let x = l.bodyStart; x < l.length; x += step) geometric += area(x + step / 2) * step;
  const scale = (d.water.bottleVolume * 1e6) / geometric; // mm³ per geometric mm³
  const target = liters * 1e6;
  let volume = 0, moment = 0, x = l.length;
  for (; x > l.bodyStart && volume < target; x -= step) {
    const dv = Math.min(area(x - step / 2) * step * scale, target - volume);
    volume += dv;
    moment += dv * (x - step / 2);
  }
  return { centroid: volume > 0 ? moment / volume : l.length, surface: x };
}

export interface Stability {
  cp: number; // mm from nose tip
  cg: number;
  margin: number; // calibers
  mass: number; // g
}

export function centreOfMass(items: MassItem[]): { mass: number; x: number } {
  const mass = items.reduce((s, i) => s + i.mass, 0);
  return { mass, x: mass > 0 ? items.reduce((s, i) => s + i.mass * i.x, 0) / mass : 0 };
}

export interface PressureTerm {
  name: string;
  cn: number; // normal-force coefficient slope C_Nα (per radian)
  x: number; // mm from nose tip
}

/** Barrowman terms of each component (subsonic, small angle of attack). */
export function pressureTerms(d: Design): PressureTerm[] {
  const l = layout(d);
  const ref = l.refDiameter;
  const terms: PressureTerm[] = [{ name: "Nariz", cn: 2 * (d.nose.diameter / ref) ** 2, x: NOSE_CP[d.nose.shape] * d.nose.length }];
  if (d.type === "water" && d.tail.length > 0) {
    const df = d.body.diameter, da = d.tail.aftDiameter;
    const cn = 2 * ((da / ref) ** 2 - (df / ref) ** 2); // negative for a boattail
    const ratio = df / da;
    const x = l.bodyEnd + (d.tail.length / 3) * (1 + (1 - ratio) / (1 - ratio * ratio));
    terms.push({ name: "Hombro de la botella", cn, x });
  }
  const f = d.fins;
  if (f.count > 0 && f.span > 0) {
    const r = d.body.diameter / 2;
    const midChord = Math.hypot(f.span, f.sweep + f.tipChord / 2 - f.rootChord / 2);
    const cn = (1 + r / (f.span + r)) * (4 * f.count * (f.span / ref) ** 2) /
      (1 + Math.sqrt(1 + (2 * midChord / (f.rootChord + f.tipChord)) ** 2));
    const sum = f.rootChord + f.tipChord;
    const x = l.finLeading + (f.sweep * (f.rootChord + 2 * f.tipChord)) / (3 * sum) + (sum - (f.rootChord * f.tipChord) / sum) / 6;
    // Barrowman's fin term is derived for 3 or 4 fins; scale its 4N factor down beyond that.
    terms.push({ name: "Aletas", cn: f.count > 4 ? cn * 0.75 : cn, x });
  }
  return terms;
}

/** Barrowman centre of pressure: the C_Nα-weighted average of the component locations. */
export function centreOfPressure(d: Design): number {
  const terms = pressureTerms(d);
  const cnTotal = terms.reduce((s, t) => s + t.cn, 0);
  return terms.reduce((s, t) => s + t.cn * t.x, 0) / cnTotal;
}

export function stability(d: Design, items: MassItem[]): Stability {
  const cp = centreOfPressure(d);
  const { mass, x } = centreOfMass(items);
  return { cp, cg: x, margin: (cp - x) / layout(d).refDiameter, mass };
}

/** Wetted surface areas (mm²) used by the drag model. */
export function wettedAreas(d: Design): { body: number; fins: number } {
  const l = layout(d);
  const nose = noseProperties(d.nose.shape, d.nose.length, d.nose.diameter).surface;
  const tail = l.tailLength > 0 ? frustumSurface(d.body.diameter, l.aftDiameter, l.tailLength) : 0;
  return {
    body: nose + Math.PI * d.body.diameter * d.body.length + tail,
    fins: 2 * d.fins.count * finArea(d.fins),
  };
}
