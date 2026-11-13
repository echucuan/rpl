// Rocket Tec parachute builder: the student picks the canopy shape, its radius and the length of the
// shroud lines, and the drag coefficient follows from them: Cd = Cd_base(shape) × f(L/D).
import type { Design } from "../model";

export type ChuteShape = "circular" | "octagonal" | "hexagonal" | "square";

/**
 * Flat canopies cut from plastic. Polygons are measured with the radius from the centre to a corner (vertex);
 * the base coefficient is the one of a well inflated canopy (long lines), referred to the flat area.
 * Fewer sides spill more air at the corners and oscillate more, so the coefficient drops.
 */
export const CHUTE_SHAPES: Record<ChuteShape, { label: string; sides: number; cd0: number }> = {
  circular: { label: "Circular", sides: 0, cd0: 0.8 },
  octagonal: { label: "Octagonal", sides: 8, cd0: 0.78 },
  hexagonal: { label: "Hexagonal", sides: 6, cd0: 0.76 },
  square: { label: "Cuadrada", sides: 4, cd0: 0.7 },
};

/**
 * Line factor f(L/D): short lines pull the canopy edge inwards and it opens less. The factor grows with the ratio
 * of line length to canopy diameter and levels off from L/D ≈ 1.5. Linear interpolation between the rows.
 */
export const LINE_FACTOR: [number, number][] = [
  [0.5, 0.8],
  [0.75, 0.88],
  [1, 0.94],
  [1.25, 0.98],
  [1.5, 1],
];

export function lineFactor(ratio: number): number {
  const t = LINE_FACTOR;
  if (ratio <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (ratio <= t[i][0]) {
      const [x0, y0] = t[i - 1], [x1, y1] = t[i];
      return y0 + ((y1 - y0) * (ratio - x0)) / (x1 - x0);
    }
  }
  return t[t.length - 1][1];
}

/** Flat area (m²) of a canopy with this radius (m): π r² or a regular polygon of n sides, (n/2) r² sin(2π/n). */
export function shapeArea(shape: ChuteShape, radius: number): number {
  const n = CHUTE_SHAPES[shape].sides;
  return n === 0 ? Math.PI * radius ** 2 : (n / 2) * radius ** 2 * Math.sin((2 * Math.PI) / n);
}

/** Everything the parachute section and phase IV show: area, line ratio, factor and the resulting Cd. */
export function chuteProperties(d: Design) {
  const r = d.recovery;
  const radius = r.diameter / 2000; // m
  if (d.type !== "estes") {
    // The water rocket keeps a circular canopy with the coefficient typed in the form.
    return { shape: "circular" as ChuteShape, radius, area: Math.PI * radius ** 2, ratio: NaN, factor: 1, cd0: r.cd, cd: r.cd, built: false };
  }
  const shape = r.shape ?? "circular";
  const lines = (r.lineLength ?? r.diameter) / 1000;
  const ratio = lines / (2 * radius);
  const factor = lineFactor(ratio);
  const cd0 = CHUTE_SHAPES[shape].cd0;
  return { shape, radius, area: shapeArea(shape, radius), ratio, factor, cd0, cd: cd0 * factor, built: true };
}

/** Drag area Cd·A of the open parachute (m²). */
export const chuteCdA = (d: Design) => (d.recovery.kind === "parachute" ? chuteProperties(d).cd * chuteProperties(d).area : 0);
