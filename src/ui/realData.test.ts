import { describe, expect, it } from "vitest";
import { guessColumn, parseTable, realSeries } from "./realData";

describe("real flight CSV", () => {
  it("reads semicolon files with decimal commas and aligns liftoff", () => {
    const text = "Experimento PASCO\nTiempo (s);Altitud (m);Aceleración (m/s²)\n0,0;12,0;9,8\n0,1;12,1;9,8\n0,2;14,0;120\n0,3;20,5;60\n0,4;30,0;-9,8\n0,5;25,0;-9,8\n";
    const t = parseTable(text);
    if (typeof t === "string") throw new Error(t);
    expect(t.headers).toEqual(["Tiempo (s)", "Altitud (m)", "Aceleración (m/s²)"]);
    expect(t.rows[2]).toEqual([0.2, 14, 120]);
    const alt = guessColumn(t.headers, [/altitud/i], 1);
    const s = realSeries(t, 0, alt, 2, "m", 1.0);
    if (typeof s === "string") throw new Error(s);
    expect(s.apogee).toBeCloseTo(18, 5); // 30 m minus the 12 m baseline
    expect(s.altitude[2].x).toBeCloseTo(1.0, 5); // first sample >1 m above baseline lands on the simulated liftoff
    expect(s.acceleration).toHaveLength(6);
  });

  it("converts feet and rejects files without numbers", () => {
    const t = parseTable("time,height (ft)\n0,0\n1,100\n2,50\n");
    if (typeof t === "string") throw new Error(t);
    const s = realSeries(t, 0, 1, -1, "ft", 0);
    if (typeof s === "string") throw new Error(s);
    expect(s.apogee).toBeCloseTo(30.48, 2);
    expect(parseTable("a,b\nx,y\nz,w\n")).toMatch(/números/);
  });
});
