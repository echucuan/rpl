import type { Design } from "../model";
import type { Stability } from "../physics/geometry";
import { format } from "./fields";

export type StabilityLevel = "stable" | "unstable" | "over";

/**
 * One verdict the student can read at a glance: the same thresholds as the flight warnings
 * (under 1 caliber unstable, over 3 overstable). Water rockets are judged without water.
 */
export function stabilityStatus(type: Design["type"], loaded: Stability, empty: Stability) {
  const margin = type === "water" ? empty.margin : Math.min(loaded.margin, empty.margin);
  const level: StabilityLevel = margin < 1 ? "unstable" : Math.max(loaded.margin, empty.margin) > 3 ? "over" : "stable";
  const word = level === "stable" ? "Estable" : level === "unstable" ? "Inestable" : "Sobreestable";
  const icon = level === "stable" ? "✓" : "⚠";
  return { level, margin, label: `${icon} ${word}`, detail: `${format(margin, 2)} calibres` };
}
