import type { Design } from "../model";
import type { FlightResult } from "../physics/simulate";

/** 1 nominal · 2 off-nominal · 3 recovery damage · 4 failed flight. The flight takes the worst level of its checks. */
export type Level = 1 | 2 | 3 | 4;

export const LEVELS: Record<Level, { label: string; term: string; emoji: string; status: string }> = {
  1: { label: "The Borrego has landed!", term: "Nominal flight", emoji: "✅", status: "GO" },
  2: { label: "Shaky Borrego", term: "Off-nominal", emoji: "⚠️", status: "CAUTION" },
  3: { label: "Bruised Borrego", term: "Recovery damage", emoji: "🩹", status: "NO-GO" },
  4: { label: "Borrego BBQ", term: "CATO / Lawn dart", emoji: "💥", status: "NO-GO" },
};

export interface Check {
  id: "tw" | "rail" | "margin" | "deploy" | "landing";
  name: string;
  /** The measured value, as shown. */
  value: string;
  /** What counts as GO. */
  target: string;
  level: Level;
  /** Why it got this level (only when it is not GO). */
  why?: string;
  /** What to try in the Cohete tab (only when it is not GO). */
  hint?: string;
}

export interface Rating {
  level: Level;
  /** The real term for this flight; a failure names its cause. */
  term: string;
  checks: Check[];
}

const f1 = (x: number) => x.toFixed(1);

/** Rates the simulated flight with the thresholds of model rocketry (NAR) and the app's own warnings. */
export function rateFlight(d: Design, r: FlightResult): Rating {
  const checks: Check[] = [];
  const water = d.type === "water";

  // 1. Thrust-to-weight: under 1 it does not lift off (CATO); NAR recommends at least 5.
  const tw = r.thrustToWeight;
  checks.push({
    id: "tw", name: "Empuje / peso", value: f1(tw), target: "5 o más",
    level: tw < 1 ? 4 : tw < 5 ? 2 : 1,
    why: tw < 1 ? "El empuje no alcanza a levantar el peso: no despega." : tw < 5 ? `Con ${f1(tw)} el cohete acelera lento al principio.` : undefined,
    hint: tw < 5 ? (water ? "Más presión o un cohete más ligero le dan más empuje por cada newton de peso." : "Aligera el cohete: con menos masa, el mismo motor lo empuja con más fuerza.") : undefined,
  });

  // 2. Speed leaving the guide: below 10 m/s the fins do not stabilize well yet (never worse than caution).
  const rail = r.guideExit?.v ?? 0;
  checks.push({
    id: "rail", name: "Salida de la guía", value: `${f1(rail)} m/s`, target: "10 m/s o más",
    level: rail < 10 ? 2 : 1,
    why: rail < 10 ? `Sale a ${f1(rail)} m/s: las aletas todavía no tienen suficiente aire para estabilizarlo.` : undefined,
    hint: rail < 10 ? "Un cohete más ligero acelera más; una guía más larga le da más distancia para ganar velocidad." : undefined,
  });

  // 3. Stability margin in calibers (water: empty bottle, the coasting case).
  const margin = water ? r.stabilityEmpty.margin : Math.min(r.stabilityLoaded.margin, r.stabilityEmpty.margin);
  checks.push({
    id: "margin", name: "Margen de estabilidad", value: `${margin.toFixed(2)} cal`, target: "1 calibre o más",
    level: margin < 0.5 ? 4 : margin < 1 ? 2 : 1,
    why: margin < 0.5 ? "El centro de presión está casi en el centro de masa: el cohete da vueltas en el aire." : margin < 1 ? "Margen justo: con viento o una ráfaga puede cabecear." : undefined,
    hint: margin < 1 ? "Mueve el centro de masa hacia la ojiva (más peso adelante) o agranda las aletas." : undefined,
  });

  // 4. Parachute opening: it has to open, and the slower the better (fast openings tear the cord: a "zipper").
  const chute = d.recovery.kind === "parachute" && d.recovery.deployment !== "none";
  const open = chute && r.ejection ? Math.abs(r.ejection.v) : null;
  checks.push({
    id: "deploy", name: "Apertura del paracaídas", value: open === null ? "no abre" : `${f1(open)} m/s`, target: "5 m/s o menos",
    level: open === null ? 4 : open > 10 ? 3 : open > 5 ? 2 : 1,
    why: open === null
      ? (chute ? "El cohete toca el suelo antes de que se abra el paracaídas: «lawn dart»." : "Sin paracaídas cae libre y se clava en el suelo: «lawn dart».")
      : open > 10 ? `Abre a ${f1(open)} m/s: el tirón puede rasgar el tubo («zipper»).` : open > 5 ? `Abre a ${f1(open)} m/s, lejos del apogeo.` : undefined,
    hint: open === null
      ? (chute ? "Revisa el retardo del motor: el cohete necesita más altura o un retardo más corto." : "Agrega un paracaídas en la sección de recuperación.")
      : open > 5 ? (water ? "Ajusta cuándo se abre el paracaídas para que sea cerca del apogeo." : "Compara el retardo ideal con el del motor: cambia la masa o el arrastre para acercarlos.") : undefined,
  });

  // 5. Landing speed under the parachute: 15 ft/s (4.6 m/s) is the usual limit for an undamaged landing.
  if (open !== null) {
    const land = r.descentRate;
    checks.push({
      id: "landing", name: "Aterrizaje", value: `${f1(land)} m/s`, target: "4.6 m/s o menos",
      level: land > 6 ? 3 : land > 4.6 ? 2 : 1,
      why: land > 6 ? `Aterriza a ${f1(land)} m/s: es probable que se rompa una aleta.` : land > 4.6 ? `Aterriza a ${f1(land)} m/s, un poco rápido.` : undefined,
      hint: land > 4.6 ? "Un paracaídas más grande (más radio) baja más despacio." : undefined,
    });
  }

  const level = Math.max(...checks.map((c) => c.level)) as Level;
  // A failure names its cause: no liftoff is a CATO, tumbling is an unstable flight, no parachute a lawn dart.
  const worst = checks.find((c) => c.level === 4);
  const term = worst?.id === "tw" ? "CATO" : worst?.id === "margin" ? "Unstable flight" : worst?.id === "deploy" ? "Lawn dart" : LEVELS[level].term;
  return { level, term, checks };
}
