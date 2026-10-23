import { useMemo, useState } from "react";
import type { Design, EstesDesign, WaterDesign } from "../../model";
import { PSI } from "../../model";
import { impulseClass, motorById, type Motor } from "../../catalog";
import type { FlightResult } from "../../physics/simulate";
import { format } from "../fields";
import { LineChart } from "../LineChart";
import { Code, Eq, LessonHeader, StageBlock, Think, YourRocket, n } from "./common";

const G0 = 9.80665;
const r = String.raw;

export function ThrustLesson({ design, result }: { design: Design; result: FlightResult }) {
  if (design.type === "water") return <WaterThrust design={design} result={result} />;
  const motor = motorById(design.motor.id);
  return motor ? <MotorThrust design={design} motor={motor} /> : null;
}

function trapezoid(t: number[], f: number[]): number {
  let s = 0;
  for (let i = 0; i + 1 < t.length; i++) s += ((f[i] + f[i + 1]) / 2) * (t[i + 1] - t[i]);
  return s;
}

function MotorThrust({ design, motor: m }: { design: EstesDesign; motor: Motor }) {
  const end = m.time[m.time.length - 1];
  const [t, setT] = useState(() => Math.min(0.3, end / 2));
  const i = Math.max(0, m.time.findIndex((x, k) => k + 1 < m.time.length && x <= t && m.time[k + 1] > t));
  const [t0, t1, f0, f1] = [m.time[i], m.time[i + 1] ?? m.time[i], m.thrust[i], m.thrust[i + 1] ?? m.thrust[i]];
  const ft = t1 > t0 ? f0 + ((f1 - f0) * (t - t0)) / (t1 - t0) : f0;
  const impulse = trapezoid(m.time, m.thrust);
  const propellant = (m.mass[0] - m.mass[m.mass.length - 1]) / 1000;
  const isp = impulse / (propellant * G0);
  const cls = impulseClass(m.totalImpulse);

  const thrustSeries = useMemo(() => [
    { label: "Empuje medido (tabla)", points: m.time.map((x, k) => ({ x, y: m.thrust[k] })), color: "#a35f2a", showPoints: true, fill: true },
  ], [m]);
  const massSeries = useMemo(() => [{ label: "Masa del motor", points: m.time.map((x, k) => ({ x, y: m.mass[k] })), color: "#0039a6", showPoints: true }], [m]);
  const markers = useMemo(() => [{ x: t, label: `t = ${t.toFixed(2)} s` }], [t]);

  return (
    <div className="lesson">
      <LessonHeader
        title="1. Empuje: lo que impulsa al cohete"
        intro={<>La gráfica de empuje <Eq tex="T(t)" /> es el punto de partida de toda la simulación. Para un motor Estes no se calcula: se <b>mide</b> en un banco de pruebas y RPL usa esa tabla de datos.</>}
      />
      <div className="lesson-grid">
        <StageBlock stage="fisica">
          <p>
            Dentro del motor se quema propelente de pólvora negra. Los gases calientes salen a gran velocidad por la tobera, hacia abajo.
            Por la <b>tercera ley de Newton</b> (o, mejor dicho, por la conservación del momento lineal), si el motor empuja gas hacia abajo, el gas
            empuja al cohete hacia arriba. Esa fuerza es el <b>empuje</b>.
          </p>
          <p>Un motor Estes tiene tres etapas:</p>
          <ol>
            <li><b>Pico inicial:</b> la superficie que arde es grande al principio; da el "golpe" para despegar rápido.</li>
            <li><b>Meseta:</b> empuje casi constante mientras se consume el resto del propelente.</li>
            <li><b>Retardo y eyección:</b> deja de empujar, arde una carga lenta que solo hace humo ({design.motor.delay} s en tu motor) y al final una pequeña carga expulsa el paracaídas.</li>
          </ol>
          <p>
            El nombre del motor resume todo: <b>{m.name}-{design.motor.delay}</b> significa clase de impulso <b>{cls}</b>, empuje promedio de unos{" "}
            <b>{m.name.match(/[A-G](\d+)/)?.[1] ?? "–"} N</b> y <b>{design.motor.delay} s</b> de retardo.
          </p>
        </StageBlock>

        <StageBlock stage="matematicas">
          <p>El empuje viene del cambio de momento del gas que sale con velocidad <Eq tex="v_e" />:</p>
          <Eq block tex={r`T = \dot m\, v_e + (p_e - p_a)\,A_e`} />
          <p>Lo que importa para el vuelo es el <b>impulso total</b>, el área bajo la curva de empuje:</p>
          <Eq block tex={r`I = \int_0^{t_b} T(t)\,dt \qquad \bar T = \frac{I}{t_b} \qquad I_{sp} = \frac{I}{m_p\, g}`} />
          <p>
            Por el teorema impulso–momento, <Eq tex="I" /> es el momento que el motor le puede dar al cohete. Las clases de motores duplican el impulso en cada
            letra: A hasta 2.5 N·s, B hasta 5, C hasta 10, D hasta 20, E hasta 40, F hasta 80.
          </p>
          <p>Además el cohete pierde masa al quemar propelente, así que la masa también es función del tiempo, <Eq tex="m(t)" />.</p>
          <YourRocket>
            <Eq block tex={r`I \approx ${n(impulse, 2)}\ \text{N·s} \quad (\text{clase } ${cls}) \qquad t_b = ${n(end, 2)}\ \text{s}`} />
            <Eq block tex={r`\bar T = \frac{${n(impulse, 2)}}{${n(end, 2)}} = ${n(impulse / end, 2)}\ \text{N} \qquad T_{max} = ${n(m.maxThrust, 1)}\ \text{N}`} />
            <Eq block tex={r`m_p = ${n(propellant * 1000, 1)}\ \text{g} \quad\Rightarrow\quad I_{sp} = \frac{${n(impulse, 2)}}{${n(propellant, 4)}\cdot 9.81} = ${n(isp, 0)}\ \text{s}`} />
          </YourRocket>
        </StageBlock>

        <StageBlock stage="computacion">
          <p>
            La computadora solo tiene una tabla de <b>{m.time.length} puntos</b> <Eq tex="(t_i, T_i)" />. Para conocer el empuje en cualquier instante usa{" "}
            <b>interpolación lineal</b> entre los dos puntos vecinos:
          </p>
          <Eq block tex={r`T(t) = T_i + \frac{T_{i+1}-T_i}{t_{i+1}-t_i}\,(t - t_i), \qquad t_i \le t < t_{i+1}`} />
          <div className="interactive">
            <label className="slider-label">
              Mueve el tiempo: <b>t = {t.toFixed(3)} s</b>
              <input type="range" min={0} max={end} step={end / 400} value={t} onChange={(e) => setT(Number(e.target.value))} />
            </label>
            <Eq block tex={r`T(${n(t, 3)}) = ${n(f0, 2)} + \frac{${n(f1, 2)} - ${n(f0, 2)}}{${n(t1, 3)} - ${n(t0, 3)}}(${n(t, 3)} - ${n(t0, 3)}) = \mathbf{${n(ft, 2)}\ N}`} />
          </div>
          <p>El impulso se calcula con la <b>regla del trapecio</b>: se suman las áreas de los trapecios entre puntos.</p>
          <Eq block tex={r`I \approx \sum_{i} \frac{T_i + T_{i+1}}{2}\,(t_{i+1}-t_i) = ${n(impulse, 3)}\ \text{N·s}`} />
          <Code>{`
// Empuje en el instante t, interpolando la tabla del motor
function empuje(t) {
  if (t >= tiempos[tiempos.length - 1]) return 0;     // se acabó el propelente
  let i = 0;
  while (tiempos[i + 1] <= t) i++;                    // buscar el intervalo
  const pendiente = (empujes[i + 1] - empujes[i]) / (tiempos[i + 1] - tiempos[i]);
  return empujes[i] + pendiente * (t - tiempos[i]);
}
          `}</Code>
        </StageBlock>
      </div>

      <div className="card">
        <div className="charts">
          <LineChart title={`Curva de empuje del ${m.name} (puntos medidos y área = impulso)`} xLabel="Tiempo (s)" yLabel="Empuje (N)" series={thrustSeries} markers={markers} />
          <LineChart title="Masa del motor m(t)" xLabel="Tiempo (s)" yLabel="Masa (g)" series={massSeries} markers={markers} />
        </div>
      </div>
      <Think>
        <ul>
          <li>¿Por qué el pico inicial es tan importante para salir derecho de la guía?</li>
          <li>Dos motores con el mismo impulso, uno con empuje alto y corto y otro bajo y largo: ¿cuál llega más alto? Pruébalo comparando el C6 con el C11 en la pestaña Cohete.</li>
          <li>El área bajo la curva es el impulso. ¿Qué unidades tiene? Compruébalo con <Eq tex="\text{N}\cdot\text{s} = \text{kg}\cdot\text{m/s}" />.</li>
        </ul>
      </Think>
    </div>
  );
}

function WaterThrust({ design: d, result: res }: { design: WaterDesign; result: FlightResult }) {
  const w = d.water;
  const burn = res.samples.filter((s) => s.t <= (res.burnout?.t ?? 0) + 0.002);
  const waterEnd = burn.find((s) => (s.water ?? 0) <= 1e-6)?.t ?? res.burnout?.t ?? 0;
  const impulse = trapezoid(burn.map((s) => s.t), burn.map((s) => s.thrust));
  const pa = 101325;
  const dp = w.pressure * PSI;
  const an = (Math.PI / 4) * (w.nozzleDiameter / 1000) ** 2;
  const ab = (Math.PI / 4) * (d.body.diameter / 1000) ** 2;
  const factor = 1 - (an / ab) ** 2;
  const f0 = (2 * 0.97 * an * dp) / factor;
  const u0 = Math.sqrt((2 * dp) / (997 * factor));
  const va0 = w.bottleVolume - w.waterVolume;
  const pEndWater = (pa + dp) * Math.pow(va0 / w.bottleVolume, 1.4) - pa;

  const charts = useMemo(() => {
    const ms = (s: { t: number }) => s.t * 1000;
    return {
      thrust: [{ label: "Empuje", points: burn.map((s) => ({ x: ms(s), y: s.thrust })), color: "#a35f2a", fill: true }],
      pressure: [{ label: "Presión manométrica", points: burn.map((s) => ({ x: ms(s), y: s.pressure ?? 0 })), color: "#0039a6" }],
      water: [{ label: "Agua en la botella", points: burn.map((s) => ({ x: ms(s), y: s.water ?? 0 })), color: "#0f8a9d", fill: true }],
      markers: [{ x: waterEnd * 1000, label: "Se acaba el agua" }],
    };
  }, [burn, waterEnd]);

  return (
    <div className="lesson">
      <LessonHeader
        title="1. Empuje: agua y aire a presión"
        intro={<>En el cohete de agua el empuje sí se <b>calcula</b>: depende de la presión del aire, que baja conforme el agua sale. Todo ocurre en menos de un parpadeo: unos <b>{format((res.burnout?.t ?? 0) * 1000, 0)} ms</b>.</>}
      />
      <div className="lesson-grid">
        <StageBlock stage="fisica">
          <p>
            El compresor mete aire hasta {format(w.pressure, 0)} psi. Ese aire empuja el agua hacia abajo por la boca de la botella; por la{" "}
            <b>tercera ley de Newton</b>, el agua empuja a la botella hacia arriba. El agua es unas 800 veces más densa que el aire, por eso da mucho más empuje
            que soltar solo aire.
          </p>
          <ol>
            <li><b>Fase de agua:</b> el aire se expande rápido, sin tiempo de intercambiar calor con el exterior (proceso <b>adiabático</b>): se enfría y su presión cae.</li>
            <li><b>Fase de aire:</b> cuando ya no hay agua, sale el aire que queda, primero a la velocidad del sonido (flujo "estrangulado").</li>
          </ol>
          <p>Por eso el empuje es máximo al despegar y cae muy rápido.</p>
        </StageBlock>

        <StageBlock stage="matematicas">
          <p>Expansión adiabática del aire (<Eq tex="\gamma = 1.4" />):</p>
          <Eq block tex={r`p\,V_a^{\gamma} = p_0\,V_{a0}^{\gamma} \;\Rightarrow\; p(t) = p_0\left(\frac{V_{a0}}{V_a(t)}\right)^{\gamma}`} />
          <p>Velocidad de salida del agua (Bernoulli entre el interior y la boquilla):</p>
          <Eq block tex={r`u = \sqrt{\frac{2\,(p - p_a)}{\rho_w\,\left[1-(A_n/A_b)^2\right]}}`} />
          <p>El agua sale con caudal <Eq tex="Q = C_d A_n u" />, así que el volumen de agua y el empuje cumplen:</p>
          <Eq block tex={r`\frac{dV_w}{dt} = -C_d A_n u \qquad T = \rho_w Q\,u = \frac{2\,C_d A_n (p-p_a)}{1-(A_n/A_b)^2}`} />
          <p>Fase de aire, flujo sónico mientras <Eq tex="p/p_a > 1.893" />:</p>
          <Eq block tex={r`\dot m = C_d A_n\, p \sqrt{\frac{\gamma}{R\,T}}\left(\frac{2}{\gamma+1}\right)^{\frac{\gamma+1}{2(\gamma-1)}}`} />
          <YourRocket>
            <Eq block tex={r`A_n = \tfrac{\pi}{4}(${n(w.nozzleDiameter / 1000, 4)})^2 = ${n(an * 1e4, 2)}\ \text{cm}^2 \qquad p_0 - p_a = ${n(w.pressure, 0)}\ \text{psi} = ${n(dp / 1000, 1)}\ \text{kPa}`} />
            <Eq block tex={r`u_0 = ${n(u0, 1)}\ \text{m/s} \qquad T_0 = \frac{2(0.97)(${n(an, 6)})(${n(dp, 0)})}{${n(factor, 3)}} = \mathbf{${n(f0, 0)}\ N}`} />
            <Eq block tex={r`V_{a0} = ${n(va0, 2)}\ \text{L} \to V_a = ${n(w.bottleVolume, 2)}\ \text{L}: \quad p - p_a = ${n(pEndWater / PSI, 1)}\ \text{psi al acabarse el agua}`} />
            <Eq block tex={r`I = \int T\,dt \approx ${n(impulse, 2)}\ \text{N·s}`} />
          </YourRocket>
        </StageBlock>

        <StageBlock stage="computacion">
          <p>
            Aquí no hay tabla: las ecuaciones forman un <b>sistema de ecuaciones diferenciales</b>. El estado del cohete tiene cuatro variables y la
            computadora calcula sus derivadas en cada instante:
          </p>
          <Eq block tex={r`\vec y = \begin{pmatrix} h \\ v \\ V_w \\ m_{aire}\end{pmatrix}, \qquad \frac{d\vec y}{dt} = \begin{pmatrix} v \\ a \\ -C_dA_n u \\ -\dot m\end{pmatrix}`} />
          <p>
            Como el agua sale en ~{format(waterEnd * 1000, 0)} ms, el paso de tiempo debe ser muy pequeño: RPL usa <Eq tex="\Delta t = 0.05\ \text{ms}" /> durante
            el empuje (más de {format((res.burnout?.t ?? 0) / 5e-5, 0)} pasos) y lo agranda después. El método es Runge-Kutta de 4.º orden (pestaña 6).
          </p>
          <Code>{`
// Derivadas del sistema de agua en un instante
const p = p0 * Math.pow(Va0 / Va, 1.4);              // expansión adiabática
if (Vw > 0) {
  const u = Math.sqrt(2 * (p - pa) / (rhoAgua * (1 - (An / Ab) ** 2)));
  const Q = Cd * An * u;                              // caudal (m³/s)
  empuje = rhoAgua * Q * u;
  dVw = -Q;                                           // el agua se vacía
} else {
  // fase de aire: flujo sónico o subsónico por la boquilla
}
          `}</Code>
        </StageBlock>
      </div>

      <div className="card">
        <div className="charts three">
          <LineChart title="Empuje T(t)" xLabel="Tiempo (ms)" yLabel="Empuje (N)" series={charts.thrust} markers={charts.markers} />
          <LineChart title="Presión dentro de la botella" xLabel="Tiempo (ms)" yLabel="Presión (psi)" series={charts.pressure} markers={charts.markers} />
          <LineChart title="Agua en la botella V_w(t)" xLabel="Tiempo (ms)" yLabel="Agua (L)" series={charts.water} markers={charts.markers} />
        </div>
      </div>
      <Think>
        <ul>
          <li>Si llenas la botella casi toda de agua, hay mucha masa que expulsar pero poco aire para empujarla. Si pones muy poca, sobra aire pero falta masa. Busca en la pestaña Cohete la cantidad de agua que da la mayor altura.</li>
          <li>¿Por qué la presión baja más rápido que linealmente? Mira el exponente <Eq tex="\gamma" />.</li>
          <li>¿Qué pasaría con el empuje si la boquilla fuera más pequeña (por ejemplo, un conector Gardena de 9 mm)?</li>
        </ul>
      </Think>
    </div>
  );
}
