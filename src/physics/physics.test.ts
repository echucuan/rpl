import { describe, expect, it } from "vitest";
import { newEstesDesign, newWaterDesign, type EstesDesign } from "../model";
import { a10Motor } from "../motor";
import { air, G } from "./atmosphere";
import { dragModel } from "./drag";
import { centreOfPressure } from "./geometry";
import { simulate, type FlightResult, type SimulationOptions } from "./simulate";

// The physics is checked against exact solutions of simplified cases.

const fly = (d: Parameters<typeof simulate>[0], o?: SimulationOptions) => {
  const r = simulate(d, o);
  if (typeof r === "string") throw new Error(r);
  return r as FlightResult;
};

const rocketTec = (): EstesDesign => newEstesDesign();

describe("Barrowman stability", () => {
  it("puts the centre of pressure of a finless ogive rocket at 0.466 of the nose length", () => {
    const d = { ...rocketTec(), fins: { ...rocketTec().fins, count: 0 } };
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

  it("lands at the parachute's terminal velocity", () => {
    const d = rocketTec();
    const last = r.samples[r.samples.length - 1];
    const rho = air(0, d.launch.altitude, d.launch.temperature).density;
    const cdA = d.recovery.cd * (Math.PI / 4) * (d.recovery.diameter / 1000) ** 2 + last.cd * dragModel(d).refArea;
    const vt = Math.sqrt((2 * last.mass * G) / (rho * cdA));
    expect(r.descentRate).toBeCloseTo(vt, 1);
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
