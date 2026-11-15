import { describe, expect, it } from "vitest";
import { READING, readingSeconds } from "./readingTime";

const words = (n: number) => Array(n).fill("palabra").join(" ");

describe("readingSeconds", () => {
  it("stays between the minimum and the maximum", () => {
    expect(readingSeconds("¡Hola!")).toBe(READING.min);
    expect(readingSeconds("")).toBe(READING.min);
    expect(readingSeconds(words(2000))).toBe(READING.max);
  });

  it("reads 250 words per minute", () => {
    expect(readingSeconds(words(125))).toBe(30);
  });

  it("adds a little per formula and does not count its symbols as words", () => {
    // 100 words = 24 s, + 2 inline × 0.5 s + 1 displayed × 2 s
    const text = `${words(100)} $v_i$, $g$, $$v(t) = v_i - g\\,(t - t_i)$$`;
    expect(readingSeconds(text)).toBe(27);
  });

  it("keeps a typical long four-stage answer under a minute", () => {
    const answer = `${words(260)} ${Array(20).fill("$v_i$").join(" ")} $$m\\,\\frac{dv}{dt} = -mg$$`;
    expect(readingSeconds(answer)).toBe(READING.max);
  });
});
