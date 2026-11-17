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
/** The head of every step page (title line, or the row of section buttons): the same height everywhere (CSS .step-head, .phase-head). */
const HEAD_H = 58;
const HEAD_GAP = 16; // between the head and the stage

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
      // Hidden (another section of the page is on screen): nothing to measure.
      if (!el.offsetParent) return;
      // One window for every stage in RPL, from sizes only (never from where things happen to be): the row of steps
      // 8 px under the top edge, the end of the menu that holds it, the head of the page (one line, HEAD_H high on
      // every page) and its gap; it ends over the ← → buttons. So moving between steps, sections or tabs never
      // changes its size.
      const steps = document.querySelector<HTMLElement>(".menu-row.phases");
      const menu = steps?.closest<HTMLElement>(".workspace-menu");
      const ms = menu ? getComputedStyle(menu) : null;
      const menuTail = ms ? parseFloat(ms.paddingBottom) + parseFloat(ms.borderBottomWidth) + parseFloat(ms.marginBottom) : 0;
      const top = 8 + (steps?.offsetHeight ?? 0) + menuTail + HEAD_H + HEAD_GAP;
      const nav = document.querySelector<HTMLElement>(".lesson-nav");
      const navSpace = nav ? nav.offsetHeight + parseFloat(getComputedStyle(nav).marginTop || "0") : 0;
      const h = Math.max(MIN_STAGE, Math.floor(innerHeight - top - navSpace - BOTTOM_GAP));
      el.style.setProperty("--stage-h", `${h}px`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    const steps = document.querySelector(".menu-row.phases");
    if (steps) ro.observe(steps);
    // The menu above (main steps + row of steps) changes height when its main row folds away: measure again.
    const menu = document.querySelector(".workspace-menu");
    if (menu) ro.observe(menu);
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
