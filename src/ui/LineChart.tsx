import { useEffect, useRef } from "react";
import { Chart, LineController, LineElement, PointElement, LinearScale, Legend, Tooltip, Filler } from "chart.js";

Chart.register(LineController, LineElement, PointElement, LinearScale, Legend, Tooltip, Filler);
Chart.defaults.font.family = getComputedStyle(document.documentElement).fontFamily;

export interface Series {
  label: string;
  points: { x: number; y: number }[];
  color: string;
  dashed?: boolean;
}

export function LineChart({ title, xLabel, yLabel, series }: { title: string; xLabel: string; yLabel: string; series: Series[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart<"line"> | null>(null);

  useEffect(() => {
    chart.current = new Chart(canvas.current!, {
      type: "line",
      data: { datasets: [] },
      options: {
        animation: false,
        maintainAspectRatio: false,
        parsing: false,
        normalized: true,
        interaction: { mode: "nearest", axis: "x", intersect: false },
        elements: { point: { radius: 0, hitRadius: 6 }, line: { borderWidth: 2 } },
        plugins: {
          legend: { display: true, labels: { boxWidth: 14 } },
          title: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `t = ${(items[0].parsed.x ?? 0).toFixed(2)} s`,
              label: (item) => `${item.dataset.label}: ${(item.parsed.y ?? 0).toFixed(1)} ${yLabel.match(/\(([^)]+)\)/)?.[1] ?? ""}`,
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
  }, [xLabel, yLabel]);

  useEffect(() => {
    const c = chart.current;
    if (!c) return;
    c.data.datasets = series.map((s) => ({
      label: s.label,
      data: s.points,
      borderColor: s.color,
      backgroundColor: s.color,
      borderDash: s.dashed ? [6, 4] : [],
    }));
    c.update();
  }, [series]);

  return (
    <figure style={{ margin: 0 }}>
      <figcaption className="hint" style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>{title}</figcaption>
      <div className="chart-box"><canvas ref={canvas} /></div>
    </figure>
  );
}
