// Unsaved-work tracking for the active Rocket Tec and Rocket Challenge projects.
// The only real save is a file on the student's computer: a design is "clean" when it equals
// the last file downloaded or opened (or an untouched new design, or one opened from Mis diseños).
// Everything here is pure so the tests can run each scenario without a browser.
import type { Design } from "../model";
import { WEIGHED, newEstesDesign, newWaterDesign } from "../model";

/** Fills fields missing from designs saved by older versions with today's defaults. */
export function normalize(d: Design): Design {
  const base = d.type === "water" ? newWaterDesign() : newEstesDesign();
  const merged: Record<string, unknown> = { ...base, ...d };
  for (const [k, v] of Object.entries(base)) {
    if (v && typeof v === "object" && !Array.isArray(v)) merged[k] = { ...v, ...((d as unknown as Record<string, object>)[k] ?? {}) };
  }
  const n = merged as unknown as Design;
  if (n.type === "estes") {
    // Replace the placeholder estimates used before the lab weighed these parts; keep anything a student typed.
    if (n.altimeter.mass === 5) n.altimeter = { ...n.altimeter, mass: WEIGHED.altimeter };
    if (n.recovery.mass === 9) n.recovery = { ...n.recovery, mass: WEIGHED.parachute };
    if (n.motor.mass === 8.2 && n.motor.propellant === 3.5) n.motor = { mass: WEIGHED.motorLoaded, propellant: WEIGHED.motorLoaded - WEIGHED.motorBurnt };
  }
  return n;
}

/** JSON with sorted keys, so two designs with the same values always give the same text. */
function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(Object.is(v, -0) ? 0 : v) ?? "null";
}

/** Everything that goes in the project file, in a canonical form. */
export const fingerprint = (d: Design) => stableStringify(normalize(d));

/** Where the clean version came from: only "downloaded" and "written" are files the student saved. */
export type BaselineSource = "new" | "opened" | "imported" | "downloaded" | "written";

export interface Project {
  design: Design;
  /** The version the student can get back without this browser tab: the last file, or a fresh design. */
  baseline: { design: Design; fp: string; source: BaselineSource; at: string };
  /** Snapshot being written right now, if any. */
  exporting: string | null;
  error: string | null;
}

export function project(design: Design, source: BaselineSource, at = new Date().toISOString()): Project {
  const d = normalize(design);
  return { design: d, baseline: { design: d, fp: fingerprint(d), source, at }, exporting: null, error: null };
}

export const isDirty = (p: Project) => fingerprint(p.design) !== p.baseline.fp;

export type SaveStatus = "clean" | "dirty" | "preparing" | "started" | "written" | "error";

export function saveStatus(p: Project): SaveStatus {
  if (p.exporting !== null) return "preparing";
  if (isDirty(p)) return p.error ? "error" : "dirty";
  if (p.baseline.source === "downloaded") return "started";
  if (p.baseline.source === "written") return "written";
  return "clean";
}

export const STATUS_TEXT: Record<SaveStatus, string> = {
  clean: "Sin cambios pendientes",
  dirty: "Cambios sin guardar",
  preparing: "Preparando archivo…",
  started: "Descarga iniciada",
  written: "Archivo guardado en tu equipo",
  error: "Error al exportar",
};

/** Contents of the .rpl.json file; unchanged from version 1 so old files still open. */
export const projectFile = (d: Design) => JSON.stringify({ app: "Rocket Physics Lab Sinaloa", version: 1, design: d }, null, 2);

/**
 * Delivers the file. "written" when the browser confirms the bytes reached the disk
 * (File System Access API), "downloaded" when it only handed the file to its download manager,
 * "cancelled" when the student closed the save dialog.
 */
export type Writer = (name: string, content: string) => Promise<"written" | "downloaded" | "cancelled">;

export type ExportOutcome = { ok: true; source: "written" | "downloaded"; fp: string; design: Design } | { ok: false; cancelled: boolean; error?: string };

/** Exports a snapshot taken now; later edits are not part of it and stay pending. */
export async function exportSnapshot(design: Design, name: string, writer: Writer): Promise<ExportOutcome> {
  const snap = normalize(structuredClone(design));
  try {
    const result = await writer(name, projectFile(snap));
    if (result === "cancelled") return { ok: false, cancelled: true };
    return { ok: true, source: result, fp: fingerprint(snap), design: snap };
  } catch (e) {
    return { ok: false, cancelled: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Applies a finished export: the snapshot becomes the clean version, whatever was typed meanwhile stays pending. */
export function afterExport(p: Project, out: ExportOutcome, at = new Date().toISOString()): Project {
  if (out.ok) return { ...p, exporting: null, error: null, baseline: { design: out.design, fp: out.fp, source: out.source, at } };
  return { ...p, exporting: null, error: out.cancelled ? null : out.error ?? "No se pudo crear el archivo." };
}

/** "Salir sin guardar": back to the last saved (or fresh) version. */
export const discard = (p: Project): Project => ({ ...p, design: p.baseline.design, error: null });

// ---------- navigation guard ----------

export type Tab = "inicio" | "estes" | "water" | "designs" | "about";
export type ProgramType = Design["type"];

/** Something the student asked for that would leave or replace a project. */
export type Intent =
  | { kind: "tab"; to: Tab; sub?: string }
  | { kind: "open"; design: Design; source: "opened" | "imported"; id?: string }
  | { kind: "new"; type: ProgramType };

/** Which project, if any, has unsaved work that this intent would leave or replace. */
export function guardFor(current: Tab, intent: Intent, projects: Record<ProgramType, Project>): ProgramType | null {
  const at = (t: ProgramType) => (isDirty(projects[t]) ? t : null);
  if (intent.kind === "tab") {
    // Moving between the sub-tabs of one simulator never reaches here: only leaving it counts.
    return (current === "estes" || current === "water") && intent.to !== current ? at(current) : null;
  }
  return at(intent.kind === "open" ? intent.design.type : intent.type);
}

/** The browser's own "leave site?" prompt is needed while any project has unsaved work. */
export const shouldWarnOnUnload = (projects: Record<ProgramType, Project>) =>
  Object.values(projects).some((p) => isDirty(p) || p.exporting !== null);

// ---------- recovery draft (browser only, never replaces the file) ----------

export interface Draft {
  version: 2;
  design: Design;
  baseline: Project["baseline"];
  updatedAt: string;
}

/** Drafts older than this are dropped when the app starts. */
export const DRAFT_MAX_AGE_DAYS = 30;

export const draftOf = (p: Project, at = new Date().toISOString()): Draft => ({ version: 2, design: p.design, baseline: p.baseline, updatedAt: at });

/**
 * What to do with the draft found at start-up: "resume" when it holds nothing unsaved,
 * "ask" when it has work the student never downloaded, "drop" when absent or too old.
 * Drafts from older versions (a bare design) count as unsaved unless they are an untouched new design.
 */
export function readDraft(raw: unknown, type: ProgramType, now = Date.now()): { action: "drop" } | { action: "resume" | "ask"; project: Project; updatedAt: string | null } {
  if (!raw || typeof raw !== "object") return { action: "drop" };
  const r = raw as Partial<Draft> & Partial<Design>;
  if (r.version === 2 && r.design?.type === type && r.baseline) {
    if (now - Date.parse(r.updatedAt ?? "") > DRAFT_MAX_AGE_DAYS * 864e5) return { action: "drop" };
    const p: Project = { design: normalize(r.design), baseline: { ...r.baseline, design: normalize(r.baseline.design), fp: fingerprint(r.baseline.design) }, exporting: null, error: null };
    return { action: isDirty(p) ? "ask" : "resume", project: p, updatedAt: r.updatedAt ?? null };
  }
  if (r.type === type) {
    const fresh = project(type === "water" ? newWaterDesign() : newEstesDesign(), "new");
    const p = { ...fresh, design: normalize(r as Design) };
    return { action: isDirty(p) ? "ask" : "resume", project: p, updatedAt: null };
  }
  return { action: "drop" };
}
