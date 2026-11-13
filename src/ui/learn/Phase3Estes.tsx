import { useMemo, useState } from "react";
import type { Design, EstesDesign } from "../../model";
import { motorFor } from "../../motor";
import { G } from "../../physics/atmosphere";
import { dragModel } from "../../physics/drag";
import { simulate, type FlightResult } from "../../physics/simulate";
import { format } from "../fields";
import { LineChart } from "../LineChart";
import { QTY, faded, nearest, within, type PhaseId } from "../phases";
import { Code, Eq, StageBlock, Think, n } from "./common";
import { ConstantS, ConstantV, TanhS, TanhV } from "./derivations";
import { RocketFreeBody, forceScale } from "./diagrams";
import { MethodTree } from "./Phase1Lesson";
import { phase2DragRef, phase2Model } from "./Phase2Estes";
import { MethodResults, MissingPhase, PhaseCharts, PhaseFacts, PhaseHeader, forceSeriesTec, phaseAverages, phaseOf, type MethodResult } from "./phaseCommon";

const r = String.raw;

/** Forces chart of the results: built from the samples on screen, so it follows the chart range buttons. */
const FORCES = { title: "Fuerzas y suma de fuerzas ΣF", yLabel: "Fuerza (N)", series: forceSeriesTec };

/** ρ and C_d for the phase III drag model come from a flight with drag while falling, even when the switch turns it off. */
export function phase3DragRef(d: EstesDesign, res: FlightResult) {
  const withDrag = d.motor.fallDrag === false ? simulate({ ...d, motor: { ...d.motor, fallDrag: true } }) : res;
  const ref = typeof withDrag === "string" ? res : withDrag;
  const ph = phaseOf(ref, 3);
  let fall = within(ref.samples, ph.from, ph.to).filter((x) => x.v < -0.5);
  // A very short fall has almost no samples moving: use the ones around the apogee.
  if (fall.length < 3) fall = within(ref.samples, ref.apogee.t - 0.3, ref.apogee.t + 0.3);
  const { rho, cd } = phaseAverages(d, fall);
  return { rho, cd };
}

/**
 * Numbers of the Rocket Tec phase III model (apogee → ejection): no thrust, constant mass (the same as phases I and II),
 * weight and optional drag, which now points UP because the rocket falls. The phase starts where phase II ends
 * (t_i = its t_f, v_i = 0) and ends when the ejection charge fires: t_f = t_b + delay.
 * Without drag: dv/dt = −g. With drag: dv/dt = −g + c·v², solved with tanh from rest.
 */
export function phase3Model(d: EstesDesign, res: FlightResult, ref2: { rho: number; cd: number }, ref3: { rho: number; cd: number }) {
  const M2 = phase2Model(d, res, ref2);
  const motor = motorFor(d.motor);
  const tb = M2.ti;
  const delay = motor.delay;
  const ti = M2.tf;
  const vi = 0; // the apogee: phase II ends when v = 0
  const si = M2.s(M2.tf);
  const tf = motor.burnTime + delay;
  const exists = tf > ti + 1e-6;
  const m = M2.m;
  const W = m * G;
  const withDrag = d.motor.fallDrag !== false;
  const A = dragModel(d).refArea;
  const { rho, cd } = ref3;
  const c = (rho * cd * A) / (2 * m); // 1/m
  const k = Math.sqrt(G * c); // 1/s
  const vt = Math.sqrt(G / c); // m/s, terminal speed without the parachute
  const v = (t: number) => (withDrag ? -vt * Math.tanh(k * (t - ti)) : vi - G * (t - ti));
  const s = (t: number) => (withDrag ? si - Math.log(Math.cosh(k * (t - ti))) / c : si + vi * (t - ti) - 0.5 * G * (t - ti) ** 2);
  /** Drag force with its sign (y up): against the velocity, so upward while falling. */
  const D = (vel: number) => (withDrag ? -0.5 * rho * cd * A * vel * Math.abs(vel) : 0);
  const F = (t: number) => -W + D(v(t));
  const dvdt = (t: number) => F(t) / m;
  return { M2, motor, tb, delay, ti, vi, si, tf, exists, m, W, withDrag, A, rho, cd, c, k, vt, v, s, D, F, dvdt };
}
type Model3 = ReturnType<typeof phase3Model>;

/** Euler steps for phase III from t_i to t_f; with drag the force depends on v. */
function euler3(M: Model3, dt: number, until = M.tf) {
  const pts = [{ t: M.ti, v: M.vi, s: M.si }];
  while (pts[pts.length - 1].t < until - 1e-9) {
    const p = pts[pts.length - 1];
    const h = Math.min(dt, until - p.t);
    const a = (-M.W + M.D(p.v)) / M.m;
    pts.push({ t: p.t + h, v: p.v + a * h, s: p.s + p.v * h });
  }
  return pts;
}

export function Phase3EstesLesson({ design: d, result: res, onPhase, onChange }: { design: EstesDesign; result: FlightResult; onPhase: (id: PhaseId) => void; onChange?: (d: Design) => void }) {
  const ref2 = useMemo(() => phase2DragRef(d, res), [d, res]);
  const ref3 = useMemo(() => phase3DragRef(d, res), [d, res]);
  const M = phase3Model(d, res, ref2, ref3);
  const ph = phaseOf(res, 3);
  const [t, setT] = useState(() => ph.from + (ph.to - ph.from) * 0.6);
  const sample = nearest(res.samples, Math.min(Math.max(t, ph.from), ph.to));
  const exists = M.exists && ph.exists;

  return (
    <div className="lesson">
      <PhaseHeader
        result={res} type={d.type}
        id={3}
        onPick={onPhase}
        intro={exists
          ? <>En el apogeo el cohete se detiene un instante y empieza a <b>caer</b>, todavía sin paracaídas. El motor sigue quemando su carga de retardo; la fase termina cuando la <b>carga de eyección</b> separa el cohete y saca el paracaídas, {format(M.delay, 0)} s después de que se acabó el empuje.</>
          : <>Del apogeo hasta la eyección. En este vuelo la eyección ocurre antes del apogeo, así que esta fase no existe.</>}
      />
      {!exists && (
        <MissingPhase type={d.type} id={3}>
          <p>La carga de eyección se activa a los <b>{format(M.tf, 2)} s</b> y el cohete llega al apogeo a los <b>{format(M.ti, 2)} s</b>: el paracaídas se abre mientras el cohete todavía sube.</p>
          <p>Para verla, el cohete tiene que llegar al apogeo en menos de {format(M.delay, 0)} s después de que se acaba el empuje (más masa o más arrastre).</p>
        </MissingPhase>
      )}
      <div className="lesson-grid">
        <StageBlock stage="fisica">
          <DelayBox M={M} />
          {exists && (
            <>
              <p>
                Ya no hay empuje. Sobre el cohete actúan el <b>peso</b> (<i>Weight</i>) hacia abajo y el <b>arrastre</b> (<i>Drag</i>), que se opone a la velocidad.
                Como ahora el cohete <b>baja</b>, el arrastre apunta <b>hacia arriba</b>: cambió de dirección respecto a la Fase II.
              </p>
              <FallModel design={d} onChange={onChange} m={M.m} />
              <ul>
                <li>En el apogeo <Eq tex={r`v = 0`} />, pero la aceleración <b>no</b> es cero: vale <Eq tex={r`-g`} />. Por eso el cohete no se queda quieto arriba.</li>
                <li>{M.withDrag
                  ? <>El peso lo acelera hacia abajo y el arrastre lo frena cada vez más conforme gana rapidez. Si cayera mucho tiempo, el arrastre igualaría al peso: la <b>velocidad terminal</b>, <Eq tex={r`v_t = ${n(M.vt, 1)}\ \text{m/s}`} />.</>
                  : <>Sin arrastre es una <b>caída libre</b>: la velocidad crece hacia abajo con <Eq tex={r`dv/dt = -g`} />, igual que una piedra que se suelta.</>}</li>
                <li>La fase termina cuando la carga de eyección separa el cohete y saca el paracaídas.</li>
              </ul>
              <div className="interactive">
                <label className="slider-label">
                  Diagrama de cuerpo libre en <b>t = {sample.t.toFixed(3)} s</b>
                  <input type="range" min={ph.from} max={ph.to} step={(ph.to - ph.from) / 300} value={t} onChange={(e) => setT(Number(e.target.value))} />
                </label>
                <div className="fbd-row fbd-row-rocket">
                  <RocketFreeBody sample={sample} cgFraction={res.stabilityLoaded.cg / (d.nose.length + d.body.length)} inverted forceMax={forceScale(within(res.samples, ph.from, ph.to))} />
                  <div className="fbd-equations">
                    <p className="hint">Las fuerzas salen del <b>centro de masa</b> (CM), el origen del marco de referencia <i>xy</i>. El eje <i>y</i> positivo apunta hacia arriba.</p>
                    <ul className="fbd-forces">
                      <li><Eq tex={r`W = mg = ${n(sample.mass * G, 3)}\ \text{N}`} /></li>
                      <li style={{ color: QTY.D }}><Eq tex={r`D = ${n(Math.abs(sample.drag), 3)}\ \text{N}`} /></li>
                      <li><Eq tex={r`v = ${n(sample.v, 2)}\ \text{m/s}`} /></li>
                    </ul>
                    <Eq block tex={r`m\,\frac{dv}{dt} = -W + D`} />
                    <Eq block tex={r`\frac{dv}{dt} = \frac{-${n(sample.mass * G, 3)} + ${n(Math.abs(sample.drag), 3)}}{${n(sample.mass, 4)}} = \mathbf{${n(sample.a, 2)}\ m/s^2}`} />
                  </div>
                </div>
              </div>
            </>
          )}
          <dl className="notation">
            <div><dt><i>W</i> (<i>Weight</i>)</dt><dd>Peso: la fuerza de gravedad sobre el cohete, <Eq tex={r`W = mg`} />, hacia abajo.</dd></div>
            <div><dt><i>D</i> (<i>Drag</i>)</dt><dd>Arrastre: siempre en contra de la velocidad. En esta fase apunta hacia arriba.</dd></div>
            <div><dt><Eq tex={r`v_t`} /></dt><dd>Velocidad terminal: la rapidez a la que el arrastre iguala al peso y el cohete deja de acelerar.</dd></div>
            <div><dt><Eq tex={r`t_b`} /></dt><dd>Tiempo en que se acaba el empuje (<i>burnout</i>).</dd></div>
          </dl>
        </StageBlock>

        {exists && (
          <StageBlock stage="matematicas">
            <Phase3Math M={M} />
          </StageBlock>
        )}

        {exists && (
          <StageBlock stage="computacion">
            <Phase3ModelComputation M={M} />
            <Phase3EulerComparison M={M} res={res} />
          </StageBlock>
        )}
      </div>

      {exists && (
        <section className="stage stage-resultados">
          <header>
            <span className="stage-n">4</span>
            <div>
              <h3>Fase III: Resultados</h3>
              <p className="stage-explain">Interpretamos los cambios del cohete en esta fase y verificamos si el modelo predice bien lo que se mide.</p>
            </div>
          </header>
          <div className="stage-body">
            <Phase3Results M={M} />
            <PhaseFacts result={res} type={d.type} id={3} />
            <PhaseCharts result={res} type={d.type} id={3} extra={FORCES} merge={1} />
            <Think>
              <ul>
                <li>En el apogeo <Eq tex={r`v = 0`} />. ¿Cuánto vale ahí <Eq tex={r`dv/dt`} />? ¿Por qué el cohete no se queda flotando?</li>
                <li>Compara el arrastre en la Fase II y en la Fase III: ¿hacia dónde apunta en cada una? ¿Por qué cambió?</li>
                <li>Cambia el botón de arrastre de esta fase: ¿cuánto cambia la velocidad en la separación? ¿Por qué tan poco en tan poco tiempo?</li>
                <li>¿Qué retardo haría que la eyección ocurriera justo en el apogeo? ¿Qué pasaría con un retardo de 5 s?</li>
                <li>Si la caída durara mucho, ¿la velocidad crecería sin límite? ¿Qué pasa cuando el arrastre iguala al peso?</li>
                <li>Las condiciones finales de la Fase III son las condiciones iniciales de la Fase IV. ¿Qué valores tendrán <code>FaseIV_vi</code> y <code>FaseIV_si</code>?</li>
              </ul>
            </Think>
          </div>
        </section>
      )}
    </div>
  );
}

/** "El retardo y la eyección": what the motor does after the thrust ends, with the numbers of this flight. */
function DelayBox({ M }: { M: Model3 }) {
  const ideal = M.ti - M.tb;
  return (
    <div className="maxq">
      <b>El retardo y la eyección</b>
      <p>
        El nombre del motor <b>{M.motor.name}</b> dice cuánto espera: el último número es el <b>retardo</b>, {format(M.delay, 0)} s. Cuando se acaba el
        propelente, el motor ya no empuja, pero sigue quemando una <b>carga de retardo</b> (deja la estela de humo). Al terminar, se enciende la{" "}
        <b>carga de eyección</b>: un pequeño estallido que empuja hacia adelante, separa la nariz del cuerpo y saca el paracaídas.
      </p>
      <Eq block tex={r`t_{eyección} = t_b + \text{retardo} = ${n(M.tb, 2)} + ${n(M.delay, 0)} = ${n(M.tf, 2)}\ \text{s}`} />
      <p>
        El retardo ideal es el tiempo que tarda el cohete en subir sin empuje (la Fase II): <Eq tex={r`t_{apogeo} - t_b = ${n(M.ti, 2)} - ${n(M.tb, 2)} = ${n(ideal, 2)}\ \text{s}`} />.
        {M.exists
          ? <> Como el retardo es más largo, el cohete <b>cae {format(M.tf - M.ti, 2)} s</b> sin paracaídas antes de la separación: esa es la Fase III.</>
          : <> Como el retardo es más corto, la eyección llega antes del apogeo y el paracaídas se abre mientras el cohete todavía sube rápido.</>}
      </p>
    </div>
  );
}

/** Phase III simplified model and its own switch for air drag. */
function FallModel({ design: d, onChange, m }: { design: EstesDesign; onChange?: (d: Design) => void; m: number }) {
  const withDrag = d.motor.fallDrag !== false;
  const set = (fallDrag: boolean) => fallDrag !== withDrag && onChange?.({ ...d, motor: { ...d.motor, fallDrag } });
  return (
    <div className="simplified-model">
      <b>Modelo simplificado de la Fase III</b>
      <ul>
        <li><b>Sin empuje:</b> el motor solo quema la carga de retardo, <Eq tex={r`T = 0`} />.</li>
        <li><b>Masa constante:</b> la misma de las fases I y II, <Eq tex={r`m = ${n(m * 1000, 1)}\ \text{g}`} />, así que el <b>peso</b> es constante: <Eq tex={r`W = mg`} />.</li>
        <li><b>Arrastre opcional:</b> puedes incluirlo o ignorarlo mientras el cohete cae sin paracaídas.</li>
      </ul>
      <div className="thrust-model" role="group" aria-label="Arrastre en la Fase III">
        <button type="button" className={`btn small ${withDrag ? "primary" : ""}`} aria-pressed={withDrag} disabled={!onChange} onClick={() => set(true)}
          title="El aire frena la caída. La solución usa la tangente hiperbólica (tanh).">
          Con arrastre (D)
        </button>
        <button type="button" className={`btn small ${!withDrag ? "primary" : ""}`} aria-pressed={!withDrag} disabled={!onChange} onClick={() => set(false)}
          title="Caída libre: solo actúa el peso y dv/dt = −g.">
          Sin arrastre
        </button>
      </div>
      <p className="hint">Se aplica a todos los cálculos de la Fase III y es independiente de los botones de las fases I y II.</p>
    </div>
  );
}

/** First card of the phase III results: analytic model and Euler (Δt = 0.01 s up to t_f, as in its MATLAB script). */
function Phase3Results({ M }: { M: Model3 }) {
  const { ti, vi, tf, withDrag } = M;
  const dt = 0.01;
  const end = useMemo(() => { const p = euler3(M, dt); return p[p.length - 1]; }, [M]);
  const cards: MethodResult[] = [
    { q: "F", label: `Suma de fuerzas${withDrag ? " en la separación" : ""}`, unit: "N", analytic: M.F(tf), euler: -M.W + M.D(end.v), digits: 2, sub: withDrag ? r`\textstyle\sum F = -W + D` : r`\textstyle\sum F = -W` },
    { q: "a", label: "Aceleración promedio", unit: "m/s²", analytic: (M.v(tf) - vi) / (tf - ti), euler: (end.v - vi) / (end.t - ti), digits: 2, sub: r`\Delta v / \Delta t` },
    { q: "v", label: "Velocidad en la separación", unit: "m/s", analytic: M.v(tf), euler: end.v, digits: 2, sub: r`v(t_f),\ t_f = ${n(tf, 2)}\ \text{s}` },
    { q: "s", label: "Posición en la separación", unit: "m", analytic: M.s(tf), euler: end.s, digits: 2, sub: r`s(t_f)`, hero: true },
  ];
  return (
    <MethodResults cards={cards} dt={dt} note={withDrag
      ? <>Con arrastre la aceleración cambia en cada paso; Euler usa la del inicio de cada paso y se equivoca un poco. Con pasos más pequeños se acerca al analítico.</>
      : <>Sin arrastre <Eq tex={r`\sum F / m = -g`} /> es constante: Euler acierta la velocidad, pero la posición se queda un poco arriba porque usa la velocidad del inicio de cada paso.</>} />
  );
}

function Phase3Math({ M }: { M: Model3 }) {
  const { ti, si, tf, m, W, withDrag, rho, cd, A, c, k, vt, v, s, tb, delay } = M;
  const dt = 0.01;
  const hand = euler3(M, dt, ti + 2 * dt);
  const [p0, p1, p2] = hand;
  const f4 = (x: number) => n(x, 4);
  const a0 = (-W + M.D(p0.v)) / m, a1 = (-W + M.D(p1.v)) / m;
  const vEnd = v(tf), sEnd = s(tf);
  const tree = [ti, ti + 0.1, ti + 0.2].map((t) => ({ t, v: v(t) }));

  return (
    <div className="derivation">
      <p>Queremos los <b>modelos</b> de la velocidad y la posición del cohete desde el apogeo hasta la separación{withDrag ? "." : ":"}</p>
      {!withDrag && <Eq block tex={r`v(t) = v_i + \frac{\sum F}{m}\,(t - t_i)`} />}
      <p>Igual que en las fases I y II, partimos de la <b>segunda ley de Newton</b> y de la definición de velocidad:</p>
      <Eq block tex={r`\frac{dv}{dt} = \frac{\sum F}{m} \qquad\qquad \frac{ds}{dt} = v`} />
      <p>
        La fase empieza en el apogeo, donde terminó la Fase II. Las <b>condiciones iniciales</b> son las condiciones finales de la Fase II (en el apogeo la
        velocidad es cero):
      </p>
      <Eq block tex={r`t_i = ${n(ti, 3)}\ \text{s} \qquad v_i = 0\ \text{m/s} \qquad s_i = ${n(si, 2)}\ \text{m}`} />
      <p>Otra vez hay dos formas de resolver la ecuación diferencial:</p>
      <MethodTree dvdt={0} rows={tree} formula={withDrag ? r`v(t) = -v_t\,\tanh\!\big(\sqrt{gc}\,(t - t_i)\big)` : r`v(t) = v_i + \dfrac{\sum F}{m}\,(t - t_i)`} />

      <h4><span className="step-n">1</span> La suma de fuerzas</h4>
      <p>Del diagrama de cuerpo libre, con el eje <i>y</i> positivo hacia arriba: no hay empuje, el peso resta {withDrag ? "y el arrastre suma, porque ahora apunta hacia arriba (el cohete baja)" : "y aquí ignoramos el arrastre"}.</p>
      {withDrag ? (
        <>
          <Eq block tex={r`\sum F = -W + D = -mg + \tfrac12\rho\,C_dA\,v^2`} />
          <p>Dividimos entre <Eq tex={r`m`} /> y, como en la Fase II, juntamos las constantes del arrastre en <Eq tex={r`c`} /> (con <Eq tex={r`\rho`} /> y <Eq tex={r`C_d`} /> promedio de esta fase):</p>
          <Eq block tex={r`\frac{dv}{dt} = -g + c\,v^2, \qquad c = \frac{\rho\,C_dA}{2m}`} />
          <p>Compara con la Fase II, <Eq tex={r`dv/dt = -g - c\,v^2`} />: solo cambió el signo del arrastre.</p>
        </>
      ) : (
        <>
          <Eq block tex={r`\sum F = -W = -mg \quad\Rightarrow\quad \frac{dv}{dt} = \frac{\sum F}{m} = -g`} />
          <p>Es la misma ecuación de la Fase II sin arrastre: el peso no cambia aunque el cohete ahora baje.</p>
        </>
      )}

      <h4><span className="step-n">2</span> Método analítico: v(t) por separación de variables</h4>
      {withDrag ? (
        <TanhV
          note={
            <p className="hint">
              Como <Eq tex={r`\tanh`} /> nunca pasa de 1, la rapidez nunca pasa de <Eq tex={r`v_t`} />: es la <b>velocidad terminal</b>, cuando <Eq tex={r`\sum F = 0`} /> (el arrastre
              iguala al peso). Para tiempos cortos <Eq tex={r`\tanh x \approx x`} /> y queda la caída libre <Eq tex={r`v \approx -g\,(t - t_i)`} />.
            </p>
          }
        />
      ) : (
        <ConstantV
          phase="Fase III"
          note={<p className="hint">Es el mismo modelo de las fases I y II. Aquí <Eq tex={r`v_i = 0`} /> y <Eq tex={r`\sum F / m = -g`} />: la velocidad se vuelve negativa (el cohete baja).</p>}
        />
      )}

      <h4><span className="step-n">3</span> Método analítico: s(t) a partir de v = ds/dt</h4>
      {withDrag ? <TanhS /> : <ConstantS phase="Fase III" />}

      <h4><span className="step-n">4</span> ¿Cuándo se separa?</h4>
      <p>
        Aquí no buscamos un instante en que algo valga cero: el final lo decide el motor. La carga de eyección se activa <Eq tex={r`${n(delay, 0)}\ \text{s}`} /> después
        de que se acaba el empuje:
      </p>
      <Eq block tex={r`t_f = t_b + \text{retardo} = ${n(tb, 3)} + ${n(delay, 0)} = ${n(tf, 3)}\ \text{s}`} />
      <p>Evaluamos los modelos en <Eq tex={r`t_f`} /> para saber cómo llega el cohete a la separación:</p>
      <div className="result-eq"><Eq block tex={r`v(t_f) = ${n(vEnd, 2)}\ \text{m/s} \qquad s(t_f) = ${n(sEnd, 2)}\ \text{m}`} /></div>

      <h4><span className="step-n">5</span> Método numérico: Euler en MATLAB</h4>
      <p>La regla de Euler es la misma de las fases anteriores: <i>«lo nuevo = lo que tenía + cuánto cambia en un paso»</i>.</p>
      <div className="result-eq"><Eq block tex={r`v_{n+1} = v_n + \frac{\sum F_n}{m}\,\Delta t \qquad\qquad s_{n+1} = s_n + v_n\,\Delta t`} /></div>
      {withDrag
        ? <p>Con arrastre la suma de fuerzas cambia en cada paso: <Eq tex={r`\sum F_n = -mg + \tfrac12\rho\,C_dA\,v_n^2`} />. Al principio <Eq tex={r`v_0 = 0`} /> y solo actúa el peso.</p>
        : <p>Aquí <Eq tex={r`\sum F_n / m = -g`} /> en todos los pasos.</p>}
      <p>Los dos primeros pasos a mano, con <Eq tex={r`\Delta t = 0.01\ \text{s}`} />, empezando en el apogeo:</p>
      <div className="euler-hand">
        <p><b>Paso 1:</b></p>
        <Eq block tex={r`v_1 = v_0 + \frac{\sum F_0}{m}\,\Delta t = ${n(p0.v, 2)} + (${n(a0, 2)})(0.01) = ${f4(p1.v)}\ \text{m/s}`} />
        <Eq block tex={r`s_1 = s_0 + v_0\,\Delta t = ${n(p0.s, 2)} + ${n(p0.v, 2)}(0.01) = ${f4(p1.s)}\ \text{m}`} />
        <p><b>Paso 2:</b></p>
        <Eq block tex={r`v_2 = v_1 + \frac{\sum F_1}{m}\,\Delta t = ${f4(p1.v)} + (${n(a1, 2)})(0.01) = ${f4(p2.v)}\ \text{m/s}`} />
        <Eq block tex={r`s_2 = s_1 + v_1\,\Delta t = ${f4(p1.s)} + (${f4(p1.v)})(0.01) = ${f4(p2.s)}\ \text{m}`} />
      </div>
      <p>
        <b>¿Cuándo parar?</b> Como en la Fase I, sabemos de antemano cuándo termina la fase (<Eq tex={r`t_f`} />), así que repetimos los pasos un número fijo de
        veces con un ciclo <code>for</code>.
      </p>
      <Code title="MATLAB · Fase III con el método de Euler">{`
% Fase III: Apogeo - Separación (sin empuje, masa constante${withDrag ? ", con arrastre" : ", sin arrastre"})

% 1. Datos: las condiciones iniciales vienen de la Fase II
FaseIII_vi = FaseII_VelocidadFinal;   % m/s (0 en el apogeo)
FaseIII_si = FaseII_PosicionFinal;    % m
FaseIII_ti = FaseII_tf;               % s
FaseIII_tf = FaseI_tf + ${n(delay, 0)};          % s, eyección = t_b + retardo
m  = FaseII_MasaCohete;               % kg, la misma masa
g  = 9.81;                            % m/s^2${withDrag ? `
rho = ${n(rho, 3)};                         % kg/m^3, densidad del aire (promedio)
Cd  = ${n(cd, 3)};                         % coeficiente de arrastre (promedio)
A   = ${n(A * 1e4, 3)}e-4;                     % m^2, área frontal` : ""}
dt = 0.01;                            % s, paso de tiempo
N  = round((FaseIII_tf - FaseIII_ti)/dt);   % número de pasos

% 2. Valores iniciales
t = zeros(1, N+1);  v = zeros(1, N+1);  s = zeros(1, N+1);
t(1) = FaseIII_ti;  v(1) = FaseIII_vi;  s(1) = FaseIII_si;

% 3. Regla de Euler
for k = 1:N
    SF = -m*g${withDrag ? " + 0.5*rho*Cd*A*v(k)^2" : ""};${withDrag ? "   % peso hacia abajo, arrastre hacia arriba" : "                   % solo el peso"}
    v(k+1) = v(k) + (SF/m)*dt;        % v_(n+1) = v_n + (SF/m)*dt
    s(k+1) = s(k) + v(k)*dt;          % s_(n+1) = s_n + v_n*dt
    t(k+1) = t(k) + dt;
end

% 4. Resultados: el último paso es la separación
fprintf('Separación: v = %.2f m/s, s = %.2f m\\n', v(end), s(end));
      `}</Code>

      <p className="hint">Los resultados de tu cohete, con los dos métodos, están al principio de la parte 4 · Resultados.</p>
      {withDrag && (
        <p className="hint">
          Con tus números: <Eq tex={r`c = \frac{(${n(rho, 3)})(${n(cd, 3)})(${n(A * 1e4, 2)}\times10^{-4})}{2(${n(m, 4)})} = ${n(c, 5)}\ \text{m}^{-1}`} />,{" "}
          <Eq tex={r`\sqrt{gc} = ${n(k, 4)}\ \text{s}^{-1}`} /> y <Eq tex={r`v_t = ${n(vt, 1)}\ \text{m/s}`} />.
        </p>
      )}
    </div>
  );
}

/** Phase III computation, part 1: the four charts of the analytic model and the MATLAB code that makes each one. */
function Phase3ModelComputation({ M }: { M: Model3 }) {
  const { ti, tf, withDrag, rho, cd, A, delay } = M;
  const charts = useMemo(() => {
    const ts = Array.from({ length: 81 }, (_, i) => ti + ((tf - ti) * i) / 80);
    const line = (f: (t: number) => number) => ts.map((t) => ({ x: t, y: f(t) }));
    return {
      v: [{ label: "v(t)", points: line(M.v), color: QTY.v }],
      s: [{ label: "s(t)", points: line(M.s), color: QTY.s }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ti, tf, withDrag, M.si, M.c]);
  const plot = (handle: string, title: string, yLabel: string) => `figure;
fplot(${handle}, FaseIII_Dominio, 'LineWidth', 1.5)
title('${title}')
xlabel('Tiempo (s)')
ylabel('${yLabel}')
grid on`;

  return (
    <>
      <h4 className="comp-step">Simulaciones v(t) y s(t)</h4>
      <p>
        La computadora evalúa los modelos de Matemáticas en todos los instantes de la Fase III, desde el apogeo en <Eq tex={r`t_i = ${n(ti, 2)}\ \text{s}`} /> hasta la
        separación en <Eq tex={r`t_f = ${n(tf, 2)}\ \text{s}`} />. Copia el script en MATLAB y córrelo: genera las gráficas de la velocidad y la posición.
      </p>
      <Code title="MATLAB · Fase III: Apogeo - Separación, v(t) y s(t)" scroll>{`
%% Fase III: Apogeo - Separación (sin empuje, masa constante${withDrag ? ", con arrastre" : ", sin arrastre"})
% Va después de los scripts de las fases I y II, porque usa sus resultados.
% Cada bloque marcado con %% es una sección: en MATLAB Live Script puedes
% correr cada sección por separado (Ctrl + Enter).

%% 1. Condiciones iniciales: las condiciones finales de la Fase II (el apogeo)
FaseIII_si = FaseII_PosicionFinal;                    % m
FaseIII_vi = FaseII_VelocidadFinal;                   % m/s (0 en el apogeo)
FaseIII_ti = FaseII_tf;                               % s, tiempo del vuelo
FaseIII_MasaCohete = FaseII_MasaCohete;               % kg, la misma masa

% Fuerzas (eje y positivo hacia arriba)
FaseIII_FuerzaMotor = 0;                              % N, solo quema el retardo
FaseIII_FuerzaPesoCohete = FaseIII_MasaCohete * (-9.81);${withDrag ? `
FaseIII_rho = ${n(rho, 3)};                                % kg/m^3
FaseIII_Cd  = ${n(cd, 3)};
FaseIII_A   = ${n(A * 1e4, 3)}e-4;                            % m^2
FaseIII_c   = FaseIII_rho*FaseIII_Cd*FaseIII_A/(2*FaseIII_MasaCohete);   % 1/m
FaseIII_k   = sqrt(9.81*FaseIII_c);                   % 1/s
FaseIII_vt  = sqrt(9.81/FaseIII_c);                   % m/s, velocidad terminal` : ""}

%% 2. Modelos de la velocidad y la posición
% Los modelos usan (t - FaseIII_ti): el tiempo que lleva la fase.${withDrag ? `
FaseIII_ModeloVt = @(t) -FaseIII_vt*tanh(FaseIII_k*(t - FaseIII_ti));
FaseIII_ModeloSt = @(t) FaseIII_si - (1/FaseIII_c)*log(cosh(FaseIII_k*(t - FaseIII_ti)));` : `
% Sin arrastre la suma de fuerzas y la aceleración son constantes.
FaseIII_SumFuerza = FaseIII_FuerzaMotor + FaseIII_FuerzaPesoCohete;   % N
FaseIII_Aceleracion = FaseIII_SumFuerza / FaseIII_MasaCohete;         % m/s^2
FaseIII_ModeloVt = @(t) FaseIII_vi + FaseIII_Aceleracion*(t - FaseIII_ti);
FaseIII_ModeloSt = @(t) FaseIII_si + FaseIII_vi*(t - FaseIII_ti) + (1/2)*FaseIII_Aceleracion*(t - FaseIII_ti).^2;`}

%% 3. Dominio: hasta la eyección
% La carga de eyección se activa "retardo" segundos después de que se
% acaba el empuje.
FaseIII_Retardo = ${n(delay, 0)};                        % s, el número final del motor
FaseIII_tf = FaseI_tf + FaseIII_Retardo;
FaseIII_Dominio = [FaseIII_ti FaseIII_tf];

%% 4. Gráfica de la velocidad v(t)
${plot("FaseIII_ModeloVt", "Fase III: v(t)", "Velocidad (m/s)")}

%% 5. Gráfica de la posición s(t)
${plot("FaseIII_ModeloSt", "Fase III: s(t)", "Posición (m)")}

%% 6. Condiciones finales (la separación)
% Sin punto y coma al final, MATLAB muestra el valor en la ventana de comandos.
% Deben salir los mismos resultados de Matemáticas:
%   velocidad   = ${format(M.v(tf), 2)} m/s
%   posición    = ${format(M.s(tf), 2)} m
% Estas condiciones finales son las condiciones iniciales de la Fase IV.
FaseIII_VelocidadFinal   = FaseIII_ModeloVt(FaseIII_Dominio(2))
FaseIII_PosicionFinal    = FaseIII_ModeloSt(FaseIII_Dominio(2))
      `}</Code>

      <h4 className="comp-step">Lo que debe salir en MATLAB</h4>
      <p>Al correr el script, MATLAB dibuja estas gráficas (aquí puedes ampliarlas y hacer zoom):</p>
      <div className="charts">
        <LineChart title="Velocidad v(t)" xLabel="Tiempo (s)" yLabel="v (m/s)" series={charts.v} height={220} yZero />
        <LineChart title="Posición s(t)" xLabel="Tiempo (s)" yLabel="s (m)" series={charts.s} height={220} />
      </div>
      <p className="hint">
        {withDrag
          ? <>La velocidad empieza en cero y se hace cada vez más negativa, pero cada vez más despacio: se acerca a la velocidad terminal <Eq tex={r`-v_t`} />. La posición baja desde el apogeo cada vez más rápido.</>
          : <>La velocidad es una <b>recta</b> que empieza en cero y baja, y la posición es una <b>parábola</b> que empieza en su punto más alto.</>}
      </p>
    </>
  );
}

/** Phase III computation, part 2: analytic model, Euler and the RPL simulation side by side. */
function Phase3EulerComparison({ M, res }: { M: Model3; res: FlightResult }) {
  const { ti, tf, withDrag } = M;
  const counts = [5, 10, 20, 50, 100, 500, 1000];
  const [N, setN] = useState(10);
  const dt = (tf - ti) / N;
  const dtLabel = `${Number(dt.toPrecision(3))}`;
  const dots = N <= 50;
  const euler = useMemo(() => euler3(M, dt), [M, dt]);
  const last = euler[euler.length - 1];
  const ph = phaseOf(res, 3);
  const sim = within(res.samples, ph.from, ph.to);
  const simLabel = withDrag ? "Simulación RPL (RK4, con arrastre)" : "Simulación RPL (RK4)";
  const charts = useMemo(() => {
    const ts = Array.from({ length: 61 }, (_, i) => ti + ((tf - ti) * i) / 60);
    return {
      v: [
        { label: "Analítico", points: ts.map((t) => ({ x: t, y: M.v(t) })), color: QTY.v, dashed: true },
        { label: `Euler, Δt = ${dtLabel} s`, points: euler.map((p) => ({ x: p.t, y: p.v })), color: QTY.v, showPoints: dots },
        { label: simLabel, points: sim.map((x) => ({ x: x.t, y: x.v })), color: faded(QTY.v) },
      ],
      s: [
        { label: "Analítico", points: ts.map((t) => ({ x: t, y: M.s(t) })), color: QTY.s, dashed: true },
        { label: `Euler, Δt = ${dtLabel} s`, points: euler.map((p) => ({ x: p.t, y: p.s })), color: QTY.s, showPoints: dots },
        { label: simLabel, points: sim.map((x) => ({ x: x.t, y: x.h })), color: faded(QTY.s) },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [euler, dtLabel, dots, simLabel, ti, tf, sim]);
  const pct = (a: number, b: number) => (b !== 0 ? ((a - b) / Math.abs(b)) * 100 : 0);
  const vEnd = M.v(tf), sEnd = M.s(tf);
  const ej = res.ejection;

  return (
    <>
      <h4 className="comp-step">Comparación de solución analítica vs numérica</h4>
      <p>Primero corre en MATLAB el script de Euler de Matemáticas y después este código: grafica los dos métodos juntos.</p>
      <Code title="MATLAB · comparar Euler con el modelo analítico">{`
% Corre antes el script de Euler de Matemáticas: crea los vectores t, v y s.
% Este código dibuja Euler (puntos) contra el modelo analítico (línea punteada).

tt = linspace(FaseIII_ti, FaseIII_tf, 200);
subplot(2,1,1); plot(t, v, 'o', tt, FaseIII_ModeloVt(tt), '--'); grid on;
ylabel('v (m/s)'); legend('Euler', 'Analítico');
subplot(2,1,2); plot(t, s, 'o', tt, FaseIII_ModeloSt(tt), '--'); grid on;
xlabel('Tiempo (s)'); ylabel('s (m)'); legend('Euler', 'Analítico');
      `}</Code>

      <h4 className="comp-step">Lo que debe salir en MATLAB</h4>
      <p>Escoge cuántos pasos usa Euler entre <Eq tex={r`t_i`} /> y <Eq tex={r`t_f`} /> y observa cómo se acerca a la solución analítica:</p>
      <div className="interactive">
        <div className="euler-steps">
          <span>Número de pasos de Euler:</span>
          <div className="euler-step-buttons" role="group" aria-label="Número de pasos de Euler">
            {counts.map((c) => (
              <button key={c} type="button" className={`btn small ${c === N ? "primary" : ""}`} aria-pressed={c === N} onClick={() => setN(c)}>{c}</button>
            ))}
          </div>
          <Eq tex={r`\Delta t = \frac{t_f - t_i}{N} = \frac{${n(tf - ti, 2)}\ \text{s}}{${N}} = ${dtLabel}\ \text{s}`} />
        </div>
        <div className="charts">
          <LineChart title="Velocidad v(t) en la Fase III" xLabel="Tiempo (s)" yLabel="v (m/s)" series={charts.v} height={220} />
          <LineChart title="Posición s(t) en la Fase III" xLabel="Tiempo (s)" yLabel="s (m)" series={charts.s} height={220} />
        </div>
      </div>
      <table className="summary">
        <thead><tr><th>En la separación</th><th className="num">Analítico</th><th className="num">Euler</th><th className="num">Simulación</th></tr></thead>
        <tbody>
          <tr>
            <td>Tiempo <Eq tex={r`t_f`} /></td>
            <td className="num">{format(tf, 2)} s</td>
            <td className="num">{format(last.t, 2)} s</td>
            <td className="num">{ej ? `${format(ej.t, 2)} s` : "–"}</td>
          </tr>
          <tr>
            <td>Velocidad <Eq tex={r`v(t_f)`} /></td>
            <td className="num q-v">{format(vEnd, 2)} m/s</td>
            <td className="num q-v">{format(last.v, 2)} m/s ({format(Math.abs(pct(last.v, vEnd)) < 0.05 ? 0 : pct(last.v, vEnd), 1)} %)</td>
            <td className="num q-v">{ej ? `${format(ej.v, 2)} m/s` : "–"}</td>
          </tr>
          <tr>
            <td>Posición <Eq tex={r`s(t_f)`} /></td>
            <td className="num q-s">{format(sEnd, 2)} m</td>
            <td className="num q-s">{format(last.s, 2)} m</td>
            <td className="num q-s">{ej ? `${format(ej.h, 2)} m` : "–"}</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">
        {withDrag
          ? "Con arrastre la aceleración cambia en cada paso, así que Euler se equivoca un poco; con más pasos el error baja. La simulación usa un C_d y una densidad que cambian, y sus fases anteriores pueden diferir del modelo: por eso no coincide exactamente."
          : "Sin arrastre dv/dt = −g es constante: Euler acierta la velocidad, pero la posición se queda un poco arriba porque usa la velocidad del inicio de cada paso, que es la más lenta del paso (el cohete va acelerando hacia abajo)."}
      </p>
    </>
  );
}
