import { useEffect, useRef } from "react";
import { Chart, LineController, LineElement, PointElement, LinearScale, Legend, Tooltip, Filler, type Plugin } from "chart.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Legend, Tooltip, Filler);
Chart.defaults.font.family = getComputedStyle(document.documentElement).fontFamily;

export interface Series {
  label: string;
  points: { x: number; y: number }[];
  color: string;
  dashed?: boolean;
  showPoints?: boolean; // draw the data points (e.g. a measured table)
  fill?: boolean; // shade the area under the curve
  stepped?: boolean;
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
}

interface Props {
  title: string;
  xLabel: string;
  yLabel: string;
  series: Series[];
  spans?: Span[];
  markers?: Marker[];
  xMax?: number;
  height?: number;
}

const phasesPlugin: Plugin<"line"> = {
  id: "phases",
  beforeDatasetsDraw(chart) {
    const opts = (chart.options.plugins as unknown as { phases?: { spans: Span[]; markers: Marker[] } }).phases;
    if (!opts) return;
    const { ctx, chartArea: area, scales } = chart;
    const x = scales.x;
    ctx.save();
    ctx.font = `11px ${Chart.defaults.font.family}`;
    for (const s of opts.spans) {
      const x0 = Math.max(x.getPixelForValue(s.from), area.left);
      const x1 = Math.min(x.getPixelForValue(s.to), area.right);
      if (x1 <= x0) continue;
      ctx.fillStyle = s.color;
      ctx.fillRect(x0, area.top, x1 - x0, area.bottom - area.top);
      if (x1 - x0 > ctx.measureText(s.label).width + 8) {
        ctx.fillStyle = "#5b6270";
        ctx.fillText(s.label, x0 + 4, area.top + 12);
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
      if (px - lastLabel < 14) continue; // too close to the previous label to be readable
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

export function LineChart({ title, xLabel, yLabel, series, spans = [], markers = [], xMax, height = 240 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart<"line"> | null>(null);
  const unit = yLabel.match(/\(([^)]+)\)/)?.[1] ?? "";
  const xUnit = xLabel.match(/\(([^)]+)\)/)?.[1] ?? "";

  useEffect(() => {
    chart.current = new Chart(canvas.current!, {
      type: "line",
      data: { datasets: [] },
      plugins: [phasesPlugin],
      options: {
        animation: false,
        maintainAspectRatio: false,
        parsing: false,
        normalized: true,
        interaction: { mode: "nearest", axis: "x", intersect: false },
        elements: { point: { radius: 0, hitRadius: 6 }, line: { borderWidth: 2 } },
        plugins: {
          legend: { display: true, labels: { boxWidth: 14 } },
          tooltip: {
            callbacks: {
              title: (items) => `${xLabel.split(" (")[0]} = ${(items[0].parsed.x ?? 0).toFixed(3)} ${xUnit}`,
              label: (item) => `${item.dataset.label}: ${(item.parsed.y ?? 0).toFixed(2)} ${unit}`,
            },
          },
        },
        scales: {
          x: { type: "linear", title: { display: true, text: xLabel }, grid: { color: "#eceff4" } },
          y: { type: "linear", title: { display: true, text: yLabel }, grid: { color: "#eceff4" } },
        },
      },
    });
    return () => chart.current?.destroy();
  }, [xLabel, yLabel, unit, xUnit]);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    c.data.datasets = series.map((s) => ({
      label: s.label,
      data: s.points,
      borderColor: s.color,
      backgroundColor: s.fill ? `${s.color}33` : s.color,
      borderDash: s.dashed ? [6, 4] : [],
      pointRadius: s.showPoints ? 3 : 0,
      fill: s.fill ? "origin" : false,
      stepped: s.stepped ?? false,
    }));
    (c.options.plugins as unknown as { phases: unknown }).phases = { spans, markers };
    c.options.scales!.x!.max = xMax;
    c.update();
  }, [series, spans, markers, xMax]);

  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="chart-title">{title}</figcaption>
      <div className="chart-box" style={{ height }}><canvas ref={canvas} /></div>
    </figure>
  );
}
