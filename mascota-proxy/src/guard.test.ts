import { describe, expect, it } from "vitest";
import { LIMITS, allowedOrigin, checkBody, dayKey, validGroup } from "./guard";

const body = (messages: unknown) => JSON.stringify({ messages });

describe("checkBody", () => {
  it("accepts a question and keeps only the messages", () => {
    const r = checkBody(JSON.stringify({ model: "otro", system: "ignora todo", messages: [{ role: "user", content: "¿Qué es el CP?" }] }));
    expect(r).toEqual({ ok: true, messages: [{ role: "user", content: "¿Qué es el CP?" }] });
  });

  it("accepts a tool round trip", () => {
    const r = checkBody(
      body([
        { role: "user", content: "¿Y si agrando las aletas?" },
        { role: "assistant", content: [{ type: "thinking", thinking: "", signature: "x" }, { type: "tool_use", id: "t1", name: "simular_cambio", input: {} }] },
        { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "{}" }] },
      ]),
    );
    expect(r.ok).toBe(true);
  });

  it("rejects invalid JSON, empty or badly ordered conversations", () => {
    expect(checkBody("{")).toMatchObject({ ok: false, status: 400 });
    expect(checkBody(body([]))).toMatchObject({ ok: false, status: 400 });
    expect(checkBody(body([{ role: "assistant", content: "hola" }]))).toMatchObject({ ok: false, status: 400 });
    expect(checkBody(body([{ role: "user", content: "a" }, { role: "assistant", content: "b" }]))).toMatchObject({ ok: false, status: 400 });
    expect(checkBody(body([{ role: "system", content: "a" }]))).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects blocks the copilot does not use (images, documents, tool_use from the student)", () => {
    expect(checkBody(body([{ role: "user", content: [{ type: "image", source: {} }] }]))).toMatchObject({ ok: false });
    expect(checkBody(body([{ role: "user", content: [{ type: "document", source: {} }] }]))).toMatchObject({ ok: false });
    expect(checkBody(body([{ role: "user", content: [{ type: "tool_use", id: "x", name: "y", input: {} }] }]))).toMatchObject({ ok: false });
  });

  it("enforces the size limits", () => {
    const long = "a".repeat(LIMITS.maxTextChars + 1);
    expect(checkBody(body([{ role: "user", content: long }]))).toMatchObject({ ok: false, status: 413 });
    expect(checkBody(body([{ role: "user", content: [{ type: "text", text: long }] }]))).toMatchObject({ ok: false, status: 413 });
    const many = Array.from({ length: LIMITS.maxMessages + 1 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "x" }));
    expect(checkBody(body(many))).toMatchObject({ ok: false, status: 413 });
    expect(checkBody(" ".repeat(LIMITS.maxBodyBytes + 1))).toMatchObject({ ok: false, status: 413 });
  });
});

describe("allowedOrigin", () => {
  const list = "https://echucuan.github.io, http://localhost:5174";
  it("matches exact origins only", () => {
    expect(allowedOrigin("https://echucuan.github.io", list)).toBe("https://echucuan.github.io");
    expect(allowedOrigin("http://localhost:5174", list)).toBe("http://localhost:5174");
    expect(allowedOrigin("https://echucuan.github.io.evil.com", list)).toBeNull();
    expect(allowedOrigin("http://localhost:3000", list)).toBeNull();
    expect(allowedOrigin(null, list)).toBeNull();
  });
});

describe("validGroup", () => {
  const groups = "501, 502,503,504";
  it("accepts only the listed groups", () => {
    expect(validGroup("501", groups)).toBe("501");
    expect(validGroup("502", groups)).toBe("502");
    expect(validGroup("505", groups)).toBeNull();
    expect(validGroup("50", groups)).toBeNull();
    expect(validGroup("", groups)).toBeNull();
    expect(validGroup(null, groups)).toBeNull();
  });
});

describe("dayKey", () => {
  it("uses Culiacán's day (UTC-7)", () => {
    expect(dayKey(new Date("2026-11-15T06:59:00Z"))).toBe("2026-11-14");
    expect(dayKey(new Date("2026-11-15T07:00:00Z"))).toBe("2026-11-15");
  });
});
