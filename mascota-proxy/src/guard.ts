/**
 * Checks on what the browser sends, before anything reaches the Claude API.
 * Pure functions (no Worker APIs) so they can be tested with vitest.
 */

export const LIMITS = {
  /** Messages kept from the conversation (user + assistant turns). */
  maxMessages: 40,
  /** Whole request body, in bytes. The design + flight summary fits well within this. */
  maxBodyBytes: 64_000,
  /** One text block written by a student. */
  maxTextChars: 4_000,
};

/** Content blocks the copilot conversation can contain. */
const USER_BLOCKS = new Set(["text", "tool_result"]);
const ASSISTANT_BLOCKS = new Set(["text", "tool_use", "thinking", "redacted_thinking"]);

export type Checked = { ok: true; messages: unknown[] } | { ok: false; status: number; error: string };

const fail = (status: number, error: string): Checked => ({ ok: false, status, error });

/** Accepts only a plain user/assistant conversation; everything else in the body is ignored. */
export function checkBody(raw: string): Checked {
  if (new TextEncoder().encode(raw).length > LIMITS.maxBodyBytes) return fail(413, "La conversación es demasiado larga. Empieza una nueva.");
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "Petición inválida.");
  }
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return fail(400, "Faltan mensajes.");
  if (messages.length > LIMITS.maxMessages) return fail(413, "La conversación es demasiado larga. Empieza una nueva.");

  for (const [i, m] of messages.entries()) {
    const role = (m as { role?: unknown })?.role;
    const content = (m as { content?: unknown })?.content;
    if (role !== "user" && role !== "assistant") return fail(400, "Rol inválido.");
    if (i === 0 && role !== "user") return fail(400, "La conversación debe empezar con el alumno.");
    if (typeof content === "string") {
      if (role === "user" && content.length > LIMITS.maxTextChars) return fail(413, "La pregunta es demasiado larga.");
      continue;
    }
    if (!Array.isArray(content) || content.length === 0) return fail(400, "Mensaje vacío.");
    const allowed = role === "user" ? USER_BLOCKS : ASSISTANT_BLOCKS;
    for (const b of content) {
      const type = (b as { type?: unknown })?.type;
      if (typeof type !== "string" || !allowed.has(type)) return fail(400, "Contenido no permitido.");
      const text = (b as { text?: unknown }).text;
      if (role === "user" && typeof text === "string" && text.length > LIMITS.maxTextChars) return fail(413, "La pregunta es demasiado larga.");
    }
  }
  if ((messages.at(-1) as { role: string }).role !== "user") return fail(400, "El último mensaje debe ser del alumno.");
  return { ok: true, messages };
}

/** Exact match against the comma-separated list in ALLOWED_ORIGINS. */
export function allowedOrigin(origin: string | null, list: string): string | null {
  if (!origin) return null;
  return list.split(",").map((s) => s.trim()).filter(Boolean).includes(origin) ? origin : null;
}

/** The student's group, if it is one of the comma-separated list in GROUPS. */
export function validGroup(given: string | null, list: string): string | null {
  if (!given) return null;
  return list.split(",").map((s) => s.trim()).filter(Boolean).includes(given) ? given : null;
}

/**
 * Who counts as one student for the per-student limits: the anonymous id the app keeps in each
 * browser (x-rpl-device), so a classroom sharing one IP address is not counted as one student.
 * Without a valid id (an old copy of the page, or a hand-made request) it falls back to the IP.
 */
export function studentKey(device: string | null, ip: string | null): string {
  return device && /^[A-Za-z0-9-]{16,64}$/.test(device) ? `dev:${device}` : `ip:${ip ?? "local"}`;
}

/** Day key in Culiacán time (UTC-7, no DST), so quotas reset at local midnight. */
export function dayKey(now: Date): string {
  return new Date(now.getTime() - 7 * 3600_000).toISOString().slice(0, 10);
}
