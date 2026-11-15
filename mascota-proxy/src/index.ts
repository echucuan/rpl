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
import { allowedOrigin, checkBody, dayKey, validGroup } from "./guard";
import { SYSTEM_PROMPT } from "./prompt";
import { TOOLS } from "./tools";

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
  QUOTA: KVStore;
}

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // The SDK sends several x-stainless-* headers; they are ignored, so the requested ones are allowed.
    "Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers") ?? "content-type, x-rpl-group",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

async function countAndCheck(env: Env, student: string, group: string): Promise<string | null> {
  const day = dayKey(new Date());
  const keys = { student: `d:${day}:${student}`, group: `g:${day}:${group}`, total: `t:${day}` };
  const [s, g, t] = await Promise.all([env.QUOTA.get(keys.student), env.QUOTA.get(keys.group), env.QUOTA.get(keys.total)]);
  const used = { student: Number(s ?? 0), group: Number(g ?? 0), total: Number(t ?? 0) };
  if (used.total >= Number(env.DAILY_TOTAL)) return "El copiloto ya respondió todas las preguntas de hoy. Vuelve mañana.";
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = allowedOrigin(request.headers.get("Origin"), env.ALLOWED_ORIGINS);
    const cors = corsHeaders(origin, request);

    if (url.pathname === "/health") return Response.json({ ok: true, model: env.MODEL }, { headers: cors });
    if (url.pathname !== "/v1/messages") return apiError(404, "No encontrado.", cors);
    if (!origin) return apiError(403, "Origen no permitido.", cors);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return apiError(400, "Usa POST.", cors);

    const group = validGroup(request.headers.get("x-rpl-group"), env.GROUPS);
    if (!group) return apiError(400, "Elige tu grupo para hablar con el copiloto.", cors);

    // One student = one IP address (in a classroom many students can share one; the limits allow for that).
    const student = request.headers.get("CF-Connecting-IP") ?? "local";
    const { success } = await env.PER_MINUTE.limit({ key: student });
    if (!success) return apiError(429, "Vas muy rápido. Espera un minuto y vuelve a preguntar.", cors);

    const checked = checkBody(await request.text());
    if (!checked.ok) return apiError(checked.status, checked.error, cors);

    const quota = await countAndCheck(env, student, group);
    if (quota) return apiError(429, quota, cors);

    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
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
      // Pass the event stream through untouched: the SDK in the browser parses it.
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { ...cors, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) return apiError(429, "El copiloto está muy ocupado. Intenta en unos segundos.", cors);
      if (error instanceof Anthropic.APIError) {
        console.error("Claude API error", error.status, error.message);
        return apiError(502, "El copiloto no pudo responder. Intenta de nuevo.", cors);
      }
      console.error("Unexpected error", error);
      return apiError(500, "Error inesperado en el copiloto.", cors);
    }
  },
};
