import { CHUTE_SHAPES, type ChuteShape } from "../physics/parachute";
import { format } from "./fields";

/**
 * The parachute's measures, drawn to scale and animated one at a time: seen from above (shape, radius r to a corner,
 * diameter D = 2r and flat area A_p) and from the side, inflated, with the shroud lines of length L that meet at one
 * point above the rocket. Short lines pull the canopy edge in, so it opens narrower (the factor f(L/D)).
 */
export function ChuteDiagram({ shape, radius, lines, area, factor }: {
  shape: ChuteShape;
  radius: number; // m
  lines: number; // m
  area: number; // m²
  factor: number; // f(L/D)
}) {
  const n = CHUTE_SHAPES[shape].sides;
  const R = 82; // px for the radius in the top view
  const cx = 130, cy = 150;
  // Vertices at 0° and 180° so the diameter D is the horizontal line between two opposite corners.
  const corners = (count: number) => Array.from({ length: count }, (_, i) => (2 * Math.PI * i) / count).map((a) => [cx + R * Math.cos(a), cy - R * Math.sin(a)]);
  const outline = n === 0 ? null : corners(n).map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + " Z";
  const attach = corners(n === 0 ? 8 : n); // where the lines are tied

  // Side view: the inflated canopy is narrower than the flat one, and narrower still with short lines.
  const ratio = lines / (2 * radius);
  const px = R / radius; // px per metre, the same scale as the top view
  let w = 2 * R * 0.72 * factor * factor;
  let dome = w * 0.42;
  let Lpx = lines * px;
  let hang = Math.sqrt(Math.max(Lpx * Lpx - (w / 2) ** 2, 1));
  // Fit long lines in the frame by shrinking the whole side view.
  const room = 236;
  const sc = Math.min(1, room / (dome + hang + 46));
  w *= sc; dome *= sc; Lpx *= sc; hang *= sc;
  const sx = 420, top = 34;
  const edge = top + dome; // canopy rim
  const knot = edge + hang; // where the lines meet
  const xs = [-w / 2, -w / 6, w / 6, w / 2];
  const rocketH = 40 * sc + 6;

  return (
    <figure className="chute-diagram" aria-label={`Medidas del paracaídas: ${CHUTE_SHAPES[shape].label.toLowerCase()}, radio ${format(radius * 100, 1)} cm, hilos de ${format(lines * 100, 1)} cm`}>
      <svg viewBox="0 0 560 300" role="img">
        <text x={cx} y={20} className="cd-title" textAnchor="middle">Vista desde arriba (extendido)</text>
        <text x={sx} y={20} className="cd-title" textAnchor="middle">Vista de lado (inflado)</text>

        {/* Top view: the flat canopy */}
        <g className="cd-canopy-top">
          {outline ? <path d={outline} /> : <circle cx={cx} cy={cy} r={R} />}
        </g>
        {attach.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.2} className="cd-knot" />)}
        <g className="cd-dim cd-step-a">
          <text x={cx} y={cy + 24} textAnchor="middle" className="cd-area">A<tspan baselineShift="sub" fontSize="10">p</tspan> = {format(area * 1e4, 0)} cm²</text>
        </g>
        <g className="cd-dim cd-step-r">
          <line x1={cx} y1={cy} x2={cx + R} y2={cy} className="cd-r" />
          <circle cx={cx} cy={cy} r={3.5} className="cd-center" />
          <text x={cx + R / 2} y={cy - 8} textAnchor="middle" className="cd-label">r = {format(radius * 100, 1)} cm</text>
        </g>
        <g className="cd-dim cd-step-d">
          <line x1={cx - R} y1={cy + R + 16} x2={cx + R} y2={cy + R + 16} className="cd-measure" markerStart="url(#cd-arrow)" markerEnd="url(#cd-arrow)" />
          <line x1={cx - R} y1={cy + 4} x2={cx - R} y2={cy + R + 22} className="cd-ext" />
          <line x1={cx + R} y1={cy + 4} x2={cx + R} y2={cy + R + 22} className="cd-ext" />
          <text x={cx} y={cy + R + 34} textAnchor="middle" className="cd-label">D = 2r = {format(radius * 200, 1)} cm</text>
        </g>

        {/* Side view: inflated canopy, lines and rocket */}
        <g className="cd-side">
          <g className="cd-breathe">
            <path d={`M${sx - w / 2},${edge} C${sx - w / 2},${edge - dome * 1.3} ${sx + w / 2},${edge - dome * 1.3} ${sx + w / 2},${edge} Q${sx},${edge - dome * 0.18} ${sx - w / 2},${edge} Z`} className="cd-canopy-side" />
          </g>
          {xs.map((x, i) => <line key={i} x1={sx + x} y1={edge} x2={sx} y2={knot} className="cd-line" />)}
          <line x1={sx} y1={knot} x2={sx} y2={knot + 10} className="cd-line" />
          <rect x={sx - 5 * sc - 2} y={knot + 10} width={10 * sc + 4} height={rocketH} rx={3} className="cd-rocket" />
          <circle cx={sx} cy={knot} r={3} className="cd-knot" />
        </g>
        <g className="cd-dim cd-step-l">
          <line x1={sx - w / 2} y1={edge} x2={sx} y2={knot} className="cd-l" />
          <text x={sx - w / 4 - 14} y={(edge + knot) / 2} textAnchor="end" className="cd-label">L = {format(lines * 100, 1)} cm</text>
          <text x={sx - w / 4 - 14} y={(edge + knot) / 2 + 19} textAnchor="end" className="cd-small">L/D = {format(ratio, 2)} → f = {format(factor, 3)}</text>
        </g>

        <defs>
          <marker id="cd-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" className="cd-arrowhead" />
          </marker>
        </defs>
      </svg>
      <figcaption className="hint">
        <b>r</b>: del centro a una {n === 0 ? "orilla" : "esquina"} · <b>D = 2r</b>: el diámetro · <b>A<sub>p</sub></b>: el área del plástico extendido · <b>L</b>: de la orilla al nudo
        donde se juntan los hilos. Con hilos cortos el paracaídas se abre menos.
      </figcaption>
    </figure>
  );
}
