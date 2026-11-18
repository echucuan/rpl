import { describe, expect, it } from "vitest";
import { costUsd, lastQuestion, normalizeQuestion, parseEvents, readReply, toCsv } from "./usage";

const DEV = "0123456789abcdef-0001";
const SES = "0123456789abcdef-0002";

describe("parseEvents", () => {
  it("keeps known kinds and drops the rest", () => {
    const rows = parseEvents(
      JSON.stringify({
        device: DEV, session: SES, group: "502",
        events: [
          { kind: "time", route: "estes/cohete", target: "", value: 58 },
          { kind: "click", route: "estes/cohete", target: "  Agregar   masa ", value: 3 },
          { kind: "hack", value: 1 },
          { kind: "time", value: -4 },
          { kind: "time", value: 1e9 },
        ],
      }),
      "501,502",
    )!;
    expect(rows.map((r) => r.kind)).toEqual(["time", "click"]);
    expect(rows[1]).toMatchObject({ grp: "502", target: "Agregar masa", value: 3 });
  });
  it("needs valid ids and leaves unknown groups empty", () => {
    expect(parseEvents(JSON.stringify({ device: "x", session: SES, events: [] }), "501")).toBeNull();
    expect(parseEvents("{", "501")).toBeNull();
    expect(parseEvents(JSON.stringify({ device: DEV, session: SES, group: "999", events: [{ kind: "start" }] }), "501")![0].grp).toBe("");
  });
});

describe("lastQuestion", () => {
  it("reads the student's text, not tool results", () => {
    expect(lastQuestion([{ role: "user", content: " ¿Es estable? " }])).toBe("¿Es estable?");
    expect(lastQuestion([{ role: "user", content: [{ type: "text", text: "Hola" }] }])).toBe("Hola");
    expect(lastQuestion([{ role: "user", content: [{ type: "tool_result", tool_use_id: "a", content: "x" }] }])).toBe("");
  });
});

describe("readReply", () => {
  it("collects the text, the tools and the tokens of a streamed answer", async () => {
    const sse = [
      `event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":10,"cache_read_input_tokens":90}}}`,
      `data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`,
      `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hola, "}}`,
      `data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"piloto"}}`,
      `data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","name":"ver_diseno","input":{}}}`,
      `data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":42}}`,
    ].join("\n\n");
    const bytes = new TextEncoder().encode(sse);
    // Split in odd places, as the network does.
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < bytes.length; i += 37) c.enqueue(bytes.slice(i, i + 37));
        c.close();
      },
    });
    expect(await readReply(stream)).toEqual({ text: "Hola, piloto", tools: ["ver_diseno"], inTokens: 100, cacheRead: 90, cacheWrite: 0, outTokens: 42 });
  });
});

describe("costUsd", () => {
  it("prices plain input, cache reads (0.1×), cache writes (1.25×) and output", () => {
    // Haiku 5.5: $0.10 in, $0.50 out per million.
    const usd = costUsd({ model: "claude-haiku-5-5", inTokens: 3_000_000, cacheRead: 1_000_000, cacheWrite: 1_000_000, outTokens: 1_000_000 });
    expect(usd).toBeCloseTo(0.1 + 0.01 + 0.125 + 0.5, 6);
  });
  it("counts an unknown model at Opus 5.5 prices", () => {
    expect(costUsd({ model: "otro", inTokens: 1_000_000, cacheRead: 0, cacheWrite: 0, outTokens: 0 })).toBe(4);
  });
});

describe("normalizeQuestion and toCsv", () => {
  it("compares questions without accents or signs", () => {
    expect(normalizeQuestion("¿Mi cohete es ESTABLE?")).toBe(normalizeQuestion("mi cohete es estable"));
  });
  it("quotes cells that need it", () => {
    expect(toCsv([{ a: 'di "hola"', b: 1 }])).toBe('﻿a,b\r\n"di ""hola""",1');
  });
});
