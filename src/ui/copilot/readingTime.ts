const DISPLAY = /\$\$[\s\S]+?\$\$/g;
const INLINE = /\$[^$\n]+?\$/g;

/** Reading pace and limits for the reading clock on Rocky's answers. Change them here. */
export const READING = { wordsPerMinute: 250, perInlineFormula: 0.5, perDisplayFormula: 2, min: 5, max: 45 };

/**
 * Seconds a student needs to read one of Rocky's answers: about 250 words per minute, a little extra
 * per formula (more for a displayed equation than for a symbol in the text), between 5 and 45 s.
 */
export function readingSeconds(text: string): number {
  const display = text.match(DISPLAY)?.length ?? 0;
  const rest = text.replace(DISPLAY, " ");
  const inline = rest.match(INLINE)?.length ?? 0;
  const words = rest.replace(INLINE, " ").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  const s = (words / READING.wordsPerMinute) * 60 + inline * READING.perInlineFormula + display * READING.perDisplayFormula;
  return Math.min(READING.max, Math.max(READING.min, Math.round(s)));
}
