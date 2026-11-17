import { layout } from "../../physics/geometry";
import { useMemo, useState } from "react";
import type { Design, EstesDesign, WaterDesign } from "../../model";
import { PSI } from "../../model";
import { makerName, motorFor, motorSpec, impulseClass, thrustPoints, type Motor } from "../../motor";
import { G } from "../../physics/atmosphere";
import type { FlightResult, Sample } from "../../physics/simulate";
import { format } from "../fields";
import { LineChart } from "../LineChart";
import { QTY, faded, nearest, posSym, within, type PhaseId } from "../phases";
import { Code, DerivationZoom, Eq, StageBlock, Think, YourRocket, n } from "./common";
import { FreeBody, RocketFreeBody, forceScale } from "./diagrams";
import { MethodResults, PhaseCharts, PhaseFacts, PhaseHeader, forceSeries, forceSeriesTec, matlabVector, phaseOf, type MethodResult, PhaseOutcome } from "./phaseCommon";

const r = String.raw;

function trapezoid(t: number[], f: number[]): number {
  let s = 0;
  for (let i = 0; i + 1 < t.length; i++) s += ((f[i] + f[i + 1]) / 2) * (t[i + 1] - t[i]);
  return s;
}

export function Phase1Lesson({ design: d, result: res, onPhase, onChange }: { design: Design; result: FlightResult; onPhase: (id: PhaseId) => void; onChange?: (d: Design) => void }) {
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
  // With a constant average thrust the speed usually keeps rising until burnout.
  const peakBeforeBurnout = vMax.t < ph.to - 0.005;
  const average = d.type === "estes" && d.motor.thrust === "average";
  const burnDrag = !(average && d.type === "estes" && d.motor.burnDrag === false);

  return (
    <div className="lesson">
      <PhaseHeader
        result={res} type={d.type}
        id={1}
        onPick={onPhase}
        intro={<>Del encendido al fin del empuje ({format(ph.to, 2)} s): la única fase en la que una fuerza empuja hacia arriba, y la velocidad <b>aumenta</b> de 0 a casi {format(vMax.v, 0)} m/s.</>}
      />
      <div className="lesson-grid">
        {d.type === "estes" ? (
          <StageBlock stage="fisica">
            <MotorPhysics design={d} />
            <p>
              Sobre el cohete actúan tres fuerzas: <b>empuje</b> (<i>Thrust</i>) hacia arriba, <b>peso</b> (<i>Weight</i>) hacia abajo y{" "}
              <b>arrastre</b> (<i>Drag</i>) del aire en contra de la velocidad.
            </p>
            {average && <SimplifiedModel design={d} onChange={onChange} />}
            <ul>
              <li><b>Despegue:</b> el cohete se queda en la plataforma hasta que el empuje supera al peso (a los {format(liftoff.t, 3)} s).</li>
              <li><b>Sale de la guía</b> a {res.guideExit ? format(res.guideExit.v, 1) : "–"} m/s: desde ahí lo estabilizan las aletas.</li>
              {peakBeforeBurnout ? (
                <li>
                  <b>Detalle para descubrir:</b> la velocidad máxima ({format(vMax.v, 1)} m/s) ocurre a los {format(vMax.t, 3)} s, un poco <i>antes</i> de que
                  termine el empuje. En los últimos instantes el empuje ya es menor que peso + arrastre y el cohete empieza a frenar.
                </li>
              ) : (
                <li>
                  <b>Detalle para descubrir:</b> la velocidad máxima ({format(vMax.v, 1)} m/s) llega justo al terminar el empuje, a los {format(vMax.t, 3)} s:
                  {!average ? " el empuje supera a peso + arrastre hasta el final." : burnDrag ? " con una fuerza constante el empuje nunca baja de peso + arrastre mientras dura." : " sin arrastre, las fuerzas no cambian y el cohete acelera igual todo el empuje."}
                </li>
              )}
            </ul>
            <div className="interactive">
              <label className="slider-label">
                Diagrama de cuerpo libre en <b>t = {s.t.toFixed(3)} s</b>
                <input type="range" min={0} max={ph.to} step={ph.to / 300} value={t} onChange={(e) => setT(Number(e.target.value))} />
              </label>
              <div className="fbd-row fbd-row-rocket">
                <RocketFreeBody sample={s} cgFraction={res.stabilityLoaded.cg / layout(d).length} forceMax={forceScale(within(res.samples, 0, ph.to))} />
                <div className="fbd-equations">
                  <p className="hint">Las tres fuerzas salen del <b>centro de masa</b> (CM), el origen del marco de referencia <i>xy</i>. El eje <i>y</i> positivo apunta hacia arriba.</p>
                  <ul className="fbd-forces">
                    <li style={{ color: QTY.T }}><Eq tex={r`T = ${n(s.thrust, 2)}\ \text{N}`} /></li>
                    <li><Eq tex={r`W = mg = ${n(s.mass * G, 3)}\ \text{N}`} /></li>
                    <li style={{ color: QTY.D }}><Eq tex={r`D = ${n(Math.abs(s.drag), 3)}\ \text{N}`} /></li>
                    <li><Eq tex={r`m = ${n(s.mass * 1000, 1)}\ \text{g}`} /></li>
                  </ul>
                  <Eq block tex={r`m\,\frac{dv}{dt} = T - W - D`} />
                  <Eq block tex={r`\frac{dv}{dt} = \frac{${n(s.thrust, 2)} - ${n(s.mass * G, 3)} - ${n(s.drag, 3)}}{${n(s.mass, 4)}} = \mathbf{${n(s.a, 1)}\ m/s^2}`} />
                </div>
              </div>
            </div>
            <dl className="notation">
              <div><dt><i>T</i> (<i>Thrust</i>)</dt><dd>Empuje: la fuerza con la que los gases del motor empujan al cohete hacia arriba, en newtons (N).</dd></div>
              <div><dt><i>D</i> (<i>Drag</i>)</dt><dd>Arrastre: la resistencia del aire, siempre en contra de la velocidad. Crece con el cuadrado de la velocidad.</dd></div>
              <div><dt><i>W</i> (<i>Weight</i>)</dt><dd>Peso: la fuerza de gravedad sobre el cohete, <Eq tex={r`W = mg`} />, hacia abajo.</dd></div>
              <div><dt><i>dv/dt</i></dt><dd>Aceleración: cuánto cambia la velocidad en cada segundo, en m/s².</dd></div>
            </dl>
          </StageBlock>
        ) : (
        <StageBlock stage="fisica">
          <WaterPhysics design={d} />
          <p>Sobre el cohete actúan tres fuerzas: <b>empuje</b> hacia arriba, <b>peso</b> hacia abajo y <b>arrastre</b> del aire en contra de la velocidad.</p>
          <ul>
            <li><b>Despegue:</b> el cohete se queda en la plataforma hasta que el empuje supera al peso (a los {format(liftoff.t, 3)} s).</li>
            <li><b>Sale de la guía</b> a {res.guideExit ? format(res.guideExit.v, 1) : "–"} m/s: desde ahí lo estabilizan las aletas.</li>
            {peakBeforeBurnout ? (
              <li>
                <b>Detalle para descubrir:</b> la velocidad máxima ({format(vMax.v, 1)} m/s) ocurre a los {format(vMax.t, 3)} s, un poco <i>antes</i> de que
                termine el empuje. En los últimos instantes el empuje ya es menor que peso + arrastre y el cohete empieza a frenar.
              </li>
            ) : (
              <li>
                <b>Detalle para descubrir:</b> la velocidad máxima ({format(vMax.v, 1)} m/s) llega justo al terminar el empuje, a los {format(vMax.t, 3)} s:
                {average ? " con una fuerza constante el empuje nunca baja de peso + arrastre mientras dura." : " el empuje supera a peso + arrastre hasta el final."}
              </li>
            )}
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
        )}

        {d.type === "estes" ? (
          <StageBlock stage="matematicas">
            {average ? (
              <AverageMath design={d} result={res} withDrag={burnDrag} />
            ) : (
              <>
                <p>Segunda ley de Newton con masa variable (el empuje medido ya incluye el momento de los gases expulsados):</p>
                <Eq block tex={r`m(t)\,\frac{dv}{dt} = T(t) - W - D, \qquad W = m(t)\,g, \qquad D = \tfrac12\rho\,v|v|\,C_dA, \qquad \frac{ds}{dt} = v`} />
                <MotorMath design={d} />
                <p>Estimación a mano con el teorema impulso–momento (sin arrastre, masa promedio):</p>
                <Eq block tex={r`v_b \approx \frac{I}{\bar m} - g\,t_b`} />
                <YourRocket>
                  <Eq block tex={r`\text{Despega si } T > W: \quad ${n(first.thrust, 1)}\ \text{N} > ${n(first.mass * G, 3)}\ \text{N}`} />
                  <Eq block tex={r`v_b \approx \frac{${n(impulse, 2)}}{${n(mMean, 4)}} - 9.81(${n(ph.to, 3)}) = ${n(vIdeal, 1)}\ \text{m/s}`} />
                  <Eq block tex={r`\text{Simulación con arrastre: } v_b = ${n(res.burnout?.v ?? 0, 1)}\ \text{m/s}`} />
                </YourRocket>
              </>
            )}
          </StageBlock>
        ) : (
        <StageBlock stage="matematicas">
          <p>Segunda ley de Newton con masa variable (el empuje medido ya incluye el momento del gas o el agua expulsados):</p>
          <Eq block tex={r`m(t)\,\frac{dv}{dt} = T(t) - \tfrac12\rho\,v|v|\,C_dA - m(t)\,g, \qquad \frac{dh}{dt} = v`} />
          <WaterMath design={d} result={res} />
          <p>Estimación a mano con el teorema impulso–momento (sin arrastre, masa promedio):</p>
          <Eq block tex={r`v_b \approx \frac{I}{\bar m} - g\,t_b`} />
          <YourRocket>
            <Eq block tex={r`\text{Despega si } T > mg: \quad ${n(first.thrust, 1)}\ \text{N} > ${n(first.mass * G, 2)}\ \text{N}`} />
            <Eq block tex={r`v_b \approx \frac{${n(impulse, 2)}}{${n(mMean, 4)}} - 9.81(${n(ph.to, 3)}) = ${n(vIdeal, 1)}\ \text{m/s}`} />
            <Eq block tex={r`\text{Simulación con arrastre: } v_b = ${n(res.burnout?.v ?? 0, 1)}\ \text{m/s}`} />
          </YourRocket>
        </StageBlock>
        )}

        {d.type === "estes" && average ? (
          <StageBlock stage="computacion">
            <AverageModelComputation design={d} result={res} />
            <AverageComputation design={d} result={res} burn={burn} />
          </StageBlock>
        ) : (
        <StageBlock stage="computacion">
          {d.type === "estes" ? <MotorComputation design={d} /> : <WaterComputation result={res} />}
          <p>En cada paso de tiempo se evalúan las fuerzas y se avanza con Runge-Kutta 4 (ver la lección Método numérico):</p>
          <Code>{`
function dydt = derivadas_fase1(t, y, p)
    ${posSym(d.type)} = y(1);  v = y(2);
    T   = empuje(t, p);                       % tabla del motor o modelo de agua
    m   = p.m_seca + masa_propulsion(t, p);   % la masa disminuye
    rho = densidad(${posSym(d.type)}, p);                     % atmósfera estándar
    D   = 0.5*rho*v*abs(v)*p.Cd*p.A;          % arrastre (Drag)
    W   = m*p.g;                              % peso (Weight)
    dvdt = (T - W - D)/m;                     % segunda ley de Newton
    if ${posSym(d.type)} <= 0 && v <= 0 && dvdt < 0
        dvdt = 0;                             % todavía en la plataforma
    end
    dydt = [v; dvdt];
end
          `}</Code>
        </StageBlock>
        )}
      </div>

      {d.type === "estes" ? (
        <PhaseOutcome
          phase="I"
          charts={<PhaseCharts result={res} type={d.type} id={1} extra={{ title: "Fuerzas y suma de fuerzas ΣF", yLabel: "Fuerza (N)", series: forceSeriesTec }} fill />}
          results={<>{average && <Phase1Results design={d} result={res} />}<PhaseFacts result={res} type={d.type} id={1} /></>}
          think={average ? (
            <ul>
                <li>En la gráfica de aceleración, <i>dv/dt</i> es una recta horizontal y al terminar el empuje cae de golpe a un valor negativo. ¿Qué fuerza desapareció y cuáles quedan actuando en la Fase II?</li>
                <li>Si el cohete pesara el doble, ¿qué pasaría con <Eq tex={r`\sum F`} />, <Eq tex={r`dv/dt`} />, la velocidad y la posición al final de la Fase I? Pruébalo con tus modelos de MATLAB cambiando <code>FaseI_MasaCohete</code>.</li>
                <li>¿Qué diría tu modelo <Eq tex={r`v(t)`} /> si el empuje promedio fuera menor que el peso? ¿Tiene sentido físico? ¿Qué pasa de verdad con el cohete en la plataforma?</li>
                <li>Con Euler la velocidad sale exacta con cualquier número de pasos, pero la posición no. ¿Por qué?</li>
                <li>Activa «Con arrastre (D)» en Física: ¿cuánto cambian la velocidad y la posición al final de esta fase? ¿Por qué tan poco, si el cohete va a más de 20 m/s?</li>
                <li>Cambia en la pestaña Motor al empuje real: ¿cuánto cambian la velocidad al final de esta fase y el apogeo? ¿Por qué?</li>
                <li>Las condiciones finales de la Fase I son las condiciones iniciales de la Fase II. ¿Qué valores tendrán <code>FaseII_vi</code> y <code>FaseII_si</code>?</li>
              </ul>
          ) : (
            <ul>
          {peakBeforeBurnout
            ? <li>¿Por qué la velocidad máxima ocurre antes de que termine el empuje? Busca en la gráfica de aceleración el instante en que cruza el cero.</li>
            : <li>¿Por qué la aceleración no llega a cero antes de que termine el empuje? Compara el empuje con el peso y el arrastre en la gráfica de fuerzas.</li>}
          {average && <li>Cambia en la pestaña Motor al empuje real: ¿cuánto cambian la velocidad al final de esta fase y el apogeo? ¿Por qué?</li>}
          <li>La estimación con impulso da más velocidad que la simulación. ¿Qué fuerza ignora?</li>
          {d.type === "estes"
            ? <li>Dos motores con casi el mismo impulso (C6 y C11): ¿cuál deja al cohete más rápido al final de esta fase? Pruébalo en la pestaña Cohete.</li>
            : <li>Busca en la pestaña Cohete la cantidad de agua que da la mayor velocidad al final de esta fase. ¿Por qué ni mucha ni poca?</li>}
        </ul>
          )}
        />
      ) : (
      <>
      <PhaseFacts result={res} type={d.type} id={1} />
      <PhaseCharts result={res} type={d.type} id={1} extra={{ title: "Fuerzas", yLabel: "Fuerza (N)", series: forces }} />
      <WaterCharts result={res} />
      <Think>
        <ul>
          {peakBeforeBurnout
            ? <li>¿Por qué la velocidad máxima ocurre antes de que termine el empuje? Busca en la gráfica de aceleración el instante en que cruza el cero.</li>
            : <li>¿Por qué la aceleración no llega a cero antes de que termine el empuje? Compara el empuje con el peso y el arrastre en la gráfica de fuerzas.</li>}
          <li>La estimación con impulso da más velocidad que la simulación. ¿Qué fuerza ignora?</li>
          <li>Busca en la pestaña Cohete la cantidad de agua que da la mayor velocidad al final de esta fase. ¿Por qué ni mucha ni poca?</li>
        </ul>
      </Think>
      </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Estes motor

function MotorPhysics({ design }: { design: EstesDesign }) {
  const m = motorFor(design.motor);
  return (
    <>
      <p>
        El motor quema pólvora negra y expulsa gases a gran velocidad hacia abajo. Por la <b>tercera ley de Newton</b> (conservación del momento), el gas
        empuja al cohete hacia arriba. El empuje de un motor Estes no se calcula: se <b>mide</b> en un banco de pruebas.
      </p>
      <p>
        <b>Motor {makerName(motorSpec(design.motor.id).maker)} {m.name}</b>: la <b>A</b> es la clase de impulso (clase {impulseClass(m.totalImpulse)}: hasta 2.5 N·s), el <b>10</b> es el empuje promedio nominal en
        newtons, el <b>3</b> son los segundos de retardo hasta la eyección del paracaídas y la <b>T</b> indica un motor corto de 13 mm.{" "}
        {m.model === "average"
          ? <>Aquí usas el modelo simplificado: un <b>empuje promedio constante</b> de {format(m.averageThrust, 2)} N durante {format(m.burnTime, 2)} s, con el mismo impulso que la curva medida.</>
          : <>En la curva medida casi todo el impulso llega en el pico de los primeros 0.2 s ({format(m.maxThrust, 1)} N); después queda un empuje de 1 N hasta los {format(m.burnTime, 2)} s.</>}
      </p>
      {m.model === "average" && (
        <div className="alert warning">
          Estás usando el empuje promedio (se elige en la pestaña Motor). Los cálculos son más sencillos, pero las predicciones no son tan correctas como con el
          empuje real: el modelo no tiene el pico de {format(motorFor({ ...design.motor, thrust: "real" }).maxThrust, 1)} N del despegue.
        </div>
      )}
    </>
  );
}

/** The simplified model used with the average thrust, and the switch for air drag during the burn. */
function SimplifiedModel({ design: d, onChange }: { design: EstesDesign; onChange?: (d: Design) => void }) {
  const m = motorFor(d.motor);
  const withDrag = d.motor.burnDrag !== false;
  const set = (burnDrag: boolean) => burnDrag !== withDrag && onChange?.({ ...d, motor: { ...d.motor, burnDrag } });
  return (
    <div className="simplified-model">
      <b>Modelo simplificado (empuje promedio)</b>
      <ul>
        <li><b>Empuje constante:</b> <Eq tex={r`T = \bar T = ${n(m.averageThrust, 2)}\ \text{N}`} /> durante {format(m.burnTime, 2)} s.</li>
        <li><b>Masa constante:</b> se ignora el combustible que se quema, así que el <b>peso</b> también es constante: <Eq tex={r`W = mg`} />.</li>
        <li><b>Arrastre opcional:</b> puedes incluirlo o ignorarlo mientras el motor empuja.</li>
      </ul>
      <div className="thrust-model" role="group" aria-label="Arrastre durante el empuje">
        <button type="button" className={`btn small ${withDrag ? "primary" : ""}`} aria-pressed={withDrag} disabled={!onChange} onClick={() => set(true)}
          title="El aire frena al cohete mientras el motor empuja. Es más realista, pero la ecuación ya no se resuelve con una fórmula sencilla.">
          Con arrastre (D)
        </button>
        <button type="button" className={`btn small ${!withDrag ? "primary" : ""}`} aria-pressed={!withDrag} disabled={!onChange} onClick={() => set(false)}
          title="Ignora la resistencia del aire mientras el motor empuja: todas las fuerzas son constantes y el movimiento es uniformemente acelerado. Las predicciones serán menos correctas.">
          Sin arrastre
        </button>
      </div>
      <p className="hint">Se aplica a todos los cálculos de la Fase I. En la Fase II el arrastre se elige con su propio botón.</p>
    </div>
  );
}

/** Numbers of the Phase I model with the average thrust (no drag, constant mass). */
export function averageModel(d: EstesDesign, res: FlightResult) {
  const motor = motorFor(d.motor);
  const tb = motor.burnTime;
  const m = res.samples[0].mass; // kg, constant in this model
  const T = motor.averageThrust;
  const W = m * G;
  const F = T - W; // N, sum of forces without drag
  const dvdt = F / m; // m/s², constant
  const vi = 0, si = 0; // the rocket starts at rest on the pad
  const v = (t: number) => vi + dvdt * t;
  const s = (t: number) => si + vi * t + 0.5 * dvdt * t * t;
  return { motor, tb, m, T, W, F, dvdt, vi, si, v, s };
}

/**
 * Tree infographic: one differential equation, two ways to solve it.
 * Analytic (separation of variables → exact formula) and numerical (Euler in MATLAB → table of approximate values).
 */
export function MethodTree({ dvdt, formula, rows: given }: { dvdt: number; formula?: string; rows?: { t: number; v: number }[] }) {
  const rows = given ?? [0, 0.1, 0.2].map((t) => ({ t, v: dvdt * t }));
  return (
    <figure className="method-tree" aria-label="Diagrama: dos métodos para resolver la ecuación diferencial">
      <div className="mt-root">
        <span className="mt-kicker">Ecuación diferencial</span>
        <Eq tex={r`\dfrac{dv}{dt} = \dfrac{\sum F}{m}`} />
      </div>
      <div className="mt-branches">
        <div className="mt-branch mt-analytic">
          <div className="mt-node mt-head"><span className="mt-icon" aria-hidden="true">∫</span> Método analítico</div>
          <div className="mt-node"><b>Separación de variables</b><span>se integra con cálculo, a mano</span></div>
          <div className="mt-node mt-leaf">
            <span className="mt-kicker">Resultado: una fórmula</span>
            <Eq tex={formula ?? r`v(t) = v_i + \dfrac{\sum F}{m}\,t`} />
          </div>
          <div className="mt-tag">✔ Exacto para cualquier <i>t</i></div>
        </div>
        <div className="mt-branch mt-numeric">
          <div className="mt-node mt-head"><span className="mt-icon" aria-hidden="true">Δt</span> Método numérico</div>
          <div className="mt-node"><b>Método de Euler</b><span>MATLAB avanza en pasos pequeños de tiempo</span></div>
          <div className="mt-node mt-leaf">
            <span className="mt-kicker">Resultado: una tabla</span>
            <table className="mt-table">
              <thead><tr><th>t (s)</th><th>v (m/s)</th></tr></thead>
              <tbody>
                {rows.map((x) => <tr key={x.t}><td>{x.t.toFixed(2)}</td><td>{x.v.toFixed(2)}</td></tr>)}
                <tr><td>⋮</td><td>⋮</td></tr>
              </tbody>
            </table>
          </div>
          <div className="mt-tag">≈ Aproximado: mejora con Δt pequeño</div>
        </div>
      </div>
    </figure>
  );
}

/** The first Euler steps worked out by hand with the student's numbers, then a table of the first values. */
function EulerByHand({ dvdt, vi, si }: { dvdt: number; vi: number; si: number }) {
  const dt = 0.01;
  const rows = eulerSteps(dvdt, vi, si, 4 * dt, dt);
  const [p0, p1, p2] = rows;
  const f = (x: number, k = 4) => n(x, k);
  return (
    <div className="euler-hand">
      <p><b>Paso 1</b> (de <Eq tex={r`n = 0`} /> a <Eq tex={r`n = 1`} />, de <Eq tex={r`t = 0`} /> a <Eq tex={r`t = 0.01\ \text{s}`} />):</p>
      <Eq block tex={r`v_1 = v_0 + \frac{\sum F}{m}\,\Delta t = ${f(p0.v, 0)} + ${n(dvdt, 2)}(0.01) = ${f(p1.v)}\ \text{m/s}`} />
      <Eq block tex={r`s_1 = s_0 + v_0\,\Delta t = ${f(p0.s, 0)} + ${f(p0.v, 0)}(0.01) = ${f(p1.s)}\ \text{m}`} />
      <p className="hint">En el primer paso la posición no cambia: Euler usa la velocidad del inicio del paso, que es cero.</p>
      <p><b>Paso 2</b> (de <Eq tex={r`n = 1`} /> a <Eq tex={r`n = 2`} />): usamos los valores que acabamos de calcular.</p>
      <Eq block tex={r`v_2 = v_1 + \frac{\sum F}{m}\,\Delta t = ${f(p1.v)} + ${n(dvdt, 2)}(0.01) = ${f(p2.v)}\ \text{m/s}`} />
      <Eq block tex={r`s_2 = s_1 + v_1\,\Delta t = ${f(p1.s)} + ${f(p1.v)}(0.01) = ${f(p2.s)}\ \text{m}`} />
      <p>Y así sucesivamente. Cada fila sale de la anterior:</p>
      <table className="summary euler-table">
        <thead><tr><th className="num">n</th><th className="num"><Eq tex={r`t_n`} /> (s)</th><th className="num"><Eq tex={r`v_n`} /> (m/s)</th><th className="num"><Eq tex={r`s_n`} /> (m)</th></tr></thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={i}><td className="num">{i}</td><td className="num">{p.t.toFixed(2)}</td><td className="num">{p.v.toFixed(4)}</td><td className="num">{p.s.toFixed(4)}</td></tr>
          ))}
          <tr><td className="num">⋮</td><td className="num">⋮</td><td className="num">⋮</td><td className="num">⋮</td></tr>
        </tbody>
      </table>
    </div>
  );
}

/** Euler steps for dv/dt = ΣF/m and ds/dt = v, from t = 0 to t_b. */
export function eulerSteps(dvdt: number, vi: number, si: number, tb: number, dt: number) {
  const pts = [{ t: 0, v: vi, s: si }];
  while (pts[pts.length - 1].t < tb - 1e-9) {
    const p = pts[pts.length - 1];
    const h = Math.min(dt, tb - p.t);
    pts.push({ t: p.t + h, v: p.v + dvdt * h, s: p.s + p.v * h });
  }
  return pts;
}

/**
 * Phase I with the average thrust: the model v(t) = vi + (ΣF/m)·t comes from Newton's second law dv/dt = ΣF/m,
 * and s(t) from v = ds/dt. Two ways to solve them: analytic (separation of variables) and numerical (Euler in MATLAB).
 * The math model has no drag, so the net force is constant. s is the position ("state"), ready for 3D.
 */
function AverageMath({ design: d, result: res, withDrag }: { design: EstesDesign; result: FlightResult; withDrag: boolean }) {
  const { motor, tb, m, T, dvdt, vi, si } = averageModel(d, res);

  return (
    <div className="derivation">
      <p>
        Queremos el <b>modelo</b> (la función) de la velocidad del cohete mientras el motor empuja:
      </p>
      <Eq block tex={r`v(t) = v_i + \frac{\sum F}{m}\,t`} />
      <p>
        Para llegar a él partimos de la <b>segunda ley de Newton</b>, que no nos da la velocidad sino <i>cómo cambia</i>:
      </p>
      <Eq block tex={r`\frac{dv}{dt} = \frac{\sum F}{m}`} />
      <p>
        Es una <b>ecuación diferencial</b>. Resolverla es encontrar la función <Eq tex={r`v(t)`} />. Después, con la definición de velocidad{" "}
        <Eq tex={r`v = \frac{ds}{dt}`} />, encontramos la posición <Eq tex={r`s(t)`} />. Usamos la letra <b>s</b> (de <i>state</i>, estado): hoy es la
        posición sobre la plataforma, en una dimensión; más adelante será un vector y el mismo planteamiento servirá en 3D.
      </p>
      <p>Hay dos formas de resolver una ecuación diferencial:</p>
      <MethodTree dvdt={dvdt} />


      <h4><span className="step-n">1</span> La suma de fuerzas</h4>
      <p>Del diagrama de cuerpo libre, con el eje <i>y</i> positivo hacia arriba, el empuje suma y el peso resta. En el modelo matemático ignoramos el arrastre:</p>
      <Eq block tex={r`\sum F = \bar T - W = \bar T - mg`} />
      <p>Con el empuje promedio y la masa constante, <b>toda la suma de fuerzas es constante</b>, y por lo tanto <Eq tex={r`\frac{dv}{dt}`} /> también.</p>
      {withDrag && (
        <p className="hint">Tienes activado «Con arrastre (D)»: la simulación sí incluye el arrastre, así que en Computación sus resultados serán un poco menores que los de este modelo.</p>
      )}

      <h4><span className="step-n">2</span> Método analítico: v(t) por separación de variables</h4>
      <DerivationZoom
        title="Fase I · v(t) por separación de variables"
        ode={r`\frac{dv}{dt} = \frac{\sum F}{m}, \qquad v(0) = v_i`}
        result={r`v(t) = v_i + \frac{\sum F}{m}\,t`}
        steps={[
          {
            title: "Identificamos la ecuación",
            body: (
              <>
                <p>La segunda ley de Newton nos dice <b>cómo cambia</b> la velocidad. Queremos la función <Eq tex={r`v(t)`} /> que cumple:</p>
                <Eq block tex={r`\frac{dv}{dt} = \frac{\sum F}{m}`} />
                <p>Con el empuje promedio y la masa constante, <Eq tex={r`\frac{\sum F}{m}`} /> es un <b>número constante</b>: no depende de <Eq tex={r`v`} /> ni de <Eq tex={r`t`} />. Además sabemos cómo empieza: al tiempo <Eq tex={r`0`} /> la velocidad es <Eq tex={r`v_i`} />.</p>
              </>
            ),
          },
          {
            title: "Separamos las variables",
            body: (
              <>
                <p>Multiplicamos los dos lados por <Eq tex={r`dt`} />: todo lo que tiene <Eq tex={r`v`} /> queda a la izquierda y todo lo que tiene <Eq tex={r`t`} /> a la derecha.</p>
                <Eq block tex={r`\frac{dv}{dt} = \frac{\sum F}{m} \quad\Rightarrow\quad dv = \frac{\sum F}{m}\,dt`} />
              </>
            ),
          },
          {
            title: "Ponemos los límites de integración",
            body: (
              <>
                <p>Integramos los dos lados. Cada lado lleva sus propios límites: al tiempo <Eq tex={r`0`} /> la velocidad es <Eq tex={r`v_i`} />; al tiempo <Eq tex={r`t`} />, es <Eq tex={r`v`} />.</p>
                <Eq block tex={r`\int_{v_i}^{v} dv = \int_0^{t} \frac{\sum F}{m}\,dt`} />
              </>
            ),
          },
          {
            title: "Resolvemos el lado izquierdo",
            body: (
              <>
                <p>La integral de <Eq tex={r`dv`} /> es <Eq tex={r`v`} />. La evaluamos: límite de arriba menos límite de abajo.</p>
                <Eq block tex={r`\int_{v_i}^{v} dv = \Big[\,v\,\Big]_{v_i}^{v} = v - v_i`} />
              </>
            ),
          },
          {
            title: "Resolvemos el lado derecho",
            body: (
              <>
                <p><Eq tex={r`\frac{\sum F}{m}`} /> es constante, así que sale de la integral. Queda la integral de <Eq tex={r`dt`} />, que es <Eq tex={r`t`} />:</p>
                <Eq block tex={r`\int_0^{t} \frac{\sum F}{m}\,dt = \frac{\sum F}{m}\int_0^{t} dt = \frac{\sum F}{m}\Big[\,t\,\Big]_0^{t} = \frac{\sum F}{m}\,(t - 0) = \frac{\sum F}{m}\,t`} />
              </>
            ),
          },
          {
            title: "Igualamos y despejamos v",
            body: (
              <>
                <p>Juntamos los dos lados y pasamos <Eq tex={r`v_i`} /> sumando a la derecha:</p>
                <Eq block tex={r`v - v_i = \frac{\sum F}{m}\,t \quad\Rightarrow\quad v(t) = v_i + \frac{\sum F}{m}\,t`} />
                <p className="hint">Comprueba: si derivas <Eq tex={r`v(t)`} /> obtienes <Eq tex={r`\frac{\sum F}{m}`} /> (la ecuación diferencial) y si pones <Eq tex={r`t = 0`} /> obtienes <Eq tex={r`v_i`} /> (la condición inicial). Las dos se cumplen.</p>
              </>
            ),
          },
        ]}
      />

      <h4><span className="step-n">3</span> Método analítico: s(t) a partir de v = ds/dt</h4>
      <DerivationZoom
        title="Fase I · s(t) a partir de v = ds/dt"
        ode={r`\frac{ds}{dt} = v_i + \frac{\sum F}{m}\,t, \qquad s(0) = s_i`}
        result={r`s(t) = s_i + v_i\,t + \frac12\,\frac{\sum F}{m}\,t^2`}
        note={
          <p className="hint">
            Cada término tiene un significado: <Eq tex={r`s_i`} /> es dónde empieza, <Eq tex={r`v_i\,t`} /> es lo que avanzaría con su velocidad inicial y{" "}
            <Eq tex={r`\tfrac12\,\tfrac{\sum F}{m}\,t^2`} /> es lo que avanza de más porque la fuerza lo acelera.
          </p>
        }
        steps={[
          {
            title: "Partimos de la definición de velocidad",
            body: (
              <>
                <p>Sustituimos el modelo <Eq tex={r`v(t)`} /> que acabamos de encontrar:</p>
                <Eq block tex={r`\frac{ds}{dt} = v(t) \quad\Rightarrow\quad \frac{ds}{dt} = v_i + \frac{\sum F}{m}\,t`} />
                <p>Ahora la velocidad <b>no</b> es constante: depende de <Eq tex={r`t`} />. Por eso la integral tendrá dos términos.</p>
              </>
            ),
          },
          {
            title: "Separamos las variables",
            body: (
              <>
                <p>Multiplicamos los dos lados por <Eq tex={r`dt`} />: queda <Eq tex={r`ds`} /> sola a la izquierda y todo lo que depende de <Eq tex={r`t`} /> a la derecha.</p>
                <Eq block tex={r`ds = \left(v_i + \frac{\sum F}{m}\,t\right)dt`} />
              </>
            ),
          },
          {
            title: "Ponemos los límites de integración",
            body: (
              <>
                <p>Al tiempo <Eq tex={r`0`} /> el cohete está en la posición inicial <Eq tex={r`s_i`} />; al tiempo <Eq tex={r`t`} /> está en <Eq tex={r`s`} />:</p>
                <Eq block tex={r`\int_{s_i}^{s} ds = \int_0^{t} \left(v_i + \frac{\sum F}{m}\,t\right)dt`} />
              </>
            ),
          },
          {
            title: "Resolvemos el lado izquierdo",
            body: <Eq block tex={r`\int_{s_i}^{s} ds = \Big[\,s\,\Big]_{s_i}^{s} = s - s_i`} />,
          },
          {
            title: "Separamos el lado derecho en dos términos",
            body: (
              <>
                <p>La integral de una suma es la suma de las integrales:</p>
                <Eq block tex={r`\int_0^{t} \left(v_i + \frac{\sum F}{m}\,t\right)dt = \underbrace{\int_0^{t} v_i\,dt}_{\text{término 1}} + \underbrace{\int_0^{t} \frac{\sum F}{m}\,t\,dt}_{\text{término 2}}`} />
              </>
            ),
          },
          {
            title: "Término 1",
            body: (
              <>
                <p><Eq tex={r`v_i`} /> es una constante, sale de la integral y queda la integral de <Eq tex={r`dt`} />:</p>
                <Eq block tex={r`\int_0^{t} v_i\,dt = v_i\int_0^{t} dt = v_i\Big[\,t\,\Big]_0^{t} = v_i\,(t - 0) = v_i\,t`} />
              </>
            ),
          },
          {
            title: "Término 2",
            body: (
              <>
                <p><Eq tex={r`\sum F / m`} /> también es constante y sale de la integral. Para <Eq tex={r`t`} /> usamos la regla de la potencia, <Eq tex={r`\int t^n\,dt = \frac{t^{n+1}}{n+1}`} />, con <Eq tex={r`n = 1`} />:</p>
                <Eq block tex={r`\int_0^{t} \frac{\sum F}{m}\,t\,dt = \frac{\sum F}{m}\left[\frac{t^2}{2}\right]_0^{t} = \frac{\sum F}{m}\left(\frac{t^2}{2} - \frac{0^2}{2}\right) = \frac12\,\frac{\sum F}{m}\,t^2`} />
              </>
            ),
          },
          {
            title: "Juntamos los dos lados y despejamos s",
            body: (
              <>
                <p>Pasamos <Eq tex={r`s_i`} /> sumando a la derecha:</p>
                <Eq block tex={r`s - s_i = v_i\,t + \frac12\,\frac{\sum F}{m}\,t^2 \quad\Rightarrow\quad s(t) = s_i + v_i\,t + \frac12\,\frac{\sum F}{m}\,t^2`} />
                <p className="hint">Comprueba: si derivas <Eq tex={r`s(t)`} /> obtienes otra vez <Eq tex={r`v(t) = v_i + \tfrac{\sum F}{m}\,t`} />.</p>
              </>
            ),
          },
        ]}
      />
      <p>
        En la Fase I el cohete parte del reposo y de la plataforma: <Eq tex={r`v_i = 0`} /> y <Eq tex={r`s_i = 0`} />. Las dejamos en el modelo
        porque en otras fases no valen cero.
      </p>

      <h4><span className="step-n">4</span> Método numérico: Euler en MATLAB</h4>
      <p>
        La computadora no sabe integrar como lo hicimos a mano: solo sabe <b>sumar, restar, multiplicar y dividir</b>, muy rápido. El método de Euler
        convierte la ecuación diferencial en operaciones de ese tipo.
      </p>

      <p><b>a) Dividimos el tiempo en pasos.</b> Escogemos un paso de tiempo pequeño <Eq tex={r`\Delta t`} /> y solo calculamos el cohete en los instantes</p>
      <Eq block tex={r`t_0 = 0,\quad t_1 = \Delta t,\quad t_2 = 2\Delta t,\quad \dots,\quad t_n = n\,\Delta t`} />
      <p>
        El subíndice <Eq tex={r`n`} /> es el número de paso: <Eq tex={r`v_n`} /> y <Eq tex={r`s_n`} /> son la velocidad y la posición en el instante{" "}
        <Eq tex={r`t_n`} />. Con <Eq tex={r`\Delta t = 0.01\ \text{s}`} />, para llegar a <Eq tex={r`t_b = ${n(tb, 2)}\ \text{s}`} /> hacen falta{" "}
        <b>{Math.round(tb / 0.01)} pasos</b>.
      </p>

      <p><b>b) Cambiamos la derivada por un cociente de diferencias.</b> La derivada es el cambio dividido entre el tiempo cuando el intervalo es infinitamente pequeño:</p>
      <Eq block tex={r`\frac{dv}{dt} = \lim_{\Delta t \to 0} \frac{v(t + \Delta t) - v(t)}{\Delta t}`} />
      <p>Si <Eq tex={r`\Delta t`} /> es pequeño (pero no cero), quitamos el límite y aceptamos una aproximación (<Eq tex={r`\approx`} />):</p>
      <Eq block tex={r`\frac{dv}{dt} \approx \frac{v_{n+1} - v_n}{\Delta t} \qquad\qquad \frac{ds}{dt} \approx \frac{s_{n+1} - s_n}{\Delta t}`} />

      <p><b>c) Sustituimos en las dos ecuaciones del movimiento</b> <Eq tex={r`\frac{dv}{dt} = \frac{\sum F}{m}`} /> y <Eq tex={r`\frac{ds}{dt} = v`} />:</p>
      <Eq block tex={r`\frac{v_{n+1} - v_n}{\Delta t} = \frac{\sum F}{m} \qquad\qquad \frac{s_{n+1} - s_n}{\Delta t} = v_n`} />

      <p><b>d) Despejamos el valor siguiente</b>: multiplicamos por <Eq tex={r`\Delta t`} /> y pasamos <Eq tex={r`v_n`} /> y <Eq tex={r`s_n`} /> a la derecha:</p>
      <div className="result-eq"><Eq block tex={r`v_{n+1} = v_n + \frac{\sum F}{m}\,\Delta t \qquad\qquad s_{n+1} = s_n + v_n\,\Delta t`} /></div>
      <p className="hint">
        Se lee así: <i>«lo nuevo = lo que tenía + cuánto cambia en un paso»</i>. Si conozco el cohete ahora, puedo calcularlo un instante después. Para la
        posición usamos <Eq tex={r`v_n`} />, la velocidad al <b>inicio</b> del paso: por eso Euler es aproximado.
      </p>

      <p><b>e) Hacemos los primeros pasos a mano</b> con tu cohete (<Eq tex={r`\tfrac{\sum F}{m} = ${n(dvdt, 2)}\ \text{m/s}^2`} />, <Eq tex={r`\Delta t = 0.01\ \text{s}`} />). Empezamos con los valores iniciales <Eq tex={r`v_0 = v_i = ${n(vi, 0)}`} /> y <Eq tex={r`s_0 = s_i = ${n(si, 0)}`} />:</p>
      <EulerByHand dvdt={dvdt} vi={vi} si={si} />

      <p><b>f) El algoritmo.</b> Repetir esa regla {Math.round(tb / 0.01)} veces a mano sería muy cansado; la computadora lo hace en milisegundos:</p>
      <ol className="algorithm-steps">
        <li>Dar los datos: <Eq tex={r`\bar T`} />, <Eq tex={r`m`} />, <Eq tex={r`g`} />, <Eq tex={r`t_b`} /> y <Eq tex={r`\Delta t`} />.</li>
        <li>Calcular una sola vez <Eq tex={r`\sum F`} /> y <Eq tex={r`\frac{\sum F}{m}`} /> (son constantes).</li>
        <li>Guardar los valores iniciales <Eq tex={r`v_i`} /> y <Eq tex={r`s_i`} /> en la primera casilla.</li>
        <li>Repetir para cada paso: calcular <Eq tex={r`v_{n+1}`} /> y <Eq tex={r`s_{n+1}`} /> con la regla de Euler.</li>
        <li>Mostrar los valores del último paso: la velocidad y la posición al final de la Fase I.</li>
      </ol>
      <p>En MATLAB (los números de cada línea corresponden a los pasos de arriba; recuerda que en MATLAB la primera casilla es <code>v(1)</code>, que guarda <Eq tex={r`v_0`} />):</p>
      <Code title="MATLAB · Fase I con el método de Euler">{`
% Fase I: Despegue - MaxQ con empuje promedio (sin arrastre, masa constante)

% 1. Datos
FaseI_vi = 0;                 % m/s, velocidad inicial
FaseI_si = 0;                 % m, posición inicial
T_prom = ${n(T, 3)};              % N, empuje promedio del motor ${motor.name}
m      = ${n(m, 4)};             % kg, masa del cohete (constante)
g      = 9.81;                % m/s^2
t_b    = ${n(tb, 2)};               % s, duración del empuje
dt     = 0.01;                % s, paso de tiempo

% 2. Constantes del modelo (se calculan una sola vez)
SF   = T_prom - m*g;          % suma de fuerzas: empuje - peso
dvdt = SF/m;                  % segunda ley de Newton

% 3. Instantes t_n = n*dt y valores iniciales
t = 0:dt:t_b;                 % t(1) = 0, t(2) = dt, ... t(end) = t_b
v = zeros(size(t));           % casillas para guardar v_n
s = zeros(size(t));           % casillas para guardar s_n
v(1) = FaseI_vi;              % v_0
s(1) = FaseI_si;              % s_0

% 4. Regla de Euler en cada paso: lo nuevo = lo que tenía + cambio en un paso
for k = 1:numel(t)-1
    v(k+1) = v(k) + dvdt*dt;  % v_(n+1) = v_n + (SF/m)*dt
    s(k+1) = s(k) + v(k)*dt;  % s_(n+1) = s_n + v_n*dt
end

% 5. Resultados del último paso
fprintf('Velocidad al final de la Fase I: %.2f m/s\\n', v(end));
fprintf('Posición al final de la Fase I:  %.2f m\\n', s(end));
      `}</Code>
      <p className="hint">Los resultados de tu cohete, con los dos métodos, están al principio de la parte 4 · Resultados.</p>
    </div>
  );
}

/**
 * First card of the phase I results: the four numbers of the model solved both ways, the analytic formulas and
 * Euler with the same Δt = 0.01 s as the MATLAB script of Matemáticas.
 */
function Phase1Results({ design: d, result: res }: { design: EstesDesign; result: FlightResult }) {
  const { tb, T, W, F, dvdt, vi, si, v, s } = averageModel(d, res);
  const dt = 0.01;
  const last = useMemo(() => {
    const steps = eulerSteps(dvdt, vi, si, tb, dt);
    return steps[steps.length - 1];
  }, [dvdt, vi, si, tb]);
  const cards: MethodResult[] = [
    { q: "F", label: "Fuerza promedio", unit: "N", analytic: F, euler: F, digits: 2, sub: r`\textstyle\sum F = ${n(T, 2)} - ${n(W, 3)}` },
    { q: "a", label: "Aceleración promedio", unit: "m/s²", analytic: dvdt, euler: dvdt, digits: 2, sub: r`dv/dt = \textstyle\sum F / m` },
    { q: "v", label: "Velocidad máxima", unit: "m/s", analytic: v(tb), euler: last.v, digits: 2, sub: r`v(t_b),\ t_b = ${n(tb, 2)}\ \text{s}` },
    { q: "s", label: "Altura máxima de la Fase I", unit: "m", analytic: s(tb), euler: last.s, digits: 2, sub: r`s(t_b)`, hero: true },
  ];
  return (
    <MethodResults cards={cards} dt={dt} note={<>
      La fuerza, la aceleración y la velocidad salen iguales con los dos métodos, porque <Eq tex={r`\sum F / m`} /> es constante. La posición de Euler se queda un poco abajo:
      usa la velocidad del inicio de cada paso, la más lenta del paso.
    </>} />
  );
}

/**
 * Computation for Phase I with the average thrust, part 1: the charts ΣF(t), dv/dt, v(t) and s(t) of the analytic model,
 * then the MATLAB code that makes each one (same structure as the course script: FaseI_ variables, models as functions, fplot).
 */
function AverageModelComputation({ design: d, result: res }: { design: EstesDesign; result: FlightResult }) {
  const { motor, tb, m, T, dvdt, v, s } = averageModel(d, res);
  const charts = useMemo(() => {
    const ts = Array.from({ length: 61 }, (_, i) => (tb * i) / 60);
    const line = (f: (t: number) => number) => ts.map((t) => ({ x: t, y: f(t) }));
    return {
      v: [{ label: "v(t)", points: line(v), color: QTY.v }],
      s: [{ label: "s(t)", points: line(s), color: QTY.s }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tb, dvdt]);
  const plot = (handle: string, title: string, yLabel: string) => `
figure;
fplot(${handle}, FaseI_Dominio, 'LineWidth', 1.5)
title('${title}')
xlabel('Tiempo (s)')
ylabel('${yLabel}')
grid on
`;

  return (
    <>
      <h4 className="comp-step">Simulaciones v(t) y s(t)</h4>
      <p>
        La computadora evalúa los modelos que encontraste en Matemáticas para todos los instantes de la Fase I, desde <Eq tex={r`t = 0`} /> hasta{" "}
        <Eq tex={r`t_b = ${n(tb, 2)}\ \text{s}`} />. Copia el script en MATLAB y córrelo: genera las gráficas de la velocidad y la posición.
      </p>
      <Code title="MATLAB · Fase I: Despegue - MaxQ, v(t) y s(t)" scroll>{`
%% Fase I: Despegue - MaxQ (empuje promedio constante, masa constante)
% Cada bloque marcado con %% es una sección del script: en MATLAB Live Script
% puedes correr cada sección por separado (Ctrl + Enter).

clear all;

%% 1. Condiciones iniciales
FaseI_si = 0;                                % m
FaseI_vi = 0;                                % m/s
FaseI_MasaCohete = ${n(m, 4)};                   % kg (constante)
FaseI_ti = 0;                                % s
FaseI_tf = ${n(tb, 2)};                              % s, fin del empuje

% Fuerzas (eje y positivo hacia arriba)
FaseI_FuerzaPesoCohete = FaseI_MasaCohete * (-9.81);   % N, W hacia abajo
FaseI_FuerzaMotor = ${n(T, 3)};                        % N, empuje promedio del ${motor.name}

% Suma de fuerzas y aceleración: son constantes en esta fase
FaseI_SumFuerza = FaseI_FuerzaMotor + FaseI_FuerzaPesoCohete;   % N
FaseI_Aceleracion = FaseI_SumFuerza / FaseI_MasaCohete;         % m/s^2

% Dominio: el intervalo de tiempo de la fase
FaseI_Dominio = [FaseI_ti FaseI_tf];

%% 2. Modelos de la velocidad y la posición
% Son funciones anónimas, @(t): reciben un tiempo y regresan la velocidad
% o la posición en ese instante.
% El ".^" eleva elemento por elemento cuando t es un vector.
FaseI_ModeloVt = @(t) FaseI_vi + FaseI_Aceleracion*t;
FaseI_ModeloSt = @(t) FaseI_si + FaseI_vi*t + (1/2)*FaseI_Aceleracion*t.^2;

%% 3. Gráfica de la velocidad v(t)
${plot("FaseI_ModeloVt", "Fase I: v(t)", "Velocidad (m/s)").trim()}

%% 4. Gráfica de la posición s(t)
${plot("FaseI_ModeloSt", "Fase I: s(t)", "Posición (m)").trim()}

%% 5. Condiciones finales
% Sin punto y coma al final, MATLAB muestra el valor en la ventana de comandos.
% Deben salir los mismos resultados de Matemáticas:
%   velocidad = ${format(v(tb), 2)} m/s
%   posición  = ${format(s(tb), 2)} m
% Estas condiciones finales son las condiciones iniciales de la Fase II.
FaseI_VelocidadFinal = FaseI_ModeloVt(FaseI_Dominio(2))
FaseI_PosicionFinal  = FaseI_ModeloSt(FaseI_Dominio(2))
      `}</Code>

      <h4 className="comp-step">Lo que debe salir en MATLAB</h4>
      <p>Al correr el script, MATLAB dibuja estas gráficas (aquí puedes ampliarlas y hacer zoom):</p>
      <div className="charts">
        <LineChart title="Velocidad v(t)" xLabel="Tiempo (s)" yLabel="v (m/s)" series={charts.v} height={220} />
        <LineChart title="Posición s(t)" xLabel="Tiempo (s)" yLabel="s (m)" series={charts.s} height={220} />
      </div>
      <p className="hint">
        Fíjate en la forma: la velocidad es una <b>recta</b> que sube (la aceleración es constante) y la posición es una <b>parábola</b>. La pendiente
        de <Eq tex={r`s(t)`} /> en cada instante es la velocidad <Eq tex={r`v(t)`} />.
      </p>
    </>
  );
}

/** Computation for Phase I with the average thrust: the analytic model, Euler and the RPL simulation side by side. */
function AverageComputation({ design: d, result: res, burn }: { design: EstesDesign; result: FlightResult; burn: Sample[] }) {
  const { tb, dvdt, vi, si, v, s } = averageModel(d, res);
  const withDrag = d.motor.burnDrag !== false;
  // The student picks the number of Euler steps; the step is Δt = t_b / N.
  const counts = [5, 10, 20, 50, 100, 500, 1000];
  const [N, setN] = useState(10);
  const dt = tb / N;
  const dtLabel = `${Number(dt.toPrecision(3))}`;
  const dots = N <= 50;
  const euler = useMemo(() => eulerSteps(dvdt, vi, si, tb, dt), [dvdt, vi, si, tb, dt]);
  const last = euler[euler.length - 1];
  const sim = res.burnout;
  const simLabel = withDrag ? "Simulación RPL (RK4, con arrastre)" : "Simulación RPL (RK4)";
  const charts = useMemo(() => {
    const ts = Array.from({ length: 41 }, (_, i) => (tb * i) / 40);
    const simPts = burn.filter((x) => x.t <= tb + 1e-9);
    return {
      v: [
        { label: "Analítico", points: ts.map((t) => ({ x: t, y: v(t) })), color: QTY.v, dashed: true },
        { label: `Euler, Δt = ${dtLabel} s`, points: euler.map((p) => ({ x: p.t, y: p.v })), color: QTY.v, showPoints: dots },
        { label: simLabel, points: simPts.map((x) => ({ x: x.t, y: x.v })), color: faded(QTY.v) },
      ],
      s: [
        { label: "Analítico", points: ts.map((t) => ({ x: t, y: s(t) })), color: QTY.s, dashed: true },
        { label: `Euler, Δt = ${dtLabel} s`, points: euler.map((p) => ({ x: p.t, y: p.s })), color: QTY.s, showPoints: dots },
        { label: simLabel, points: simPts.map((x) => ({ x: x.t, y: x.h })), color: faded(QTY.s) },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burn, tb, dvdt, euler, dtLabel, dots, simLabel]);
  const pct = (a: number, b: number) => (b !== 0 ? ((a - b) / b) * 100 : 0);

  return (
    <>
      <h4 className="comp-step">Comparación de solución analítica vs numérica</h4>
      <p>Primero corre en MATLAB el script de Euler de Matemáticas y después este código: grafica los dos métodos juntos.</p>
      <Code title="MATLAB · comparar Euler con el modelo analítico">{`
% Corre antes el script de Euler de Matemáticas: crea los vectores t, v y s.
% Este código dibuja Euler (puntos) contra el modelo analítico (línea punteada).

v_analitica = FaseI_vi + dvdt*t;
s_analitica = FaseI_si + FaseI_vi*t + 0.5*dvdt*t.^2;

subplot(2,1,1); plot(t, v, 'o', t, v_analitica, '--'); grid on;
ylabel('v (m/s)'); legend('Euler', 'Analítico');
subplot(2,1,2); plot(t, s, 'o', t, s_analitica, '--'); grid on;
xlabel('Tiempo (s)'); ylabel('s (m)'); legend('Euler', 'Analítico');
      `}</Code>

      <h4 className="comp-step">Lo que debe salir en MATLAB</h4>
      <p>Comparamos los dos métodos de Matemáticas con la simulación completa de RPL. Escoge cuántos pasos usa Euler y observa cómo se acerca a la solución analítica:</p>
      <div className="interactive">
        <div className="euler-steps">
          <span>Número de pasos de Euler:</span>
          <div className="euler-step-buttons" role="group" aria-label="Número de pasos de Euler">
            {counts.map((c) => (
              <button key={c} type="button" className={`btn small ${c === N ? "primary" : ""}`} aria-pressed={c === N} onClick={() => setN(c)}>{c}</button>
            ))}
          </div>
          <Eq tex={r`\Delta t = \frac{t_b}{N} = \frac{${n(tb, 2)}\ \text{s}}{${N}} = ${dtLabel}\ \text{s}`} />
        </div>
        <div className="charts">
          <LineChart title="Velocidad v(t) en la Fase I" xLabel="Tiempo (s)" yLabel="v (m/s)" series={charts.v} height={220} />
          <LineChart title="Posición s(t) en la Fase I" xLabel="Tiempo (s)" yLabel="s (m)" series={charts.s} height={220} />
        </div>
      </div>
      <table className="summary">
        <thead><tr><th>Al terminar el empuje</th><th className="num">Analítico</th><th className="num">Euler</th><th className="num">Simulación</th></tr></thead>
        <tbody>
          <tr>
            <td>Velocidad <Eq tex={r`v(t_b)`} /></td>
            <td className="num">{format(v(tb), 2)} m/s</td>
            <td className="num">{format(last.v, 2)} m/s</td>
            <td className="num">{sim ? `${format(sim.v, 2)} m/s` : "–"}</td>
          </tr>
          <tr>
            <td>Posición <Eq tex={r`s(t_b)`} /></td>
            <td className="num">{format(s(tb), 2)} m</td>
            <td className="num">{format(last.s, 2)} m ({format(pct(last.s, s(tb)), 1)} %)</td>
            <td className="num">{sim ? `${format(sim.h, 2)} m` : "–"}</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">
        Como <Eq tex={r`dv/dt`} /> es constante, Euler acierta la velocidad exacta con cualquier paso. La posición no: Euler usa la velocidad del
        inicio de cada paso y se queda corto; al hacer <Eq tex={r`\Delta t`} /> más pequeño el error baja.{" "}
        {withDrag
          ? "La simulación incluye el arrastre (botón «Con arrastre (D)» en Física), por eso da un poco menos."
          : "Sin arrastre, la simulación y la solución analítica coinciden."}
      </p>
    </>
  );
}

function MotorMath({ design }: { design: EstesDesign }) {
  const m = motorFor(design.motor);
  const end = m.time[m.time.length - 1];
  const impulse = trapezoid(m.time, m.thrust);
  const propellant = design.motor.propellant / 1000;
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
  const m: Motor = motorFor(design.motor);
  const end = m.time[m.time.length - 1];
  const [t, setT] = useState(() => Math.min(0.3, end / 2));
  const i = Math.max(0, m.time.findIndex((x, k) => k + 1 < m.time.length && x <= t && m.time[k + 1] > t));
  const [t0, t1, f0, f1] = [m.time[i], m.time[i + 1] ?? m.time[i], m.thrust[i], m.thrust[i + 1] ?? m.thrust[i]];
  const ft = t1 > t0 ? f0 + ((f1 - f0) * (t - t0)) / (t1 - t0) : f0;
  const curve = useMemo(() => [{ label: m.model === "average" ? "Empuje promedio constante" : m.model === "measured" ? "Tu prueba estática" : `Tabla del ${m.name}`, points: thrustPoints(m), color: "#a35f2a", showPoints: m.model === "real", fill: true }], [m]);
  const marker = useMemo(() => [{ x: t, label: `t = ${t.toFixed(2)} s` }], [t]);
  if (m.model === "average") {
    return (
      <>
        <p>Con el empuje promedio la computadora no necesita una tabla: la fuerza es la misma durante todo el empuje y cero después.</p>
        <Eq block tex={r`T(t) = \begin{cases} \bar F = ${n(m.averageThrust, 2)}\ \text{N} & 0 \le t < ${n(end, 2)}\ \text{s} \\ 0 & t \ge ${n(end, 2)}\ \text{s} \end{cases}`} />
        <LineChart title="Empuje promedio constante: área = impulso" xLabel="Tiempo (s)" yLabel="Empuje (N)" series={curve} height={200} />
        <Code>{`
% Empuje promedio constante del motor ${m.name}
F_prom = ${n(m.averageThrust, 3)};   % N
t_b    = ${n(end, 3)};   % s, duración del empuje

T = F_prom*(t < t_b);                         % empuje en t (0 al terminar)
I = F_prom*t_b;                               % impulso: área del rectángulo
fprintf('Impulso total: %.2f N*s\\n', I);
        `}</Code>
      </>
    );
  }
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
