import { describe, expect, it } from "vitest";
import { MOTORS, curveImpulse } from "../motor";
import { parseTable } from "./realData";
import { analyzeStaticTest, guessStaticColumns, type StaticTestFile } from "./staticTest";

const curve = MOTORS["A10-3T"].certified;

/** Thrust of the certified curve at time t (linear interpolation), N. */
function thrustAt(t: number): number {
  if (t <= 0 || t >= curve.time[curve.time.length - 1]) return 0;
  const i = curve.time.findIndex((x) => x > t);
  const [t1, t2, f1, f2] = [curve.time[i - 1], curve.time[i], curve.thrust[i - 1], curve.thrust[i]];
  return f1 + ((f2 - f1) * (t - t1)) / (t2 - t1);
}

/** A load-cell log: 1 s at rest, ignition, then 1 s more; grams and milliseconds, with a 50 g offset. */
function fakeLog(delimiter = ",", decimal = "."): string {
  const lines = ["Prueba estática equipo 3", ["Tiempo (ms)", "Fuerza (g)", "Temperatura (°C)"].join(delimiter)];
  for (let ms = 0; ms <= 3000; ms += 2) {
    const t = (ms - 1000) / 1000;
    const grams = 50 + thrustAt(t) / 0.00980665;
    const temp = 28 + (t > 0 ? Math.min(t, 1.2) * 40 : 0);
    lines.push([String(ms), grams.toFixed(2).replace(".", decimal), temp.toFixed(1).replace(".", decimal)].join(delimiter));
  }
  return lines.join("\n");
}

function load(text: string): StaticTestFile {
  const table = parseTable(text);
  if (typeof table === "string") throw new Error(table);
  return { name: "prueba.csv", table, ...guessStaticColumns(table.headers) };
}

describe("static test", () => {
  it("guesses columns and units from the headers", () => {
    const f = load(fakeLog());
    expect(f).toMatchObject({ timeCol: 0, forceCol: 1, tempCol: 2, timeUnit: "ms", forceUnit: "gf" });
    expect(guessStaticColumns(["t (s)", "Empuje (N)"])).toMatchObject({ forceCol: 1, tempCol: -1, timeUnit: "s", forceUnit: "N" });
    expect(guessStaticColumns(["Time", "Load (kg)", "Temp"])).toMatchObject({ forceUnit: "kgf", tempCol: 2 });
  });

  it("recovers the certified curve: tare removed, ignition at t = 0", () => {
    const r = analyzeStaticTest(load(fakeLog()));
    if (typeof r === "string") throw new Error(r);
    expect(r.tare).toBeCloseTo(50 * 0.00980665, 3);
    expect(r.impulse).toBeCloseTo(curveImpulse(curve), 1);
    expect(r.maxThrust).toBeCloseTo(Math.max(...curve.thrust), 1);
    expect(r.burnTime).toBeGreaterThan(0.95);
    expect(r.burnTime).toBeLessThan(1.07);
    expect(Math.abs(r.force.find((p) => p.y >= 0.05 * r.maxThrust)!.x)).toBeLessThan(0.003);
    expect(r.startTemperature).toBeCloseTo(28, 0);
    expect(r.maxTemperature).toBeCloseTo(76, 0);
  });

  it("reads semicolons with decimal commas (Excel in Spanish)", () => {
    const r = analyzeStaticTest(load(fakeLog(";", ",")));
    if (typeof r === "string") throw new Error(r);
    expect(r.impulse).toBeCloseTo(curveImpulse(curve), 1);
  });

  it("explains files it cannot use", () => {
    const f = load("t,F\n0,1\n1,1\n2,1\n3,1\n4,1\n");
    expect(typeof analyzeStaticTest(f)).toBe("string");
    expect(typeof analyzeStaticTest(load("t,F\n0,0\n1,0\n2,0\n"))).toBe("string");
  });
});
