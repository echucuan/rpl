import { layout } from "../../physics/geometry";
import { useMemo, useState } from "react";
import type { Design, EstesDesign } from "../../model";
import { G } from "../../physics/atmosphere";
import { dragModel } from "../../physics/drag";
import { simulate, type FlightResult } from "../../physics/simulate";
import { format } from "../fields";
import { LineChart } from "../LineChart";
import { QTY, faded, nearest, within, type PhaseId } from "../phases";
import { Code, Eq, StageBlock, Think, n } from "./common";
import { ConstantS, ConstantV, TanS, TanV } from "./derivations";
import { RocketFreeBody, forceScale } from "./diagrams";
import { MethodTree, averageModel } from "./Phase1Lesson";
import { MethodResults, PhaseCharts, PhaseFacts, PhaseHeader, forceSeriesTec, phaseAverages, phaseOf, type MethodResult } from "./phaseCommon";

const r = String.raw;

/** Forces chart of the results: built from the samples on screen, so it follows the "Solo Fase II / Fase I + Fase II" buttons. */
const FORCES = { title: "Fuerzas y suma de fuerzas ΣF", yLabel: "Fuerza (N)", series: forceSeriesTec };

/**
 * Numbers of the Rocket Tec phase II model (burnout → apogee): no thrust, constant mass (the same as phase I),
 * weight and optional drag. Time is the flight time: the phase starts at t_i = t_b and the formulas use (t − t_i).
 * Without drag: dv/dt = −g. With drag: dv/dt = −g − c·v², c = ρC_dA/(2m), solved with tan/arctan.
 */
export function phase2Model(d: EstesDesign, res: FlightResult, dragRef: { rho: number; cd: number }) {
  const ph = phaseOf(res, 2);
  const start = nearest(res.samples, ph.from);
  const average = d.motor.thrust === "average";
  // Initial conditions: the end of phase I (its formulas with the average thrust, the simulation with the real curve).
  const p1 = average ? averageModel(d, res) : null;
  const ti = p1 ? p1.tb : start.t;
  const vi = p1 ? p1.v(p1.tb) : start.v;
  const si = p1 ? p1.s(p1.tb) : start.h;
  const m = p1 ? p1.m : start.mass;
  const W = m * G;
  const withDrag = d.motor.coastDrag !== false;
  const A = dragModel(d).refArea;
  const { rho, cd } = dragRef;
  const c = (rho * cd * A) / (2 * m); // 1/m
  const q = Math.sqrt(G * c); // 1/s
  const phi = Math.atan(vi * Math.sqrt(c / G));
  const v = (t: number) => (withDrag ? Math.sqrt(G / c) * Math.tan(phi - q * (t - ti)) : vi - G * (t - ti));
  const s = (t: number) => (withDrag ? si + Math.log(Math.cos(phi - q * (t - ti)) / Math.cos(phi)) / c : si + vi * (t - ti) - 0.5 * G * (t - ti) ** 2);
  const D = (vel: number) => (withDrag ? 0.5 * rho * cd * A * vel * Math.abs(vel) : 0);
  const F = (t: number) => -W - D(v(t)); // N, sum of forces
  const dvdt = (t: number) => F(t) / m;
  const tf = withDrag ? ti + phi / q : ti + vi / G;
  return { ph, start, average, ti, vi, si, m, W, withDrag, A, rho, cd, c, q, phi, v, s, F, dvdt, tf, D };
}
type Model2 = ReturnType<typeof phase2Model>;

/** Euler steps for phase II from t_i to t_f; the force depends on v when there is drag. */
function euler2(M: Model2, dt: number, until = M.tf) {
  const pts = [{ t: M.ti, v: M.vi, s: M.si }];
  while (pts[pts.length - 1].t < until - 1e-9) {
    const p = pts[pts.length - 1];
    const h = Math.min(dt, until - p.t);
    const a = (-M.W - M.D(p.v)) / M.m;
    pts.push({ t: p.t + h, v: p.v + a * h, s: p.s + p.v * h });
  }
  return pts;
}

/** ρ and C_d for the phase II drag model come from a flight with drag in phase II, even when the switch turns it off. */
export function phase2DragRef(d: EstesDesign, res: FlightResult) {
  const withDrag = d.motor.coastDrag === false ? simulate({ ...d, motor: { ...d.motor, coastDrag: true } }) : res;
  const ref = typeof withDrag === "string" ? res : withDrag;
  const ph = phaseOf(ref, 2);
  const coast = within(ref.samples, ph.from, ph.to).filter((x) => x.v > 0.5);
  const { rho, cd } = phaseAverages(d, coast);
  return { rho, cd };
}

export function Phase2EstesLesson({ design: d, result: res, onPhase, onChange }: { design: EstesDesign; result: FlightResult; onPhase: (id: PhaseId) => void; onChange?: (d: Design) => void }) {
  const dragRef = useMemo(() => phase2DragRef(d, res), [d, res]);
  const M = phase2Model(d, res, dragRef);
  const { ph, start } = M;
  const [t, setT] = useState(() => ph.from + (ph.to - ph.from) * 0.2);
  const sample = nearest(res.samples, Math.min(Math.max(t, ph.from), ph.to));
  const qMax = 0.5 * start.density * start.v * start.v;

  return (
    <div className="lesson">
      <PhaseHeader
        result={res} type={d.type}
        id={2}
        onPick={onPhase}
        intro={<>Se acabó el empuje: el cohete sigue subiendo por inercia, pero el peso{M.withDrag ? " y el arrastre lo frenan" : " lo frena"}. La velocidad <b>disminuye</b> de {format(start.v, 1)} m/s hasta 0 en el <b>apogeo</b>, el punto más alto.</>}
      />
      <div className="lesson-grid">
        <StageBlock stage="fisica">
          <div className="maxq">
            <b>¿Qué es MaxQ?</b>
            <p>
              Mientras el cohete se mueve, el aire choca contra él. La <b>presión dinámica</b> <Eq tex={r`q`} /> mide qué tan fuerte «empuja» el aire contra el
              cohete; depende de la densidad del aire y del cuadrado de la rapidez:
            </p>
            <Eq block tex={r`q = \tfrac12\,\rho\,v^2`} />
            <p>
              La rapidez es máxima justo cuando se acaba el empuje, así que ahí <Eq tex={r`q`} /> es máxima: es el instante <b>MaxQ</b>, el de mayor esfuerzo
              aerodinámico sobre la estructura. En tu cohete: <Eq tex={r`q_{max} = \tfrac12(${n(start.density, 3)})(${n(start.v, 1)})^2 = ${n(qMax, 0)}\ \text{Pa}`} />.
              Desde ese momento el cohete frena, <Eq tex={r`q`} /> baja y la fase termina en el <b>apogeo</b>, donde <Eq tex={r`v = 0`} />.
            </p>
          </div>
          <p>
            Ya no hay empuje. Sobre el cohete actúan el <b>peso</b> (<i>Weight</i>) hacia abajo y el <b>arrastre</b> (<i>Drag</i>), que se opone a la velocidad: como el
            cohete todavía sube, el arrastre también apunta <b>hacia abajo</b>. Las dos fuerzas lo frenan.
          </p>
          <CoastModel design={d} onChange={onChange} m={M.m} />
          <ul>
            <li>La aceleración es negativa todo el tiempo: la velocidad disminuye.{M.withDrag ? " Con arrastre es más negativa que −g al principio (el arrastre es grande cuando va rápido) y se acerca a −g al llegar al apogeo." : " Sin arrastre vale exactamente −g: el cohete frena igual que una piedra lanzada hacia arriba."}</li>
            <li>La fase termina en el <b>apogeo</b>: la velocidad es cero y el cohete deja de subir.</li>          </ul>
          <div className="interactive">
            <label className="slider-label">
              Diagrama de cuerpo libre en <b>t = {sample.t.toFixed(3)} s</b>
              <input type="range" min={ph.from} max={ph.to} step={(ph.to - ph.from) / 300} value={t} onChange={(e) => setT(Number(e.target.value))} />
            </label>
            <div className="fbd-row fbd-row-rocket">
              <RocketFreeBody sample={sample} cgFraction={res.stabilityLoaded.cg / layout(d).length} forceMax={forceScale(within(res.samples, ph.from, ph.to))} />
              <div className="fbd-equations">
                <p className="hint">Las fuerzas salen del <b>centro de masa</b> (CM), el origen del marco de referencia <i>xy</i>. El eje <i>y</i> positivo apunta hacia arriba.</p>
                <ul className="fbd-forces">
                  <li><Eq tex={r`W = mg = ${n(sample.mass * G, 3)}\ \text{N}`} /></li>
                  <li style={{ color: QTY.D }}><Eq tex={r`D = ${n(Math.abs(sample.drag), 3)}\ \text{N}`} /></li>
                  <li><Eq tex={r`v = ${n(sample.v, 2)}\ \text{m/s}`} /></li>
                </ul>
                <Eq block tex={r`m\,\frac{dv}{dt} = -W - D`} />
                <Eq block tex={r`\frac{dv}{dt} = \frac{-${n(sample.mass * G, 3)} - ${n(Math.abs(sample.drag), 3)}}{${n(sample.mass, 4)}} = \mathbf{${n(sample.a, 2)}\ m/s^2}`} />
              </div>
            </div>
          </div>
          <dl className="notation">
            <div><dt><i>W</i> (<i>Weight</i>)</dt><dd>Peso: la fuerza de gravedad sobre el cohete, <Eq tex={r`W = mg`} />, hacia abajo.</dd></div>
            <div><dt><i>D</i> (<i>Drag</i>)</dt><dd>Arrastre: la resistencia del aire, siempre en contra de la velocidad. Crece con el cuadrado de la velocidad.</dd></div>
            <div><dt><i>q</i></dt><dd>Presión dinámica: <Eq tex={r`\tfrac12\rho v^2`} />, en pascales (Pa). MaxQ es su valor máximo.</dd></div>
            <div><dt><i>dv/dt</i></dt><dd>Aceleración: cuánto cambia la velocidad en cada segundo, en m/s².</dd></div>
          </dl>
        </StageBlock>

        <StageBlock stage="matematicas">
          <Phase2Math M={M} />
        </StageBlock>

        <StageBlock stage="computacion">
          <Phase2ModelComputation M={M} />
          <Phase2EulerComparison M={M} res={res} />
        </StageBlock>
      </div>

      <section className="stage stage-resultados">
        <header>
          <span className="stage-n">4</span>
          <div>
            <h3>Fase II: Resultados</h3>
            <p className="stage-explain">Interpretamos los cambios del cohete en esta fase y verificamos si el modelo predice bien lo que se mide.</p>
          </div>
        </header>
        <div className="stage-body">
          <Phase2Results M={M} />
          <PhaseFacts result={res} type={d.type} id={2} />
          <PhaseCharts result={res} type={d.type} id={2} extra={FORCES} merge />
          <Think>
            <ul>
              <li>Al terminar el empuje, <i>dv/dt</i> cambia de golpe de positiva a negativa. ¿Qué fuerza desapareció? ¿Cambia la dirección de la velocidad en ese instante?</li>
              <li>Sin arrastre, <Eq tex={r`dv/dt = -g`} /> no depende de la masa. ¿Llegaría al mismo apogeo un cohete más pesado con la misma velocidad inicial? ¿Y con arrastre?</li>
              <li>Cambia el botón de arrastre de esta fase: ¿cuántos metros de apogeo le quita el aire a tu cohete? ¿Qué porcentaje es?</li>
              <li>Sin arrastre, la velocidad baja en línea recta. ¿Por qué con arrastre la curva baja más rápido al principio y más despacio al final?</li>
              <li>¿Qué tiene que pasar para que el paracaídas se abra justo en el apogeo? Compara el tiempo de esta fase con el retardo del motor (3 s).</li>
              <li>Las condiciones finales de la Fase II son las condiciones iniciales de la Fase III. ¿Qué valores tendrán <code>FaseIII_vi</code> y <code>FaseIII_si</code>?</li>
            </ul>
          </Think>
        </div>
      </section>
    </div>
  );
}

/** Phase II simplified model and its own switch for air drag. */
function CoastModel({ design: d, onChange, m }: { design: EstesDesign; onChange?: (d: Design) => void; m: number }) {
  const withDrag = d.motor.coastDrag !== false;
  const set = (coastDrag: boolean) => coastDrag !== withDrag && onChange?.({ ...d, motor: { ...d.motor, coastDrag } });
  return (
    <div className="simplified-model">
      <b>Modelo simplificado de la Fase II</b>
      <ul>
        <li><b>Sin empuje:</b> el motor ya no empuja, <Eq tex={r`T = 0`} />.</li>
        <li><b>Masa constante:</b> la misma de la Fase I, <Eq tex={r`m = ${n(m * 1000, 1)}\ \text{g}`} />, así que el <b>peso</b> es constante: <Eq tex={r`W = mg`} />.</li>
        <li><b>Arrastre opcional:</b> puedes incluirlo o ignorarlo mientras el cohete sube al apogeo.</li>
      </ul>
      <div className="thrust-model" role="group" aria-label="Arrastre en la Fase II">
        <button type="button" className={`btn small ${withDrag ? "primary" : ""}`} aria-pressed={withDrag} disabled={!onChange} onClick={() => set(true)}
          title="El aire frena al cohete mientras sube. Es más realista; la solución usa tangente y arcotangente.">
          Con arrastre (D)
        </button>
        <button type="button" className={`btn small ${!withDrag ? "primary" : ""}`} aria-pressed={!withDrag} disabled={!onChange} onClick={() => set(false)}
          title="Ignora la resistencia del aire: solo actúa el peso y el cohete frena con dv/dt = −g. El apogeo predicho será más alto que el real.">
          Sin arrastre
        </button>
      </div>
      <p className="hint">Se aplica a todos los cálculos de la Fase II y es independiente del botón de la Fase I.</p>
    </div>
  );
}

/** First card of the phase II results: analytic model and Euler (Δt = 0.01 s, while v > 0, as in its MATLAB script). */
function Phase2Results({ M }: { M: Model2 }) {
  const { ti, vi, tf, withDrag } = M;
  const dt = 0.01;
  const end = useMemo(() => {
    let p = { t: ti, v: vi, s: M.si };
    for (let k = 0; p.v > 0 && k < 100000; k++) {
      const a = (-M.W - M.D(p.v)) / M.m;
      p = { t: p.t + dt, v: p.v + a * dt, s: p.s + p.v * dt };
    }
    return p;
  }, [M, ti, vi]);
  const avg = (v1: number, t1: number) => (t1 > ti ? (v1 - vi) / (t1 - ti) : 0);
  const cards: MethodResult[] = [
    { q: "F", label: `Suma de fuerzas${withDrag ? " al inicio" : ""}`, unit: "N", analytic: M.F(ti), euler: -M.W - M.D(vi), digits: 2, sub: withDrag ? r`\textstyle\sum F = -W - D` : r`\textstyle\sum F = -W` },
    { q: "a", label: "Aceleración promedio", unit: "m/s²", analytic: avg(0, tf), euler: avg(end.v, end.t), digits: 2, sub: r`\Delta v / \Delta t` },
    { q: "n", label: "Tiempo hasta el apogeo", unit: "s", analytic: tf - ti, euler: end.t - ti, digits: 2, sub: r`t_f - t_i,\ t_f = ${n(tf, 2)}\ \text{s}` },
    { q: "s", label: "Apogeo", unit: "m", analytic: M.s(tf), euler: end.s, digits: 2, sub: r`s_{max} = s(t_f)`, hero: true },
  ];
  return (
    <MethodResults cards={cards} dt={dt} note={<>
      Euler para en el primer paso en que la velocidad ya no es positiva, así que su tiempo puede pasarse hasta un paso ({dt} s). Con pasos más pequeños se acerca al analítico.
    </>} />
  );
}

function Phase2Math({ M }: { M: Model2 }) {
  const { ti, vi, si, m, W, withDrag, rho, cd, A, c, q, phi, v } = M;
  const dt = 0.01;
  const hand = euler2(M, dt, ti + 2 * dt);
  const [p0, p1, p2] = hand;
  const f4 = (x: number) => n(x, 4);
  const a0 = (-W - M.D(p0.v)) / m, a1 = (-W - M.D(p1.v)) / m;
  const tree = [ti, ti + 0.1, ti + 0.2].map((t) => ({ t, v: v(t) }));

  return (
    <div className="derivation">
      <p>Queremos los <b>modelos</b> de la velocidad y la posición del cohete desde que se acaba el empuje hasta el apogeo{withDrag ? "." : ":"}</p>
      {!withDrag && <Eq block tex={r`v(t) = v_i + \frac{\sum F}{m}\,(t - t_i)`} />}
      <p>Igual que en la Fase I, partimos de la <b>segunda ley de Newton</b> y de la definición de velocidad:</p>
      <Eq block tex={r`\frac{dv}{dt} = \frac{\sum F}{m} \qquad\qquad \frac{ds}{dt} = v`} />
      <p>
        Usamos el <b>tiempo del vuelo</b>: la fase empieza en <Eq tex={r`t_i = t_b`} /> y <Eq tex={r`(t - t_i)`} /> es el tiempo que lleva la fase. Las{" "}
        <b>condiciones iniciales</b> son las condiciones finales de la Fase I:
      </p>
      <Eq block tex={r`t_i = ${n(ti, 3)}\ \text{s} \qquad v_i = ${n(vi, 2)}\ \text{m/s} \qquad s_i = ${n(si, 2)}\ \text{m}`} />
      <p>Otra vez hay dos formas de resolver la ecuación diferencial:</p>
      <MethodTree dvdt={0} rows={tree} formula={withDrag ? r`v(t) = \sqrt{\tfrac{g}{c}}\,\tan\!\big(\varphi - \sqrt{gc}\,(t - t_i)\big)` : r`v(t) = v_i + \dfrac{\sum F}{m}\,(t - t_i)`} />

      <h4><span className="step-n">1</span> La suma de fuerzas</h4>
      <p>Del diagrama de cuerpo libre, con el eje <i>y</i> positivo hacia arriba: ya no hay empuje y {withDrag ? "el peso y el arrastre restan (los dos apuntan hacia abajo mientras sube)" : "el peso resta (aquí ignoramos el arrastre)"}.</p>
      {withDrag ? (
        <>
          <Eq block tex={r`\sum F = -W - D = -mg - \tfrac12\rho\,C_dA\,v^2`} />
          <p>Dividimos entre <Eq tex={r`m`} /> y juntamos las constantes del arrastre en una sola letra <Eq tex={r`c`} />. Tomamos <Eq tex={r`\rho`} /> y <Eq tex={r`C_d`} /> constantes (sus promedios en esta fase):</p>
          <Eq block tex={r`\frac{dv}{dt} = -g - c\,v^2, \qquad c = \frac{\rho\,C_dA}{2m}`} />
          <p>La suma de fuerzas <b>ya no es constante</b>: depende de <Eq tex={r`v`} />. Por eso la solución es más elaborada que en la Fase I.</p>
        </>
      ) : (
        <>
          <Eq block tex={r`\sum F = -W = -mg \quad\Rightarrow\quad \frac{dv}{dt} = \frac{\sum F}{m} = -g`} />
          <p>La suma de fuerzas es <b>constante</b> y la masa se cancela: todos los cuerpos frenan igual, <Eq tex={r`dv/dt = -g`} />.</p>
        </>
      )}

      <h4><span className="step-n">2</span> Método analítico: v(t) por separación de variables</h4>
      {withDrag ? (
        <TanV />
      ) : (
        <ConstantV
          phase="Fase II"
          note={<p className="hint">Es el mismo modelo de la Fase I. Lo único nuevo es <Eq tex={r`(t - t_i)`} />: el reloj de la fase empieza en <Eq tex={r`t_i`} />, no en cero. Aquí <Eq tex={r`\sum F / m = -g`} /> es negativo, por eso la velocidad baja.</p>}
        />
      )}

      <h4><span className="step-n">3</span> Método analítico: s(t) a partir de v = ds/dt</h4>
      {withDrag ? <TanS /> : <ConstantS phase="Fase II" />}

      <h4><span className="step-n">4</span> ¿Cuándo llega al apogeo?</h4>
      <p>En el apogeo el cohete deja de subir: <Eq tex={r`v(t_f) = 0`} />. Despejamos el tiempo final <Eq tex={r`t_f`} />:</p>
      {withDrag ? (
        <>
          <Eq block tex={r`\tan\!\Big(\varphi - \sqrt{gc}\,(t_f - t_i)\Big) = 0 \quad\Rightarrow\quad \varphi - \sqrt{gc}\,(t_f - t_i) = 0 \quad\Rightarrow\quad t_f = t_i + \frac{\varphi}{\sqrt{gc}}`} />
          <p>Y el apogeo es la posición en ese instante. Como <Eq tex={r`\frac{1}{\cos^2\varphi} = 1 + \tan^2\varphi`} />:</p>
          <div className="result-eq"><Eq block tex={r`s_{max} = s(t_f) = s_i + \frac{1}{2c}\,\ln\!\left(1 + \frac{c\,v_i^2}{g}\right)`} /></div>
        </>
      ) : (
        <>
          <Eq block tex={r`0 = v_i + \frac{\sum F}{m}\,(t_f - t_i) \quad\Rightarrow\quad t_f = t_i - \frac{v_i}{\sum F / m} = t_i + \frac{v_i}{g}`} />
          <p>Y el apogeo es la posición en ese instante:</p>
          <div className="result-eq"><Eq block tex={r`s_{max} = s(t_f) = s_i + \frac{v_i^2}{2g}`} /></div>
          <p className="hint">Es la conservación de la energía: toda la energía cinética <Eq tex={r`\tfrac12 m v_i^2`} /> se convierte en energía potencial <Eq tex={r`mg\,(s_{max} - s_i)`} />.</p>
        </>
      )}

      <h4><span className="step-n">5</span> Método numérico: Euler en MATLAB</h4>
      <p>La regla de Euler es la misma de la Fase I: <i>«lo nuevo = lo que tenía + cuánto cambia en un paso»</i>.</p>
      <div className="result-eq"><Eq block tex={r`v_{n+1} = v_n + \frac{\sum F_n}{m}\,\Delta t \qquad\qquad s_{n+1} = s_n + v_n\,\Delta t`} /></div>
      {withDrag
        ? <p>Lo nuevo es que la suma de fuerzas cambia en cada paso, porque el arrastre depende de la velocidad: <Eq tex={r`\sum F_n = -mg - \tfrac12\rho\,C_dA\,v_n^2`} />. Para Euler eso no es problema: solo usa la velocidad que ya conoce.</p>
        : <p>Aquí <Eq tex={r`\sum F_n / m = -g`} /> en todos los pasos.</p>}
      <p>Los dos primeros pasos a mano, con <Eq tex={r`\Delta t = 0.01\ \text{s}`} />, empezando en <Eq tex={r`t_0 = t_i`} />, <Eq tex={r`v_0 = v_i`} />, <Eq tex={r`s_0 = s_i`} />:</p>
      <div className="euler-hand">
        <p><b>Paso 1:</b></p>
        <Eq block tex={r`v_1 = v_0 + \frac{\sum F_0}{m}\,\Delta t = ${n(p0.v, 2)} + (${n(a0, 2)})(0.01) = ${f4(p1.v)}\ \text{m/s}`} />
        <Eq block tex={r`s_1 = s_0 + v_0\,\Delta t = ${n(p0.s, 2)} + ${n(p0.v, 2)}(0.01) = ${f4(p1.s)}\ \text{m}`} />
        <p><b>Paso 2:</b></p>
        <Eq block tex={r`v_2 = v_1 + \frac{\sum F_1}{m}\,\Delta t = ${f4(p1.v)} + (${n(a1, 2)})(0.01) = ${f4(p2.v)}\ \text{m/s}`} />
        <Eq block tex={r`s_2 = s_1 + v_1\,\Delta t = ${f4(p1.s)} + ${f4(p1.v)}(0.01) = ${f4(p2.s)}\ \text{m}`} />
      </div>
      <p>
        <b>¿Cuándo parar?</b> En la Fase I sabíamos que el empuje duraba <Eq tex={r`t_b`} />. Aquí no sabemos de antemano cuánto dura la fase: repetimos los
        pasos <b>mientras la velocidad sea positiva</b> (un ciclo <code>while</code>). Cuando deja de serlo, llegamos al apogeo.
      </p>
      <Code title="MATLAB · Fase II con el método de Euler">{`
% Fase II: MaxQ - Apogeo (sin empuje, masa constante${withDrag ? ", con arrastre" : ", sin arrastre"})

% 1. Datos: las condiciones iniciales vienen de la Fase I
FaseII_vi = FaseI_VelocidadFinal;   % m/s
FaseII_si = FaseI_PosicionFinal;    % m
FaseII_ti = FaseI_tf;               % s
m  = FaseI_MasaCohete;              % kg, la misma masa de la Fase I
g  = 9.81;                          % m/s^2${withDrag ? `
rho = ${n(rho, 3)};                       % kg/m^3, densidad del aire (promedio)
Cd  = ${n(cd, 3)};                       % coeficiente de arrastre (promedio)
A   = ${n(A * 1e4, 3)}e-4;                   % m^2, área frontal` : ""}
dt = 0.01;                          % s, paso de tiempo

% 2. Valores iniciales
t = FaseII_ti;  v = FaseII_vi;  s = FaseII_si;

% 3. Regla de Euler mientras el cohete sube
k = 1;
while v(k) > 0
    SF = -m*g${withDrag ? " - 0.5*rho*Cd*A*v(k)^2" : ""};${withDrag ? "   % peso y arrastre" : "                   % solo el peso"}
    v(k+1) = v(k) + (SF/m)*dt;      % v_(n+1) = v_n + (SF/m)*dt
    s(k+1) = s(k) + v(k)*dt;        % s_(n+1) = s_n + v_n*dt
    t(k+1) = t(k) + dt;
    k = k + 1;
end

% 4. Resultados: el último paso es el apogeo
fprintf('Apogeo: %.2f m a los %.2f s\\n', s(end), t(end));
      `}</Code>

      <p className="hint">Los resultados de tu cohete, con los dos métodos, están al principio de la parte 4 · Resultados.</p>
      {withDrag && (
        <p className="hint">
          Con tus números: <Eq tex={r`c = \frac{(${n(rho, 3)})(${n(cd, 3)})(${n(A * 1e4, 2)}\times10^{-4})}{2(${n(m, 4)})} = ${n(c, 5)}\ \text{m}^{-1}`} />,{" "}
          <Eq tex={r`\sqrt{gc} = ${n(q, 4)}\ \text{s}^{-1}`} /> y <Eq tex={r`\varphi = ${n(phi, 4)}\ \text{rad}`} />.
        </p>
      )}
    </div>
  );
}

/** Phase II computation, part 1: the four charts of the analytic model and the MATLAB code that makes each one. */
function Phase2ModelComputation({ M }: { M: Model2 }) {
  const { ti, tf, withDrag, rho, cd, A } = M;
  const charts = useMemo(() => {
    const ts = Array.from({ length: 81 }, (_, i) => ti + ((tf - ti) * i) / 80);
    const line = (f: (t: number) => number) => ts.map((t) => ({ x: t, y: f(t) }));
    return {
      v: [{ label: "v(t)", points: line(M.v), color: QTY.v }],
      s: [{ label: "s(t)", points: line(M.s), color: QTY.s }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ti, tf, withDrag, M.vi, M.si, M.c]);
  const plot = (handle: string, title: string, yLabel: string) => `figure;
fplot(${handle}, FaseII_Dominio, 'LineWidth', 1.5)
title('${title}')
xlabel('Tiempo (s)')
ylabel('${yLabel}')
grid on`;

  return (
    <>
      <h4 className="comp-step">Simulaciones v(t) y s(t)</h4>
      <p>
        La computadora evalúa los modelos de Matemáticas en todos los instantes de la Fase II, desde <Eq tex={r`t_i = ${n(ti, 2)}\ \text{s}`} /> hasta el
        apogeo en <Eq tex={r`t_f = ${n(tf, 2)}\ \text{s}`} />. Copia el script en MATLAB y córrelo: genera las gráficas de la velocidad y la posición.
      </p>
      <Code title="MATLAB · Fase II: MaxQ - Apogeo, v(t) y s(t)" scroll>{`
%% Fase II: MaxQ - Apogeo (sin empuje, masa constante${withDrag ? ", con arrastre" : ", sin arrastre"})
% Va después del script de la Fase I, porque usa sus resultados.
% Cada bloque marcado con %% es una sección: en MATLAB Live Script puedes
% correr cada sección por separado (Ctrl + Enter).

%% 1. Condiciones iniciales: las condiciones finales de la Fase I
FaseII_si = FaseI_PosicionFinal;                    % m
FaseII_vi = FaseI_VelocidadFinal;                   % m/s
FaseII_ti = FaseI_tf;                               % s, tiempo del vuelo
FaseII_MasaCohete = FaseI_MasaCohete;               % kg, la misma masa

% Fuerzas (eje y positivo hacia arriba)
FaseII_FuerzaMotor = 0;                             % N, ya no hay empuje
FaseII_FuerzaPesoCohete = FaseII_MasaCohete * (-9.81);${withDrag ? `
FaseII_rho = ${n(rho, 3)};                               % kg/m^3
FaseII_Cd  = ${n(cd, 3)};
FaseII_A   = ${n(A * 1e4, 3)}e-4;                           % m^2
FaseII_c   = FaseII_rho*FaseII_Cd*FaseII_A/(2*FaseII_MasaCohete);   % 1/m
FaseII_phi = atan(FaseII_vi*sqrt(FaseII_c/9.81));   % rad
FaseII_q   = sqrt(9.81*FaseII_c);                   % 1/s` : ""}

%% 2. Modelos de la velocidad y la posición
% Como usamos el tiempo del vuelo, los modelos tienen (t - FaseII_ti):
% el tiempo que lleva la fase.${withDrag ? `
FaseII_ModeloVt = @(t) sqrt(9.81/FaseII_c)*tan(FaseII_phi - FaseII_q*(t - FaseII_ti));
FaseII_ModeloSt = @(t) FaseII_si + (1/FaseII_c)*log(cos(FaseII_phi - FaseII_q*(t - FaseII_ti))/cos(FaseII_phi));` : `
% Sin arrastre la suma de fuerzas y la aceleración son constantes.
FaseII_SumFuerza = FaseII_FuerzaMotor + FaseII_FuerzaPesoCohete;   % N
FaseII_Aceleracion = FaseII_SumFuerza / FaseII_MasaCohete;         % m/s^2
FaseII_ModeloVt = @(t) FaseII_vi + FaseII_Aceleracion*(t - FaseII_ti);
FaseII_ModeloSt = @(t) FaseII_si + FaseII_vi*(t - FaseII_ti) + (1/2)*FaseII_Aceleracion*(t - FaseII_ti).^2;`}

%% 3. Dominio: hasta el apogeo
% El apogeo es cuando v = 0
FaseII_tf = ${withDrag ? "FaseII_ti + FaseII_phi/FaseII_q" : "FaseII_ti - FaseII_vi/FaseII_Aceleracion"};
FaseII_Dominio = [FaseII_ti FaseII_tf];

%% 4. Gráfica de la velocidad v(t)
${plot("FaseII_ModeloVt", "Fase II: v(t)", "Velocidad (m/s)")}

%% 5. Gráfica de la posición s(t)
${plot("FaseII_ModeloSt", "Fase II: s(t)", "Posición (m)")}

%% 6. Condiciones finales
% Sin punto y coma al final, MATLAB muestra el valor en la ventana de comandos.
% Deben salir los mismos resultados de Matemáticas:
%   velocidad   = 0 m/s (el apogeo)
%   posición    = ${format(M.s(tf), 2)} m
% Estas condiciones finales son las condiciones iniciales de la Fase III.
FaseII_VelocidadFinal   = FaseII_ModeloVt(FaseII_Dominio(2))
FaseII_PosicionFinal    = FaseII_ModeloSt(FaseII_Dominio(2))
      `}</Code>

      <h4 className="comp-step">Lo que debe salir en MATLAB</h4>
      <p>Al correr el script, MATLAB dibuja estas gráficas (aquí puedes ampliarlas y hacer zoom):</p>
      <div className="charts">
        <LineChart title="Velocidad v(t)" xLabel="Tiempo (s)" yLabel="v (m/s)" series={charts.v} height={220} />
        <LineChart title="Posición s(t)" xLabel="Tiempo (s)" yLabel="s (m)" series={charts.s} height={220} />
      </div>
      <p className="hint">
        {withDrag
          ? <>La velocidad baja hasta cero, primero rápido (el arrastre ayuda a frenar) y luego casi como una recta; la posición sube y se aplana en el apogeo, donde su pendiente es cero.</>
          : <>La velocidad es una <b>recta</b> que baja hasta cero (la aceleración es constante, <Eq tex={r`-g`} />) y la posición es una <b>parábola</b> que se aplana en el apogeo, su punto más alto.</>}
      </p>
    </>
  );
}

/** Phase II computation, part 2: analytic model, Euler and the RPL simulation side by side. */
function Phase2EulerComparison({ M, res }: { M: Model2; res: FlightResult }) {
  const { ti, tf, withDrag } = M;
  const counts = [5, 10, 20, 50, 100, 500, 1000];
  const [N, setN] = useState(10);
  const dt = (tf - ti) / N;
  const dtLabel = `${Number(dt.toPrecision(3))}`;
  const dots = N <= 50;
  const euler = useMemo(() => euler2(M, dt), [M, dt]);
  const last = euler[euler.length - 1];
  const ph = M.ph;
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
  const pct = (a: number, b: number) => (b !== 0 ? ((a - b) / b) * 100 : 0);
  const sMax = M.s(tf);

  return (
    <>
      <h4 className="comp-step">Comparación de solución analítica vs numérica</h4>
      <p>Primero corre en MATLAB el script de Euler de Matemáticas y después este código: grafica los dos métodos juntos.</p>
      <Code title="MATLAB · comparar Euler con el modelo analítico">{`
% Corre antes el script de Euler de Matemáticas: crea los vectores t, v y s.
% Este código dibuja Euler (puntos) contra el modelo analítico (línea punteada).

tt = linspace(FaseII_ti, FaseII_tf, 200);
subplot(2,1,1); plot(t, v, 'o', tt, FaseII_ModeloVt(tt), '--'); grid on;
ylabel('v (m/s)'); legend('Euler', 'Analítico');
subplot(2,1,2); plot(t, s, 'o', tt, FaseII_ModeloSt(tt), '--'); grid on;
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
          <LineChart title="Velocidad v(t) en la Fase II" xLabel="Tiempo (s)" yLabel="v (m/s)" series={charts.v} height={220} />
          <LineChart title="Posición s(t) en la Fase II" xLabel="Tiempo (s)" yLabel="s (m)" series={charts.s} height={220} />
        </div>
      </div>
      <table className="summary">
        <thead><tr><th>En el apogeo</th><th className="num">Analítico</th><th className="num">Euler</th><th className="num">Simulación</th></tr></thead>
        <tbody>
          <tr>
            <td>Tiempo <Eq tex={r`t_f`} /></td>
            <td className="num">{format(tf, 2)} s</td>
            <td className="num">{format(last.t, 2)} s</td>
            <td className="num">{format(res.apogee.t, 2)} s</td>
          </tr>
          <tr>
            <td>Apogeo <Eq tex={r`s(t_f)`} /></td>
            <td className="num">{format(sMax, 2)} m</td>
            <td className="num">{format(last.s, 2)} m ({format(pct(last.s, sMax), 1)} %)</td>
            <td className="num">{format(res.apogee.h, 2)} m</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">
        {withDrag
          ? "Con arrastre la aceleración cambia en cada paso, así que Euler se equivoca un poco en la velocidad y en la posición; con más pasos el error baja. La simulación usa un C_d y una densidad que cambian con la velocidad y la altura, y la Fase I de la simulación puede incluir arrastre: por eso difiere un poco de la fórmula."
          : "Sin arrastre dv/dt = −g es constante: Euler acierta la velocidad, pero la posición se pasa: usa la velocidad del inicio de cada paso, que es la más alta del paso porque el cohete va frenando. Si la simulación de la Fase I incluye arrastre, empieza esta fase con un poco menos de velocidad y llega más bajo."}
      </p>
    </>
  );
}
