// Designs live in the student's own browser (localStorage) and can be downloaded as files.
import type { Design } from "../model";

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

export const loadCurrent = <T extends Design>(type: T["type"]): T | null => read<T | null>(currentKey(type), null);
export const storeCurrent = (design: Design) => write(currentKey(design.type), design);

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

export function downloadDesign(design: Design) {
  downloadFile(`${fileSafe(design.name)}.rpl.json`, JSON.stringify({ app: "Rocket Physics Lab Sinaloa", version: 1, design }, null, 2));
}

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
