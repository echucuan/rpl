// Flight phases and events of a simulated flight, shared by every chart.
import type { FlightResult, Sample } from "../physics/simulate";
import type { Marker, Span } from "./LineChart";

export const PHASE_COLORS = {
  thrust: "rgba(224,112,27,0.13)",
  coast: "rgba(0,57,166,0.07)",
  fall: "rgba(91,98,112,0.10)",
  chute: "rgba(29,122,62,0.10)",
};

export function flightSpans(r: FlightResult, water = false): Span[] {
  const end = r.landing?.t ?? r.samples[r.samples.length - 1].t;
  const burn = r.burnout?.t ?? 0;
  const spans: Span[] = [{ from: 0, to: burn, label: water ? "Empuje" : "Empuje", color: PHASE_COLORS.thrust }];
  const chute = r.ejection?.t;
  if (chute !== undefined && chute < r.apogee.t) {
    spans.push({ from: burn, to: chute, label: "Vuelo libre", color: PHASE_COLORS.coast });
    spans.push({ from: chute, to: end, label: "Paracaídas", color: PHASE_COLORS.chute });
  } else {
    spans.push({ from: burn, to: r.apogee.t, label: "Vuelo libre (sube)", color: PHASE_COLORS.coast });
    if (chute !== undefined) {
      if (chute > r.apogee.t + 0.05) spans.push({ from: r.apogee.t, to: chute, label: "Caída", color: PHASE_COLORS.fall });
      spans.push({ from: chute, to: end, label: "Paracaídas", color: PHASE_COLORS.chute });
    } else {
      spans.push({ from: r.apogee.t, to: end, label: "Caída libre", color: PHASE_COLORS.fall });
    }
  }
  return spans;
}

export function flightMarkers(r: FlightResult): Marker[] {
  const m: Marker[] = [];
  if (r.burnout) m.push({ x: r.burnout.t, label: "Fin del empuje" });
  m.push({ x: r.apogee.t, label: "Apogeo" });
  if (r.ejection && Math.abs(r.ejection.t - r.apogee.t) > 0.05) m.push({ x: r.ejection.t, label: "Paracaídas" });
  return m;
}

/** Keeps every sample while thrusting and about `n` points for the rest of the flight. */
export function thin(r: FlightResult, n = 800): Sample[] {
  const burnEnd = (r.burnout?.t ?? 0) * 1.3 + 0.02;
  const step = (r.samples[r.samples.length - 1].t - burnEnd) / n;
  let last = -Infinity;
  return r.samples.filter((s, i) => {
    const keep = s.t <= burnEnd || s.t - last >= step || i === r.samples.length - 1;
    if (keep) last = s.t;
    return keep;
  });
}

export const series = (samples: Sample[], f: (s: Sample) => number) => samples.map((s) => ({ x: s.t, y: f(s) }));
