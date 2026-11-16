import { CHUTE_SHAPES, type ChuteShape } from "../physics/parachute";
import { format } from "./fields";

/** Panels (gores) of a round canopy: 8, like the usual printed plastic parachutes. */
const ROUND_GORES = 8;
const ORANGE = "#ec6b16";

/**
 * The parachute's measures, drawn to scale and animated one at a time: seen from above (shape, radius r to a corner,
 * diameter D = 2r and flat area A_p) and from the side, inflated, with the shroud lines of length L that meet at one
 * point above the rocket. Short lines pull the canopy edge in, so it opens narrower (the factor f(L/D)). Both views
 * follow the chosen shape: one panel per side (8 for a round one), orange and white in turn, a line at each corner.
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
  const gores = n === 0 ? ROUND_GORES : n;
  const attach = corners(gores); // where the lines are tied
  // Top view: one panel from the centre to each side (a pie slice when round), orange and white in turn.
  const panels = attach.map(([x0, y0], i) => {
    const [x1, y1] = attach[(i + 1) % gores];
    const edge = n === 0 ? `A${R},${R} 0 0 0 ${x1.toFixed(1)},${y1.toFixed(1)}` : `L${x1.toFixed(1)},${y1.toFixed(1)}`;
    return `M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} ${edge} Z`;
  });

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
  const rocketH = 40 * sc + 6;
  // Side view: the front half of the canopy. Its corners (where the lines are tied) are seen at x = w/2·cos(angle);
  // between two of them a panel billows, its rim curving up a little (more on a polygon, whose sides spill air).
  const apex = edge - dome;
  const front = Array.from({ length: gores / 2 + 1 }, (_, i) => (Math.PI * i) / (gores / 2)).map((a) => sx + (w / 2) * Math.cos(a));
  const scallop = dome * (n === 0 ? 0.08 : 0.1 + 0.4 / gores);
  // A seam from the top of the canopy down to the rim at x (the outer ones are its outline).
  const seam = (x: number) => `C${(sx + (x - sx) * 0.62).toFixed(1)},${(apex).toFixed(1)} ${x.toFixed(1)},${(apex + dome * 0.35).toFixed(1)} ${x.toFixed(1)},${edge.toFixed(1)}`;
  const seamUp = (x: number) => `C${x.toFixed(1)},${(apex + dome * 0.35).toFixed(1)} ${(sx + (x - sx) * 0.62).toFixed(1)},${apex.toFixed(1)} ${sx},${apex.toFixed(1)}`;
  const sidePanels = front.slice(0, -1).map((x0, i) => {
    const x1 = front[i + 1];
    return `M${sx},${apex.toFixed(1)} ${seam(x0)} Q${((x0 + x1) / 2).toFixed(1)},${(edge - scallop).toFixed(1)} ${x1.toFixed(1)},${edge.toFixed(1)} ${seamUp(x1)} Z`;
  });

  return (
    <figure className="chute-diagram" aria-label={`Medidas del paracaídas: ${CHUTE_SHAPES[shape].label.toLowerCase()}, radio ${format(radius * 100, 1)} cm, hilos de ${format(lines * 100, 1)} cm`}>
      <svg viewBox="0 0 560 300" role="img">
        <text x={cx} y={20} className="cd-title" textAnchor="middle">Vista desde arriba (extendido)</text>
        <text x={sx} y={20} className="cd-title" textAnchor="middle">Vista de lado (inflado)</text>

        {/* Top view: the flat canopy */}
        <g className="cd-canopy-top">
          {panels.map((p, i) => <path key={i} d={p} fill={i % 2 ? "#ffffff" : ORANGE} />)}
          {outline ? <path d={outline} className="cd-rim" /> : <circle cx={cx} cy={cy} r={R} className="cd-rim" />}
        </g>
        {attach.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.2} className="cd-knot" />)}
        <g className="cd-dim cd-step-a">
          <text x={cx} y={cy + 24} textAnchor="middle" className="cd-area">A<tspan baselineShift="sub" fontSize="10">p</tspan> = {format(area * 1e4, 0)} cm²</text>
        </g>
        <g className="cd-dim cd-step-r">
          <line x1={cx} y1={cy} x2={cx + R} y2={cy} className="cd-r-halo" />
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
            {sidePanels.map((p, i) => <path key={i} d={p} fill={i % 2 ? "#ffffff" : ORANGE} className="cd-panel-side" />)}
          </g>
          {front.map((x, i) => <line key={i} x1={x} y1={edge} x2={sx} y2={knot} className="cd-line" />)}
          <line x1={sx} y1={knot} x2={sx} y2={knot + 10} className="cd-line" />
          <rect x={sx - 5 * sc - 2} y={knot + 10} width={10 * sc + 4} height={rocketH} rx={3} className="cd-rocket" />
          <circle cx={sx} cy={knot} r={3} className="cd-knot" />
        </g>
        <g className="cd-dim cd-step-l">
          <line x1={sx - w / 2} y1={edge} x2={sx} y2={knot} className="cd-l-halo" />
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
