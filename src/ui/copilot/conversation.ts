/**
 * The copilot conversation: sends it to the Worker with the Anthropic SDK, streams the answer and
 * runs the tools in the browser until Claude finishes. The SDK is loaded only when the panel is used.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { Design } from "../../model";
import { readScreen } from "./screen";
import { runTool } from "./tools";

/** Worker URL: VITE_COPILOT_URL in .env.development / .env.production. Without it the copilot is hidden. */
export const COPILOT_URL: string | undefined = import.meta.env.VITE_COPILOT_URL || undefined;

/** Tool rounds per question, so a confused model cannot loop forever. */
const MAX_ROUNDS = 5;
/** Close to the Worker's limit (40); past it the student starts a new conversation. */
export const MAX_MESSAGES = 34;

export type Phase = "waiting" | "writing" | "tool";

export interface Callbacks {
  onPhase: (p: Phase, tool?: string) => void;
  onText: (delta: string) => void;
}

export class CopilotError extends Error {
  constructor(message: string, readonly kind: "group" | "limit" | "network" | "other") {
    super(message);
  }
}

let sdk: Promise<typeof import("@anthropic-ai/sdk")> | null = null;

const DEVICE_KEY = "rpl.copilot.device";
let deviceId = "";
/**
 * Anonymous random id of this browser: the Worker counts each student's limits with it, because a
 * whole classroom usually shares one IP address. It says nothing about the student.
 */
function device(): string {
  if (deviceId) return deviceId;
  try {
    deviceId = localStorage.getItem(DEVICE_KEY) ?? "";
    if (!/^[A-Za-z0-9-]{16,64}$/.test(deviceId)) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, deviceId);
    }
  } catch {
    deviceId ||= crypto.randomUUID(); // private mode: one id for this visit
  }
  return deviceId;
}

async function client(group: string): Promise<Anthropic> {
  sdk ??= import("@anthropic-ai/sdk");
  const { default: Anthropic } = await sdk;
  return new Anthropic({
    baseURL: COPILOT_URL,
    apiKey: "rpl", // the real key lives in the Worker
    dangerouslyAllowBrowser: true,
    defaultHeaders: { "x-rpl-group": group, "x-rpl-device": device() },
    maxRetries: 0, // the Worker already retries towards Claude; a retry here would spend the student's quota twice
  });
}

/**
 * Appends the assistant's turns (and the tool results) to `messages` until the answer is complete.
 * Returns the messages to keep. The visible text arrives through `cb.onText`.
 */
export async function ask(messages: Anthropic.MessageParam[], group: string, design: Design | null, cb: Callbacks, signal: AbortSignal) {
  const { default: Anthropic } = await (sdk ??= import("@anthropic-ai/sdk"));
  const api = await client(group);
  const history = [...messages];
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      cb.onPhase("waiting");
      const stream = api.messages.stream(
        // model and max_tokens are required by the SDK; the Worker replaces them (and adds system and tools).
        { model: "rpl", max_tokens: 1, messages: history },
        { signal },
      );
      stream.on("text", (delta) => {
        cb.onPhase("writing");
        cb.onText(delta);
      });
      const reply = await stream.finalMessage();
      history.push({ role: "assistant", content: reply.content });

      if (reply.stop_reason === "refusal") {
        cb.onText("\n\nPrefiero no responder eso. Pregúntame sobre tu cohete o la física del vuelo.");
        return history;
      }
      if (reply.stop_reason !== "tool_use") return history;

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of reply.content) {
        if (block.type !== "tool_use") continue;
        cb.onPhase("tool", block.name);
        const r = runTool(block.name, block.input, design, readScreen);
        results.push({ type: "tool_result", tool_use_id: block.id, content: r.content, is_error: r.isError });
      }
      history.push({ role: "user", content: results });
    }
    cb.onText("\n\n(Me quedé dando vueltas con las simulaciones. ¿Me haces la pregunta de otra forma?)");
    return history;
  } catch (e) {
    if (e instanceof Anthropic.APIUserAbortError) throw e;
    if (e instanceof Anthropic.BadRequestError && /grupo/i.test(e.message)) throw new CopilotError("Elige tu grupo para hablar conmigo.", "group");
    if (e instanceof Anthropic.APIConnectionError) throw new CopilotError("No me pude conectar. Revisa tu internet e intenta de nuevo.", "network");
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.APIError) {
      // The Worker writes its messages for the student (límites, conversación larga…).
      const msg = (e.error as { error?: { message?: string } } | undefined)?.error?.message;
      throw new CopilotError(msg ?? "No pude responder. Intenta de nuevo.", e.status === 429 || e.status === 413 ? "limit" : "other");
    }
    console.error("[copiloto]", e);
    throw new CopilotError("Algo salió mal. Intenta de nuevo.", "other");
  }
}
