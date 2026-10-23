import { useMemo } from "react";
import type { Design } from "../../model";
import { G } from "../../physics/atmosphere";
import { dragModel } from "../../physics/drag";
import type { FlightResult } from "../../physics/simulate";
import { format } from "../fields";
import { nearest, series, within, type PhaseId } from "../phases";
import { Code, Eq, StageBlock, Think, YourRocket, n } from "./common";
import { MissingPhase, PhaseCharts, PhaseFacts, PhaseHeader, phaseAverages, phaseOf } from "./phaseCommon";

const r = String.raw;

export function Phase3Lesson({ design: d, result: res, onPhase }: { design: Design; result: FlightResult; onPhase: (id: PhaseId) => void }) {
  const ph = phaseOf(res, 3);
  const samples = within(res.samples, ph.from, ph.to);
  const near = samples.length > 2 ? samples : within(res.samples, ph.from - 0.3, ph.from + 0.3);
  const { rho, cd, mass } = phaseAverages(d, near);
  const A = useMemo(() => dragModel(d).refArea, [d]);
  const vt = Math.sqrt((2 * mass * G) / (rho * cd * A));
  const tf = ph.to - ph.from;
  const end = nearest(res.samples, ph.to);
  const vExact = -vt * Math.tanh((G * tf) / vt);
  const dhExact = ((vt * vt) / G) * Math.log(Math.cosh((G * tf) / vt));

  const compare = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * tf;
      pts.push({ x: ph.from + t, y: -vt * Math.tanh((G * t) / vt) });
    }
    return [
      { label: "v simulada (RK4)", points: series(samples, (s) => s.v), color: "#5b6270" },
      { label: "v exacta: −v_t tanh(gt/v_t)", points: pts, color: "#e0701b", dashed: true },
      { label: "−v_t", points: [{ x: ph.from, y: -vt }, { x: ph.to, y: -vt }], color: "#b3261e", dashed: true },
    ];
  }, [samples, tf, vt, ph.from, ph.to]);

  return (
    <div className="lesson">
      <PhaseHeader
        result={res}
        id={3}
        onPick={onPhase}
        intro={ph.exists
          ? <>Del apogeo hasta que se abre el paracaídas{d.recovery.kind === "parachute" && res.ejection ? "" : " (o hasta el suelo)"}. El cohete cae y gana velocidad hacia abajo: de 0 a {format(Math.abs(end.v), 1)} m/s en {format(tf, 2)} s.</>
          : <>Del apogeo hasta que se abre el paracaídas. En este vuelo esta fase no ocurre, pero entenderla te ayuda a elegir el retardo correcto.</>}
      />
      {!ph.exists && (
        <MissingPhase id={3}>
          <p>{ph.note}</p>
          {d.type === "water"
            ? <p>En el cohete de agua el paracaídas se programa para abrir justo en el apogeo, así que pasa directo de la fase 2 a la fase 4.</p>
            : <p>Para verla, elige en la pestaña Cohete un retardo de motor más largo que {format(res.idealDelay ?? 0, 1)} s (el tiempo que dura la fase 2).</p>}
        </MissingPhase>
      )}
      <div className="lesson-grid">
        <StageBlock stage="fisica">
          <ul>
            <li>En el apogeo la velocidad es cero; a partir de ahí el peso hace que el cohete caiga.</li>
            <li>Ahora el <b>arrastre apunta hacia arriba</b> (en contra de la velocidad) y crece conforme el cohete acelera.</li>
            <li>Si cayera el tiempo suficiente, el arrastre igualaría al peso y la velocidad dejaría de crecer: la <b>velocidad terminal sin paracaídas</b>. Para un cohete delgado es muy alta, por eso es peligroso caer sin paracaídas.</li>
            <li>No es la "caída libre" ideal de los libros (solo peso): aquí el aire sí importa.</li>
          </ul>
          {d.type === "estes" && ph.exists && (
            <p>En un cohete Estes esta fase dura lo que el retardo excede al tiempo ideal: {d.motor.delay} s − {format(res.idealDelay ?? 0, 1)} s = <b>{format(tf, 1)} s</b>.</p>
          )}
        </StageBlock>

        <StageBlock stage="matematicas">
          <Eq block tex={r`m\,\frac{dv}{dt} = -mg + \tfrac12\rho v^2 C_d A \quad (v < 0)`} />
          <p>Con <Eq tex="\rho" />, <Eq tex="m" /> y <Eq tex="C_d" /> constantes y partiendo del reposo, la solución exacta usa la tangente hiperbólica:</p>
          <Eq block tex={r`v_t = \sqrt{\frac{2mg}{\rho C_d A}}, \qquad v(t) = -v_t \tanh\!\left(\frac{g\,t}{v_t}\right), \qquad \Delta h = -\frac{v_t^2}{g}\ln\cosh\!\left(\frac{g\,t}{v_t}\right)`} />
          <p>Para tiempos cortos, <Eq tex="\tanh x \approx x" /> y se recupera la caída libre ideal <Eq tex="v \approx -gt" />.</p>
          <YourRocket>
            <Eq block tex={r`v_t = \sqrt{\frac{2(${n(mass, 4)})(9.81)}{(${n(rho, 3)})(${n(cd, 3)})(${n(A * 1e4, 2)}\times10^{-4})}} = ${n(vt, 1)}\ \text{m/s}`} />
            {ph.exists && (
              <>
                <Eq block tex={r`v(${n(tf, 2)}) = -${n(vt, 1)}\tanh\!\left(\tfrac{9.81(${n(tf, 2)})}{${n(vt, 1)}}\right) = ${n(vExact, 2)}\ \text{m/s} \quad (\text{simulación: } ${n(end.v, 2)})`} />
                <Eq block tex={r`\Delta h = -${n(dhExact, 1)}\ \text{m} \quad (\text{simulación: } ${n(end.h - nearest(res.samples, ph.from).h, 1)}\ \text{m})`} />
              </>
            )}
          </YourRocket>
        </StageBlock>

        <StageBlock stage="computacion">
          <p>La misma función de derivadas sirve: el signo de <Eq tex="v|v|" /> hace que el arrastre cambie de dirección solo. Se integra hasta que se abre el paracaídas o el cohete toca el suelo.</p>
          <Code>{`
% Fase 3: caída sin paracaídas, desde el apogeo
t = t_ap;  y = [h_ap; 0];
while t < t_eyeccion && y(1) > 0
    y = paso_rk4(@derivadas, t, y, dt, p);
    t = t + dt;
end

% Comparar con la solución exacta
vt = sqrt(2*m*g/(rho*Cd*A));                % velocidad terminal sin paracaídas
tt = linspace(0, t - t_ap, 200);
v_exacta = -vt*tanh(g*tt/vt);
h_exacta = h_ap - vt^2/g*log(cosh(g*tt/vt));
plot(t_ap + tt, v_exacta, '--', t_ap + tt, -vt*ones(size(tt)), ':');
          `}</Code>
        </StageBlock>
      </div>

      <PhaseFacts result={res} id={3} />
      <PhaseCharts result={res} id={3} extra={{ title: "Velocidad: numérica vs. exacta", yLabel: "Velocidad (m/s)", series: compare }} />
      <Think>
        <ul>
          <li>¿Por qué la curva de velocidad empieza como una recta de pendiente −g y luego se curva?</li>
          <li>¿Cuánto tardaría tu cohete en llegar al 90 % de su velocidad terminal? (Pista: <Eq tex="\tanh x = 0.9" /> cuando <Eq tex="x \approx 1.47" />.)</li>
          <li>Si el retardo del motor es muy largo, ¿a qué velocidad se abriría el paracaídas? ¿Qué le puede pasar?</li>
        </ul>
      </Think>
    </div>
  );
}
