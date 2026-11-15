/**
 * Handlers of the copilot's tools. The Worker (mascota-proxy/src/tools.ts) declares them; they run
 * here, in the student's browser, with the RPL simulator and the design the student has open.
 * They never modify that design: simular_cambio works on a copy.
 */
import type { Design } from "../../model";
import { simulate, type FlightResult } from "../../physics/simulate";
import { LEVELS, rateFlight } from "../flightRating";

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;

/** The flight numbers the copilot talks about, rounded and named in Spanish. */
export function flightSummary(d: Design, r: FlightResult | string) {
  if (typeof r === "string") return { error_de_simulacion: r };
  const rating = rateFlight(d, r);
  return {
    apogeo_m: r1(r.apogee.h),
    tiempo_al_apogeo_s: r1(r.apogee.t),
    velocidad_maxima_m_s: r1(r.maxVelocity),
    aceleracion_maxima_m_s2: r1(r.maxAcceleration),
    mach_maximo: r2(r.maxMach),
    empuje_peso: r1(r.thrustToWeight),
    velocidad_salida_guia_m_s: r.guideExit ? r1(r.guideExit.v) : null,
    masa_despegue_g: r1(r.liftoffMass),
    estabilidad_cargado: { margen_calibres: r2(r.stabilityLoaded.margin), cp_mm: r1(r.stabilityLoaded.cp), cg_mm: r1(r.stabilityLoaded.cg) },
    estabilidad_vacio: { margen_calibres: r2(r.stabilityEmpty.margin), cp_mm: r1(r.stabilityEmpty.cp), cg_mm: r1(r.stabilityEmpty.cg) },
    velocidad_descenso_m_s: r1(r.descentRate),
    tiempo_aterrizaje_s: r.landing ? r1(r.landing.t) : null,
    retardo_ideal_s: r.idealDelay === null ? null : r1(r.idealDelay),
    calificacion: {
      nivel: rating.level,
      resultado: `${LEVELS[rating.level].status} · ${rating.term}`,
      revisiones: rating.checks.map((c) => ({ nombre: c.name, valor: c.value, meta: c.target, ok: c.level === 1, ...(c.why && { por_que: c.why }), ...(c.hint && { sugerencia: c.hint }) })),
    },
    advertencias: r.warnings.map((w) => w.text),
  };
}

const PROGRAM = { estes: "Rocket Tec (motor Estes)", water: "Rocket Challenge (cohete de agua)" } as const;

export function verDiseno(d: Design) {
  return { programa: PROGRAM[d.type], diseno: d, ultimo_vuelo: flightSummary(d, simulate(d)) };
}

export interface Change {
  ruta: string;
  valor: number | string | boolean;
}

/** Applies one change to a copy; returns why it cannot be applied, or null. */
function applyChange(target: Design, { ruta, valor }: Change): string | null {
  const keys = ruta.split(".").filter(Boolean);
  if (keys.length === 0 || keys[0] === "type") return `"${ruta}" no se puede cambiar.`;
  let obj: unknown = target;
  for (const k of keys.slice(0, -1)) {
    obj = (obj as Record<string, unknown> | null)?.[k];
    if (typeof obj !== "object" || obj === null) return `La ruta "${ruta}" no existe en este diseño.`;
  }
  const last = keys.at(-1)!;
  const parent = obj as Record<string, unknown>;
  if (!(last in parent)) return `La ruta "${ruta}" no existe en este diseño.`;
  const current = parent[last];
  if (typeof current === "object" && current !== null) return `"${ruta}" es un grupo de campos; indica uno de: ${Object.keys(current).join(", ")}.`;
  if (typeof current !== typeof valor) return `"${ruta}" espera un valor de tipo ${typeof current}, no ${typeof valor}.`;
  if (typeof valor === "number" && !Number.isFinite(valor)) return `"${ruta}" necesita un número válido.`;
  parent[last] = valor;
  return null;
}

export function simularCambio(d: Design, input: { cambios?: Change[]; motivo?: string }) {
  const variant = structuredClone(d);
  const errores: string[] = [];
  const aplicados: (Change & { antes: unknown })[] = [];
  for (const c of input.cambios ?? []) {
    const before = c.ruta.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], d);
    const err = applyChange(variant, c);
    if (err) errores.push(err);
    else aplicados.push({ ...c, antes: before });
  }
  if (aplicados.length === 0) return { errores: errores.length ? errores : ["No se indicó ningún cambio."] };
  return {
    motivo: input.motivo,
    cambios_aplicados: aplicados.map((c) => ({ ruta: c.ruta, antes: c.antes, despues: c.valor })),
    ...(errores.length && { cambios_no_aplicados: errores }),
    antes: flightSummary(d, simulate(d)),
    despues: flightSummary(variant, simulate(variant)),
    nota: "Es una simulación de prueba: el diseño del alumno no cambió.",
  };
}

/**
 * Runs a tool call from the copilot. Returns the content of the tool_result and whether it failed.
 * `readScreen` gives the text of the open screen (src/ui/copilot/screen.ts; injected so tests need no DOM).
 */
export function runTool(name: string, input: unknown, design: Design | null, readScreen?: () => unknown): { content: string; isError: boolean } {
  try {
    if (name === "ver_leccion") {
      if (!readScreen) return { content: "No se puede leer la pantalla del alumno.", isError: true };
      return { content: JSON.stringify(readScreen()), isError: false };
    }
    if (!design) return { content: "El alumno no tiene un diseño abierto: está fuera de Rocket Tec y Rocket Challenge.", isError: true };
    if (name === "ver_diseno") return { content: JSON.stringify(verDiseno(design)), isError: false };
    if (name === "simular_cambio") {
      const out = simularCambio(design, (input ?? {}) as { cambios?: Change[]; motivo?: string });
      return { content: JSON.stringify(out), isError: !("despues" in out) };
    }
    return { content: `Herramienta desconocida: ${name}`, isError: true };
  } catch (e) {
    return { content: `La herramienta falló: ${e instanceof Error ? e.message : String(e)}`, isError: true };
  }
}
