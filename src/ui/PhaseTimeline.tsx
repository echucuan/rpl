import type { FlightResult } from "../physics/simulate";
import { format } from "./fields";
import { PHASE_SOLID, flightPhases, type PhaseId } from "./phases";

/** The four flight phases as clickable blocks, in order. */
export function PhaseTimeline({ result, active, onPick }: { result: FlightResult; active?: PhaseId; onPick?: (id: PhaseId) => void }) {
  const phases = flightPhases(result);
  return (
    <div className="phase-timeline" role="list">
      {phases.map((ph) => (
        <button
          key={ph.id}
          type="button"
          role="listitem"
          className={`phase-block ${ph.exists ? "" : "missing"} ${active === ph.id ? "active" : ""}`}
          style={{ borderTopColor: PHASE_SOLID[ph.id] }}
          onClick={() => onPick?.(ph.id)}
          disabled={!onPick}
        >
          <span className="phase-num" style={{ background: PHASE_SOLID[ph.id] }}>{ph.id}</span>
          <span className="phase-text">
            <b>{ph.name}</b>
            <small>{ph.exists ? `${format(ph.from, ph.to < 1 ? 3 : 2)} – ${format(ph.to, ph.to < 1 ? 3 : 1)} s · dura ${format(ph.to - ph.from, ph.to - ph.from < 1 ? 3 : 1)} s` : "No existe en este vuelo"}</small>
          </span>
        </button>
      ))}
    </div>
  );
}
