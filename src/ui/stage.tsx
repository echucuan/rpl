import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * The stage: the one-screen layout of every page of a step (Elige, Prueba, Compara, Decide, …).
 *
 * A step page is always: its head (one line, same height on every page), the stage, and the ← → buttons. The stage
 * takes exactly the height left on the screen when the page sits where a step button leaves it (its row of steps at
 * the top), so every page of a step has the same window, the buttons never move, and nothing scrolls.
 *
 * Inside the stage nobody sets heights in pixels. The content is laid out with these classes:
 *   stage-fill    takes the height that is left (a chart, a row of columns). Give a LineChart height="fill".
 *   stage-cols    two columns that end at the same line (each column is a flex column).
 *   stage-scroll  a part that can grow without limit (a list of tests): it scrolls inside, the page does not.
 * Anything else keeps its natural height.
 *
 * While developing, a stage whose content does not fit gets a red dashed outline and a warning in the console.
 */
const MIN_STAGE = 360; // below this (very short screens) the page may scroll
const BOTTOM_GAP = 10; // space under the ← → buttons
const docTop = (el: Element) => el.getBoundingClientRect().top + scrollY;

/**
 * Makes the element it is given (the step's card, which must also carry the class step-stage) the stage. `page` is what changes between the pages of the step,
 * so the height is measured again on each page.
 */
export function useStage<T extends HTMLElement = HTMLDivElement>(page: unknown) {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      // Where a step button leaves the page: its row of steps 8 px under the top edge.
      const steps = document.querySelector(".menu-row.phases");
      const focusY = steps ? docTop(steps) - 8 : 0;
      const nav = document.querySelector<HTMLElement>(".lesson-nav");
      const navSpace = nav ? nav.offsetHeight + parseFloat(getComputedStyle(nav).marginTop || "0") : 0;
      const h = Math.max(MIN_STAGE, Math.floor(innerHeight - (docTop(el) - focusY) - navSpace - BOTTOM_GAP));
      el.style.setProperty("--stage-h", `${h}px`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    const steps = document.querySelector(".menu-row.phases");
    if (steps) ro.observe(steps);
    if (el.previousElementSibling) ro.observe(el.previousElementSibling);
    addEventListener("resize", fit);
    return () => { ro.disconnect(); removeEventListener("resize", fit); };
  }, [page]);

  // Development guard: say so when the content does not fit its stage.
  useLayoutEffect(() => {
    if (!import.meta.env.DEV) return;
    const el = ref.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      const over = el.scrollHeight - el.clientHeight;
      el.toggleAttribute("data-overflow", over > 1);
      if (over > 1) console.warn(`[escenario] El contenido se pasa ${over} px: usa stage-fill o stage-scroll en vez de alturas fijas.`, el);
    });
    return () => cancelAnimationFrame(id);
  });

  return ref;
}

/** A stage as a component, for a step page that has nothing else to attach it to. */
export function StepStage({ page, className = "", children }: { page?: unknown; className?: string; children: ReactNode }) {
  const ref = useStage(page);
  return <div ref={ref} className={`card step-stage ${className}`}>{children}</div>;
}
