import { describe, expect, it } from "vitest";
import { newEstesDesign, newWaterDesign, type EstesDesign } from "../model";
import { centreOfPressure, noseProperties } from "./geometry";
import { simulate, type FlightResult } from "./simulate";

// OpenRocket 24.12 example "A simple model rocket" (stored simulations, wind 2 m/s, sea level):
// C6-5 → apogee 316.6 m, max velocity 95.3 m/s, time to apogee 7.27 s, CP 0.319 m, liftoff mass 71 g.
function openRocketExample(motor = "C6", delay = 5): EstesDesign {
  const d = newEstesDesign();
  return {
    ...d,
    nose: { shape: "ogive", length: 100, diameter: 25, mass: 0 },
    body: { length: 300, diameter: 25, mass: 15.4 },
    fins: { count: 3, rootChord: 50.8, tipChord: 50.8, span: 30, sweep: 25.4, thickness: 2, profile: "rounded", offsetFromAft: 0, mass: 6.2 },
    recovery: { kind: "parachute", diameter: 300, cd: 0.8, mass: 8, position: 150, deployment: "ejection" },
    extras: [
      { name: "Cuerda y algodón", mass: 2.7, position: 170 },
      { name: "Tubo de motor, anillos y guía", mass: 3.5, position: 350 },
    ],
    launch: { altitude: 0, temperature: 15, guideLength: 1 },
    motor: { id: motor, delay, mountDiameter: 18 },
  };
}

function withNoseMass(d: EstesDesign): EstesDesign {
  // 2 mm polystyrene shell (1050 kg/m³) plus its 20 mm shoulder, as in the OpenRocket file
  const shell = noseProperties("ogive", 100, 25).surface + Math.PI * 23 * 20;
  return { ...d, nose: { ...d.nose, mass: shell * 2 * 1050e-6 } };
}

const fly = (d: Parameters<typeof simulate>[0]) => {
  const r = simulate(d);
  if (typeof r === "string") throw new Error(r);
  return r as FlightResult;
};

describe("Barrowman stability", () => {
  it("matches OpenRocket's centre of pressure for the example rocket", () => {
    expect(centreOfPressure(openRocketExample()) / 1000).toBeCloseTo(0.319, 2);
  });
});

describe("Estes flight", () => {
  const r = fly(withNoseMass(openRocketExample()));

  it("has the example's liftoff mass", () => {
    expect(r.liftoffMass).toBeGreaterThan(66);
    expect(r.liftoffMass).toBeLessThan(76);
  });

  it("reaches an apogee within 10% of OpenRocket", () => {
    expect(r.apogee.h).toBeGreaterThan(316.6 * 0.9);
    expect(r.apogee.h).toBeLessThan(316.6 * 1.1);
    expect(r.maxVelocity).toBeGreaterThan(95.3 * 0.92);
    expect(r.maxVelocity).toBeLessThan(95.3 * 1.08);
    expect(r.apogee.t).toBeGreaterThan(7.27 * 0.9);
    expect(r.apogee.t).toBeLessThan(7.27 * 1.1);
  });

  it("opens the parachute at burnout + delay and lands slowly", () => {
    expect(r.ejection!.t).toBeCloseTo(r.burnout!.t + 5, 1);
    expect(r.descentRate).toBeGreaterThan(3);
    expect(r.descentRate).toBeLessThan(6);
    expect(r.idealDelay).toBeGreaterThan(5);
    expect(r.idealDelay).toBeLessThan(7);
  });

  it("flags a booster motor (delay 0) as never deploying the parachute", () => {
    const b = fly(withNoseMass(openRocketExample("C6", 0)));
    expect(b.ejection).toBeNull();
    expect(b.warnings.some((w) => w.level === "error")).toBe(true);
  });
});

describe("water rocket", () => {
  it("rises higher with more pressure and never exceeds the pressure limit", () => {
    const d = newWaterDesign();
    const low = fly({ ...d, water: { ...d.water, pressure: 40 } });
    const high = fly({ ...d, water: { ...d.water, pressure: 90 } });
    expect(high.apogee.h).toBeGreaterThan(low.apogee.h);
    expect(simulate({ ...d, water: { ...d.water, pressure: 91 } })).toMatch(/90 psi/);
  });

  it("gives a plausible flight for a 1.5 L bottle at 60 psi", () => {
    const r = fly(newWaterDesign());
    // Full-bore 1.5 L rockets of ~200 g reach tens of metres; thrust lasts a fraction of a second.
    expect(r.apogee.h).toBeGreaterThan(15);
    expect(r.apogee.h).toBeLessThan(90);
    expect(r.burnout!.t).toBeLessThan(0.3);
  });

  it("has an optimum water fill between empty and full", () => {
    const d = newWaterDesign();
    const heights = [0.1, 0.4, 0.7, 1.2].map((w) => fly({ ...d, water: { ...d.water, waterVolume: w } }).apogee.h);
    const best = Math.max(...heights);
    expect(heights[0]).toBeLessThan(best);
    expect(heights[3]).toBeLessThan(best);
  });
});
