import { useMemo, useState } from "react";
import type { Design } from "../../model";
import { air, G } from "../../physics/atmosphere";
import { dragModel } from "../../physics/drag";
import { motorById } from "../../catalog";
import type { FlightResult, Sample } from "../../physics/simulate";
import { format } from "../fields";
import { LineChart } from "../LineChart";
import { flightMarkers, flightSpans, series, thin } from "../phases";
import { Code, Eq, LessonHeader, StageBlock, Think, YourRocket, n } from "./common";

const r = String.raw;

export function ForcesLesson({ design: d, result: res }: { design: Design; result: FlightResult }) {
  const shown = useMemo(() => thin(res), [res]);
  const ascentEnd = Math.min(res.apogee.t * 1.15 + 0.5, res.samples[res.samples.length - 1].t);
  const [t, setT] = useState(() => Math.min((res.burnout?.t ?? 0.5) * 0.4, ascentEnd));
  const s = nearest(res.samples, t);
  const atMax = res.samples.reduce((best, x) => (x.v > best.v ? x : best), res.samples[0]);

  const model = useMemo(() => dragModel(d, d.type === "water" ? d.water.nozzleDiameter : (motorById(d.type === "estes" ? d.motor.id : "")?.diameter ?? 0) * 0.5), [d]);
  const atmMax = air(atMax.h, d.launch.altitude, d.launch.temperature);
  const parts = model.breakdown(atMax.v, atMax.v / atmMax.soundSpeed, atmMax.kinematicViscosity, false);
  const refArea = model.refArea;
  const first = res.samples.find((x) => x.thrust > 0) ?? res.samples[0];

  const charts = useMemo(() => {
    const asc = shown.filter((x) => x.t <= ascentEnd);
    return {
      forces: [
        { label: "Empuje T", points: series(asc, (x) => x.thrust), color: "#a35f2a" },
        { label: "Peso mg", points: series(asc, (x) => x.mass * G), color: "#1a1a1a" },
        { label: "Arrastre D", points: series(asc, (x) => Math.abs(x.drag)), color: "#0039a6" },
      ],
      accel: [{ label: "Aceleración a", points: series(shown, (x) => x.a), color: "#0039a6" }],
    };
  }, [shown, ascentEnd]);
  const spans = useMemo(() => flightSpans(res, d.type === "water"), [res, d.type]);
  const markers = useMemo(() => [...flightMarkers(res), { x: s.t, label: "t elegido" }], [res, s.t]);

  return (
    <div className="lesson">
      <LessonHeader
        title="2. Fuerzas y aceleración: la segunda ley de Newton"
        intro={<>La aceleración <Eq tex="a(t)" /> sale de sumar las tres fuerzas que actúan sobre el cohete y dividir entre su masa. Es el "motor" del cálculo: de ella salen la velocidad y la altura.</>}
      />
      <div className="lesson-grid">
        <StageBlock stage="fisica">
          <p>En vuelo vertical actúan tres fuerzas:</p>
          <ul>
            <li><b>Empuje T</b>, hacia arriba, mientras hay propelente (o agua y aire).</li>
            <li><b>Peso mg</b>, siempre hacia abajo. La masa disminuye mientras se quema el propelente.</li>
            <li><b>Arrastre D</b>, la resistencia del aire, siempre en contra de la velocidad: hacia abajo al subir, hacia arriba al bajar. Crece con el cuadrado de la velocidad.</li>
          </ul>
          <p>Mueve el tiempo y observa el diagrama de cuerpo libre:</p>
          <div className="interactive">
            <label className="slider-label">
              t = <b>{s.t.toFixed(3)} s</b> · {phaseName(res, s.t)}
              <input type="range" min={0} max={ascentEnd} step={ascentEnd / 500} value={t} onChange={(e) => setT(Number(e.target.value))} />
            </label>
            <div className="fbd-row">
              <FreeBody sample={s} />
              <div>
                <Eq block tex={r`T = ${n(s.thrust, 2)}\ \text{N}`} />
                <Eq block tex={r`mg = ${n(s.mass, 4)} \times 9.81 = ${n(s.mass * G, 2)}\ \text{N}`} />
                <Eq block tex={r`D = ${n(Math.abs(s.drag), 2)}\ \text{N} \ (${s.v >= 0 ? "\\downarrow" : "\\uparrow"})`} />
                <Eq block tex={r`a = \frac{${n(s.thrust, 2)} - (${n(s.drag, 2)}) - ${n(s.mass * G, 2)}}{${n(s.mass, 4)}} = \mathbf{${n(s.a, 1)}\ m/s^2}`} />
              </div>
            </div>
          </div>
          <p>
            Fíjate en el <b>apogeo</b>: la velocidad es cero, no hay arrastre y la aceleración es exactamente <Eq tex="-g" />. Y al bajar con paracaídas el arrastre
            iguala al peso: la aceleración tiende a cero (velocidad terminal).
          </p>
        </StageBlock>

        <StageBlock stage="matematicas">
          <p>Segunda ley de Newton con masa variable (el empuje medido ya incluye el momento del gas expulsado):</p>
          <Eq block tex={r`m(t)\,\frac{dv}{dt} = T(t) - D(v,h) - m(t)\,g`} />
          <p>Arrastre aerodinámico, con <Eq tex="A" /> el área frontal y <Eq tex="\rho" /> la densidad del aire:</p>
          <Eq block tex={r`D = \tfrac12\,\rho(h)\,v\,|v|\,C_d\,A`} />
          <p>La densidad baja con la altura (atmósfera estándar, gas ideal):</p>
          <Eq block tex={r`T_{aire}(h) = T_0 - 0.0065\,h, \qquad p(h) = p_0\left(\frac{T_{aire}}{T_0}\right)^{5.256}, \qquad \rho = \frac{p}{R\,T_{aire}}`} />
          <p>El coeficiente <Eq tex="C_d" /> se arma por componentes; la fricción depende del número de Reynolds <Eq tex="Re = vL/\nu" />:</p>
          <Eq block tex={r`C_d = C_{d,\text{fricción}} + C_{d,\text{nariz}} + C_{d,\text{aletas}} + C_{d,\text{base}}, \qquad C_f = \frac{1}{(1.5\ln Re - 5.6)^2}`} />
          <YourRocket>
            <Eq block tex={r`\text{Al encender: } T = ${n(first.thrust, 1)}\ \text{N} > mg = ${n(first.mass * G, 2)}\ \text{N} \Rightarrow \text{despega}`} />
            <Eq block tex={r`\text{A } v_{max} = ${n(atMax.v, 1)}\ \text{m/s},\ h = ${n(atMax.h, 0)}\ \text{m}: \quad \rho = ${n(atmMax.density, 3)}\ \text{kg/m}^3,\ Re = ${(parts.reynolds / 1e6).toFixed(2)}\times10^6`} />
            <Eq block tex={r`C_d = ${n(parts.friction, 3)} + ${n(parts.nose, 3)} + ${n(parts.fins, 3)} + ${n(parts.base, 3)} = ${n(parts.total, 3)}`} />
            <Eq block tex={r`D = \tfrac12 (${n(atmMax.density, 3)})(${n(atMax.v, 1)})^2(${n(parts.total, 3)})(${n(refArea * 1e4, 2)}\times10^{-4}) = ${n(0.5 * atmMax.density * atMax.v ** 2 * parts.total * refArea, 2)}\ \text{N}`} />
            {d.cdOverride ? <p className="hint">Tienes un C<sub>d</sub> fijo de {format(d.cdOverride, 2)} en Lanzamiento: la simulación usa ese valor.</p> : null}
          </YourRocket>
          <CdBars parts={parts} />
        </StageBlock>

        <StageBlock stage="computacion">
          <p>
            Todo lo anterior se programa en una sola función: recibe el tiempo y el <b>estado</b> del cohete (altura y velocidad) y devuelve sus{" "}
            <b>derivadas</b>. El método numérico (pestaña 6) la llama miles de veces.
          </p>
          <Code>{`
// f(t, y): derivadas del estado y = [h, v]
function derivadas(t, [h, v]) {
  const aire = atmosfera(h);                      // densidad a esa altura
  const T = empuje(t);                            // tabla o modelo de agua
  const m = masaSeca + masaPropulsion(t);
  const Cd = coeficienteArrastre(v, aire);        // suma de componentes
  const D = 0.5 * aire.densidad * v * Math.abs(v) * Cd * A;
  let a = (T - D) / m - g;
  if (h <= 0 && v <= 0 && a < 0) a = 0;           // aún sobre la plataforma
  return [v, a];                                  // dh/dt = v,  dv/dt = a
}
          `}</Code>
          <p>
            La última condición evita que el cohete "atraviese" el suelo antes de despegar: mientras el empuje sea menor que el peso, se queda quieto.
          </p>
        </StageBlock>
      </div>

      <div className="card">
        <div className="charts">
          <LineChart title="Fuerzas durante el ascenso" xLabel="Tiempo (s)" yLabel="Fuerza (N)" series={charts.forces} spans={spans} markers={markers} xMax={ascentEnd} />
          <LineChart title="Aceleración a(t) = F_neta / m" xLabel="Tiempo (s)" yLabel="Aceleración (m/s²)" series={charts.accel} spans={spans} markers={markers} />
        </div>
      </div>
      <Think>
        <ul>
          <li>Justo después de que termina el empuje, ¿por qué la aceleración es <i>más negativa</i> que <Eq tex="-g" />?</li>
          <li>¿En qué instante la aceleración cruza por cero durante el empuje? Ahí la velocidad es máxima. Compruébalo en la gráfica de velocidad.</li>
          <li>Un acelerómetro dentro del cohete no mide <Eq tex="a" /> sino <Eq tex="a+g" />. ¿Cuánto marcaría en el apogeo?</li>
        </ul>
      </Think>
    </div>
  );
}

function nearest(samples: Sample[], t: number): Sample {
  let best = samples[0];
  for (const s of samples) if (Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
  return best;
}

function phaseName(r: FlightResult, t: number): string {
  if (r.samples[0] && t < (r.samples.find((s) => s.h > 0.001)?.t ?? 0)) return "en la plataforma";
  if (t <= (r.burnout?.t ?? 0)) return "con empuje";
  if (r.ejection && t >= r.ejection.t) return "con paracaídas";
  if (t <= r.apogee.t) return "subiendo sin empuje";
  return "cayendo";
}

/** Free-body diagram: arrow lengths proportional to the forces at this instant. */
function FreeBody({ sample: s }: { sample: Sample }) {
  const w = s.mass * G;
  const forces = [s.thrust, w, Math.abs(s.drag)];
  const max = Math.max(...forces, 1e-9);
  const L = (f: number) => 12 + (f / max) * 78;
  const cx = 80, top = 110, bottom = 175;
  const arrow = (x: number, y0: number, len: number, up: boolean, color: string, label: string) => (
    <g>
      <line x1={x} x2={x} y1={y0} y2={up ? y0 - len : y0 + len} stroke={color} strokeWidth={4} />
      <path d={up ? `M${x - 7},${y0 - len + 8} L${x},${y0 - len - 4} L${x + 7},${y0 - len + 8} Z` : `M${x - 7},${y0 + len - 8} L${x},${y0 + len + 4} L${x + 7},${y0 + len - 8} Z`} fill={color} />
      <text x={x + 10} y={up ? y0 - len / 2 : y0 + len / 2 + 4} fontSize={13} fill={color} fontWeight={700}>{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 180 290" className="fbd" role="img" aria-label="Diagrama de cuerpo libre">
      <path d={`M${cx},${top - 22} L${cx + 10},${top} L${cx + 10},${bottom} L${cx - 10},${bottom} L${cx - 10},${top} Z`} fill="#f3f1ec" stroke="#1a1a1a" />
      <path d={`M${cx - 10},${bottom - 20} l-11,20 h11 Z M${cx + 10},${bottom - 20} l11,20 h-11 Z`} fill="#c9d6ef" stroke="#0039a6" />
      {s.thrust > 0 && arrow(cx - 30, (top + bottom) / 2, L(s.thrust), true, "#a35f2a", "T")}
      {arrow(cx, bottom + 2, L(w), false, "#1a1a1a", "mg")}
      {Math.abs(s.drag) > 1e-3 && arrow(cx + 32, (top + bottom) / 2, L(Math.abs(s.drag)), s.v < 0, "#0039a6", "D")}
      <text x={4} y={14} fontSize={12} fill="#5b6270">v = {format(s.v, 1)} m/s {s.v >= 0 ? "↑" : "↓"}</text>
    </svg>
  );
}

function CdBars({ parts }: { parts: { friction: number; nose: number; fins: number; base: number; total: number } }) {
  const rows = [
    { name: "Fricción con la superficie", v: parts.friction, color: "#0039a6" },
    { name: "Presión en la nariz", v: parts.nose, color: "#7a4fb0" },
    { name: "Bordes de las aletas", v: parts.fins, color: "#1d7a3e" },
    { name: "Base (cola)", v: parts.base, color: "#e0701b" },
  ];
  return (
    <div className="cd-bars">
      {rows.map((r) => (
        <div key={r.name} className="cd-row">
          <span>{r.name}</span>
          <span className="cd-track"><span style={{ width: `${(r.v / parts.total) * 100}%`, background: r.color }} /></span>
          <span className="num">{r.v.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
}
