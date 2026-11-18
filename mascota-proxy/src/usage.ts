/**
 * Usage of RPL for the teacher's research: what the simulator sends every minute (time, clicks, changes,
 * views) and what Rocky was asked and answered. No names: a student is the anonymous id of a browser.
 * Pure helpers first (tested with vitest), then the D1 reads for the private data page.
 */

export const EVENT_KINDS = new Set(["start", "time", "view", "click", "edit", "rocky_open", "rocky_read", "rocky_unread"]);
const ID = /^[A-Za-z0-9-]{16,64}$/;
export const EVENT_LIMITS = { maxEvents: 300, maxBytes: 64_000, maxText: 80, maxValue: 86_400 };

export interface EventRow {
  device: string;
  grp: string;
  session: string;
  kind: string;
  route: string;
  target: string;
  value: number;
}

const clip = (s: unknown, n: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, n) : "");

/** A batch of events from the simulator, checked: unknown kinds, bad ids and odd values are dropped. */
export function parseEvents(raw: string, groups: string): EventRow[] | null {
  if (new TextEncoder().encode(raw).length > EVENT_LIMITS.maxBytes) return null;
  let body: { device?: unknown; group?: unknown; session?: unknown; events?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return null;
  }
  const device = typeof body.device === "string" && ID.test(body.device) ? body.device : null;
  const session = typeof body.session === "string" && ID.test(body.session) ? body.session : null;
  if (!device || !session || !Array.isArray(body.events)) return null;
  const allowed = groups.split(",").map((s) => s.trim());
  const grp = typeof body.group === "string" && allowed.includes(body.group) ? body.group : "";
  const rows: EventRow[] = [];
  for (const e of body.events.slice(0, EVENT_LIMITS.maxEvents)) {
    const kind = (e as { kind?: unknown })?.kind;
    const value = Number((e as { value?: unknown })?.value ?? 0);
    if (typeof kind !== "string" || !EVENT_KINDS.has(kind)) continue;
    if (!Number.isFinite(value) || value < 0 || value > EVENT_LIMITS.maxValue) continue;
    rows.push({
      device, grp, session, kind,
      route: clip((e as { route?: unknown }).route, 40),
      target: clip((e as { target?: unknown }).target, EVENT_LIMITS.maxText),
      value: Math.round(value * 10) / 10,
    });
  }
  return rows;
}

/** The student's question, when the conversation ends with one (not with the results of Rocky's tools). */
export function lastQuestion(messages: unknown[]): string {
  const last = messages.at(-1) as { role?: string; content?: unknown } | undefined;
  if (last?.role !== "user") return "";
  if (typeof last.content === "string") return last.content.trim();
  if (!Array.isArray(last.content)) return "";
  if (last.content.some((b) => (b as { type?: string })?.type === "tool_result")) return "";
  return last.content.map((b) => ((b as { type?: string; text?: string }).type === "text" ? (b as { text: string }).text : "")).join("\n").trim();
}

export interface Reply {
  text: string;
  tools: string[];
  /** All input tokens, cached or not; cacheRead and cacheWrite are the part that went through the cache. */
  inTokens: number;
  cacheRead: number;
  cacheWrite: number;
  outTokens: number;
}

/** What Rocky said in one streamed round (the Claude API's event stream), read as it passes to the browser. */
export async function readReply(stream: ReadableStream<Uint8Array>): Promise<Reply> {
  const reply: Reply = { text: "", tools: [], inTokens: 0, cacheRead: 0, cacheWrite: 0, outTokens: 0 };
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = "";
  const take = (line: string) => {
    if (!line.startsWith("data:")) return;
    let ev: Record<string, unknown>;
    try {
      ev = JSON.parse(line.slice(5));
    } catch {
      return;
    }
    const type = ev.type;
    if (type === "message_start") {
      const u = (ev.message as { usage?: { input_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } })?.usage;
      reply.cacheRead = u?.cache_read_input_tokens ?? 0;
      reply.cacheWrite = u?.cache_creation_input_tokens ?? 0;
      reply.inTokens = (u?.input_tokens ?? 0) + reply.cacheRead + reply.cacheWrite;
    } else if (type === "content_block_start") {
      const b = ev.content_block as { type?: string; name?: string };
      if (b?.type === "tool_use" && b.name) reply.tools.push(b.name);
    } else if (type === "content_block_delta") {
      const d = ev.delta as { type?: string; text?: string };
      if (d?.type === "text_delta" && d.text) reply.text += d.text;
    } else if (type === "message_delta") {
      reply.outTokens = (ev.usage as { output_tokens?: number })?.output_tokens ?? reply.outTokens;
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach((l) => take(l.trim()));
  }
  take(buffer.trim());
  return reply;
}

/** A question reduced to compare it with others: lower case, no accents, no signs, no extra spaces. */
export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Rows as CSV (Excel opens it in Spanish with the BOM). */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "﻿";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}

/**
 * Claude prices in USD per million tokens (input, output), to estimate what Rocky spends. Cache reads cost 0.1×
 * the input and cache writes 1.25×. Update this table if the prices change; an unknown model counts as Opus 5.5
 * (an estimate on the high side).
 */
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-opus-5": { input: 5, output: 25 },
};

export interface TokenSums {
  model: string;
  /** All input tokens, cache included. */
  inTokens: number;
  cacheRead: number;
  cacheWrite: number;
  outTokens: number;
}

/** Estimated USD of some tokens of one model. */
export function costUsd(t: TokenSums): number {
  const p = PRICES[t.model] ?? PRICES["claude-opus-5-5"];
  const plain = Math.max(0, t.inTokens - t.cacheRead - t.cacheWrite);
  return (plain * p.input + t.cacheRead * p.input * 0.1 + t.cacheWrite * p.input * 1.25 + t.outTokens * p.output) / 1e6;
}

/* ---------- D1 ---------- */

export interface D1Result<T> {
  results: T[];
}
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface D1 {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
}

export async function saveEvents(db: D1, rows: EventRow[], ts: number, day: string) {
  if (!rows.length) return;
  const sql = "INSERT INTO events (ts, day, device, grp, session, kind, route, target, value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
  await db.batch(rows.map((r) => db.prepare(sql).bind(ts, day, r.device, r.grp, r.session, r.kind, r.route, r.target, r.value)));
}

export interface RockyRow {
  ts: number;
  day: string;
  device: string;
  grp: string;
  turn: string;
  question: string;
  answer: string;
  tools: string;
  inTokens: number;
  cacheRead: number;
  cacheWrite: number;
  outTokens: number;
  model: string;
  ms: number;
  status: string;
}

export async function saveRocky(db: D1, r: RockyRow) {
  await db
    .prepare(
      "INSERT INTO rocky (ts, day, device, grp, turn, question, answer, tools, in_tokens, cache_read, cache_write, out_tokens, model, ms, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(r.ts, r.day, r.device, r.grp, r.turn, r.question, r.answer, r.tools, r.inTokens, r.cacheRead, r.cacheWrite, r.outTokens, r.model, r.ms, r.status)
    .run();
}

type Row = Record<string, number | string>;
const all = async (db: D1, sql: string, ...args: unknown[]) => (await db.prepare(sql).bind(...args).all<Row>()).results;

/** Estimated USD of the Rocky rows that match `where` (rows without a model used the Worker's current MODEL). */
async function spend(db: D1, model: string, where: string, ...args: unknown[]) {
  const rows = await all(
    db,
    `SELECT CASE WHEN model = '' THEN ? ELSE model END AS m, SUM(in_tokens) AS i, SUM(cache_read) AS cr, SUM(cache_write) AS cw, SUM(out_tokens) AS o
       FROM rocky WHERE ${where} GROUP BY m`,
    model, ...args,
  );
  return rows.reduce((a, r) => a + costUsd({ model: String(r.m), inTokens: Number(r.i), cacheRead: Number(r.cr), cacheWrite: Number(r.cw), outTokens: Number(r.o) }), 0);
}

const WEEK = 7 * 86_400_000;

/** The estimated Claude balance: recharges noted on the data page minus what Rocky spent since the first one. */
export async function credit(db: D1, model: string, from: string, to: string, now = Date.now()) {
  const recharges = (await all(db, "SELECT id, ts, usd, note FROM credit ORDER BY ts")).map((r) => ({ id: Number(r.id), ts: Number(r.ts), usd: Number(r.usd), note: String(r.note) }));
  const since = recharges[0]?.ts ?? null;
  const loaded = recharges.reduce((a, r) => a + r.usd, 0);
  const spent = since == null ? 0 : await spend(db, model, "ts >= ?", since);
  const inRange = await spend(db, model, "day BETWEEN ? AND ?", from, to);
  const [q] = await all(db, "SELECT COUNT(DISTINCT turn) AS n FROM rocky WHERE day BETWEEN ? AND ? AND question <> ''", from, to);
  return {
    model,
    recharges,
    loaded,
    spent,
    balance: since == null ? null : loaded - spent,
    lastWeek: await spend(db, model, "ts >= ?", now - WEEK),
    inRange,
    perQuestion: Number(q?.n) ? inRange / Number(q.n) : 0,
  };
}

export async function addCredit(db: D1, ts: number, usd: number, note: string) {
  await db.prepare("INSERT INTO credit (ts, usd, note) VALUES (?, ?, ?)").bind(ts, usd, note).run();
}
export async function removeCredit(db: D1, id: number) {
  await db.prepare("DELETE FROM credit WHERE id = ?").bind(id).run();
}

/** One Rocky turn: the question, the whole answer (all its rounds) and whether the student read it. */
export interface Turn {
  turn: string;
  ts: number;
  day: string;
  device: string;
  grp: string;
  question: string;
  answer: string;
  tools: string;
  ms: number;
  tokens: number;
  read: "sí" | "no" | "";
  readSeconds: number;
}

export async function turns(db: D1, from: string, to: string): Promise<Turn[]> {
  const rows = await all(
    db,
    `SELECT turn, MIN(ts) AS ts, MIN(day) AS day, device, grp,
            MAX(question) AS question, GROUP_CONCAT(answer, '') AS answer, GROUP_CONCAT(NULLIF(tools, ''), ' ') AS tools,
            SUM(ms) AS ms, SUM(in_tokens + out_tokens) AS tokens
       FROM (SELECT * FROM rocky WHERE day BETWEEN ? AND ? ORDER BY id)
      GROUP BY turn HAVING MAX(question) <> '' ORDER BY ts`,
    from, to,
  );
  const reads = await all(db, "SELECT kind, target, MAX(value) AS value FROM events WHERE kind IN ('rocky_read','rocky_unread') AND day BETWEEN ? AND ? GROUP BY kind, target", from, to);
  const read = new Map<string, { read: boolean; s: number }>();
  for (const r of reads) {
    const prev = read.get(String(r.target));
    if (r.kind === "rocky_read" || !prev) read.set(String(r.target), { read: r.kind === "rocky_read" || !!prev?.read, s: Math.max(Number(r.value), prev?.s ?? 0) });
  }
  return rows.map((r) => {
    const rd = read.get(String(r.turn));
    return {
      turn: String(r.turn), ts: Number(r.ts), day: String(r.day), device: String(r.device), grp: String(r.grp),
      question: String(r.question), answer: String(r.answer ?? ""), tools: String(r.tools ?? ""),
      ms: Number(r.ms), tokens: Number(r.tokens), read: rd ? (rd.read ? "sí" : "no") : "", readSeconds: rd?.s ?? 0,
    };
  });
}

/** Everything the data page shows, for the days from…to (Culiacán). */
export async function summary(db: D1, from: string, to: string, model: string) {
  const range = [from, to];
  const [totals] = await all(
    db,
    `SELECT COUNT(DISTINCT device) AS students, COUNT(DISTINCT session) AS sessions, COUNT(DISTINCT day) AS days,
            COALESCE(SUM(CASE WHEN kind='time' THEN value END), 0) AS seconds,
            COALESCE(SUM(CASE WHEN kind='click' THEN value END), 0) AS clicks,
            COALESCE(SUM(CASE WHEN kind='edit' THEN value END), 0) AS edits
       FROM events WHERE day BETWEEN ? AND ?`,
    ...range,
  );
  const sessions = await all(
    db,
    `SELECT session, device, (MAX(ts) - MIN(ts)) / 1000.0 AS wall, SUM(CASE WHEN kind='time' THEN value ELSE 0 END) AS active
       FROM events WHERE day BETWEEN ? AND ? GROUP BY session`,
    ...range,
  );
  const byGroup = await all(
    db,
    `SELECT grp, COUNT(DISTINCT device) AS students, COUNT(DISTINCT session) AS sessions,
            SUM(CASE WHEN kind='time' THEN value ELSE 0 END) AS seconds, SUM(CASE WHEN kind='click' THEN value ELSE 0 END) AS clicks,
            SUM(CASE WHEN kind='edit' THEN value ELSE 0 END) AS edits
       FROM events WHERE day BETWEEN ? AND ? GROUP BY grp ORDER BY grp`,
    ...range,
  );
  const byDay = await all(
    db,
    `SELECT day, COUNT(DISTINCT device) AS students, COUNT(DISTINCT session) AS sessions, SUM(CASE WHEN kind='time' THEN value ELSE 0 END) AS seconds
       FROM events WHERE day BETWEEN ? AND ? GROUP BY day ORDER BY day`,
    ...range,
  );
  const byHour = await all(
    db,
    `SELECT CAST(((ts / 1000 - 7 * 3600) % 86400) / 3600 AS INTEGER) AS hour, SUM(value) AS seconds
       FROM events WHERE kind='time' AND day BETWEEN ? AND ? GROUP BY hour ORDER BY hour`,
    ...range,
  );
  const byRoute = await all(
    db,
    `SELECT route, SUM(CASE WHEN kind='time' THEN value ELSE 0 END) AS seconds, SUM(CASE WHEN kind='view' THEN value ELSE 0 END) AS views,
            SUM(CASE WHEN kind='click' THEN value ELSE 0 END) AS clicks, SUM(CASE WHEN kind='edit' THEN value ELSE 0 END) AS edits
       FROM events WHERE day BETWEEN ? AND ? AND route <> '' GROUP BY route ORDER BY seconds DESC`,
    ...range,
  );
  const topClicks = await all(
    db,
    "SELECT route, target, SUM(value) AS n FROM events WHERE kind='click' AND day BETWEEN ? AND ? GROUP BY route, target ORDER BY n DESC LIMIT 30",
    ...range,
  );
  const topEdits = await all(
    db,
    "SELECT route, target, SUM(value) AS n FROM events WHERE kind='edit' AND day BETWEEN ? AND ? GROUP BY route, target ORDER BY n DESC LIMIT 30",
    ...range,
  );
  const students = await all(
    db,
    `SELECT device, MAX(grp) AS grp, COUNT(DISTINCT session) AS sessions, COUNT(DISTINCT day) AS days,
            SUM(CASE WHEN kind='time' THEN value ELSE 0 END) AS seconds, SUM(CASE WHEN kind='click' THEN value ELSE 0 END) AS clicks,
            SUM(CASE WHEN kind='edit' THEN value ELSE 0 END) AS edits, SUM(CASE WHEN kind='rocky_open' THEN 1 ELSE 0 END) AS rocky_opens
       FROM events WHERE day BETWEEN ? AND ? GROUP BY device`,
    ...range,
  );
  const ts = await turns(db, from, to);

  // Rocky
  const perStudent = new Map<string, { questions: number; read: number }>();
  for (const t of ts) {
    const s = perStudent.get(t.device) ?? { questions: 0, read: 0 };
    s.questions++;
    if (t.read === "sí") s.read++;
    perStudent.set(t.device, s);
  }
  const repeated = new Map<string, { text: string; n: number; students: Set<string> }>();
  for (const t of ts) {
    const k = normalizeQuestion(t.question);
    if (!k) continue;
    const r = repeated.get(k) ?? { text: t.question, n: 0, students: new Set<string>() };
    r.n++;
    r.students.add(t.device);
    repeated.set(k, r);
  }
  const tools = new Map<string, number>();
  for (const t of ts) for (const name of t.tools.split(/\s+/).filter(Boolean)) tools.set(name, (tools.get(name) ?? 0) + 1);
  const known = ts.filter((t) => t.read);
  const rockyByGroup = new Map<string, number>();
  for (const t of ts) rockyByGroup.set(t.grp, (rockyByGroup.get(t.grp) ?? 0) + 1);

  return {
    from, to,
    credit: await credit(db, model, from, to),
    totals: { ...totals, questions: ts.length, askers: perStudent.size },
    sessions: sessions.map((s) => ({ wall: Number(s.wall), active: Number(s.active) })),
    byGroup: byGroup.map((g) => ({ ...g, questions: rockyByGroup.get(String(g.grp)) ?? 0 })),
    byDay,
    byHour,
    byRoute,
    topClicks,
    topEdits,
    students: students.map((s) => ({ ...s, questions: perStudent.get(String(s.device))?.questions ?? 0, read: perStudent.get(String(s.device))?.read ?? 0 })),
    rocky: {
      questions: ts.length,
      read: known.filter((t) => t.read === "sí").length,
      unread: known.filter((t) => t.read === "no").length,
      unknown: ts.length - known.length,
      avgAnswerWords: ts.length ? Math.round(ts.reduce((a, t) => a + t.answer.split(/\s+/).filter(Boolean).length, 0) / ts.length) : 0,
      avgSeconds: ts.length ? Math.round(ts.reduce((a, t) => a + t.ms, 0) / ts.length / 100) / 10 : 0,
      tokens: ts.reduce((a, t) => a + t.tokens, 0),
      tools: [...tools].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
      repeated: [...repeated.values()].map((r) => ({ text: r.text, n: r.n, students: r.students.size })).sort((a, b) => b.n - a.n).slice(0, 30),
      recent: ts.slice(-200).reverse().map((t) => ({ ts: t.ts, grp: t.grp, question: t.question, answer: t.answer.slice(0, 600), read: t.read, tools: t.tools })),
    },
  };
}

/** Prompt to group the questions into themes (the data page's "Temas de las preguntas"). */
export const THEMES_PROMPT = `Eres un asistente de investigación educativa. Recibes preguntas que alumnos de primer semestre de ingeniería (curso de física, reto de cohetes) le hicieron a un tutor de IA llamado Rocky dentro de un simulador de cohetes.
Agrúpalas en hasta 14 temas que sirvan para reportar en un congreso de innovación educativa. Para cada tema da: un nombre corto en español, una descripción de una línea, cuántas preguntas caen en él, y hasta 3 preguntas de ejemplo copiadas tal cual. Clasifica además el nivel cognitivo predominante de cada tema (Recordar, Comprender, Aplicar, Analizar, Evaluar o Crear, de la taxonomía de Bloom).
Usa solo temas que tengan al menos una pregunta (con pocas preguntas, pocos temas). Cada pregunta va en un solo tema; la suma de las cuentas debe ser igual al total de preguntas.
Responde SOLO con JSON con esta forma: {"temas":[{"tema":"","descripcion":"","n":0,"bloom":"","ejemplos":[""]}]}`;
