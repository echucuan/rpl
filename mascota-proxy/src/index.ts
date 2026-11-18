/**
 * RPL copilot proxy (Cloudflare Worker).
 *
 * The browser talks to this Worker with the Anthropic SDK (baseURL = this Worker), as if it were the
 * Claude API. The Worker keeps the API key secret and decides everything that matters: model, system
 * prompt, tools, max tokens and effort. From the browser it only takes the conversation (`messages`),
 * after checking the group (501–504), the origin, the size and the per-student, per-group and daily limits.
 *
 * The tools run in the browser (they call the RPL simulator); the Worker only declares them.
 */
import Anthropic from "@anthropic-ai/sdk";
import { allowedOrigin, checkBody, dayKey, studentKey, validGroup } from "./guard";
import { SYSTEM_PROMPT } from "./prompt";
import { TOOLS } from "./tools";
import { THEMES_PROMPT, addCredit, lastQuestion, parseEvents, readReply, removeCredit, saveEvents, saveRocky, summary, toCsv, turns, type D1, type Reply } from "./usage";

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}
interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export interface Env {
  /** Secrets (wrangler secret put …; locally in .dev.vars). */
  ANTHROPIC_API_KEY: string;
  /** Key of the teacher's data page (#datos). Without it the data page answers 503. */
  ADMIN_KEY?: string;
  /** Vars (wrangler.toml). */
  ALLOWED_ORIGINS: string;
  GROUPS: string;
  DAILY_PER_GROUP: string;
  MODEL: string;
  MAX_TOKENS: string;
  EFFORT: string;
  DAILY_PER_STUDENT: string;
  DAILY_TOTAL: string;
  /** Bindings. */
  PER_MINUTE: RateLimiter;
  PER_IP: RateLimiter;
  QUOTA: KVStore;
  /** Usage database (migrations/): what the simulator and Rocky record for the teacher's research. */
  DB?: D1;
  EVENTS: RateLimiter;
}

interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

const ID = /^[A-Za-z0-9-]{16,64}$/;

const DAY_TTL = 2 * 24 * 3600; // keep counters a little longer than a day

/** Errors in the Claude API's shape, so the SDK in the browser raises its typed errors. */
function apiError(status: number, message: string, cors: HeadersInit): Response {
  const type = { 400: "invalid_request_error", 401: "authentication_error", 403: "permission_error", 413: "request_too_large", 429: "rate_limit_error" }[status] ?? "api_error";
  return Response.json({ type: "error", error: { type, message } }, { status, headers: cors });
}

function corsHeaders(origin: string | null, request: Request): Record<string, string> {
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    // The SDK sends several x-stainless-* headers; they are ignored, so the requested ones are allowed.
    "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") ?? "content-type, x-rpl-group, x-rpl-device, x-rpl-turn, authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

async function countAndCheck(env: Env, student: string, group: string): Promise<string | null> {
  const day = dayKey(new Date());
  const keys = { student: `d:${day}:${student}`, group: `g:${day}:${group}`, total: `t:${day}` };
  const [s, g, t] = await Promise.all([env.QUOTA.get(keys.student), env.QUOTA.get(keys.group), env.QUOTA.get(keys.total)]);
  const used = { student: Number(s ?? 0), group: Number(g ?? 0), total: Number(t ?? 0) };
  if (used.total >= Number(env.DAILY_TOTAL)) return "Rocky ya respondió todas las preguntas de hoy. Vuelve mañana.";
  if (used.group >= Number(env.DAILY_PER_GROUP)) return `El grupo ${group} ya usó todas sus preguntas de hoy. Vuelve mañana.`;
  if (used.student >= Number(env.DAILY_PER_STUDENT)) return "Ya usaste tus preguntas de hoy. Vuelve mañana.";
  // KV is not atomic: under heavy parallel use the counts can fall a little short. The minute limiter
  // and the spending limit in the Claude Console are the hard stops.
  await Promise.all([
    env.QUOTA.put(keys.student, String(used.student + 1), { expirationTtl: DAY_TTL }),
    env.QUOTA.put(keys.group, String(used.group + 1), { expirationTtl: DAY_TTL }),
    env.QUOTA.put(keys.total, String(used.total + 1), { expirationTtl: DAY_TTL }),
  ]);
  return null;
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url);
    const origin = allowedOrigin(request.headers.get("Origin"), env.ALLOWED_ORIGINS);
    const cors = corsHeaders(origin, request);

    if (url.pathname === "/health") return Response.json({ ok: true, model: env.MODEL }, { headers: cors });
    const known = url.pathname === "/v1/messages" || url.pathname === "/v1/events" || url.pathname.startsWith("/admin/");
    if (!known) return apiError(404, "No encontrado.", cors);
    if (!origin) return apiError(403, "Origen no permitido.", cors);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/v1/events") return events(request, env, cors);
    if (url.pathname.startsWith("/admin/")) return admin(request, url, env, cors);
    if (request.method !== "POST") return apiError(400, "Usa POST.", cors);

    const group = validGroup(request.headers.get("x-rpl-group"), env.GROUPS);
    if (!group) return apiError(400, "Elige tu grupo para hablar con Rocky.", cors);

    // One student = one browser (its anonymous id), not one IP: a whole classroom can share one IP.
    // The IP keeps only a wide per-minute cap, against scripts that invent a new id each time.
    const ip = request.headers.get("CF-Connecting-IP") ?? "local";
    const student = studentKey(request.headers.get("x-rpl-device"), ip);
    if (!(await env.PER_IP.limit({ key: ip })).success) return apiError(429, "Rocky está muy ocupado en tu red. Espera un minuto y vuelve a preguntar.", cors);
    if (!(await env.PER_MINUTE.limit({ key: student })).success) return apiError(429, "Vas muy rápido. Espera un minuto y vuelve a preguntar.", cors);

    const checked = checkBody(await request.text());
    if (!checked.ok) return apiError(checked.status, checked.error, cors);

    const quota = await countAndCheck(env, student, group);
    if (quota) return apiError(429, quota, cors);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    // For the teacher's research: each round of Rocky is recorded with its turn (one question of the student).
    const started = Date.now();
    const turn = request.headers.get("x-rpl-turn") ?? "";
    const logging = !!env.DB && ID.test(turn);
    const record = (r: Reply, status: string) => {
      if (!logging) return;
      ctx.waitUntil(
        saveRocky(env.DB!, {
          ts: started, day: dayKey(new Date(started)), device: student.replace(/^(dev|ip):/, ""), grp: group, turn,
          question: lastQuestion(checked.messages).slice(0, 4000), answer: r.text, tools: r.tools.join(" "),
          inTokens: r.inTokens, cacheRead: r.cacheRead, cacheWrite: r.cacheWrite, outTokens: r.outTokens, model: env.MODEL,
          ms: Date.now() - started, status,
        }).catch((e) => console.error("usage: rocky", e)),
      );
    };
    try {
      const upstream = await client.messages
        .create({
          model: env.MODEL,
          max_tokens: Number(env.MAX_TOKENS),
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          tools: TOOLS,
          output_config: { effort: env.EFFORT as Anthropic.OutputConfig["effort"] },
          messages: checked.messages as Anthropic.MessageParam[],
          stream: true,
        })
        .asResponse();
      // Pass the event stream through untouched: the SDK in the browser parses it. A copy is read here to
      // record the answer.
      let body = upstream.body;
      if (logging && body) {
        const [toBrowser, toLog] = body.tee();
        body = toBrowser;
        ctx.waitUntil(readReply(toLog).then((r) => record(r, "ok")).catch((e) => console.error("usage: read", e)));
      }
      return new Response(body, {
        status: upstream.status,
        headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    } catch (error) {
      record({ text: "", tools: [], inTokens: 0, cacheRead: 0, cacheWrite: 0, outTokens: 0 }, "error");
      if (error instanceof Anthropic.RateLimitError) return apiError(429, "Rocky está muy ocupado. Intenta en unos segundos.", cors);
      if (error instanceof Anthropic.APIError) {
        console.error("Claude API error", error.status, error.message);
        return apiError(502, "Rocky no pudo responder. Intenta de nuevo.", cors);
      }
      console.error("Unexpected error", error);
      return apiError(500, "Error inesperado en Rocky.", cors);
    }
  },
};

/** POST /v1/events: a batch of usage events from the simulator (every minute and when the page closes). */
async function events(request: Request, env: Env, cors: Record<string, string>): Promise<Response> {
  if (request.method !== "POST") return apiError(400, "Usa POST.", cors);
  if (!env.DB) return new Response(null, { status: 204, headers: cors });
  const rows = parseEvents(await request.text(), env.GROUPS);
  if (!rows) return apiError(400, "Petición inválida.", cors);
  if (!rows.length) return new Response(null, { status: 204, headers: cors });
  if (!(await env.EVENTS.limit({ key: rows[0].device })).success) return apiError(429, "Demasiados registros.", cors);
  await saveEvents(env.DB, rows, Date.now(), dayKey(new Date()));
  return new Response(null, { status: 204, headers: cors });
}

/** Same length and characters, compared without stopping at the first difference. */
function sameKey(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The teacher's data page: GET /admin/summary, /admin/turns.csv, /admin/events.csv, /admin/students.csv and
 * POST /admin/themes (Claude groups the questions into themes), for the days ?from=…&to=… (Culiacán), and
 * POST /admin/credit to note a recharge of Claude credit ({usd, note, day}) or remove one ({remove: id}).
 */
async function admin(request: Request, url: URL, env: Env, cors: Record<string, string>): Promise<Response> {
  if (!env.DB || !env.ADMIN_KEY) return apiError(503, "Falta configurar la base de datos de uso o la clave de datos (ADMIN_KEY).", cors);
  const key = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!sameKey(key, env.ADMIN_KEY)) return apiError(401, "Clave incorrecta.", cors);
  const from = DAY.test(url.searchParams.get("from") ?? "") ? url.searchParams.get("from")! : "2000-01-01";
  const to = DAY.test(url.searchParams.get("to") ?? "") ? url.searchParams.get("to")! : "2999-12-31";
  const csv = (rows: Record<string, unknown>[], name: string) =>
    new Response(toCsv(rows), {
      headers: { ...cors, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="rpl-${name}.csv"` },
    });

  switch (url.pathname) {
    case "/admin/summary":
      return Response.json(await summary(env.DB, from, to, env.MODEL), { headers: cors });
    case "/admin/credit": {
      if (request.method !== "POST") return apiError(400, "Usa POST.", cors);
      const body = (await request.json().catch(() => null)) as { usd?: unknown; note?: unknown; day?: unknown; remove?: unknown } | null;
      if (Number.isInteger(body?.remove)) {
        await removeCredit(env.DB, Number(body!.remove));
        return new Response(null, { status: 204, headers: cors });
      }
      const usd = Number(body?.usd);
      if (!Number.isFinite(usd) || usd <= 0 || usd > 100_000) return apiError(400, "Escribe una cantidad en dólares mayor que cero.", cors);
      // The recharge counts from the start of its day in Culiacán (UTC−7); without a day, from now.
      const day = typeof body?.day === "string" && DAY.test(body.day) ? body.day : null;
      const ts = day ? Date.parse(`${day}T00:00:00-07:00`) : Date.now();
      const note = typeof body?.note === "string" ? body.note.replace(/\s+/g, " ").trim().slice(0, 120) : "";
      await addCredit(env.DB, Math.min(ts, Date.now()), Math.round(usd * 100) / 100, note);
      return new Response(null, { status: 204, headers: cors });
    }
    case "/admin/turns.csv":
      return csv((await turns(env.DB, from, to)).map((t) => ({ ...t, ts: new Date(t.ts).toISOString() })), "preguntas-rocky");
    case "/admin/events.csv": {
      const rows = (await env.DB.prepare("SELECT * FROM events WHERE day BETWEEN ? AND ? ORDER BY id").bind(from, to).all()).results;
      return csv(rows.map((r) => ({ ...r, ts: new Date(Number(r.ts)).toISOString() })), "eventos");
    }
    case "/admin/students.csv":
      return csv((await summary(env.DB, from, to, env.MODEL)).students, "alumnos");
    case "/admin/themes": {
      if (request.method !== "POST") return apiError(400, "Usa POST.", cors);
      const qs = (await turns(env.DB, from, to)).map((t) => t.question.replace(/\s+/g, " ").slice(0, 300));
      if (!qs.length) return Response.json({ temas: [], total: 0, of: 0 }, { headers: cors });
      const sample = qs.slice(-800);
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
      try {
        const msg = await client.messages.create({
          model: env.MODEL,
          max_tokens: 6000,
          system: THEMES_PROMPT,
          messages: [{ role: "user", content: `Total de preguntas: ${sample.length}\n\n${sample.map((q, i) => `${i + 1}. ${q}`).join("\n")}` }],
        });
        // Grouping costs tokens too: kept as a Rocky row without a question, so it counts in the balance only.
        const now = Date.now();
        await saveRocky(env.DB, {
          ts: now, day: dayKey(new Date(now)), device: "datos", grp: "", turn: `temas-${now}`, question: "", answer: "", tools: "",
          inTokens: msg.usage.input_tokens + (msg.usage.cache_read_input_tokens ?? 0) + (msg.usage.cache_creation_input_tokens ?? 0),
          cacheRead: msg.usage.cache_read_input_tokens ?? 0, cacheWrite: msg.usage.cache_creation_input_tokens ?? 0,
          outTokens: msg.usage.output_tokens, model: env.MODEL, ms: 0, status: "temas",
        }).catch((e) => console.error("usage: themes cost", e));
        const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
        const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        return Response.json({ ...json, total: sample.length, of: qs.length }, { headers: cors });
      } catch (e) {
        console.error("usage: themes", e);
        return apiError(502, "No se pudieron agrupar las preguntas. Intenta de nuevo.", cors);
      }
    }
  }
  return apiError(404, "No encontrado.", cors);
}
