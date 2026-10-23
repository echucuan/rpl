import { useMemo } from "react";
import type { Design } from "../../model";
import { air, G } from "../../physics/atmosphere";
import { dragModel } from "../../physics/drag";
import type { FlightResult } from "../../physics/simulate";
import { format } from "../fields";
import { LineChart, type Series } from "../LineChart";
import { flightMarkers, flightSpans, series, thin } from "../phases";
import { Code, Eq, LessonHeader, StageBlock, Think, YourRocket, n } from "./common";

const r = String.raw;

export function VelocityLesson({ design: d, result: res }: { design: Design; result: FlightResult }) {
  const shown = useMemo(() => thin(res), [res]);
  const burn = res.samples.filter((s) => s.t <= (res.burnout?.t ?? 0));
  let impulse = 0;
  for (let i = 0; i + 1 < burn.length; i++) impulse += ((burn[i].thrust + burn[i + 1].thrust) / 2) * (burn[i + 1].t - burn[i].t);
  const tb = res.burnout?.t ?? 0;
  const mMean = burn.length ? burn.reduce((s, x) => s + x.mass, 0) / burn.length : res.samples[0].mass;
  const vIdeal = impulse / mMean - G * tb;
  const vSim = res.burnout?.v ?? 0;
  const vMax = res.samples.reduce((b, s) => (s.v > b.v ? s : b), res.samples[0]);

  // Terminal velocity under the parachute near the ground
  const last = res.samples[res.samples.length - 1];
  const ground = air(0, d.launch.altitude, d.launch.temperature);
  const model = dragModel(d);
  const chuteA = d.recovery.kind === "parachute" && res.ejection ? (Math.PI / 4) * (d.recovery.diameter / 1000) ** 2 : 0;
  const cdBody = last.cd || model.cd(5, 0.01, ground.kinematicViscosity, false);
  const cdA = d.recovery.cd * chuteA + cdBody * model.refArea;
  const vTerminal = Math.sqrt((2 * last.mass * G) / (ground.density * cdA));

  const charts = useMemo(() => {
    // Integrate the acceleration samples with the trapezoid rule, as a check of v = ∫a dt.
    const integrated: { x: number; y: number }[] = [];
    let v = 0;
    shown.forEach((s, i) => {
      if (i > 0) v += ((shown[i - 1].a + s.a) / 2) * (s.t - shown[i - 1].t);
      integrated.push({ x: s.t, y: v });
    });
    const out: Series[] = [
      { label: "v(t) de la simulación", points: series(shown, (s) => s.v), color: "#0039a6" },
      { label: "∫ a dt con trapecios", points: integrated, color: "#e0701b", dashed: true },
    ];
    if (chuteA > 0) out.push({ label: "−v terminal (paracaídas)", points: [{ x: res.ejection!.t, y: -vTerminal }, { x: last.t, y: -vTerminal }], color: "#1d7a3e", dashed: true });
    return out;
  }, [shown, chuteA, vTerminal, res.ejection, last.t]);
  const spans = useMemo(() => flightSpans(res, d.type === "water"), [res, d.type]);
  const markers = useMemo(() => [...flightMarkers(res), { x: vMax.t, label: "v máxima" }], [res, vMax.t]);

  return (
    <div className="lesson">
      <LessonHeader
        title="3. Velocidad: acumular la aceleración"
        intro={<>La velocidad no se calcula con una fórmula cerrada: se <b>acumula</b> instante a instante a partir de la aceleración. Geométricamente, <Eq tex="v(t)" /> es el área bajo la curva <Eq tex="a(t)" />.</>}
      />
      <div className="lesson-grid">
        <StageBlock stage="fisica">
          <ul>
            <li><b>Durante el empuje</b> la aceleración es positiva y la velocidad crece.</li>
            <li>La velocidad es <b>máxima</b> cuando la aceleración vale cero: el empuje ya solo iguala al peso más el arrastre ({format(vMax.v, 1)} m/s a los {format(vMax.t, 2)} s).</li>
            <li><b>Sin empuje</b>, peso y arrastre frenan al cohete; la velocidad baja hasta <b>cero en el apogeo</b>.</li>
            <li><b>Al caer</b> la velocidad es negativa. Con paracaídas el arrastre crece hasta igualar el peso y la velocidad se estabiliza: es la <b>velocidad terminal</b>.</li>
          </ul>
        </StageBlock>

        <StageBlock stage="matematicas">
          <p>La velocidad es la integral de la aceleración:</p>
          <Eq block tex={r`\frac{dv}{dt} = a(t, v, h) \quad\Longrightarrow\quad v(t) = v_0 + \int_0^{t} a(\tau)\,d\tau`} />
          <p>Una estimación a mano con el <b>teorema impulso–momento</b>, sin arrastre y con masa promedio:</p>
          <Eq block tex={r`v_{b} \approx \frac{I}{\bar m} - g\,t_b`} />
          <p>En la caída con paracaídas, <Eq tex="a = 0" /> cuando el arrastre iguala al peso:</p>
          <Eq block tex={r`\tfrac12\rho v_t^2 (C_{d,p} A_p + C_d A) = m g \;\Longrightarrow\; v_t = \sqrt{\frac{2 m g}{\rho\,(C_{d,p}A_p + C_d A)}}`} />
          <YourRocket>
            <Eq block tex={r`v_b \approx \frac{${n(impulse, 2)}}{${n(mMean, 4)}} - 9.81(${n(tb, 3)}) = ${n(vIdeal, 1)}\ \text{m/s}`} />
            <Eq block tex={r`\text{Simulación (con arrastre): } v_b = ${n(vSim, 1)}\ \text{m/s} \quad (${n(((vIdeal - vSim) / Math.max(vIdeal, 1e-9)) * 100, 0)}\%\ \text{menos})`} />
            {chuteA > 0 ? (
              <>
                <Eq block tex={r`v_t = \sqrt{\frac{2(${n(last.mass, 4)})(9.81)}{(${n(ground.density, 3)})(${n(cdA, 5)})}} = ${n(vTerminal, 2)}\ \text{m/s}`} />
                <Eq block tex={r`\text{Simulación al tocar suelo: } ${n(res.descentRate, 2)}\ \text{m/s}`} />
              </>
            ) : <p className="hint">Sin paracaídas no hay velocidad terminal baja: el cohete cae hasta casi su velocidad terminal sin paracaídas.</p>}
          </YourRocket>
        </StageBlock>

        <StageBlock stage="computacion">
          <p>
            La computadora no integra con lápiz: avanza en pasos pequeños <Eq tex="\Delta t" />. En cada paso la nueva velocidad es la anterior más la
            aceleración por el tiempo (Runge-Kutta usa un promedio inteligente de cuatro aceleraciones; ver pestaña 6):
          </p>
          <Eq block tex={r`v_{n+1} = v_n + \Delta t\;\overline{a}_n`} />
          <p>
            En la gráfica, la línea naranja punteada se obtuvo integrando los puntos de la gráfica de aceleración con la <b>regla del trapecio</b>.
            Coincide con la velocidad simulada: es la misma información, vista como el área bajo <Eq tex="a(t)" />.
          </p>
          <Code>{`
// Integrar a(t) con trapecios para reconstruir v(t)
let v = 0;
for (let i = 1; i < muestras.length; i++) {
  const dt = muestras[i].t - muestras[i - 1].t;
  v += (muestras[i - 1].a + muestras[i].a) / 2 * dt;   // área del trapecio
  velocidades.push(v);
}
          `}</Code>
        </StageBlock>
      </div>

      <div className="card">
        <LineChart title="Velocidad v(t)" xLabel="Tiempo (s)" yLabel="Velocidad (m/s)" series={charts} spans={spans} markers={markers} height={300} />
      </div>
      <Think>
        <ul>
          <li>¿Por qué la velocidad máxima ocurre un poco <i>antes</i> de que termine el empuje?</li>
          <li>La estimación con impulso–momento da más que la simulación. ¿Qué fuerza ignora?</li>
          <li>Si duplicas el diámetro del paracaídas, ¿cuánto cambia la velocidad terminal? (Pista: el área crece con <Eq tex="D^2" />.)</li>
        </ul>
      </Think>
    </div>
  );
}
