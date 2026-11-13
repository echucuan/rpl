import { useMemo } from "react";
import type { Design } from "../model";
import type { FlightResult } from "../physics/simulate";
import { LEVELS, rateFlight, type Level } from "./flightRating";
import type { SubTab } from "./Workspace";

const CONFETTI_COLORS = ["#0039a6", "#1d7a3e", "#c0262d", "#e8a317", "#6b3fa0", "#0f8a9d"];

/** Confetti pieces with fixed pseudo-random positions (same every render, so React does not redraw them). */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => {
        const x = (i * 37) % 100;
        return {
          left: `${x}%`,
          delay: `${((i * 53) % 60) / 100}s`,
          duration: `${1.6 + ((i * 29) % 90) / 100}s`,
          drift: `${((i * 41) % 80) - 40}px`,
          rotate: `${(i * 67) % 360}deg`,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          round: i % 3 === 0,
        };
      }),
    [],
  );
  return (
    <div className="fb-confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={p.round ? "round" : undefined}
          style={{ left: p.left, background: p.color, animationDelay: p.delay, animationDuration: p.duration, ["--drift" as string]: p.drift, ["--rot" as string]: p.rotate }}
        />
      ))}
    </div>
  );
}

const summary = (level: Level, go: number, total: number) =>
  level === 1
    ? `Los ${total} sistemas en GO: despega estable, el paracaídas abre a tiempo y aterriza suavecito.`
    : level === 2
      ? `${go} de ${total} sistemas en GO. Vuela y regresa, pero algo estuvo al límite.`
      : level === 3
        ? `${go} de ${total} sistemas en GO. Regresa, pero es probable que algo se rompa.`
        : `${go} de ${total} sistemas en GO. Este vuelo no termina bien.`;

/** The expected flight in one look: a badge with the borrego's verdict and the GO / NO-GO launch checklist. */
export function FlightBadge({ design, result, onGo }: { design: Design; result: FlightResult; onGo: (s: SubTab) => void }) {
  const rating = useMemo(() => rateFlight(design, result), [design, result]);
  const L = LEVELS[rating.level];
  const go = rating.checks.filter((c) => c.level === 1).length;

  return (
    // The key replays the entrance (and the confetti or the shake) whenever the verdict changes.
    <div key={rating.level} className={`card flight-badge lvl-${rating.level}`}>
      {rating.level === 1 && <Confetti />}
      <div className="fb-hero">
        <div className="fb-emoji" aria-hidden="true">
          <span className="fb-sheep">🐏</span>
          {rating.level === 2 && (
            <>
              <span className="fb-sweat s1">💦</span>
              <span className="fb-sweat s2">💧</span>
            </>
          )}
          <span className="fb-mark">{L.emoji}</span>
        </div>
        <div className="fb-text">
          <span className="fb-kicker">Vuelo esperado según la simulación</span>
          <strong className="fb-label">{L.label}</strong>
          <span className="fb-term">{rating.term}</span>
          <p className="fb-summary">{summary(rating.level, go, rating.checks.length)}</p>
        </div>
      </div>

      <h3 className="fb-list-title">Revisión de lanzamiento: GO / NO-GO</h3>
      <ol className="fb-checks">
        {rating.checks.map((c, i) => (
          <li key={c.id} className={`fb-check lvl-${c.level}`} style={{ animationDelay: `${0.5 + i * 0.22}s` }}>
            <span className="fb-status">{LEVELS[c.level].emoji} {LEVELS[c.level].status}</span>
            <span className="fb-name">{c.name}</span>
            <span className="fb-value">{c.value}</span>
            <span className="fb-target">meta: {c.target}</span>
            {c.level > 1 && (
              <div className="fb-advice">
                <p>{c.why}</p>
                <p className="fb-hint"><b>Pista:</b> {c.hint}</p>
                <button type="button" className="btn small no-print" onClick={() => onGo("cohete")}>Ir a Cohete →</button>
              </div>
            )}
          </li>
        ))}
      </ol>
      <p className="hint fb-note">
        Es una predicción: la simulación no conoce el viento ni los detalles de armado. Los límites vienen de las recomendaciones de cohetería modelo (NAR).
      </p>
    </div>
  );
}
