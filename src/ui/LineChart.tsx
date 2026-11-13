import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { LessonTypeContext } from "./learn/common";
import { Chart, Interaction, LineController, LineElement, PointElement, LinearScale, Legend, Tooltip, Filler, type InteractionItem, type InteractionModeFunction, type Plugin } from "chart.js";
import { getRelativePosition } from "chart.js/helpers";
import zoomPlugin from "chartjs-plugin-zoom";

declare module "chart.js" {
  interface InteractionModeMap {
    xPerDataset: InteractionModeFunction;
  }
}

/**
 * For each curve, the point nearest to the cursor's time. The curves have different time grids, so the
 * built-in modes would show just one of them; this one lets the tooltip read every curve at that instant.
 */
Interaction.modes.xPerDataset = (chart, e) => {
  const pos = getRelativePosition(e, chart as Chart);
  const area = chart.chartArea;
  if (pos.x < area.left || pos.x > area.right || pos.y < area.top || pos.y > area.bottom) return [];
  const xs = chart.scales.x;
  const xv = xs.getValueForPixel(pos.x) ?? 0;
  const items: InteractionItem[] = [];
  chart.data.datasets.forEach((ds, di) => {
    if (!chart.isDatasetVisible(di)) return;
    const data = ds.data as { x: number; y: number }[];
    if (!data.length) return;
    let lo = 0, hi = data.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (data[mid].x < xv) lo = mid;
      else hi = mid;
    }
    const idx = Math.abs(data[lo].x - xv) <= Math.abs(data[hi].x - xv) ? lo : hi;
    // A curve that does not reach this instant is left out.
    if (Math.abs(xs.getPixelForValue(data[idx].x) - pos.x) > 24) return;
    const element = chart.getDatasetMeta(di).data[idx];
    if (element) items.push({ element, datasetIndex: di, index: idx });
  });
  return items;
};

Chart.register(LineController, LineElement, PointElement, LinearScale, Legend, Tooltip, Filler, zoomPlugin);
Chart.defaults.font.family = getComputedStyle(document.documentElement).fontFamily;

export interface Series {
  label: string;
  points: { x: number; y: number }[];
  color: string;
  dashed?: boolean;
  showPoints?: boolean; // draw the data points (e.g. a measured table)
  fill?: boolean; // shade the area under the curve
  stepped?: boolean;
  bold?: boolean; // the curve to emphasise: thicker and drawn on top of the others
  thin?: boolean; // a secondary curve (e.g. the individual forces under ΣF): always the thin line
}

/** A shaded time interval (flight phase) drawn behind the curves. */
export interface Span {
  from: number;
  to: number;
  label: string;
  color: string;
}

/** A vertical marker at an instant (burnout, apogee...). */
export interface Marker {
  x: number;
  label: string;
  /** Draws the parachute with the borrego hanging from it, on the curve at this instant. */
  chute?: boolean;
}

interface Props {
  title: string;
  xLabel: string;
  yLabel: string;
  series: Series[];
  spans?: Span[];
  markers?: Marker[];
  xMin?: number;
  xMax?: number;
  height?: number;
  yZero?: boolean; // the vertical axis always includes 0 (e.g. a constant value)
}

interface PhasesOptions {
  spans: Span[];
  markers: Marker[];
  fontSize: number;
}

const phasesPlugin: Plugin<"line"> = {
  id: "phases",
  beforeDatasetsDraw(chart) {
    const opts = (chart.options.plugins as unknown as { phases?: PhasesOptions }).phases;
    if (!opts) return;
    const { ctx, chartArea: area, scales } = chart;
    const x = scales.x;
    ctx.save();
    ctx.font = `${opts.fontSize}px ${Chart.defaults.font.family}`;
    for (const s of opts.spans) {
      const x0 = Math.max(x.getPixelForValue(s.from), area.left);
      const x1 = Math.min(x.getPixelForValue(s.to), area.right);
      if (x1 <= x0) continue;
      ctx.fillStyle = s.color;
      ctx.fillRect(x0, area.top, x1 - x0, area.bottom - area.top);
      if (x1 - x0 > ctx.measureText(s.label).width + 8) {
        ctx.fillStyle = "#5b6270";
        ctx.fillText(s.label, x0 + 4, area.top + opts.fontSize + 1);
      }
    }
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "#5b6270";
    let lastLabel = -Infinity;
    for (const m of [...opts.markers].sort((a, b) => a.x - b.x)) {
      const px = x.getPixelForValue(m.x);
      if (px < area.left || px > area.right) continue;
      ctx.beginPath();
      ctx.moveTo(px, area.top);
      ctx.lineTo(px, area.bottom);
      ctx.stroke();
      if (px - lastLabel < opts.fontSize + 3) continue; // too close to the previous label to be readable
      lastLabel = px;
      ctx.save();
      ctx.translate(px - 3, area.bottom - 4);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#1a1a1a";
      ctx.fillText(m.label, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  },
};

/** The curve's value at x (first dataset, linear interpolation), or null outside its range. */
function curveAt(chart: Chart<"line">, x: number): number | null {
  const data = (chart.data.datasets[0]?.data ?? []) as { x: number; y: number }[];
  for (let i = 1; i < data.length; i++) {
    const a = data[i - 1], b = data[i];
    if (a.x <= x && x <= b.x) return b.x === a.x ? b.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
  }
  // A chart that starts (or ends) right at the instant, a sample later: use its first (or last) point.
  if (data.length < 2) return null;
  const first = data[0], last = data[data.length - 1];
  const near = (last.x - first.x) * 0.02;
  if (x < first.x && first.x - x <= near) return first.y;
  if (x > last.x && x - last.x <= near) return last.y;
  return null;
}

/** The parachute opening drawn on the curve: a striped canopy with the borrego 🐏 hanging from its lines. */
const chutePlugin: Plugin<"line"> = {
  id: "chute",
  afterDatasetsDraw(chart) {
    const opts = (chart.options.plugins as unknown as { phases?: PhasesOptions }).phases;
    if (!opts) return;
    const { ctx, chartArea: area, scales } = chart;
    for (const m of opts.markers) {
      if (!m.chute) continue;
      const px = scales.x.getPixelForValue(m.x);
      const value = curveAt(chart, m.x);
      if (value === null || px < area.left || px > area.right) continue;
      const S = Math.round(opts.fontSize * 2.4); // the borrego
      const W = S * 2.1, H = S * 1.0; // the canopy
      const drop = S * 1.25; // from the borrego's centre to the canopy's rim
      const py = Math.min(Math.max(scales.y.getPixelForValue(value), area.top + drop + H + 4), area.bottom - S / 2);
      const rim = py - drop;
      const gores = 6;
      const COLORS = ["#ff4d6d", "#ffb703", "#3a86ff", "#8ac926", "#ff7b00", "#9b5de5"];
      // Scalloped rim: the points where the lines attach, and a small bulge between them.
      const pts = Array.from({ length: gores + 1 }, (_, i) => px - W / 2 + (i * W) / gores);
      const dome = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0], rim);
        ctx.bezierCurveTo(px - W / 2, rim - H * 1.25, px + W / 2, rim - H * 1.25, pts[gores], rim);
        for (let i = gores; i > 0; i--) ctx.quadraticCurveTo((pts[i] + pts[i - 1]) / 2, rim + H * 0.22, pts[i - 1], rim);
        ctx.closePath();
      };
      ctx.save();
      ctx.setLineDash([]);
      // Suspension lines, from every attachment point to the borrego.
      ctx.strokeStyle = "#5b6270";
      ctx.lineWidth = 1;
      for (const x of pts) {
        ctx.beginPath();
        ctx.moveTo(x, rim);
        ctx.quadraticCurveTo((x + px) / 2, (rim + py) / 2 - 2, px, py - S * 0.38);
        ctx.stroke();
      }
      // Canopy: colourful gores fanning out from the top, clipped to the dome.
      ctx.save();
      dome();
      ctx.clip();
      const apexY = rim - H * 1.6;
      for (let i = 0; i < gores; i++) {
        ctx.beginPath();
        ctx.moveTo(px, apexY);
        ctx.lineTo(pts[i] - 1, rim + H * 0.3);
        ctx.lineTo(pts[i + 1] + 1, rim + H * 0.3);
        ctx.closePath();
        ctx.fillStyle = COLORS[i % COLORS.length];
        ctx.fill();
      }
      // A soft shine on the upper left.
      ctx.fillStyle = "#ffffff55";
      ctx.beginPath();
      ctx.ellipse(px - W * 0.18, rim - H * 0.62, W * 0.16, H * 0.16, -0.5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
      dome();
      ctx.strokeStyle = "#2b2d42";
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";
      ctx.stroke();
      // The borrego, on the curve, with a small shadow so it stands out on light backgrounds.
      ctx.shadowColor = "#00000059";
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.font = `${S}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🐏", px, py);
      ctx.restore();
    }
  },
};

/** Vertical guide line that follows the cursor, so every curve can be read at the same instant. */
type CrossChart = Chart & { $crossX?: number | null };
const crosshairPlugin: Plugin<"line"> = {
  id: "crosshair",
  afterEvent(chart, args) {
    const c = chart as unknown as CrossChart;
    const e = args.event;
    const area = chart.chartArea;
    const inside = e.type !== "mouseout" && e.x !== null && e.y !== null && e.x >= area.left && e.x <= area.right && e.y >= area.top && e.y <= area.bottom;
    const next = inside ? e.x : null;
    if (next !== c.$crossX) {
      c.$crossX = next;
      args.changed = true;
    }
  },
  afterDatasetsDraw(chart) {
    const px = (chart as unknown as CrossChart).$crossX;
    if (px === null || px === undefined) return;
    const { ctx, chartArea: area } = chart;
    ctx.save();
    ctx.strokeStyle = "rgba(26, 26, 26, 0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, area.top);
    ctx.lineTo(px, area.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

/** Axis limits rounded outward to a 1–2–2.5–5 step that gives about six divisions. */
export function niceRange(min: number, max: number): { min: number; max: number; step: number } {
  const span = Math.max(max - min, 1e-9);
  const raw = span / 6;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step + 1e-9) * step;
  return { min: min >= 0 ? Math.max(lo, 0) : lo, max: Math.ceil(max / step - 1e-9) * step, step };
}

const inRange = (x: number | undefined, r: { min: number; max: number }) => x !== undefined && x >= r.min && x <= r.max;
const dataMax = (series: Series[]) => Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.x)));

/** Font sizes and line widths: normal on the page, large in the expanded view for the projector. */
function applyLook(c: Chart<"line">, big: boolean) {
  const f = (size: number) => ({ size: big ? Math.round(size * 1.75) : size });
  const o = c.options;
  const sx = o.scales!.x! as { title: { font: unknown }; ticks: { font: unknown } };
  const sy = o.scales!.y! as { title: { font: unknown }; ticks: { font: unknown } };
  sx.title.font = sy.title.font = { ...f(12), weight: "bold" };
  sx.ticks.font = sy.ticks.font = f(12);
  o.plugins!.legend!.labels!.font = f(12);
  o.plugins!.legend!.labels!.boxWidth = big ? 24 : 14;
  o.plugins!.tooltip!.titleFont = { ...f(12), weight: "bold" };
  o.plugins!.tooltip!.bodyFont = f(12);
  o.plugins!.tooltip!.padding = big ? 12 : 6;
  o.elements!.line!.borderWidth = big ? 3.5 : 2;
  (o.plugins as unknown as { phases?: PhasesOptions }).phases!.fontSize = big ? 18 : 11;
}

// Stable empty defaults: a new [] on every render would re-apply the data and undo the zoom.
const NO_SPANS: Span[] = [];
const NO_MARKERS: Marker[] = [];

/** Rocket Tec draws every main curve as thick as ΣF; secondary curves stay thin. */
const lineWidth = (s: { bold?: boolean; thin?: boolean }, big: boolean, tec: boolean) => (s.thin ? 2 : s.bold || tec ? 4 : 2) * (big ? 1.75 : 1);

export function LineChart({ title, xLabel, yLabel, series, spans = NO_SPANS, markers = NO_MARKERS, xMin, xMax, height = 240, yZero = false }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart<"line"> | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  const tec = useContext(LessonTypeContext) === "estes";
  const unit = yLabel.match(/\(([^)]+)\)/)?.[1] ?? "";
  const xUnit = xLabel.match(/\(([^)]+)\)/)?.[1] ?? "";

  useEffect(() => {
    const onZoom = ({ chart: c }: { chart: Chart }) => {
      // The fixed tick step of the full view would leave too few divisions in a zoomed window.
      (c.options.scales!.x! as { ticks: { stepSize?: number } }).ticks.stepSize = undefined;
      c.update("none");
      setZoomed(true);
    };
    chart.current = new Chart(canvas.current!, {
      type: "line",
      data: { datasets: [] },
      plugins: [phasesPlugin, chutePlugin, crosshairPlugin],
      options: {
        animation: false,
        maintainAspectRatio: false,
        parsing: false,
        normalized: true,
        interaction: { mode: "xPerDataset", intersect: false },
        elements: { point: { radius: 0, hitRadius: 6 }, line: { borderWidth: 2 } },
        plugins: {
          legend: { display: true, labels: { boxWidth: 14 } },
          tooltip: {
            callbacks: {
              title: (items) => `${xLabel.split(" (")[0]} = ${(items[0].parsed.x ?? 0).toFixed(3)} ${xUnit}`,
              label: (item) => `${item.dataset.label}: ${(item.parsed.y ?? 0).toFixed(2)} ${unit}`,
            },
          },
          zoom: {
            zoom: {
              drag: { enabled: true, threshold: 8, backgroundColor: "rgba(7, 81, 181, 0.12)", borderColor: "#0751b5", borderWidth: 1 },
              wheel: { enabled: false },
              pinch: { enabled: true },
              mode: "xy",
              onZoomComplete: onZoom,
            },
            pan: { enabled: true, modifierKey: "shift", mode: "xy", onPanComplete: onZoom },
          },
          ...({ phases: { spans: [], markers: [], fontSize: 11 } } as object),
        },
        scales: {
          x: { type: "linear", title: { display: true, text: xLabel }, grid: { color: "#eceff4" } },
          y: { type: "linear", title: { display: true, text: yLabel }, grid: { color: "#eceff4" } },
        },
      },
    });
    return () => chart.current?.destroy();
  }, [xLabel, yLabel, unit, xUnit]);

  /** Puts the data and the axis limits of the props on the chart (also undoes any zoom). */
  const apply = useCallback(() => {
    const c = chart.current;
    if (!c) return;
    // A zoomed axis ends on round numbers with even divisions, and only the visible points are
    // passed so the vertical axis rescales to them.
    const range = xMin !== undefined || xMax !== undefined ? niceRange(xMin ?? 0, xMax ?? dataMax(series)) : null;
    const visible = (pts: Series["points"]) => (range ? pts.filter((p, i) => inRange(p.x, range) || inRange(pts[i - 1]?.x, range) || inRange(pts[i + 1]?.x, range)) : pts);
    c.data.datasets = series.map((s) => ({
      label: s.label,
      data: visible(s.points),
      borderColor: s.color,
      backgroundColor: s.fill ? `${s.color}33` : s.color,
      borderDash: s.dashed ? [6, 4] : [],
      pointRadius: s.showPoints ? 3 : 0,
      fill: s.fill ? "origin" : false,
      stepped: s.stepped ?? false,
      borderWidth: lineWidth(s, expandedRef.current, tec),
      order: s.bold ? -1 : 0,
      $bold: s.bold,
      $thin: s.thin,
    }));
    const phases = (c.options.plugins as unknown as { phases: PhasesOptions }).phases;
    phases.spans = spans;
    phases.markers = markers;
    const x = c.options.scales!.x! as { min?: number; max?: number; ticks: { stepSize?: number } };
    x.min = range?.min;
    x.max = range?.max;
    x.ticks.stepSize = range?.step;
    const y = c.options.scales!.y! as { min?: number; max?: number; beginAtZero?: boolean };
    y.min = undefined;
    y.max = undefined;
    y.beginAtZero = yZero;
    c.update();
    setZoomed(false);
  }, [series, spans, markers, xMin, xMax, yZero, tec]);

  useEffect(() => {
    apply();
  }, [apply, xLabel, yLabel]);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    expandedRef.current = expanded;
    applyLook(c, expanded);
    for (const ds of c.data.datasets) {
      const flags = ds as { $bold?: boolean; $thin?: boolean };
      ds.borderWidth = lineWidth({ bold: flags.$bold, thin: flags.$thin }, expanded, tec);
    }
    c.update("none");
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExpanded(false);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [expanded, xLabel, yLabel, tec]);

  return (
    <figure className={`line-chart ${expanded ? "expanded" : ""}`} role={expanded ? "dialog" : undefined} aria-modal={expanded || undefined} aria-label={expanded ? title : undefined}>
      <div className="chart-head">
        <figcaption className="chart-title">{title}</figcaption>
        <div className="chart-tools no-print">
          {zoomed && <button type="button" className="chart-tool" onClick={apply} title="Vuelve a la vista completa">↺ Restablecer zoom</button>}
          <button type="button" className="chart-tool" onClick={() => setExpanded(!expanded)} title={expanded ? "Cerrar (Esc)" : "Ver la gráfica en pantalla completa, con letras grandes. Para acercar una zona, arrastra sobre la gráfica."}>
            {expanded ? "✕ Cerrar" : "⤢ Ampliar"}
          </button>
        </div>
      </div>
      <div className="chart-box" style={expanded ? undefined : { height }}><canvas ref={canvas} /></div>
      {expanded && <p className="chart-help">Arrastra sobre la gráfica para acercar una zona · Shift + arrastrar para moverte · Esc para cerrar</p>}
    </figure>
  );
}
