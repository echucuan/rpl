/**
 * What the student is looking at, for the copilot's ver_leccion tool: the text of the open screen
 * with every KaTeX formula turned back into its LaTeX source, so the copilot uses the same notation.
 */

const SCREEN_NAMES: Record<string, string> = {
  fase0: "Fase 0 · El experimento / Motor: tu motor",
  motor2: "Motor: mide tu motor (prueba estática)",
  motor3: "Motor: compara tu prueba",
  motor4: "Motor: decide el empuje de la simulación",
  cohete: "Cohete: diseño (ojiva, cuerpo y porta motor)",
  cohete2: "Cohete: motor / agua y presión",
  cohete3: "Cohete: aletas",
  cohete4: "Cohete: sensores (altímetro)",
  cohete5: "Cohete: recuperación (paracaídas)",
  cohete6: "Cohete: masas adicionales",
  cohete7: "Cohete: lanzamiento",
  estabilidad: "Estabilidad",
  graficas: "Simulaciones",
  fase1: "Lección de la fase 1",
  fase2: "Lección de la fase 2",
  fase3: "Lección de la fase 3",
  fase4: "Lección de la fase 4",
};

/** Long lessons are cut here; the start (physics and equations) matters most. */
const MAX_CHARS = 14_000;

export function readScreen(): { pantalla: string; programa: string | null; texto: string; recortado: boolean } {
  const [program, sub] = location.hash.slice(1).split("/");
  const main = document.querySelector("main");
  const pantalla = SCREEN_NAMES[sub] ?? (program || "inicio");
  if (!main) return { pantalla, programa: null, texto: "", recortado: false };

  const copy = main.cloneNode(true) as HTMLElement;
  // Formulas: keep the LaTeX source instead of KaTeX's visual + MathML duplicates.
  copy.querySelectorAll(".katex-display, .katex").forEach((k) => {
    if (!copy.contains(k)) return; // the inline part of a display formula, already replaced
    const tex = k.querySelector('annotation[encoding="application/x-tex"]')?.textContent ?? "";
    const display = k.classList.contains("katex-display");
    k.replaceWith(document.createTextNode(display ? `\n$$${tex}$$\n` : `$${tex}$`));
  });
  copy.querySelectorAll("svg, canvas, button, script, style, .chart").forEach((n) => n.remove());

  // innerText needs layout to keep line breaks, so the copy is laid out off screen for a moment.
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText = "position:absolute;left:-100000px;top:0;width:900px;";
  holder.append(copy);
  document.body.append(holder);
  const raw = copy.innerText;
  holder.remove();

  const text = raw.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return {
    pantalla,
    programa: program === "estes" ? "Rocket Tec" : program === "water" ? "Rocket Challenge" : null,
    texto: text.slice(0, MAX_CHARS),
    recortado: text.length > MAX_CHARS,
  };
}
