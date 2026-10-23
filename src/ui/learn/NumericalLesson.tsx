import { useMemo, useState } from "react";
import type { Design } from "../../model";
import { simulate, type FlightResult } from "../../physics/simulate";
import { format } from "../fields";
import { LineChart, type Series } from "../LineChart";
import { series } from "../phases";
import { Code, Eq, LessonHeader, StageBlock, Think, YourRocket, n } from "./common";

const r = String.raw;
const ESTES_STEPS = [0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1];
const WATER_STEPS = [0.00005, 0.0001, 0.0002, 0.0005, 0.001, 0.002, 0.005, 0.01];

export function NumericalLesson({ design: d, result: ref }: { design: Design; result: FlightResult }) {
  const steps = d.type === "water" ? WATER_STEPS : ESTES_STEPS;
  const [k, setK] = useState(4);
  const dt = steps[k];

  const runs = useMemo(() => {
    const run = (method: "euler" | "rk4", step: number) => {
      const res = simulate(d, { method, dt: step, untilApogee: true });
      return typeof res === "string" ? null : res;
    };
    return { euler: run("euler", dt), rk4: run("rk4", dt) };
  }, [d, dt]);

  const table = useMemo(() => steps.map((s) => {
    const e = simulate(d, { method: "euler", dt: s, untilApogee: true });
    const q = simulate(d, { method: "rk4", dt: s, untilApogee: true });
    const h = (x: typeof e) => (typeof x === "string" ? NaN : x.apogee.h);
    return { dt: s, euler: h(e), rk4: h(q) };
  }), [d, steps]);

  const err = (h: number) => (Math.abs(h - ref.apogee.h) / ref.apogee.h) * 100;
  const chart = useMemo(() => {
    const asc = ref.samples.filter((s) => s.t <= ref.apogee.t);
    const out: Series[] = [{ label: "Referencia (RK4, Δt variable)", points: series(asc, (s) => s.h), color: "#1a1a1a" }];
    if (runs.euler) out.push({ label: `Euler, Δt = ${dt} s`, points: series(runs.euler.samples, (s) => s.h), color: "#e0701b", dashed: true, showPoints: dt >= 0.05 });
    if (runs.rk4) out.push({ label: `RK4, Δt = ${dt} s`, points: series(runs.rk4.samples, (s) => s.h), color: "#0039a6", dashed: true, showPoints: dt >= 0.05 });
    return out;
  }, [ref, runs, dt]);

  return (
    <div className="lesson">
      <LessonHeader
        title="6. Método numérico: cómo resuelve la computadora"
        intro={<>Las ecuaciones del vuelo no tienen solución con fórmula: el arrastre depende de <Eq tex="v^2" />, la masa cambia y el empuje es una tabla. La computadora las resuelve <b>paso a paso</b>. Aquí puedes comparar dos métodos y ver cómo el tamaño del paso cambia el resultado.</>}
      />
      <div className="lesson-grid">
        <StageBlock stage="fisica">
          <p>
            Toda la física de las lecciones anteriores se resume en: <i>"conociendo dónde está el cohete y qué tan rápido va ahora, puedo calcular qué tan
            rápido cambian esas cantidades"</i>. Es un <b>problema de valor inicial</b>: sabemos que al principio <Eq tex="h=0" /> y <Eq tex="v=0" />, y conocemos las
            leyes que dictan el cambio.
          </p>
          <p>
            La idea de cualquier método numérico es avanzar en el tiempo en pasos pequeños <Eq tex="\Delta t" />, suponiendo que dentro de cada paso las cosas
            cambian de forma sencilla. Entre más pequeño el paso, más fiel el resultado… pero más cálculos.
          </p>
        </StageBlock>

        <StageBlock stage="matematicas">
          <Eq block tex={r`\frac{d\vec y}{dt} = \vec f(t, \vec y), \qquad \vec y(0) = \vec y_0`} />
          <p><b>Método de Euler</b>: usa la pendiente al inicio del paso como si fuera constante.</p>
          <Eq block tex={r`\vec y_{n+1} = \vec y_n + \Delta t\,\vec f(t_n, \vec y_n) \qquad \text{error global} \sim O(\Delta t)`} />
          <p><b>Runge-Kutta de 4.º orden (RK4)</b>: prueba la pendiente cuatro veces dentro del paso y las promedia con pesos 1-2-2-1 (como la regla de Simpson).</p>
          <Eq block tex={r`\begin{aligned}
\vec k_1 &= \vec f(t_n,\ \vec y_n) \\
\vec k_2 &= \vec f(t_n + \tfrac{\Delta t}{2},\ \vec y_n + \tfrac{\Delta t}{2}\vec k_1) \\
\vec k_3 &= \vec f(t_n + \tfrac{\Delta t}{2},\ \vec y_n + \tfrac{\Delta t}{2}\vec k_2) \\
\vec k_4 &= \vec f(t_n + \Delta t,\ \vec y_n + \Delta t\,\vec k_3) \\
\vec y_{n+1} &= \vec y_n + \tfrac{\Delta t}{6}\left(\vec k_1 + 2\vec k_2 + 2\vec k_3 + \vec k_4\right)
\end{aligned} \qquad O(\Delta t^4)`} />
          <p>
            Si divides el paso entre 2, el error de Euler baja a la mitad, pero el de RK4 baja <b>16 veces</b>… siempre que las fuerzas cambien de forma
            suave dentro de cada paso.
          </p>
          {d.type === "water" && (
            <p>
              En el cohete de agua el empuje se acaba <b>de golpe</b> (cuando sale la última gota y luego el aire). Si ese salto cae dentro de un paso,
              ningún método conserva su orden de precisión: por eso en la tabla los errores no bajan de forma regular. Es una lección importante de
              computación: los saltos bruscos exigen pasos pequeños.
            </p>
          )}
        </StageBlock>

        <StageBlock stage="computacion">
          <div className="interactive">
            <label className="slider-label">
              Tamaño del paso: <b>Δt = {dt} s</b> ({format(ref.apogee.t / dt, 0)} pasos hasta el apogeo)
              <input type="range" min={0} max={steps.length - 1} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} />
            </label>
            <YourRocket>
              <Eq block tex={r`\text{Referencia: } h_{max} = ${n(ref.apogee.h, 2)}\ \text{m}`} />
              {runs.euler && <Eq block tex={r`\text{Euler: } ${n(runs.euler.apogee.h, 2)}\ \text{m} \quad (\text{error } ${n(err(runs.euler.apogee.h), 2)}\%)`} />}
              {runs.rk4 && <Eq block tex={r`\text{RK4: } ${n(runs.rk4.apogee.h, 2)}\ \text{m} \quad (\text{error } ${n(err(runs.rk4.apogee.h), 3)}\%)`} />}
            </YourRocket>
          </div>
          <table className="summary">
            <thead><tr><th>Δt (s)</th><th className="num">Euler: h<sub>max</sub></th><th className="num">error</th><th className="num">RK4: h<sub>max</sub></th><th className="num">error</th></tr></thead>
            <tbody>
              {table.map((row) => (
                <tr key={row.dt} style={row.dt === dt ? { background: "var(--tec-blue-soft)" } : undefined}>
                  <td>{row.dt}</td>
                  <td className="num">{format(row.euler, 2)} m</td><td className="num">{format(err(row.euler), 2)} %</td>
                  <td className="num">{format(row.rk4, 2)} m</td><td className="num">{format(err(row.rk4), 3)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            RPL usa RK4 con paso <b>variable</b>: {d.type === "water" ? "0.05 ms" : "0.5 ms"} durante el empuje (donde todo cambia rápido), 2 ms en vuelo libre
            y 10 ms con paracaídas. Así es preciso sin hacer cálculos de más.
          </p>
          <Code>{`
// Un paso de Runge-Kutta 4 para el estado y = [h, v, ...]
function pasoRK4(t, y, dt) {
  const k1 = derivadas(t, y);
  const k2 = derivadas(t + dt / 2, suma(y, k1, dt / 2));
  const k3 = derivadas(t + dt / 2, suma(y, k2, dt / 2));
  const k4 = derivadas(t + dt, suma(y, k3, dt));
  return y.map((yi, i) => yi + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}
// suma(y, k, h) = y + h·k  (componente por componente)
          `}</Code>
        </StageBlock>
      </div>

      <div className="card">
        <LineChart title="Ascenso calculado con cada método" xLabel="Tiempo (s)" yLabel="Altura (m)" series={chart} height={320} />
      </div>
      <Think>
        <ul>
          <li>Con el paso más grande, ¿qué método se equivoca más? ¿Se equivoca hacia arriba o hacia abajo?</li>
          <li>Comprueba en la tabla: al dividir Δt entre 2, ¿el error de Euler baja a la mitad? ¿Y el de RK4?</li>
          <li>RK4 hace 4 evaluaciones por paso y Euler una. Para lograr un error menor a 0.1 %, ¿cuál hace menos cálculos en total?</li>
        </ul>
      </Think>
    </div>
  );
}
