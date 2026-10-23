// Real flight data imported from a CSV file (e.g. a PASCO altimeter export).

export interface Table {
  headers: string[];
  rows: (number | null)[][];
}

/** Parses CSV/TSV text, detecting the delimiter and decimal commas. */
export function parseTable(text: string): Table | string {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 3) return "El archivo tiene muy pocas filas.";
  // Prefer tab, then semicolon (used with decimal commas), then comma: the first one that splits
  // the last lines into a consistent number of columns.
  const tail = lines.slice(-Math.min(10, Math.ceil(lines.length / 2))); // skip title lines at the top
  const delimiter = ["\t", ";", ","].find((d) => {
    const counts = tail.map((l) => l.split(d).length);
    return counts[0] > 1 && counts.every((c) => c === counts[0]);
  }) ?? ",";
  const split = (line: string) => line.split(delimiter).map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
  const decimalComma = delimiter !== ",";
  const toNumber = (c: string) => {
    const n = Number(decimalComma ? c.replace(",", ".") : c);
    return c !== "" && Number.isFinite(n) ? n : null;
  };
  // The header is the last line before the first mostly-numeric row.
  let start = 0;
  while (start < lines.length && split(lines[start]).filter((c) => toNumber(c) !== null).length < 2) start++;
  if (start >= lines.length) return "No encontré columnas con números.";
  const width = split(lines[start]).length;
  const headerCells = start > 0 ? split(lines[start - 1]) : [];
  const headers = Array.from({ length: width }, (_, i) => headerCells[i] || `Columna ${i + 1}`);
  const rows = lines.slice(start).map((l) => split(l).slice(0, width).map(toNumber));
  return { headers, rows };
}

/** Guesses a column index whose header matches one of the patterns. */
export function guessColumn(headers: string[], patterns: RegExp[], fallback: number): number {
  for (const p of patterns) {
    const i = headers.findIndex((h) => p.test(h));
    if (i >= 0) return i;
  }
  return fallback;
}

export interface RealSeries {
  altitude: { x: number; y: number }[];
  acceleration: { x: number; y: number }[];
  apogee: number; // m above the first reading
}

/**
 * Converts the selected columns to metres and shifts time so that the real liftoff lines up with
 * the simulated one (`simLiftoff`, in s).
 */
export function realSeries(t: Table, timeCol: number, altCol: number, accelCol: number, altUnit: "m" | "ft", simLiftoff: number): RealSeries | string {
  const factor = altUnit === "ft" ? 0.3048 : 1;
  const pts = t.rows
    .map((r) => ({ t: r[timeCol], h: r[altCol], a: accelCol >= 0 ? r[accelCol] : null }))
    .filter((p): p is { t: number; h: number; a: number | null } => p.t !== null && p.h !== null);
  if (pts.length < 3) return "Las columnas elegidas no tienen suficientes números.";
  const base = Math.min(...pts.slice(0, Math.min(10, pts.length)).map((p) => p.h)) * factor;
  const liftoff = pts.find((p) => p.h * factor - base > 1) ?? pts[0];
  const shift = simLiftoff - liftoff.t;
  const altitude = pts.map((p) => ({ x: p.t + shift, y: p.h * factor - base }));
  const acceleration = pts.filter((p) => p.a !== null).map((p) => ({ x: p.t + shift, y: p.a as number }));
  return { altitude, acceleration, apogee: Math.max(...altitude.map((p) => p.y)) };
}
