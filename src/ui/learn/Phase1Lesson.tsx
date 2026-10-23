import { useMemo, useState } from "react";
import type { Design, EstesDesign, WaterDesign } from "../../model";
import { PSI } from "../../model";
import { a10Motor, impulseClass, type Motor } from "../../motor";
import { G } from "../../physics/atmosphere";
import type { FlightResult } from "../../physics/simulate";
import { format } from "../fields";
import { LineChart } from "../LineChart";
import { nearest, within, type PhaseId } from "../phases";
import { Code, Eq, StageBlock, Think, YourRocket, n } from "./common";
import { FreeBody } from "./diagrams";
import { PhaseCharts, PhaseFacts, PhaseHeader, forceSeries, matlabVector, phaseOf } from "./phaseCommon";

const r = String.raw;

function trapezoid(t: number[], f: number[]): number {
  let s = 0;
  for (let i = 0; i + 1 < t.length; i++) s += ((f[i] + f[i + 1]) / 2) * (t[i + 1] - t[i]);
  return s;
}

export function Phase1Lesson({ design: d, result: res, onPhase }: { design: Design; result: FlightResult; onPhase: (id: PhaseId) => void }) {
  const ph = phaseOf(res, 1);
  const burn = within(res.samples, 0, ph.to);
  const impulse = trapezoid(burn.map((s) => s.t), burn.map((s) => s.thrust));
  const mMean = burn.length ? burn.reduce((s, x) => s + x.mass, 0) / burn.length : res.samples[0].mass;
  const vIdeal = impulse / mMean - G * ph.to;
  const vMax = res.samples.reduce((b, s) => (s.v > b.v ? s : b), res.samples[0]);
  const liftoff = res.samples.find((s) => s.h > 0.001) ?? res.samples[0];
  const first = res.samples.find((s) => s.thrust > 0) ?? res.samples[0];
  const [t, setT] = useState(() => ph.to * 0.35);
  const s = nearest(res.samples, t);
  const forces = useMemo(() => forceSeries(burn), [burn]);

  return (
    <div className="lesson">
      <PhaseHeader
        result={res}
        id={1}
        onPick={onPhase}
        intro={<>Del encendido hasta que se acaba el empuje ({format(ph.to, 3)} s). Es la única fase en la que una fuerza empuja al cohete hacia arriba: la velocidad <b>aumenta</b> de 0 a casi {format(vMax.v, 0)} m/s.</>}
      />
      <div className="lesson-grid">
        <StageBlock stage="fisica">
          {d.type === "estes" ? <MotorPhysics design={d} /> : <WaterPhysics design={d} />}
          <p>Sobre el cohete actúan tres fuerzas: <b>empuje</b> hacia arriba, <b>peso</b> hacia abajo y <b>arrastre</b> del aire en contra de la velocidad.</p>
          <ul>
            <li><b>Despegue:</b> el cohete se queda en la plataforma hasta que el empuje supera al peso (a los {format(liftoff.t, 3)} s).</li>
            <li><b>Sale de la guía</b> a {res.guideExit ? format(res.guideExit.v, 1) : "–"} m/s: desde ahí lo estabilizan las aletas.</li>
            <li>
              <b>Detalle para descubrir:</b> la velocidad máxima ({format(vMax.v, 1)} m/s) ocurre a los {format(vMax.t, 3)} s, un poco <i>antes</i> de que
              termine el empuje. En los últimos instantes el empuje ya es menor que peso + arrastre y el cohete empieza a frenar.
            </li>
          </ul>
          <div className="interactive">
            <label className="slider-label">
              Diagrama de cuerpo libre en <b>t = {s.t.toFixed(3)} s</b>
              <input type="range" min={0} max={ph.to} step={ph.to / 300} value={t} onChange={(e) => setT(Number(e.target.value))} />
            </label>
            <div className="fbd-row">
              <FreeBody sample={s} />
              <div>
                <Eq block tex={r`T = ${n(s.thrust, 2)}\ \text{N} \qquad mg = ${n(s.mass * G, 2)}\ \text{N} \qquad D = ${n(Math.abs(s.drag), 2)}\ \text{N}`} />
                <Eq block tex={r`a = \frac{T - D - mg}{m} = \frac{${n(s.thrust, 2)} - ${n(s.drag, 2)} - ${n(s.mass * G, 2)}}{${n(s.mass, 4)}} = \mathbf{${n(s.a, 1)}\ m/s^2}`} />
              </div>
            </div>
          </div>
        </StageBlock>

        <StageBlock stage="matematicas">
          <p>Segunda ley de Newton con masa variable (el empuje medido ya incluye el momento del gas o el agua expulsados):</p>
          <Eq block tex={r`m(t)\,\frac{dv}{dt} = T(t) - \tfrac12\rho\,v|v|\,C_dA - m(t)\,g, \qquad \frac{dh}{dt} = v`} />
          {d.type === "estes" ? <MotorMath design={d} /> : <WaterMath design={d} result={res} />}
          <p>Estimación a mano con el teorema impulso–momento (sin arrastre, masa promedio):</p>
          <Eq block tex={r`v_b \approx \frac{I}{\bar m} - g\,t_b`} />
          <YourRocket>
            <Eq block tex={r`\text{Despega si } T > mg: \quad ${n(first.thrust, 1)}\ \text{N} > ${n(first.mass * G, 2)}\ \text{N}`} />
            <Eq block tex={r`v_b \approx \frac{${n(impulse, 2)}}{${n(mMean, 4)}} - 9.81(${n(ph.to, 3)}) = ${n(vIdeal, 1)}\ \text{m/s}`} />
            <Eq block tex={r`\text{Simulación con arrastre: } v_b = ${n(res.burnout?.v ?? 0, 1)}\ \text{m/s}`} />
          </YourRocket>
        </StageBlock>

        <StageBlock stage="computacion">
          {d.type === "estes" ? <MotorComputation design={d} /> : <WaterComputation result={res} />}
          <p>En cada paso de tiempo se evalúan las fuerzas y se avanza con Runge-Kutta 4 (ver la lección Método numérico):</p>
          <Code>{`
function dydt = derivadas_fase1(t, y, p)
    h = y(1);  v = y(2);
    T   = empuje(t, p);                       % tabla del motor o modelo de agua
    m   = p.m_seca + masa_propulsion(t, p);   % la masa disminuye
    rho = densidad(h, p);                     % atmósfera estándar
    D   = 0.5*rho*v*abs(v)*p.Cd*p.A;          % arrastre
    a   = (T - D)/m - p.g;
    if h <= 0 && v <= 0 && a < 0
        a = 0;                                % todavía en la plataforma
    end
    dydt = [v; a];
end
          `}</Code>
        </StageBlock>
      </div>

      <PhaseFacts result={res} id={1} />
      <PhaseCharts result={res} id={1} extra={{ title: "Fuerzas", yLabel: "Fuerza (N)", series: forces }} />
      {d.type === "water" && <WaterCharts result={res} />}
      <Think>
        <ul>
          <li>¿Por qué la velocidad máxima ocurre antes de que termine el empuje? Busca en la gráfica de aceleración el instante en que cruza el cero.</li>
          <li>La estimación con impulso da más velocidad que la simulación. ¿Qué fuerza ignora?</li>
          {d.type === "estes"
            ? <li>Dos motores con casi el mismo impulso (C6 y C11): ¿cuál deja al cohete más rápido al final de esta fase? Pruébalo en la pestaña Cohete.</li>
            : <li>Busca en la pestaña Cohete la cantidad de agua que da la mayor velocidad al final de esta fase. ¿Por qué ni mucha ni poca?</li>}
        </ul>
      </Think>
    </div>
  );
}

// ---------------------------------------------------------------- Estes motor

function MotorPhysics({ design }: { design: EstesDesign }) {
  const m = a10Motor(design.motor.mass, design.motor.propellant);
  return (
    <>
      <p>
        El motor quema pólvora negra y expulsa gases a gran velocidad hacia abajo. Por la <b>tercera ley de Newton</b> (conservación del momento), el gas
        empuja al cohete hacia arriba. El empuje de un motor Estes no se calcula: se <b>mide</b> en un banco de pruebas.
      </p>
      <p>
        <b>{m.name}</b>: la <b>A</b> es la clase de impulso (clase {impulseClass(m.totalImpulse)}: hasta 2.5 N·s), el <b>10</b> es el empuje promedio nominal en
        newtons, el <b>3</b> son los segundos de retardo hasta la eyección del paracaídas y la <b>T</b> indica un motor corto de 13 mm. En la curva medida casi todo el
        impulso llega en el pico de los primeros 0.2 s ({format(m.maxThrust, 1)} N); después queda un empuje de 1 N hasta los {format(m.burnTime, 2)} s.
      </p>
    </>
  );
}

function MotorMath({ design }: { design: EstesDesign }) {
  const m = a10Motor(design.motor.mass, design.motor.propellant);
  const end = m.time[m.time.length - 1];
  const impulse = trapezoid(m.time, m.thrust);
  const propellant = (m.mass[0] - m.mass[m.mass.length - 1]) / 1000;
  return (
    <>
      <p>El <b>impulso total</b> es el área bajo la curva de empuje; el impulso específico mide qué tan bien se aprovecha el propelente:</p>
      <Eq block tex={r`I = \int_0^{t_b} T(t)\,dt \qquad \bar T = \frac{I}{t_b} \qquad I_{sp} = \frac{I}{m_p\,g}`} />
      <YourRocket>
        <Eq block tex={r`I = ${n(impulse, 2)}\ \text{N·s},\quad t_b = ${n(end, 2)}\ \text{s},\quad \bar T = ${n(impulse / end, 2)}\ \text{N},\quad I_{sp} = \frac{${n(impulse, 2)}}{${n(propellant, 4)}(9.81)} = ${n(impulse / (propellant * G), 0)}\ \text{s}`} />
      </YourRocket>
    </>
  );
}

function MotorComputation({ design }: { design: EstesDesign }) {
  const m: Motor = a10Motor(design.motor.mass, design.motor.propellant);
  const end = m.time[m.time.length - 1];
  const [t, setT] = useState(() => Math.min(0.3, end / 2));
  const i = Math.max(0, m.time.findIndex((x, k) => k + 1 < m.time.length && x <= t && m.time[k + 1] > t));
  const [t0, t1, f0, f1] = [m.time[i], m.time[i + 1] ?? m.time[i], m.thrust[i], m.thrust[i + 1] ?? m.thrust[i]];
  const ft = t1 > t0 ? f0 + ((f1 - f0) * (t - t0)) / (t1 - t0) : f0;
  const curve = useMemo(() => [{ label: `Tabla del ${m.name}`, points: m.time.map((x, k) => ({ x, y: m.thrust[k] })), color: "#a35f2a", showPoints: true, fill: true }], [m]);
  const marker = useMemo(() => [{ x: t, label: `t = ${t.toFixed(2)} s` }], [t]);
  return (
    <>
      <p>La computadora tiene una tabla de <b>{m.time.length} puntos</b> medidos. Entre dos puntos usa <b>interpolación lineal</b>:</p>
      <Eq block tex={r`T(t) = T_i + \frac{T_{i+1}-T_i}{t_{i+1}-t_i}\,(t - t_i)`} />
      <div className="interactive">
        <label className="slider-label">
          Mueve el tiempo: <b>t = {t.toFixed(3)} s</b>
          <input type="range" min={0} max={end} step={end / 400} value={t} onChange={(e) => setT(Number(e.target.value))} />
        </label>
        <Eq block tex={r`T(${n(t, 3)}) = ${n(f0, 2)} + \frac{${n(f1, 2)} - ${n(f0, 2)}}{${n(t1, 3)} - ${n(t0, 3)}}(${n(t, 3)} - ${n(t0, 3)}) = \mathbf{${n(ft, 2)}\ N}`} />
        <LineChart title="Curva de empuje: puntos medidos y área = impulso" xLabel="Tiempo (s)" yLabel="Empuje (N)" series={curve} markers={marker} height={200} />
      </div>
      <Code>{`
% Tabla medida del motor ${m.name} (tiempo en s, empuje en N)
t_tab = ${matlabVector(m.time, 3)};
T_tab = ${matlabVector(m.thrust, 2)};

T = interp1(t_tab, T_tab, t, 'linear', 0);   % empuje en t (0 al terminar)
I = trapz(t_tab, T_tab);                      % impulso con trapecios
fprintf('Impulso total: %.2f N*s\\n', I);
      `}</Code>
    </>
  );
}

// ---------------------------------------------------------------- water

function WaterPhysics({ design: d }: { design: WaterDesign }) {
  return (
    <>
      <p>
        El aire comprimido a {format(d.water.pressure, 0)} psi empuja el agua por la boca de la botella; por la <b>tercera ley de Newton</b> el agua
        empuja a la botella hacia arriba. Primero sale el agua (el aire se expande sin tiempo de intercambiar calor: <b>proceso adiabático</b>) y al
        final sale el aire que queda, a la velocidad del sonido.
      </p>
    </>
  );
}

function WaterMath({ design: d, result: res }: { design: WaterDesign; result: FlightResult }) {
  const w = d.water;
  const dp = w.pressure * PSI;
  const an = (Math.PI / 4) * (w.nozzleDiameter / 1000) ** 2;
  const ab = (Math.PI / 4) * (d.body.diameter / 1000) ** 2;
  const factor = 1 - (an / ab) ** 2;
  const burn = within(res.samples, 0, res.burnout?.t ?? 0);
  return (
    <>
      <Eq block tex={r`p(t) = p_0\left(\frac{V_{a0}}{V_a(t)}\right)^{\gamma},\quad u = \sqrt{\frac{2(p-p_a)}{\rho_w[1-(A_n/A_b)^2]}},\quad \frac{dV_w}{dt} = -C_dA_nu,\quad T = \rho_w C_d A_n u^2`} />
      <YourRocket>
        <Eq block tex={r`T_0 = \frac{2(0.97)(${n(an * 1e4, 2)}\times10^{-4})(${n(dp / 1000, 1)}\times10^{3})}{${n(factor, 3)}} = ${n((2 * 0.97 * an * dp) / factor, 0)}\ \text{N}`} />
        <Eq block tex={r`I = \int T\,dt \approx ${n(trapezoid(burn.map((s) => s.t), burn.map((s) => s.thrust)), 2)}\ \text{N·s}`} />
      </YourRocket>
    </>
  );
}

function WaterComputation({ result: res }: { result: FlightResult }) {
  return (
    <>
      <p>
        El estado tiene cuatro variables: altura, velocidad, volumen de agua y masa de aire. Como el agua sale en milisegundos, el paso de tiempo
        es de 0.05 ms ({format((res.burnout?.t ?? 0) / 5e-5, 0)} pasos solo en esta fase).
      </p>
      <Code>{`
function [T, dVw, dma] = empuje_agua(Vw, ma, p)
    Va  = p.V_botella - Vw;                       % volumen de aire
    rho = ma/Va;
    P   = p.P0*(rho/p.rho0)^p.gamma;              % expansión adiabática
    dVw = 0;  dma = 0;  T = 0;
    if P <= p.pa, return; end
    if Vw > 0                                     % sale agua
        u   = sqrt(2*(P - p.pa)/(p.rho_w*(1 - (p.An/p.Ab)^2)));
        Q   = p.Cd_n*p.An*u;                      % caudal (m^3/s)
        T   = p.rho_w*Q*u;
        dVw = -Q;
    else                                          % sale el aire (sónico)
        Taire = P/(rho*p.R);
        Te  = 2*Taire/(p.gamma + 1);
        Pe  = P*(2/(p.gamma + 1))^(p.gamma/(p.gamma - 1));
        ue  = sqrt(p.gamma*p.R*Te);
        mdot = p.Cd_n*p.An*(Pe/(p.R*Te))*ue;
        T   = mdot*ue + (Pe - p.pa)*p.An;
        dma = -mdot;
    end
end
      `}</Code>
    </>
  );
}

function WaterCharts({ result: res }: { result: FlightResult }) {
  const burn = within(res.samples, 0, (res.burnout?.t ?? 0) + 0.002);
  const ms = (t: number) => t * 1000;
  return (
    <div className="card">
      <h2>Dentro de la botella</h2>
      <div className="charts">
        <LineChart title="Presión manométrica" xLabel="Tiempo (ms)" yLabel="Presión (psi)" series={[{ label: "p − pa", points: burn.map((s) => ({ x: ms(s.t), y: s.pressure ?? 0 })), color: "#0039a6" }]} />
        <LineChart title="Agua en la botella" xLabel="Tiempo (ms)" yLabel="Agua (L)" series={[{ label: "V_w", points: burn.map((s) => ({ x: ms(s.t), y: s.water ?? 0 })), color: "#0f8a9d", fill: true }]} />
      </div>
    </div>
  );
}
