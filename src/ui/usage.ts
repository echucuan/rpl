/**
 * Usage of RPL for the teacher's research (see mascota-proxy/LEEME.md, "Datos de uso"). Without names: a
 * student is the anonymous random id of the browser and the group chosen for Rocky. Every minute (and
 * when the page is hidden or closed) it sends to the Worker, added up by screen:
 *   - time: seconds the student was really using it (page on screen and some activity in the last minute);
 *   - view: each time a screen is opened;
 *   - click: clicks on buttons, tabs and links, by their name;
 *   - edit: changes to a field, by its name;
 *   - rocky_open / rocky_read / rocky_unread: Rocky's chat opened, and each answer read (or left unread).
 * Without a Worker (VITE_COPILOT_URL) nothing is recorded.
 */

const URL_BASE: string | undefined = import.meta.env.VITE_COPILOT_URL || undefined;
const DEVICE_KEY = "rpl.copilot.device";
const GROUP_KEY = "rpl.copilot.group";
/** Seconds without a click, key, scroll or touch after which the student no longer counts as active. */
const IDLE_AFTER = 60;
const FLUSH_EVERY = 60_000;

const ID = /^[A-Za-z0-9-]{16,64}$/;
let deviceId = "";

/** Anonymous random id of this browser, shared with Rocky. It says nothing about the student. */
export function device(): string {
  if (deviceId) return deviceId;
  try {
    deviceId = localStorage.getItem(DEVICE_KEY) ?? "";
    if (!ID.test(deviceId)) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, deviceId);
    }
  } catch {
    deviceId ||= crypto.randomUUID(); // private mode: one id for this visit
  }
  return deviceId;
}

const group = () => {
  try {
    return localStorage.getItem(GROUP_KEY) ?? "";
  } catch {
    return "";
  }
};

type Kind = "start" | "time" | "view" | "click" | "edit" | "rocky_open" | "rocky_read" | "rocky_unread";
interface Ev { kind: Kind; route: string; target: string; value: number }

const session = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "";
/** Added up until the next send: "kind|route|target" → value. */
let pending = new Map<string, Ev>();
/** Events that are not added up (each answer of Rocky read or not). */
let single: Ev[] = [];
/** Rocky's answers already reported as read or unread. */
const reported = new Set<string>();

const clean = (s: string | null | undefined, n = 60) => (s ?? "").replace(/[\u{1F300}-\u{1FAFF}☀-➿️]/gu, "").replace(/\s+/g, " ").trim().slice(0, n);

/** The screen the student is on: the program and section of the address, and the step tab when there is one. */
export function currentRoute(): string {
  const base = location.hash.slice(1) || "inicio";
  const step = document.querySelector<HTMLElement>(".workspace-menu .phases [role=tab][aria-selected=true]");
  if (!step) return base;
  const name = step.querySelector(".step-name")?.textContent ?? step.querySelector(".phase-tab-text")?.firstChild?.textContent ?? "";
  // The step is also in the address as a number ("estes/cohete4"): its name says more.
  return name ? `${base.replace(/\d+$/, "")}/${clean(name, 30)}` : base;
}

function add(kind: Kind, target = "", value = 1, route = currentRoute()) {
  const key = `${kind}|${route}|${target}`;
  const e = pending.get(key);
  if (e) e.value += value;
  else pending.set(key, { kind, route, target, value });
}

/** Records something on its own (not added up), e.g. one of Rocky's answers read. */
export function track(kind: Kind, target = "", value = 1) {
  if (!URL_BASE) return;
  if (kind === "rocky_read" || kind === "rocky_unread") {
    // Each answer once (React may run the reading clock's update twice).
    if (reported.has(target)) return;
    reported.add(target);
    single.push({ kind, route: currentRoute(), target, value });
  } else add(kind, target, value);
}

/** The name of what was clicked: its label for screen readers, its title, or its visible text. */
function nameOf(el: Element): string {
  const tab = el.matches("[role=tab]") ? el.querySelector(".step-name, .tab-title, .phase-tab-text") : null;
  return clean(el.getAttribute("aria-label") || tab?.firstChild?.textContent || el.textContent || el.getAttribute("title"), 50);
}

/** The heading of the card or panel a field is in ("Ojiva", "Cuerpo"…), so "Masa" says whose. */
function sectionOf(el: Element): string {
  const box = el.closest(".panel, .card, section");
  const h = box?.querySelector("h2, h3, .panel-title");
  return clean(h?.textContent, 30);
}

function fieldName(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): string {
  const label = el.labels?.[0] ?? el.closest("label");
  const own = clean(el.getAttribute("aria-label") || label?.querySelector("span, b")?.textContent || label?.textContent, 40);
  const where = sectionOf(el);
  return where && own && !own.startsWith(where) ? `${where} · ${own}` : own || where || el.tagName.toLowerCase();
}

function send(useBeacon: boolean) {
  if (!URL_BASE || !session) return;
  const events = [...pending.values(), ...single];
  if (!events.length) return;
  pending = new Map();
  single = [];
  // text/plain: a "simple" request, without a CORS preflight; it also lets the browser send it while the page closes.
  const body = JSON.stringify({ device: device(), group: group(), session, events });
  const url = `${URL_BASE}/v1/events`;
  try {
    if (useBeacon && navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) return;
    void fetch(url, { method: "POST", body, headers: { "Content-Type": "text/plain" }, keepalive: true }).catch(() => {});
  } catch {
    /* offline: these minutes are lost, the page goes on */
  }
}

let started = false;

/** Starts recording (once). Called by the app at start-up. */
export function startUsage() {
  if (started || !URL_BASE || typeof window === "undefined") return;
  started = true;
  let lastInput = Date.now();
  let route = currentRoute();
  const poke = () => (lastInput = Date.now());
  for (const t of ["pointerdown", "keydown", "wheel", "scroll", "touchstart", "input"]) addEventListener(t, poke, { capture: true, passive: true });

  add("start", `${innerWidth}x${innerHeight}`);
  add("view");

  // Active time and screen changes, checked every second.
  setInterval(() => {
    const now = currentRoute();
    if (now !== route) {
      route = now;
      add("view", "", 1, now);
    }
    if (document.visibilityState === "visible" && Date.now() - lastInput < IDLE_AFTER * 1000) add("time", "", 1, now);
  }, 1000);

  addEventListener(
    "click",
    (e) => {
      const el = (e.target as Element | null)?.closest?.("button, a, [role=tab], [role=button], summary");
      if (!el || el.closest("#datos-page")) return;
      add("click", nameOf(el));
    },
    { capture: true },
  );
  addEventListener(
    "change",
    (e) => {
      const el = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (!el?.matches?.("input, select, textarea") || el.closest("#datos-page") || el.type === "file") return;
      add("edit", fieldName(el));
    },
    { capture: true },
  );

  setInterval(() => send(false), FLUSH_EVERY);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && send(true));
  addEventListener("pagehide", () => send(true));
}
