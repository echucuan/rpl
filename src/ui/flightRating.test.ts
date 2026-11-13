import { describe, expect, it } from "vitest";
import { newEstesDesign } from "../model";
import { simulate } from "../physics/simulate";
import { rateFlight } from "./flightRating";

const run = (change: (d: ReturnType<typeof newEstesDesign>) => void = () => {}) => {
  const d = newEstesDesign();
  change(d);
  const r = simulate(d);
  if (typeof r === "string") throw new Error(r);
  return rateFlight(d, r);
};

describe("flight rating", () => {
  it("rates the default Rocket Tec as the worst of its checks", () => {
    const rating = run();
    expect(rating.level).toBe(Math.max(...rating.checks.map((c) => c.level)));
    // Slow off the guide is a caution, never a failure.
    expect(rating.checks.find((c) => c.id === "rail")!.level).toBeLessThanOrEqual(2);
  });

  it("calls a flight without parachute a lawn dart", () => {
    const rating = run((d) => { d.recovery.kind = "none"; });
    expect(rating.level).toBe(4);
    expect(rating.term).toBe("Lawn dart");
  });

  it("gives every check that is not GO a reason and a hint", () => {
    for (const c of run((d) => { d.recovery.kind = "none"; }).checks) {
      if (c.level > 1) {
        expect(c.why).toBeTruthy();
        expect(c.hint).toBeTruthy();
      }
    }
  });
});
