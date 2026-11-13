// Static test of a solid motor: the motor is clamped on a load cell and fires without flying.
// The student uploads a CSV with time, force and (optionally) temperature; this module turns it into
// curves aligned with the manufacturer's (ignition at t = 0) and the numbers to compare.
import { guessColumn, type Table } from "./realData";

export type ForceUnit = "N" | "kgf" | "gf" | "lbf";
export type TimeUnit = "s" | "ms";

/** Newtons per unit read by the load cell. */
export const FORCE_FACTOR: Record<ForceUnit, number> = { N: 1, kgf: 9.80665, gf: 0.00980665, lbf: 4.448222 };

export interface StaticTestFile {
  name: string;
  table: Table;
  timeCol: number;
  forceCol: number;
  tempCol: number; // -1 when there is no temperature column
  timeUnit: TimeUnit;
  forceUnit: ForceUnit;
}

export interface Point {
  x: number;
  y: number;
}

export interface StaticTestResult {
  /** Force minus the reading at rest (tare), N, with time shifted so ignition is t = 0. */
  force: Point[];
  temperature: Point[]; // °C, same time axis
  tare: number; // N subtracted from every reading
  impulse: number; // N·s
  maxThrust: number; // N
  maxThrustTime: number; // s after ignition
  burnTime: number; // s
  averageThrust: number; // N
  startTemperature: number | null; // °C
  maxTemperature: number | null; // °C
  maxTemperatureTime: number | null; // s after ignition
}

/** Columns and units guessed from the headers, e.g. "Tiempo (ms)", "Fuerza (g)", "Temperatura (°C)". */
export function guessStaticColumns(headers: string[]): Omit<StaticTestFile, "name" | "table"> {
  const timeCol = guessColumn(headers, [/tiempo|time|^t\b/i], 0);
  const forceCol = guessColumn(headers, [/fuerza|force|empuje|thrust|carga|load|peso|weight/i], Math.min(1, headers.length - 1));
  const tempCol = guessColumn(headers, [/temp/i], -1);
  const th = headers[timeCol] ?? "";
  const fh = headers[forceCol] ?? "";
  const forceUnit: ForceUnit = /lb/i.test(fh) ? "lbf" : /kg/i.test(fh) ? "kgf" : /\(\s*g\s*\)|gf|gramo|gram/i.test(fh) ? "gf" : "N";
  return { timeCol, forceCol, tempCol, timeUnit: /\bms\b|mili/i.test(th) ? "ms" : "s", forceUnit };
}

/**
 * Tare: the median of the readings before the force first reaches 20 % of its peak (the motor at rest).
 * Ignition and burnout: the first and last readings above 5 % of the peak over the tare,
 * the usual threshold for motor certification curves.
 */
export function analyzeStaticTest(f: StaticTestFile): StaticTestResult | string {
  const tScale = f.timeUnit === "ms" ? 0.001 : 1;
  const fScale = FORCE_FACTOR[f.forceUnit];
  const rows = f.table.rows
    .map((r) => ({ t: r[f.timeCol], F: r[f.forceCol], T: f.tempCol >= 0 ? r[f.tempCol] : null }))
    .filter((p): p is { t: number; F: number; T: number | null } => p.t !== null && p.F !== null)
    .map((p) => ({ t: p.t * tScale, F: p.F * fScale, T: p.T }))
    .sort((a, b) => a.t - b.t);
  if (rows.length < 5) return "Las columnas elegidas no tienen suficientes números (se necesitan al menos 5 filas).";

  const rawPeak = Math.max(...rows.map((p) => p.F));
  const restEnd = rows.findIndex((p) => p.F >= 0.2 * rawPeak);
  const rest = rows.slice(0, Math.max(restEnd, 1)).map((p) => p.F).sort((a, b) => a - b);
  const tare = rest[Math.floor(rest.length / 2)];
  const net = rows.map((p) => ({ ...p, F: p.F - tare }));
  const peak = Math.max(...net.map((p) => p.F));
  if (!(peak > 0)) return "La fuerza nunca sube: revisa que elegiste la columna de fuerza.";

  const threshold = 0.05 * peak;
  const first = net.findIndex((p) => p.F >= threshold);
  let last = net.length - 1;
  while (last > first && net[last].F < threshold) last--;
  if (last <= first) return "Solo hay una lectura con fuerza: la frecuencia de muestreo es muy baja para medir el empuje.";
  const t0 = net[first].t;

  let impulse = 0;
  for (let i = Math.max(first, 1); i <= Math.min(last + 1, net.length - 1); i++) {
    const a = Math.max(net[i - 1].F, 0), b = Math.max(net[i].F, 0);
    impulse += ((a + b) / 2) * (net[i].t - net[i - 1].t);
  }
  const burnTime = net[last].t - t0;
  const top = net.reduce((best, p) => (p.F > best.F ? p : best), net[0]);

  const temps = net.filter((p): p is typeof p & { T: number } => p.T !== null);
  const hottest = temps.length ? temps.reduce((best, p) => (p.T > best.T ? p : best), temps[0]) : null;

  return {
    force: net.map((p) => ({ x: p.t - t0, y: p.F })),
    temperature: temps.map((p) => ({ x: p.t - t0, y: p.T })),
    tare,
    impulse,
    maxThrust: top.F,
    maxThrustTime: top.t - t0,
    burnTime,
    averageThrust: burnTime > 0 ? impulse / burnTime : 0,
    startTemperature: temps.length ? temps[0].T : null,
    maxTemperature: hottest ? hottest.T : null,
    maxTemperatureTime: hottest ? hottest.t - t0 : null,
  };
}

/** Empty template for the students' spreadsheets. */
export const STATIC_TEST_TEMPLATE = "Tiempo (s),Fuerza (N),Temperatura (°C)\n";
