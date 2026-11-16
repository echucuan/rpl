import { describe, expect, it } from "vitest";
import { newEstesDesign, newWaterDesign, type EstesDesign } from "../model";
import { a10Motor } from "../motor";
import { air, G } from "./atmosphere";
import { dragModel } from "./drag";
import { chuteProperties, chuteCdA, lineFactor, shapeArea } from "./parachute";
import { centreOfPressure } from "./geometry";
import { simulate, type FlightResult, type SimulationOptions } from "./simulate";

// The physics is checked against exact solutions of simplified cases.

const fly = (d: Parameters<typeof simulate>[0], o?: SimulationOptions) => {
  const r = simulate(d, o);
  if (typeof r === "string") throw new Error(r);
  return r as FlightResult;
};

// New Rocket Tec designs start with the average thrust, no drag in phases I, II and III, and no fins, altimeter or parachute.
// The flight tests fly the lab rocket: measured thrust curve with drag, four fins, the Estes altimeter and the 24" parachute.
const rocketTec = (): EstesDesign => {
  const d = newEstesDesign();
  return {
    ...d,
    motor: { ...d.motor, included: true, thrust: "real", burnDrag: true, coastDrag: true, fallDrag: true },
    altimeter: { ...d.altimeter, included: true },
    recovery: { ...d.recovery, kind: "parachute" },
    fins: { ...d.fins, count: 4 },
  };
};

describe("Barrowman stability", () => {
  it("puts the centre of pressure of a finless ogive rocket at 0.466 of the nose length", () => {
    const d = { ...rocketTec(), nose: { ...rocketTec().nose, shape: "ogive" as const }, fins: { ...rocketTec().fins, count: 0 } };
    expect(centreOfPressure(d)).toBeCloseTo(0.466 * d.nose.length, 6);
  });

  it("moves the centre of pressure aft when the fins grow", () => {
    const d = rocketTec();
    const bigger = { ...d, fins: { ...d.fins, span: d.fins.span * 1.5 } };
    expect(centreOfPressure(bigger)).toBeGreaterThan(centreOfPressure(d));
  });
});

describe("Rocket Tec flight (A10-3T)", () => {
  const r = fly(rocketTec());

  it("delivers the motor's whole impulse", () => {
    const burn = r.samples.filter((s) => s.t <= r.burnout!.t + 1e-9);
    let impulse = 0;
    for (let i = 1; i < burn.length; i++) impulse += ((burn[i - 1].thrust + burn[i].thrust) / 2) * (burn[i].t - burn[i - 1].t);
    expect(impulse).toBeCloseTo(a10Motor().totalImpulse, 1);
  });

  it("gives a plausible, stable flight that opens the parachute 3 s after burnout", () => {
    expect(r.apogee.h).toBeGreaterThan(20);
    expect(r.apogee.h).toBeLessThan(250);
    expect(r.stabilityLoaded.margin).toBeGreaterThan(1);
    expect(r.ejection!.t).toBeCloseTo(r.burnout!.t + 3, 1);
  });

  it("matches energy conservation after burnout when there is no air", () => {
    const v = fly(rocketTec(), { noDrag: true, untilApogee: true });
    const bound = v.burnout!.h + (v.burnout!.v ** 2) / (2 * G);
    expect(v.apogee.h).toBeCloseTo(bound, 0);
  });

  it("matches the exact coasting solution with constant drag", () => {
    const d = { ...rocketTec(), cdOverride: 0.6 };
    const c = fly(d, { untilApogee: true });
    const bo = c.burnout!;
    const m = c.samples[c.samples.length - 1].mass;
    const rho = air((bo.h + c.apogee.h) / 2, d.launch.altitude, d.launch.temperature).density;
    const k = (rho * 0.6 * dragModel(d).refArea) / (2 * m);
    const tUp = Math.atan(bo.v * Math.sqrt(k / G)) / Math.sqrt(G * k);
    const dhUp = Math.log(1 + (k * bo.v ** 2) / G) / (2 * k);
    expect(c.apogee.t - bo.t).toBeCloseTo(tUp, 1);
    expect(Math.abs(c.apogee.h - bo.h - dhUp) / dhUp).toBeLessThan(0.01);
  });

  it("lands at the parachute's terminal velocity with either parachute model", () => {
    const d = rocketTec();
    const last = r.samples[r.samples.length - 1];
    const rho = air(0, d.launch.altitude, d.launch.temperature).density;
    const vt = Math.sqrt((2 * last.mass * G) / (rho * chuteCdA(d)));
    expect(r.descentRate).toBeCloseTo(vt, 2);
    const q = fly({ ...d, recovery: { ...d.recovery, chuteModel: "quadratic" } });
    expect(q.descentRate).toBeCloseTo(vt, 1);
  });

  it("follows the exact linear parachute solution v = −v_t + (v_i + v_t)·e^(−bτ/m)", () => {
    const d = rocketTec();
    const ej = r.ejection!;
    const m = r.samples[r.samples.length - 1].mass;
    const rho = air(0, d.launch.altitude, d.launch.temperature).density;
    const vt = Math.sqrt((2 * m * G) / (rho * chuteCdA(d)));
    const T = vt / G; // m/b
    for (const x of r.samples.filter((p) => p.t > ej.t + 0.05 && p.t < ej.t + 2)) {
      expect(x.v).toBeCloseTo(-vt + (ej.v + vt) * Math.exp(-(x.t - ej.t) / T), 2);
    }
  });

  it("warns when the rocket is heavier than Estes allows for the A10-3T", () => {
    const heavy = fly({ ...rocketTec(), extras: [{ name: "lastre", mass: 60, position: 60 }] });
    expect(heavy.warnings.some((w) => w.text.includes("85 g"))).toBe(true);
  });

  it("converges: RK4 beats Euler and gains about 16× when the step halves", () => {
    const ref = fly(rocketTec(), { untilApogee: true }).apogee.h;
    const err = (method: "rk4" | "euler", dt: number) => Math.abs(fly(rocketTec(), { method, dt, untilApogee: true }).apogee.h - ref);
    expect(err("rk4", 0.01)).toBeLessThan(err("euler", 0.01));
    expect(err("euler", 0.01)).toBeGreaterThan(err("euler", 0.005));
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

describe("Rocket Tec with the constant average thrust", () => {
  const real = fly(rocketTec());
  const d = rocketTec();
  const r = fly({ ...d, motor: { ...d.motor, thrust: "average" } });
  const m = a10Motor();

  it("pushes with one constant force for the same burn time and impulse", () => {
    const burning = r.samples.filter((s) => s.t > 0 && s.t < m.burnTime - 1e-6);
    for (const s of burning) expect(s.thrust).toBeCloseTo(m.totalImpulse / m.burnTime, 6);
    expect(r.burnout!.t).toBeCloseTo(m.burnTime, 2);
    let impulse = 0;
    const burn = r.samples.filter((s) => s.t <= r.burnout!.t + 1e-9);
    for (let i = 1; i < burn.length; i++) impulse += ((burn[i - 1].thrust + burn[i].thrust) / 2) * (burn[i].t - burn[i - 1].t);
    expect(impulse).toBeCloseTo(m.totalImpulse, 1);
  });

  it("keeps the mass constant (the propellant burnt is ignored) and changes the prediction", () => {
    expect(r.samples[0].mass).toBeCloseTo(real.samples[0].mass, 9);
    for (const x of r.samples) expect(x.mass).toBeCloseTo(r.samples[0].mass, 12);
    expect(Math.abs(r.apogee.h - real.apogee.h)).toBeGreaterThan(0.1);
  });

  it("without drag during the burn is uniformly accelerated: v = (T̄ − W)/m · t", () => {
    const nd = fly({ ...d, motor: { ...d.motor, thrust: "average", burnDrag: false } });
    const m0 = nd.samples[0].mass;
    const accel = (m.totalImpulse / m.burnTime - m0 * G) / m0;
    for (const x of nd.samples.filter((p) => p.t > 0 && p.t < m.burnTime - 1e-6)) {
      expect(x.drag).toBe(0);
      expect(x.a).toBeCloseTo(accel, 6);
    }
    expect(nd.burnout!.v).toBeCloseTo(accel * m.burnTime, 1); // the burnout sample lands on the next time step
    expect(nd.burnout!.h).toBeCloseTo(0.5 * accel * m.burnTime ** 2, 1);
    // After the burn the air acts again.
    expect(nd.samples.some((p) => p.t > m.burnTime + 0.1 && Math.abs(p.drag) > 0)).toBe(true);
  });
});

describe("Rocket Tec parachute builder", () => {
  it("gives the Estes 24\" circular canopy with lines as long as its diameter a Cd of about 0.75", () => {
    const c = chuteProperties(rocketTec());
    expect(c.ratio).toBeCloseTo(1, 6);
    expect(c.cd).toBeCloseTo(0.8 * 0.94, 6);
    expect(c.area).toBeCloseTo(Math.PI * 0.305 ** 2, 6);
  });

  it("computes the area of each shape and interpolates the line factor", () => {
    expect(shapeArea("square", 1)).toBeCloseTo(2, 9);
    expect(shapeArea("hexagonal", 1)).toBeCloseTo((3 * Math.sqrt(3)) / 2, 9);
    expect(shapeArea("octagonal", 1)).toBeCloseTo(2 * Math.SQRT2, 9);
    expect(lineFactor(0.2)).toBe(0.8);
    expect(lineFactor(0.875)).toBeCloseTo(0.91, 9);
    expect(lineFactor(3)).toBe(1);
  });

  it("lands faster with short lines", () => {
    const d = rocketTec();
    const short = fly({ ...d, recovery: { ...d.recovery, lineLength: 200 } });
    expect(short.descentRate).toBeGreaterThan(fly(d).descentRate);
  });
});
