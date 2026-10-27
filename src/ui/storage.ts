// Designs live in the student's own browser (localStorage) and can be downloaded as files.
import type { Design } from "../model";
import { projectFile, type Draft, type Writer } from "./project";

export interface SavedDesign {
  id: string;
  savedAt: string; // ISO date
  design: Design;
}

const LIST_KEY = "rpl.designs";
const currentKey = (type: Design["type"]) => `rpl.current.${type}`;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const listDesigns = (): SavedDesign[] => read<SavedDesign[]>(LIST_KEY, []);

export function saveDesign(design: Design, id?: string): SavedDesign | null {
  const list = listDesigns();
  const entry: SavedDesign = { id: id ?? crypto.randomUUID(), savedAt: new Date().toISOString(), design };
  const next = [entry, ...list.filter((d) => d.id !== entry.id)];
  return write(LIST_KEY, next) ? entry : null;
}

export function deleteDesign(id: string) {
  write(LIST_KEY, listDesigns().filter((d) => d.id !== id));
}

/** Recovery draft of the active project; only a backup, the student's file is the real save. */
export const loadDraft = (type: Design["type"]): unknown => read<unknown>(currentKey(type), null);
export const storeDraft = (type: Design["type"], draft: Draft) => write(currentKey(type), draft);

export function downloadFile(name: string, content: string | Blob, type = "application/json") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const fileSafe = (name: string) => name.trim().replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "") || "diseño";

export const designFileName = (design: Design) => `${fileSafe(design.name)}.rpl.json`;

export function downloadDesign(design: Design) {
  downloadFile(designFileName(design), projectFile(design));
}

interface SaveFilePicker {
  (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }): Promise<{
    createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  }>;
}

/**
 * Saves the project file. Where the browser has a "Save as" dialog (Chrome, Edge) the write is
 * confirmed; elsewhere the file goes to the downloads, which the page cannot check.
 */
export const saveProjectFile: Writer = async (name, content) => {
  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (picker) {
    let handle = null;
    try {
      handle = await picker({ suggestedName: name, types: [{ description: "Diseño de Rocket Physics Lab", accept: { "application/json": [".json"] } }] });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // Not allowed here (e.g. inside a frame): fall back to a normal download.
    }
    if (handle) {
      const w = await handle.createWritable();
      await w.write(content);
      await w.close();
      return "written";
    }
  }
  downloadFile(name, content);
  return "downloaded";
};

/** Reads a downloaded design file; returns an error message when it is not one. */
export async function readDesignFile(file: File): Promise<Design | string> {
  try {
    const data = JSON.parse(await file.text());
    const design = data?.design ?? data;
    if (design?.type !== "estes" && design?.type !== "water") return "El archivo no es un diseño de Rocket Physics Lab Sinaloa.";
    return design as Design;
  } catch {
    return "No se pudo leer el archivo.";
  }
}
