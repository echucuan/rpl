// The four flight phases used by every chart and lesson. Rocket Tec uses the names and
// Roman numerals of its MATLAB course (Fase I: Despegue - MaxQ … Fase IV: Recuperación);
// Rocket Challenge keeps 1 Empuje · 2 Frenado hasta el apogeo · 3 Caída libre · 4 Paracaídas y aterrizaje.
import type { Design } from "../model";
import type { FlightResult, Sample } from "../physics/simulate";
import type { Marker, Span } from "./LineChart";

export type PhaseId = 1 | 2 | 3 | 4;

export interface Phase {
  id: PhaseId;
  from: number; // s
  to: number; // s
  exists: boolean;
  /** Why the phase is missing or shortened, for the lessons. */
  note?: string;
}

const PHASE_NAMES: Record<Design["type"], Record<PhaseId, string>> = {
  estes: { 1: "Despegue - MaxQ", 2: "MaxQ - Apogeo", 3: "Apogeo - Separación", 4: "Recuperación" },
  water: { 1: "Empuje", 2: "Frenado hasta el apogeo", 3: "Caída libre", 4: "Paracaídas y aterrizaje" },
};

const ROMAN: Record<PhaseId, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };

export const phaseName = (type: Design["type"], id: PhaseId) => PHASE_NAMES[type][id];
/** "II" in Rocket Tec, "2" in Rocket Challenge. */
export const phaseNum = (type: Design["type"], id: PhaseId) => (type === "estes" ? ROMAN[id] : String(id));
/** Symbol for the position: Rocket Tec uses s (state, ready for 3D); the water rocket keeps h. */
export const posSym = (type: Design["type"]) => (type === "estes" ? "s" : "h");
/** Chart title and axis label for the position. */
export const posTitle = (type: Design["type"]) => (type === "estes" ? "Posición s(t)" : "Altura h(t)");
export const posAxis = (type: Design["type"]) => (type === "estes" ? "Posición s (m)" : "Altura (m)");

export const PHASE_COLORS: Record<PhaseId, string> = {
  1: "rgba(224,112,27,0.14)",
  2: "rgba(0,57,166,0.08)",
  3: "rgba(91,98,112,0.12)",
  4: "rgba(29,122,62,0.11)",
};

export const PHASE_SOLID: Record<PhaseId, string> = { 1: "#e0701b", 2: "#0039a6", 3: "#5b6270", 4: "#1d7a3e" };

/**
 * Rocket Tec gives each quantity one colour, used in every chart line and in the numbers that show it
 * (the same values as the --q-* variables in styles.css): ΣF → dv/dt → v → s, from cause to effect.
 * The individual forces have their own: thrust, weight and drag.
 */
export const QTY = {
  F: "#1a1a1a", // sum of forces ΣF
  a: "#c0262d", // acceleration dv/dt
  v: "#1d7a3e", // velocity v
  s: "#0751b5", // position s
  T: "#a35f2a", // thrust
  W: "#7b8494", // weight (grey: black is ΣF)
  D: "#0f8a9d", // drag
} as const;

/** The same colour, lighter: the reference simulation drawn behind a model. */
export const faded = (hex: string) => `${hex}80`;

export function flightPhases(r: FlightResult): Phase[] {
  const end = r.landing?.t ?? r.samples[r.samples.length - 1].t;
  const burn = r.burnout?.t ?? 0;
  const apogee = r.apogee.t;
  const chute = r.ejection?.t;
  const early = chute !== undefined && chute < apogee - 0.01;
  const p = (id: PhaseId, from: number, to: number, note?: string): Phase => ({ id, from, to: Math.max(to, from), exists: to - from > 0.005, note });

  return [
    p(1, 0, burn),
    p(2, burn, early ? chute! : apogee, early ? "El paracaídas se abrió antes de llegar al apogeo, así que esta fase se cortó." : undefined),
    chute === undefined
      ? p(3, apogee, end, "No hay paracaídas (o no se abre): la caída libre dura hasta el suelo.")
      : early
        ? p(3, apogee, apogee, "No existe: el paracaídas se abrió todavía subiendo, a gran velocidad. Elige un retardo más largo.")
        : p(3, apogee, chute, chute - apogee < 0.05 ? "No existe: el paracaídas se abre justo en el apogeo." : undefined),
    chute === undefined ? p(4, end, end, "No existe: el cohete no lleva paracaídas o no se abre.") : p(4, chute, end),
  ];
}

export function flightSpans(r: FlightResult, type: Design["type"]): Span[] {
  return flightPhases(r).filter((ph) => ph.exists).map((ph) => ({ from: ph.from, to: ph.to, label: `Fase ${phaseNum(type, ph.id)}`, color: PHASE_COLORS[ph.id] }));
}

export function flightMarkers(r: FlightResult): Marker[] {
  const m: Marker[] = [];
  if (r.burnout) m.push({ x: r.burnout.t, label: "Fin del empuje" });
  // The parachute icon marks its opening; at the apogee it shares the apogee line.
  const atApogee = !!r.ejection && Math.abs(r.ejection.t - r.apogee.t) <= 0.05;
  m.push({ x: r.apogee.t, label: atApogee ? "Apogeo · paracaídas" : "Apogeo", chute: atApogee });
  if (r.ejection && !atApogee) m.push({ x: r.ejection.t, label: "Paracaídas", chute: true });
  return m;
}

/** Keeps every sample while thrusting and about `n` points for the rest of the flight. */
export function thin(r: FlightResult, n = 800): Sample[] {
  const burnEnd = (r.burnout?.t ?? 0) * 1.3 + 0.02;
  const step = (r.samples[r.samples.length - 1].t - burnEnd) / n;
  let last = -Infinity;
  return r.samples.filter((s, i) => {
    const keep = s.t <= burnEnd || s.t - last >= step || i === r.samples.length - 1;
    if (keep) last = s.t;
    return keep;
  });
}

export const series = (samples: Sample[], f: (s: Sample) => number) => samples.map((s) => ({ x: s.t, y: f(s) }));

/** Samples inside [from, to] (plus the boundary samples). */
export function within(samples: Sample[], from: number, to: number): Sample[] {
  return samples.filter((s) => s.t >= from - 1e-9 && s.t <= to + 1e-9);
}

export function nearest(samples: Sample[], t: number): Sample {
  let best = samples[0];
  for (const s of samples) if (Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
  return best;
}
