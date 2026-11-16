import { layout } from "../../physics/geometry";
import { useMemo, useState } from "react";
import type { Design, EstesDesign } from "../../model";
import { G, air } from "../../physics/atmosphere";
import { CHUTE_SHAPES, LINE_FACTOR, chuteProperties } from "../../physics/parachute";
import type { FlightResult } from "../../physics/simulate";
import { format } from "../fields";
import { LineChart } from "../LineChart";
import { ChuteDiagram } from "../ChuteDiagram";
import { QTY, faded, nearest, within, type PhaseId } from "../phases";
import { Code, Eq, StageBlock, Think, n } from "./common";
import { LinearChuteS, LinearChuteV, QuadraticChuteS, QuadraticChuteV } from "./derivations";
import { RocketFreeBody, forceScale } from "./diagrams";
import { MethodTree } from "./Phase1Lesson";
import { phase2DragRef } from "./Phase2Estes";
import { phase3DragRef, phase3Model } from "./Phase3Estes";
import { MethodResults, MissingPhase, PhaseCharts, PhaseFacts, PhaseHeader, forceSeriesTec, phaseOf, type MethodResult } from "./phaseCommon";

const r = String.raw;

/** Forces chart of the results: built from the samples on screen, so it follows the chart range buttons. */
const FORCES = { title: "Fuerzas y suma de fuerzas ΣF", yLabel: "Fuerza (N)", series: forceSeriesTec };

/** Landing speed considered safe for the rocket. */
const SAFE_LANDING = 6; // m/s

/** Root of f between a (f > 0) and b (f ≤ 0) by bisection. */
function bisect(f: (x: number) => number, a: number, b: number) {
  for (let i = 0; i < 80; i++) {
    const m = (a + b) / 2;
    if (f(m) > 0) a = m; else b = m;
  }
  return (a + b) / 2;
}

/**
 * Numbers of the Rocket Tec phase IV model (ejection → landing): no thrust, constant mass and only the parachute's drag.
 * The phase starts where phase III ends and ends when s = 0.
 * Linear model: D = −b·v with b = mg / v_t, so dv/dt = −g − (b/m)·v and v relaxes exponentially to −v_t.
 * Quadratic model: D = ½ρ·Cd·A·v² upward, dv/dt = −g + c·v², solved with coth (opens faster than v_t) or tanh (slower).
 */
export function phase4Model(d: EstesDesign, res: FlightResult, ref2: { rho: number; cd: number }, ref3: { rho: number; cd: number }) {
  const M3 = phase3Model(d, res, ref2, ref3);
  // Normally phase IV starts at the end of phase III; when the parachute opens before the apogee, at the simulated ejection.
  const fromM3 = M3.exists;
  const ej = res.ejection;
  const ti = fromM3 ? M3.tf : (ej?.t ?? M3.tf);
  const vi = fromM3 ? M3.v(M3.tf) : (ej?.v ?? 0);
  const si = fromM3 ? M3.s(M3.tf) : (ej?.h ?? 0);
  const m = M3.m;
  const W = m * G;
  const chute = chuteProperties(d);
  const rho = air(0, d.launch.altitude, d.launch.temperature).density; // at the ground, where it lands
  const CdA = chute.cd * chute.area;
  const vt = Math.sqrt((2 * m * G) / (rho * CdA));
  const b = W / vt; // N·s/m
  const T = m / b; // s, time constant (= v_t / g)
  const c = (rho * CdA) / (2 * m); // 1/m
  const k = Math.sqrt(G * c); // 1/s (= g / v_t)
  const linear = d.recovery.chuteModel !== "quadratic";
  const u = Math.abs(vi) / vt;
  // Quadratic cases: the rocket still rising (vi > 0), falling faster than v_t (coth) or slower (tanh).
  const qcase: "rising" | "coth" | "tanh" = vi > 0 ? "rising" : u > 1 ? "coth" : "tanh";
  const phi = qcase === "coth" ? Math.atanh(1 / u) : qcase === "tanh" ? Math.atanh(Math.min(u, 0.999999)) : Math.atan(vi / vt);
  const tTop = qcase === "rising" ? phi / k : 0; // rising case: time to stop
  const sTop = qcase === "rising" ? si - Math.log(Math.cos(phi)) / c : si;

  const v = (t: number) => {
    const tau = Math.max(t - ti, 0);
    if (linear) return -vt + (vi + vt) * Math.exp(-tau / T);
    if (qcase === "coth") return -vt / Math.tanh(k * tau + phi);
    if (qcase === "tanh") return -vt * Math.tanh(k * tau + phi);
    return tau < tTop ? vt * Math.tan(phi - k * tau) : -vt * Math.tanh(k * (tau - tTop));
  };
  const s = (t: number) => {
    const tau = Math.max(t - ti, 0);
    if (linear) return si - vt * tau + T * (vi + vt) * (1 - Math.exp(-tau / T));
    if (qcase === "coth") return si - Math.log(Math.sinh(k * tau + phi) / Math.sinh(phi)) / c;
    if (qcase === "tanh") return si - Math.log(Math.cosh(k * tau + phi) / Math.cosh(phi)) / c;
    return tau < tTop ? si + Math.log(Math.cos(phi - k * tau) / Math.cos(phi)) / c : sTop - Math.log(Math.cosh(k * (tau - tTop))) / c;
  };
  /** Parachute force with its sign (y up): against the velocity, so upward while falling. */
  const D = (vel: number) => (linear ? -b * vel : -0.5 * rho * CdA * vel * Math.abs(vel));
  const F = (t: number) => -W + D(v(t));
  const dvdt = (t: number) => F(t) / m;

  // Landing: s(t_f) = 0. Approximation once the transient has died out, then the exact root.
  const ln2 = Math.log(2);
  const tauApprox = linear
    ? (si + T * (vi + vt)) / vt
    : qcase === "coth"
      ? (c * si + ln2 + Math.log(Math.sinh(phi)) - phi) / k
      : qcase === "tanh"
        ? (c * si + ln2 + Math.log(Math.cosh(phi)) - phi) / k
        : tTop + (c * sTop + ln2) / k;
  const tfApprox = ti + tauApprox;
  let hi = ti + Math.max(tauApprox * 2, 1);
  while (s(hi) > 0) hi += tauApprox + 1;
  const tf = si > 0 ? bisect(s, ti, hi) : ti;
  return { M3, ti, vi, si, tf, tfApprox, m, W, chute, rho, CdA, vt, b, T, c, k, linear, u, qcase, phi, v, s, D, F, dvdt };
}
type Model4 = ReturnType<typeof phase4Model>;

/** Euler steps for phase IV from t_i while the rocket is above the ground. */
function euler4(M: Model4, dt: number, maxSteps = 20000) {
  const pts = [{ t: M.ti, v: M.vi, s: M.si }];
  while (pts[pts.length - 1].s > 0 && pts.length <= maxSteps) {
    const p = pts[pts.length - 1];
    const a = (-M.W + M.D(p.v)) / M.m;
    pts.push({ t: p.t + dt, v: p.v + a * dt, s: p.s + p.v * dt });
  }
  return pts;
}

/** Times bunched at the start of the phase, where the parachute brakes in a fraction of a second. */
const phaseTimes = (ti: number, tf: number, count = 160) => Array.from({ length: count + 1 }, (_, i) => ti + (tf - ti) * (i / count) ** 2);

export function Phase4EstesLesson({ design: d, result: res, onPhase, onChange }: { design: EstesDesign; result: FlightResult; onPhase: (id: PhaseId) => void; onChange?: (d: Design) => void }) {
  const ref2 = useMemo(() => phase2DragRef(d, res), [d, res]);
  const ref3 = useMemo(() => phase3DragRef(d, res), [d, res]);
  const M = phase4Model(d, res, ref2, ref3);
  const ph = phaseOf(res, 4);
  const [t, setT] = useState(() => ph.from + Math.min(0.15, (ph.to - ph.from) * 0.05));
  const sample = nearest(res.samples, Math.min(Math.max(t, ph.from), ph.to));
  const hasChute = d.recovery.kind === "parachute";

  if (!ph.exists || !hasChute) {
    return (
      <div className="lesson">
        <PhaseHeader result={res} type={d.type} id={4} onPick={onPhase} intro={<>Del momento en que se abre el paracaídas hasta que el cohete toca el suelo.</>} />
        <MissingPhase type={d.type} id={4}>
          {ph.note && <p>{ph.note}</p>}
          <p>Sin paracaídas, el cohete toca el suelo a <b>{format(res.descentRate, 1)} m/s</b> ({format(res.descentRate * 3.6, 0)} km/h). Agrega uno en la pestaña Cohete para ver esta fase.</p>
        </MissingPhase>
      </div>
    );
  }

  return (
    <div className="lesson">
      <PhaseHeader
        result={res} type={d.type}
        id={4}
        onPick={onPhase}
        intro={<>La carga de eyección saca el <b>paracaídas</b>. Desde ese instante la fuerza del paracaídas frena al cohete hasta su <b>velocidad terminal</b> y lo baja con rapidez constante hasta el suelo. La fase termina al <b>aterrizar</b>, cuando <Eq tex={r`s = 0`} />.</>}
      />
      <div className="lesson-grid">
        <StageBlock stage="fisica">
          <ChuteBox M={M} />
          <p>
            Ya no hay empuje. Sobre el cohete actúan el <b>peso</b> (<i>Weight</i>) hacia abajo y la fuerza del <b>paracaídas</b> (<i>Drag</i>), que se opone a la velocidad:
            como el cohete baja, apunta <b>hacia arriba</b>. El arrastre del cuerpo del cohete es tan pequeño junto al del paracaídas que lo ignoramos.
          </p>
          <ChuteModel design={d} onChange={onChange} m={M.m} b={M.b} />
          <ul>
            {M.vi < 0 && M.u > 1
              ? <li>Al abrirse, el cohete cae a <Eq tex={r`${n(Math.abs(M.vi), 2)}\ \text{m/s}`} />, más rápido que la velocidad terminal: el paracaídas jala <b>más</b> que el peso, la suma de fuerzas apunta hacia arriba y el cohete <b>frena</b> (es el <b>tirón</b> que se siente al abrirse).</li>
              : <li>Al abrirse, el cohete va más lento que la velocidad terminal: el peso gana y el cohete <b>acelera</b> hacia abajo hasta alcanzarla.</li>}
            <li>Conforme la rapidez se acerca a <Eq tex={r`v_t`} />, la fuerza del paracaídas se acerca al peso: <Eq tex={r`\sum F \to 0`} />, la aceleración también, y el cohete baja con <b>velocidad constante</b>.</li>
            <li>La fase termina cuando el cohete toca el suelo. Para no dañarlo, conviene aterrizar a menos de {SAFE_LANDING} m/s.</li>
          </ul>
          <div className="interactive">
            <label className="slider-label">
              Diagrama de cuerpo libre en <b>t = {sample.t.toFixed(3)} s</b>
              <input type="range" min={ph.from} max={ph.to} step={(ph.to - ph.from) / 600} value={t} onChange={(e) => setT(Number(e.target.value))} />
            </label>
            <div className="fbd-row fbd-row-rocket">
              <RocketFreeBody sample={sample} cgFraction={res.stabilityLoaded.cg / layout(d).length} inverted forceMax={forceScale(within(res.samples, ph.from, ph.to))} />
              <div className="fbd-equations">
                <p className="hint">Las fuerzas salen del <b>centro de masa</b> (CM), el origen del marco de referencia <i>xy</i>. El eje <i>y</i> positivo apunta hacia arriba. Mueve el tiempo al principio de la fase para ver el tirón.</p>
                <ul className="fbd-forces">
                  <li><Eq tex={r`W = mg = ${n(sample.mass * G, 3)}\ \text{N}`} /></li>
                  <li style={{ color: QTY.D }}><Eq tex={M.linear ? r`D = b\,|v| = ${n(Math.abs(sample.drag), 3)}\ \text{N}` : r`D = \tfrac12\rho C_dA_p v^2 = ${n(Math.abs(sample.drag), 3)}\ \text{N}`} /></li>
                  <li><Eq tex={r`v = ${n(sample.v, 2)}\ \text{m/s}`} /></li>
                </ul>
                <Eq block tex={r`m\,\frac{dv}{dt} = -W + D`} />
                <Eq block tex={r`\frac{dv}{dt} = \frac{-${n(sample.mass * G, 3)} + ${n(Math.abs(sample.drag), 3)}}{${n(sample.mass, 4)}} = \mathbf{${n(sample.a, 2)}\ m/s^2}`} />
              </div>
            </div>
          </div>
          <dl className="notation">
            <div><dt><i>W</i> (<i>Weight</i>)</dt><dd>Peso: la fuerza de gravedad sobre el cohete, <Eq tex={r`W = mg`} />, hacia abajo.</dd></div>
            <div><dt><i>D</i> (<i>Drag</i>)</dt><dd>Fuerza del paracaídas: siempre en contra de la velocidad; al bajar apunta hacia arriba.</dd></div>
            <div><dt><Eq tex={r`b`} /></dt><dd>Constante del paracaídas en el modelo lineal <Eq tex={r`D = -b\,v`} />, en N·s/m.</dd></div>
            <div><dt><Eq tex={r`v_t`} /></dt><dd>Velocidad terminal: la rapidez a la que la fuerza del paracaídas iguala al peso.</dd></div>
            <div><dt><Eq tex={r`C_d,\ A_p`} /></dt><dd>Coeficiente de arrastre y área plana del paracaídas, de la sección Paracaídas de la pestaña Cohete.</dd></div>
          </dl>
        </StageBlock>

        <StageBlock stage="matematicas">
          <Phase4Math M={M} />
        </StageBlock>

        <StageBlock stage="computacion">
          <Phase4ModelComputation M={M} />
          <Phase4EulerComparison M={M} res={res} />
        </StageBlock>
      </div>

      <section className="stage stage-resultados">
        <header>
          <span className="stage-n">4</span>
          <div>
            <h3>Fase IV: Resultados</h3>
            <p className="stage-explain">Interpretamos los cambios del cohete en esta fase y verificamos si el modelo predice bien lo que se mide.</p>
          </div>
        </header>
        <div className="stage-body">
          <Phase4Results M={M} />
          <PhaseFacts result={res} type={d.type} id={4} />
          <PhaseCharts result={res} type={d.type} id={4} extra={FORCES} merge={1} />
          <Think>
            <ul>
              <li>Justo al abrirse el paracaídas, el cohete va hacia abajo pero <Eq tex={r`dv/dt`} /> es positiva. ¿Qué significa? ¿Hacia dónde apunta la suma de fuerzas?</li>
              <li>¿Por qué la velocidad deja de cambiar? ¿Cuánto vale ahí la suma de fuerzas?</li>
              <li>Duplica el radio del paracaídas: el área crece con <Eq tex={r`r^2`} />. ¿Cuánto cambia la velocidad terminal? ¿Y el tiempo de descenso?</li>
              <li>Con el mismo radio, cambia la geometría (circular, octagonal, hexagonal, cuadrada). ¿Cuál baja más lento? ¿Por qué influyen el área y el <Eq tex={r`C_d`} />?</li>
              <li>Acorta los hilos. ¿Qué pasa con el factor <Eq tex={r`f(L/D)`} /> y con la velocidad de aterrizaje?</li>
              <li>Cambia el botón Lineal / Cuadrático: ¿en qué parte de la fase se nota la diferencia y en cuál casi no? ¿Por qué aterrizan a la misma velocidad?</li>
              <li>
                En el video del lanzamiento mide la velocidad de descenso con el paracaídas abierto (altura ÷ tiempo de bajada). Calcula <Eq tex={r`b = mg / v_t`} /> con tu medición y
                compárala con la de tu modelo, <Eq tex={r`b = ${n(M.b, 4)}\ \text{N·s/m}`} />.
              </li>
            </ul>
          </Think>
        </div>
      </section>
    </div>
  );
}

/** "El paracaídas y la velocidad terminal": the parachute the student built, its Cd and the terminal speed. */
function ChuteBox({ M }: { M: Model4 }) {
  const { chute, vt, m, rho, CdA } = M;
  const vLand = Math.abs(M.v(M.tf));
  const ok = vLand <= SAFE_LANDING;
  const shape = CHUTE_SHAPES[chute.shape];
  return (
    <div className="maxq">
      <b>El paracaídas y la velocidad terminal</b>
      <p>
        Tu paracaídas es <b>{shape.label.toLowerCase()}</b>, de radio <Eq tex={r`r = ${n(chute.radius * 100, 1)}\ \text{cm}`} />, con hilos de{" "}
        <Eq tex={r`L = ${n(chute.ratio * chute.radius * 2 * 100, 1)}\ \text{cm}`} />. Su coeficiente de arrastre sale de la forma y del largo de los hilos (sección Paracaídas de la pestaña Cohete):
      </p>
      <ChuteDiagram shape={chute.shape} radius={chute.radius} lines={chute.ratio * chute.radius * 2} area={chute.area} factor={chute.factor} />
      <Eq block tex={r`C_d = C_{d,\text{base}} \times f\!\left(\tfrac{L}{D}\right) = ${n(chute.cd0, 2)} \times f(${n(chute.ratio, 2)}) = ${n(chute.cd0, 2)} \times ${n(chute.factor, 3)} = ${n(chute.cd, 3)}`} />
      <table className="summary chute-table">
        <thead><tr><th><Eq tex={r`L/D`} /></th>{LINE_FACTOR.map(([x]) => <th key={x} className="num">{x === LINE_FACTOR[LINE_FACTOR.length - 1][0] ? `${format(x, 2)} o más` : format(x, 2)}</th>)}</tr></thead>
        <tbody><tr><td><Eq tex={r`f(L/D)`} /></td>{LINE_FACTOR.map(([x, f]) => <td key={x} className="num">{format(f, 2)}</td>)}</tr></tbody>
      </table>
      <p className="hint">
        <Eq tex={r`C_{d,\text{base}}`} />: circular 0.80, octagonal 0.78, hexagonal 0.76, cuadrada 0.70. Con hilos cortos el dosel se cierra y frena menos. Entre dos renglones
        de la tabla se interpola.
      </p>
      <p>
        Con el área plana <Eq tex={r`A_p = ${n(chute.area, 4)}\ \text{m}^2`} />, la <b>velocidad terminal</b> es la rapidez a la que la fuerza del paracaídas sostiene el peso:
      </p>
      <Eq block tex={r`\tfrac12\rho\,C_dA_p\,v_t^2 = mg \;\Rightarrow\; v_t = \sqrt{\frac{2mg}{\rho\,C_dA_p}} = \sqrt{\frac{2(${n(m, 4)})(9.81)}{(${n(rho, 3)})(${n(CdA, 4)})}} = ${n(vt, 2)}\ \text{m/s}`} />
      <p>
        Tu cohete aterriza a <b>{format(vLand, 2)} m/s</b>: {ok
          ? <>menos de {SAFE_LANDING} m/s, un aterrizaje seguro.</>
          : <>más de {SAFE_LANDING} m/s, puede dañarse. Usa un paracaídas más grande o con mayor <Eq tex={r`C_d`} />.</>}
      </p>
    </div>
  );
}

/** Phase IV model of the parachute force and its switch: linear f = −b·v (default) or quadratic ½ρ·Cd·A·v². */
function ChuteModel({ design: d, onChange, m, b }: { design: EstesDesign; onChange?: (d: Design) => void; m: number; b: number }) {
  const linear = d.recovery.chuteModel !== "quadratic";
  const set = (chuteModel: "linear" | "quadratic") => (chuteModel === "linear") !== linear && onChange?.({ ...d, recovery: { ...d.recovery, chuteModel } });
  return (
    <div className="simplified-model">
      <b>Modelo simplificado de la Fase IV</b>
      <ul>
        <li><b>Sin empuje:</b> el motor ya terminó, <Eq tex={r`T = 0`} />.</li>
        <li><b>Masa constante:</b> la misma de las fases anteriores, <Eq tex={r`m = ${n(m * 1000, 1)}\ \text{g}`} />, así que el <b>peso</b> es constante: <Eq tex={r`W = mg`} />.</li>
        <li>
          <b>Fuerza del paracaídas:</b> {linear
            ? <>proporcional a la velocidad, <Eq tex={r`D = -b\,v`} /> con <Eq tex={r`b = ${n(b, 4)}\ \text{N·s/m}`} />. Es el modelo más fácil de resolver.</>
            : <>proporcional al cuadrado de la velocidad, <Eq tex={r`D = \tfrac12\rho\,C_dA_p\,v^2`} />, como el aire real.</>}
        </li>
      </ul>
      <div className="thrust-model" role="group" aria-label="Fuerza del paracaídas en la Fase IV">
        <button type="button" className={`btn small ${linear ? "primary" : ""}`} aria-pressed={linear} disabled={!onChange} onClick={() => set("linear")}
          title="D = −b·v: la solución usa una exponencial.">
          Lineal (D = −bv)
        </button>
        <button type="button" className={`btn small ${!linear ? "primary" : ""}`} aria-pressed={!linear} disabled={!onChange} onClick={() => set("quadratic")}
          title="D = ½ρ·Cd·A·v²: la solución usa funciones hiperbólicas.">
          Cuadrático (D = ½ρC<sub>d</sub>Av²)
        </button>
      </div>
      <p className="hint">Los dos modelos tienen la misma velocidad terminal: <Eq tex={r`b = mg / v_t`} />. Se aplica a todos los cálculos de la Fase IV y a la simulación.</p>
    </div>
  );
}

/** First card of the phase IV results: analytic model and Euler (Δt = 0.01 s, while s > 0, as in its MATLAB script). */
function Phase4Results({ M }: { M: Model4 }) {
  const { ti, vi, tf } = M;
  const dt = 0.01;
  const end = useMemo(() => { const p = euler4(M, dt, 200000); return p[p.length - 1]; }, [M]);
  const vEnd = M.v(tf);
  const safe = Math.abs(vEnd) <= SAFE_LANDING;
  const cards: MethodResult[] = [
    { q: "F", label: "Suma de fuerzas al aterrizar", unit: "N", analytic: M.F(tf), euler: -M.W + M.D(end.v), digits: 3, sub: r`\textstyle\sum F = -W + D \approx 0` },
    { q: "a", label: "Aceleración promedio", unit: "m/s²", analytic: (vEnd - vi) / (tf - ti), euler: (end.v - vi) / (end.t - ti), digits: 2, sub: r`\Delta v / \Delta t` },
    { q: "n", label: "Tiempo de descenso", unit: "s", analytic: tf - ti, euler: end.t - ti, digits: 2, sub: r`t_f - t_i,\ t_f = ${n(tf, 2)}\ \text{s}` },
    { q: "v", label: "Velocidad de aterrizaje", unit: "m/s", analytic: vEnd, euler: end.v, digits: 2, sub: r`v(t_f)`, hero: true },
  ];
  return (
    <MethodResults cards={cards} dt={dt} note={<>
      {safe ? <>Aterriza a menos de {SAFE_LANDING} m/s: un aterrizaje <b>seguro</b>. </> : <>Aterriza a más de {SAFE_LANDING} m/s: <b>puede dañarse</b>; usa un paracaídas más grande. </>}
      La suma de fuerzas al aterrizar es casi cero porque el cohete ya baja a velocidad terminal. Euler para en el primer paso con <Eq tex={r`s \le 0`} />, así que su tiempo
      puede pasarse hasta un paso ({dt} s).
    </>} />
  );
}

function Phase4Math({ M }: { M: Model4 }) {
  const { ti, vi, si, tf, tfApprox, m, W, linear, b, T, vt, c, k, phi, qcase, v, rho, CdA } = M;
  const dt = 0.01;
  const hand = euler4(M, dt, 2);
  const [p0, p1, p2] = hand;
  const f4 = (x: number) => n(x, 4);
  const a0 = (-W + M.D(p0.v)) / m, a1 = (-W + M.D(p1.v)) / m;
  const vEnd = v(tf);
  const tree = [ti, ti + 0.1, ti + 0.2].map((t) => ({ t, v: v(t) }));
  const g = 9.81;
  const fall = qcase === "coth" ? r`\coth` : r`\tanh`;
  const lnf = qcase === "coth" ? r`\sinh` : r`\cosh`;

  return (
    <div className="derivation">
      <p>Queremos los <b>modelos</b> de la velocidad y la posición del cohete desde que se abre el paracaídas hasta que toca el suelo.</p>
      <p>Igual que en las fases anteriores, partimos de la <b>segunda ley de Newton</b> y de la definición de velocidad:</p>
      <Eq block tex={r`\frac{dv}{dt} = \frac{\sum F}{m} \qquad\qquad \frac{ds}{dt} = v`} />
      <p>Las <b>condiciones iniciales</b> son las condiciones finales de la Fase III (la separación):</p>
      <Eq block tex={r`t_i = ${n(ti, 3)}\ \text{s} \qquad v_i = ${n(vi, 2)}\ \text{m/s} \qquad s_i = ${n(si, 2)}\ \text{m}`} />
      <p>Otra vez hay dos formas de resolver la ecuación diferencial:</p>
      <MethodTree dvdt={0} rows={tree} formula={linear ? r`v(t) = -v_t + (v_i + v_t)\,e^{-\frac{b}{m}(t - t_i)}` : r`v(t) = -v_t\,${fall}\!\big(\sqrt{gc}\,(t - t_i) + \varphi\big)`} />

      <h4><span className="step-n">1</span> La suma de fuerzas</h4>
      <p>Del diagrama de cuerpo libre, con el eje <i>y</i> positivo hacia arriba: no hay empuje, el peso resta y la fuerza del paracaídas va en contra de la velocidad.</p>
      {linear ? (
        <>
          <Eq block tex={r`\sum F = -W + D = -mg - b\,v`} />
          <p className="hint">El signo menos de <Eq tex={r`-b\,v`} /> la pone siempre contra la velocidad: al bajar <Eq tex={r`v < 0`} />, así que <Eq tex={r`-b\,v > 0`} /> apunta hacia arriba.</p>
          <p><b>¿Cuánto vale b?</b> Cuando el cohete baja a velocidad terminal, el paracaídas sostiene exactamente el peso. Usamos la <Eq tex={r`v_t`} /> del arrastre real del aire (recuadro de Física):</p>
          <Eq block tex={r`b\,v_t = mg \;\Rightarrow\; b = \frac{mg}{v_t} = \frac{(${n(m, 4)})(9.81)}{${n(vt, 3)}} = ${n(b, 4)}\ \text{N·s/m}`} />
          <p>Dividimos entre <Eq tex={r`m`} />:</p>
          <Eq block tex={r`\frac{dv}{dt} = -g - \frac{b}{m}\,v, \qquad \frac{b}{m} = ${n(b / m, 3)}\ \text{s}^{-1}`} />
        </>
      ) : (
        <>
          <Eq block tex={r`\sum F = -W + D = -mg + \tfrac12\rho\,C_dA_p\,v^2`} />
          <p>Dividimos entre <Eq tex={r`m`} /> y juntamos las constantes, como en la Fase III, pero ahora con el área del paracaídas:</p>
          <Eq block tex={r`\frac{dv}{dt} = -g + c\,v^2, \qquad c = \frac{\rho\,C_dA_p}{2m} = \frac{(${n(rho, 3)})(${n(CdA, 4)})}{2(${n(m, 4)})} = ${n(c, 4)}\ \text{m}^{-1}`} />
        </>
      )}

      <h4><span className="step-n">2</span> Método analítico: v(t) por separación de variables</h4>
      {linear ? (
        <LinearChuteV
          vt={vt}
          note={
            <p className="hint">
              La exponencial se hace cero muy rápido: en <Eq tex={r`m/b = ${n(T, 3)}\ \text{s}`} /> ya bajó a 37 % y en <Eq tex={r`5\,m/b = ${n(5 * T, 2)}\ \text{s}`} /> a menos de 1 %.
              Después queda <Eq tex={r`v \approx -v_t`} />: la <b>velocidad terminal</b>.
            </p>
          }
        />
      ) : qcase === "rising" ? (
        <p>En este vuelo el paracaídas se abre con el cohete todavía <b>subiendo</b>. Primero frena hasta detenerse con <Eq tex={r`v = v_t\tan(\varphi - \sqrt{gc}\,(t - t_i))`} /> y después cae como en la Fase III, con <Eq tex={r`\tanh`} />. La computadora usa las dos partes.</p>
      ) : (
        <QuadraticChuteV coth={qcase === "coth"} vt={vt} phi={phi} />
      )}

      <h4><span className="step-n">3</span> Método analítico: s(t) a partir de v = ds/dt</h4>
      {linear ? (
        <LinearChuteS note={<p className="hint">El primer término es una recta (bajar a velocidad terminal); el segundo es la corrección del frenado al inicio, que se vuelve constante muy pronto.</p>} />
      ) : qcase === "rising" ? (
        <p>Igual que la velocidad, la posición tiene dos partes: sube un poco más con <Eq tex={r`\ln\cos`} /> y luego baja con <Eq tex={r`\ln\cosh`} />, como en la Fase III.</p>
      ) : (
        <QuadraticChuteS coth={qcase === "coth"} />
      )}

      <h4><span className="step-n">4</span> ¿Cuándo aterriza?</h4>
      <p>
        El cohete toca el suelo cuando <Eq tex={r`s(t_f) = 0`} />. Esta ecuación <b>no se puede despejar</b> exactamente para <Eq tex={r`t_f`} />, pero hay un truco: al llegar al suelo el
        frenado ya terminó hace mucho.
      </p>
      {linear ? (
        <>
          <p><b>a) Aproximación a mano.</b> Para entonces <Eq tex={r`e^{-\frac{b}{m}(t_f - t_i)} \approx 0`} />, y queda una ecuación lineal:</p>
          <Eq block tex={r`0 \approx s_i - v_t\,(t_f - t_i) + \frac{m}{b}(v_i + v_t) \;\Rightarrow\; t_f \approx t_i + \frac{s_i + \frac{m}{b}(v_i + v_t)}{v_t}`} />
          <Eq block tex={r`t_f \approx ${n(ti, 3)} + \frac{${n(si, 2)} + (${n(T, 4)})(${n(vi + vt, 3)})}{${n(vt, 3)}} = ${n(tfApprox, 3)}\ \text{s}`} />
        </>
      ) : (
        <>
          <p><b>a) Aproximación a mano.</b> Para tiempos grandes <Eq tex={r`\ln ${lnf} x \approx x - \ln 2`} />, y queda una ecuación lineal en <Eq tex={r`t_f`} />:</p>
          <Eq block tex={r`t_f \approx ${n(tfApprox, 3)}\ \text{s}`} />
        </>
      )}
      <p><b>b) Con la computadora.</b> MATLAB busca la raíz exacta de <Eq tex={r`s(t) = 0`} /> con <code>fzero</code>, empezando en la aproximación:</p>
      <Eq block tex={r`t_f = ${n(tf, 3)}\ \text{s} \qquad (\text{diferencia: } ${n(Math.abs(tf - tfApprox) * 1000, 2)}\ \text{ms})`} />
      <p>Evaluamos la velocidad en <Eq tex={r`t_f`} /> para saber cómo llega al suelo:</p>
      <div className="result-eq"><Eq block tex={r`v(t_f) = ${n(vEnd, 2)}\ \text{m/s} \approx -v_t`} /></div>

      <h4><span className="step-n">5</span> Método numérico: Euler en MATLAB</h4>
      <p>La regla de Euler es la misma de las fases anteriores: <i>«lo nuevo = lo que tenía + cuánto cambia en un paso»</i>.</p>
      <div className="result-eq"><Eq block tex={r`v_{n+1} = v_n + \frac{\sum F_n}{m}\,\Delta t \qquad\qquad s_{n+1} = s_n + v_n\,\Delta t`} /></div>
      <p>La suma de fuerzas cambia en cada paso: <Eq tex={linear ? r`\sum F_n = -mg - b\,v_n` : r`\sum F_n = -mg + \tfrac12\rho\,C_dA_p\,v_n^2`} />. Los dos primeros pasos a mano, con <Eq tex={r`\Delta t = 0.01\ \text{s}`} />:</p>
      <div className="euler-hand">
        <p><b>Paso 1:</b></p>
        <Eq block tex={r`v_1 = v_0 + \frac{\sum F_0}{m}\,\Delta t = ${n(p0.v, 2)} + (${n(a0, 2)})(0.01) = ${f4(p1.v)}\ \text{m/s}`} />
        <Eq block tex={r`s_1 = s_0 + v_0\,\Delta t = ${n(p0.s, 2)} + (${n(p0.v, 2)})(0.01) = ${f4(p1.s)}\ \text{m}`} />
        <p><b>Paso 2:</b></p>
        <Eq block tex={r`v_2 = v_1 + \frac{\sum F_1}{m}\,\Delta t = ${f4(p1.v)} + (${n(a1, 2)})(0.01) = ${f4(p2.v)}\ \text{m/s}`} />
        <Eq block tex={r`s_2 = s_1 + v_1\,\Delta t = ${f4(p1.s)} + (${f4(p1.v)})(0.01) = ${f4(p2.s)}\ \text{m}`} />
      </div>
      <p>
        <b>¿Cuándo parar?</b> Como en la Fase II, no sabemos de antemano cuántos pasos hacen falta: repetimos mientras el cohete siga arriba del suelo, con un ciclo{" "}
        <code>while s(k) &gt; 0</code>.
      </p>
      <Code title="MATLAB · Fase IV con el método de Euler">{`
% Fase IV: Separación - Aterrizaje (sin empuje, masa constante, ${linear ? "paracaídas lineal D = -b*v" : "paracaídas cuadrático"})

% 1. Datos: las condiciones iniciales vienen de la Fase III
FaseIV_vi = FaseIII_VelocidadFinal;   % m/s
FaseIV_si = FaseIII_PosicionFinal;    % m
FaseIV_ti = FaseIII_tf;               % s
m  = FaseIII_MasaCohete;              % kg, la misma masa
g  = ${g};                            % m/s^2
rho = ${n(rho, 3)};                         % kg/m^3, aire en el suelo
Cd  = ${n(M.chute.cd, 3)};                         % del paracaídas (forma x hilos)
Ap  = ${n(M.chute.area, 4)};                        % m^2, área plana del paracaídas
vt  = sqrt(2*m*g/(rho*Cd*Ap));        % m/s, velocidad terminal${linear ? `
b   = m*g/vt;                         % N*s/m, constante del paracaídas` : ""}
dt = 0.01;                            % s, paso de tiempo

% 2. Valores iniciales
t = FaseIV_ti;  v = FaseIV_vi;  s = FaseIV_si;
k = 1;

% 3. Regla de Euler: mientras el cohete siga arriba del suelo
while s(k) > 0
    SF = -m*g ${linear ? "- b*v(k)" : "+ 0.5*rho*Cd*Ap*v(k)^2"};${linear ? "             % peso abajo, paracaídas contra v" : "   % peso abajo, paracaídas arriba"}
    v(k+1) = v(k) + (SF/m)*dt;        % v_(n+1) = v_n + (SF/m)*dt
    s(k+1) = s(k) + v(k)*dt;          % s_(n+1) = s_n + v_n*dt
    t(k+1) = t(k) + dt;
    k = k + 1;
end

% 4. Resultados: el último paso es el aterrizaje
fprintf('Aterriza a los %.2f s con v = %.2f m/s\\n', t(end), v(end));
      `}</Code>

      <p className="hint">Los resultados de tu cohete, con los dos métodos, están al principio de la parte 4 · Resultados.</p>
      {!linear && (
        <p className="hint">
          Con tus números: <Eq tex={r`\sqrt{gc} = ${n(k, 4)}\ \text{s}^{-1}`} /> y <Eq tex={r`v_t = ${n(vt, 2)}\ \text{m/s}`} />.
        </p>
      )}
    </div>
  );
}

/** Phase IV computation, part 1: the four charts of the analytic model and the MATLAB code that makes each one. */
function Phase4ModelComputation({ M }: { M: Model4 }) {
  const { ti, tf, tfApprox, linear, qcase } = M;
  const charts = useMemo(() => {
    const ts = phaseTimes(ti, tf);
    const line = (f: (t: number) => number) => ts.map((t) => ({ x: t, y: f(t) }));
    return {
      v: [{ label: "v(t)", points: line(M.v), color: QTY.v }],
      s: [{ label: "s(t)", points: line(M.s), color: QTY.s }],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ti, tf, linear, M.si, M.vi, M.vt]);
  const plot = (handle: string, title: string, yLabel: string) => `figure;
fplot(${handle}, FaseIV_Dominio, 'LineWidth', 1.5)
title('${title}')
xlabel('Tiempo (s)')
ylabel('${yLabel}')
grid on`;
  const quadModels = qcase === "coth"
    ? `FaseIV_phi = acoth(abs(FaseIV_vi)/FaseIV_vt);
FaseIV_ModeloVt = @(t) -FaseIV_vt*coth(FaseIV_k*(t - FaseIV_ti) + FaseIV_phi);
FaseIV_ModeloSt = @(t) FaseIV_si - (1/FaseIV_c)*log(sinh(FaseIV_k*(t - FaseIV_ti) + FaseIV_phi)/sinh(FaseIV_phi));`
    : `FaseIV_phi = atanh(abs(FaseIV_vi)/FaseIV_vt);
FaseIV_ModeloVt = @(t) -FaseIV_vt*tanh(FaseIV_k*(t - FaseIV_ti) + FaseIV_phi);
FaseIV_ModeloSt = @(t) FaseIV_si - (1/FaseIV_c)*log(cosh(FaseIV_k*(t - FaseIV_ti) + FaseIV_phi)/cosh(FaseIV_phi));`;

  return (
    <>
      <h4 className="comp-step">Simulaciones v(t) y s(t)</h4>
      <p>
        La computadora evalúa los modelos de Matemáticas en todos los instantes de la Fase IV, desde la apertura en <Eq tex={r`t_i = ${n(ti, 2)}\ \text{s}`} /> hasta el aterrizaje en{" "}
        <Eq tex={r`t_f = ${n(tf, 2)}\ \text{s}`} />. Copia el script en MATLAB y córrelo: genera las gráficas de la velocidad y la posición.
      </p>
      <Code title="MATLAB · Fase IV: Recuperación, v(t) y s(t)" scroll>{`
%% Fase IV: Recuperación (sin empuje, masa constante, paracaídas ${linear ? "lineal D = -b*v" : "cuadrático D = 0.5*rho*Cd*Ap*v^2"})
% Va después de los scripts de las fases I, II y III, porque usa sus resultados.
% Cada bloque marcado con %% es una sección: en MATLAB Live Script puedes
% correr cada sección por separado (Ctrl + Enter).

%% 1. Condiciones iniciales: las condiciones finales de la Fase III (la separación)
FaseIV_si = FaseIII_PosicionFinal;                    % m
FaseIV_vi = FaseIII_VelocidadFinal;                   % m/s
FaseIV_ti = FaseIII_tf;                               % s, tiempo del vuelo
FaseIV_MasaCohete = FaseIII_MasaCohete;               % kg, la misma masa

% Paracaídas (sección Paracaídas de la pestaña Cohete)
FaseIV_rho = ${n(M.rho, 3)};                                % kg/m^3, aire en el suelo
FaseIV_Cd  = ${n(M.chute.cd, 3)};                                % forma x factor de hilos
FaseIV_Ap  = ${n(M.chute.area, 4)};                               % m^2, área plana
FaseIV_vt  = sqrt(2*FaseIV_MasaCohete*9.81/(FaseIV_rho*FaseIV_Cd*FaseIV_Ap));   % m/s${linear ? `
FaseIV_b   = FaseIV_MasaCohete*9.81/FaseIV_vt;        % N*s/m` : `
FaseIV_c   = FaseIV_rho*FaseIV_Cd*FaseIV_Ap/(2*FaseIV_MasaCohete);   % 1/m
FaseIV_k   = sqrt(9.81*FaseIV_c);                     % 1/s`}

%% 2. Modelos de la velocidad y la posición
% Los modelos usan (t - FaseIV_ti): el tiempo que lleva la fase.${linear ? `
FaseIV_ModeloVt = @(t) -FaseIV_vt + (FaseIV_vi + FaseIV_vt)*exp(-(FaseIV_b/FaseIV_MasaCohete)*(t - FaseIV_ti));
FaseIV_ModeloSt = @(t) FaseIV_si - FaseIV_vt*(t - FaseIV_ti) + (FaseIV_MasaCohete/FaseIV_b)*(FaseIV_vi + FaseIV_vt)*(1 - exp(-(FaseIV_b/FaseIV_MasaCohete)*(t - FaseIV_ti)));` : `
${quadModels}`}

%% 3. Dominio: hasta el aterrizaje
% El aterrizaje es cuando s(t) = 0. No se puede despejar t_f a mano, así que
% fzero busca la raíz empezando en la aproximación (cuando la exponencial
% del frenado ya vale casi cero).
FaseIV_tfAprox = ${linear ? "FaseIV_ti + (FaseIV_si + (FaseIV_MasaCohete/FaseIV_b)*(FaseIV_vi + FaseIV_vt))/FaseIV_vt" : n(tfApprox, 3)};   % s, ${format(tfApprox, 3)}
FaseIV_tf = fzero(FaseIV_ModeloSt, FaseIV_tfAprox);   % s, ${format(tf, 3)}
FaseIV_Dominio = [FaseIV_ti FaseIV_tf];

%% 4. Gráfica de la velocidad v(t)
${plot("FaseIV_ModeloVt", "Fase IV: v(t)", "Velocidad (m/s)")}

%% 5. Gráfica de la posición s(t)
${plot("FaseIV_ModeloSt", "Fase IV: s(t)", "Posición (m)")}

%% 6. Condiciones finales (el aterrizaje)
% Sin punto y coma al final, MATLAB muestra el valor en la ventana de comandos.
% Deben salir los mismos resultados de Matemáticas:
%   velocidad al aterrizar = ${format(M.v(tf), 2)} m/s
%   tiempo de descenso   = ${format(tf - ti, 2)} s
% Con esto termina el vuelo.
FaseIV_VelocidadFinal   = FaseIV_ModeloVt(FaseIV_Dominio(2))   % velocidad de aterrizaje
FaseIV_TiempoDescenso   = FaseIV_tf - FaseIV_ti
      `}</Code>

      <h4 className="comp-step">Lo que debe salir en MATLAB</h4>
      <p>Al correr el script, MATLAB dibuja estas gráficas (aquí puedes ampliarlas y hacer zoom):</p>
      <div className="charts">
        <LineChart title="Velocidad v(t)" xLabel="Tiempo (s)" yLabel="v (m/s)" series={charts.v} height={220} yZero />
        <LineChart title="Posición s(t)" xLabel="Tiempo (s)" yLabel="s (m)" series={charts.s} height={220} yZero />
      </div>
      <p className="hint">
        Al abrirse el paracaídas la velocidad cambia muy rápido y en una fracción de segundo se vuelve constante (<Eq tex={r`-v_t`} />) y la posición baja
        como una <b>recta</b> cuya pendiente es la velocidad terminal.
      </p>
    </>
  );
}

/** Phase IV computation, part 2: analytic model, Euler and the RPL simulation side by side. */
function Phase4EulerComparison({ M, res }: { M: Model4; res: FlightResult }) {
  const { ti, tf, linear, T } = M;
  // Δt has to stay below the braking time, or Euler overshoots and blows up: 1/rate with rate = b/m (linear) or
  // 2c·|v| at the opening (quadratic, much faster). The step counts start at the first one that is stable.
  const rate = linear ? 1 / T : 2 * M.c * Math.max(Math.abs(M.vi), M.vt);
  const brake = 1 / rate;
  const minN = Math.ceil((tf - ti) * rate);
  const counts = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000].filter((c) => c >= minN).slice(0, 6);
  const [chosen, setN] = useState<number | null>(null);
  const N = chosen !== null && counts.includes(chosen) ? chosen : counts[Math.min(1, counts.length - 1)];
  const dt = (tf - ti) / N;
  const dtLabel = `${Number(dt.toPrecision(3))}`;
  const dots = N <= 100;
  const euler = useMemo(() => euler4(M, dt), [M, dt]);
  const last = euler[euler.length - 1];
  const ph = phaseOf(res, 4);
  const sim = within(res.samples, ph.from, ph.to);
  const simLabel = linear ? "Simulación RPL (RK4, paracaídas lineal)" : "Simulación RPL (RK4, paracaídas cuadrático)";
  const charts = useMemo(() => {
    const ts = phaseTimes(ti, tf, 120);
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
  const pctText = (a: number, b: number) => format(Math.abs(pct(a, b)) < 0.05 ? 0 : pct(a, b), 1);
  const vEnd = M.v(tf);
  const land = res.landing;

  return (
    <>
      <h4 className="comp-step">Comparación de solución analítica vs numérica</h4>
      <p>Primero corre en MATLAB el script de Euler de Matemáticas y después este código: grafica los dos métodos juntos.</p>
      <Code title="MATLAB · comparar Euler con el modelo analítico">{`
% Corre antes el script de Euler de Matemáticas: crea los vectores t, v y s.
% Este código dibuja Euler (puntos) contra el modelo analítico (línea punteada).

tt = linspace(FaseIV_ti, FaseIV_tf, 400);
subplot(2,1,1); plot(t, v, 'o', tt, FaseIV_ModeloVt(tt), '--'); grid on;
ylabel('v (m/s)'); legend('Euler', 'Analítico');
subplot(2,1,2); plot(t, s, 'o', tt, FaseIV_ModeloSt(tt), '--'); grid on;
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
          <LineChart title="Velocidad v(t) en la Fase IV" xLabel="Tiempo (s)" yLabel="v (m/s)" series={charts.v} height={220} yZero />
          <LineChart title="Posición s(t) en la Fase IV" xLabel="Tiempo (s)" yLabel="s (m)" series={charts.s} height={220} yZero />
        </div>
      </div>
      <table className="summary">
        <thead><tr><th>En el aterrizaje</th><th className="num">Analítico</th><th className="num">Euler</th><th className="num">Simulación</th></tr></thead>
        <tbody>
          <tr>
            <td>Tiempo <Eq tex={r`t_f`} /></td>
            <td className="num">{format(tf, 2)} s</td>
            <td className="num">{format(last.t, 2)} s</td>
            <td className="num">{land ? `${format(land.t, 2)} s` : "–"}</td>
          </tr>
          <tr>
            <td>Velocidad <Eq tex={r`v(t_f)`} /></td>
            <td className="num q-v">{format(vEnd, 2)} m/s</td>
            <td className="num q-v">{format(last.v, 2)} m/s ({pctText(last.v, vEnd)} %)</td>
            <td className="num q-v">{land ? `${format(land.v, 2)} m/s` : "–"}</td>
          </tr>
        </tbody>
      </table>
      <p className="hint">
        El frenado dura apenas unas centésimas o décimas de segundo ({linear
          ? <Eq tex={r`m/b = ${n(brake, 3)}\ \text{s}`} />
          : <Eq tex={r`1/(2c\,|v_i|) = ${n(brake, 3)}\ \text{s}`} />}): si el paso <Eq tex={r`\Delta t`} /> es más grande, Euler se pasa de largo y <b>explota</b>. Por eso aquí
        empezamos en {counts[0]} pasos. Después del frenado todos coinciden, porque la velocidad ya es constante. Euler para en el primer paso con <Eq tex={r`s \le 0`} />, por eso su
        tiempo puede pasarse un poco.
      </p>
    </>
  );
}
