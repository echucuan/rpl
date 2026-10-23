import { useMemo } from "react";
import type { Design } from "../../model";
import { a10Motor } from "../../motor";
import { air, G } from "../../physics/atmosphere";
import { dragModel } from "../../physics/drag";
import { simulate, type FlightResult } from "../../physics/simulate";
import { format } from "../fields";
import { nearest, series, within, type PhaseId } from "../phases";
import { Code, Eq, StageBlock, Think, YourRocket, n } from "./common";
import { CdBars } from "./diagrams";
import { PhaseCharts, PhaseFacts, PhaseHeader, phaseAverages, phaseOf } from "./phaseCommon";

const r = String.raw;

export function Phase2Lesson({ design: d, result: res, onPhase }: { design: Design; result: FlightResult; onPhase: (id: PhaseId) => void }) {
  const ph = phaseOf(res, 2);
  const samples = within(res.samples, ph.from, ph.to);
  const start = nearest(res.samples, ph.from), end = nearest(res.samples, ph.to);
  const { rho, cd, mass } = phaseAverages(d, samples);
  const model = useMemo(() => dragModel(d, d.type === "water" ? d.water.nozzleDiameter : (d.type === "estes" ? 13 : 0) * 0.5), [d]);
  const A = model.refArea;
  const k = (rho * cd * A) / (2 * mass);
  const vb = start.v;
  const tUp = Math.atan(vb * Math.sqrt(k / G)) / Math.sqrt(G * k);
  const dhUp = Math.log(1 + (k * vb * vb) / G) / (2 * k);
  const energy = start.h + (vb * vb) / (2 * G);
  const vacuum = useMemo(() => {
    const v = simulate(d, { noDrag: true, untilApogee: true });
    return typeof v === "string" ? null : v;
  }, [d]);
  const atm = air(start.h, d.launch.altitude, d.launch.temperature);
  const parts = model.breakdown(vb, vb / atm.soundSpeed, atm.kinematicViscosity, false);
  const motor = d.type === "estes" ? a10Motor(d.motor.mass, d.motor.propellant) : undefined;

  const analytic = useMemo(() => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * tUp;
      pts.push({ x: ph.from + t, y: Math.sqrt(G / k) * Math.tan(Math.atan(vb * Math.sqrt(k / G)) - Math.sqrt(G * k) * t) });
    }
    return [
      { label: "v simulada (RK4)", points: series(samples, (s) => s.v), color: "#0039a6" },
      { label: "v exacta (ρ, m, Cd constantes)", points: pts, color: "#e0701b", dashed: true },
    ];
  }, [samples, tUp, k, vb, ph.from]);

  return (
    <div className="lesson">
      <PhaseHeader
        result={res}
        id={2}
        onPick={onPhase}
        intro={<>Se acabó el empuje: el cohete sigue subiendo por inercia, pero el peso y el arrastre lo frenan. La velocidad <b>disminuye</b> de {format(vb, 1)} m/s a {format(end.v, 1)} m/s en {format(ph.to - ph.from, 2)} s.</>}
      />
      <div className="lesson-grid">
        <StageBlock stage="fisica">
          <ul>
            <li>Ya no hay empuje. El <b>peso</b> apunta hacia abajo y el <b>arrastre</b> también (se opone a la velocidad, que todavía es hacia arriba).</li>
            <li>Por eso la aceleración es <b>más negativa que −g</b>: el cohete frena más rápido que una piedra lanzada hacia arriba.</li>
            <li>Al principio, cuando va más rápido, el arrastre es grande; conforme frena, el arrastre se hace pequeño y la aceleración se acerca a −g.</li>
            <li>La fase termina en el <b>apogeo</b>, donde la velocidad es cero: el arrastre desaparece y la aceleración vale exactamente −g.</li>
          </ul>
          {motor && res.idealDelay !== null && (
            <p>
              Para un motor Estes, esta fase coincide con el <b>retardo</b>: lo ideal es que la carga de eyección se active justo en el apogeo. En tu
              cohete esta fase dura <b>{format(res.idealDelay, 1)} s</b> y elegiste un retardo de <b>3 s</b>.
            </p>
          )}
          <p>De qué está hecho el arrastre al empezar la fase ({format(vb, 0)} m/s):</p>
          <CdBars parts={parts} />
        </StageBlock>

        <StageBlock stage="matematicas">
          <Eq block tex={r`m\,\frac{dv}{dt} = -mg - \tfrac12\rho v^2 C_d A \quad (v > 0)`} />
          <p>Si suponemos <Eq tex="\rho" />, <Eq tex="m" /> y <Eq tex="C_d" /> constantes, con <Eq tex="k = \rho C_d A / 2m" />, la ecuación tiene solución exacta:</p>
          <Eq block tex={r`v(t) = \sqrt{\tfrac{g}{k}}\;\tan\!\left(\arctan\!\left(v_b\sqrt{\tfrac{k}{g}}\right) - \sqrt{gk}\,t\right)`} />
          <Eq block tex={r`t_{sub} = \frac{\arctan\left(v_b\sqrt{k/g}\right)}{\sqrt{gk}} \qquad \Delta h_{sub} = \frac{1}{2k}\ln\!\left(1 + \frac{k\,v_b^2}{g}\right)`} />
          <p>Sin aire (<Eq tex="k \to 0" />) se recupera la conservación de la energía:</p>
          <Eq block tex={r`\Delta h = \frac{v_b^2}{2g}`} />
          <YourRocket>
            <Eq block tex={r`k = \frac{(${n(rho, 3)})(${n(cd, 3)})(${n(A * 1e4, 2)}\times10^{-4})}{2(${n(mass, 4)})} = ${n(k, 5)}\ \text{m}^{-1}`} />
            <Eq block tex={r`t_{sub} = ${n(tUp, 2)}\ \text{s}\ \ (\text{simulación: } ${n(ph.to - ph.from, 2)}) \qquad \Delta h_{sub} = ${n(dhUp, 1)}\ \text{m}\ \ (\text{simulación: } ${n(end.h - start.h, 1)})`} />
            <Eq block tex={r`\text{Sin aire: } h_{max} = ${n(start.h, 1)} + \frac{${n(vb, 1)}^2}{2(9.81)} = ${n(energy, 1)}\ \text{m} \quad\text{vs.}\quad ${n(res.apogee.h, 1)}\ \text{m con aire}`} />
            {ph.note && <p className="hint">Como el paracaídas se abrió antes del apogeo, la fase simulada termina antes y no se puede comparar directamente con <Eq tex="t_{sub}" /> y <Eq tex="\Delta h_{sub}" />.</p>}
            {vacuum && <Eq block tex={r`\text{Todo el vuelo sin aire: } ${n(vacuum.apogee.h, 1)}\ \text{m} \Rightarrow \text{el aire quita } ${n(((vacuum.apogee.h - res.apogee.h) / vacuum.apogee.h) * 100, 0)}\%`} />}
          </YourRocket>
        </StageBlock>

        <StageBlock stage="computacion">
          <p>
            Se sigue integrando con RK4, ahora con empuje cero. Lo nuevo es detectar el <b>evento</b> del apogeo: el paso en que la velocidad cambia de
            signo. Dentro de ese paso se interpola linealmente:
          </p>
          <Eq block tex={r`t^* = t_n + \Delta t\,\frac{v_n}{v_n - v_{n+1}}`} />
          <Code>{`
% Fase 2: integrar hasta que la velocidad cambie de signo
while true
    y_nuevo = paso_rk4(@derivadas, t, y, dt, p);
    if y(2) > 0 && y_nuevo(2) <= 0                  % se cruzó v = 0
        t_ap = t + dt*y(2)/(y(2) - y_nuevo(2));     % interpolación lineal
        h_ap = y(1) + (t_ap - t)*y(2);
        break
    end
    t = t + dt;  y = y_nuevo;
end
fprintf('Apogeo: %.1f m a los %.2f s\\n', h_ap, t_ap);
          `}</Code>
          <p>MATLAB también puede hacerlo con <code>ode45</code> y una función de eventos:</p>
          <Code>{`
opciones = odeset('Events', @apogeo, 'RelTol', 1e-8);
[t, y, t_ap, y_ap] = ode45(@(t,y) derivadas(t, y, p), [t_b 60], [h_b; v_b], opciones);

function [valor, terminal, direccion] = apogeo(~, y)
    valor = y(2);       % el evento ocurre cuando v = 0
    terminal = 1;       % detener la integración
    direccion = -1;     % solo cuando v pasa de positiva a negativa
end
          `}</Code>
          <Code>{`
% Comparar con la solución exacta (rho, m y Cd constantes)
k = rho*Cd*A/(2*m);
t_sub  = atan(v_b*sqrt(k/g))/sqrt(g*k);
dh_sub = log(1 + k*v_b^2/g)/(2*k);
tt = linspace(0, t_sub, 100);
v_exacta = sqrt(g/k)*tan(atan(v_b*sqrt(k/g)) - sqrt(g*k)*tt);
plot(t_b + tt, v_exacta, '--');
          `}</Code>
        </StageBlock>
      </div>

      <PhaseFacts result={res} id={2} />
      <PhaseCharts result={res} id={2} extra={{ title: "Velocidad: numérica vs. exacta", yLabel: "Velocidad (m/s)", series: analytic }} />
      <Think>
        <ul>
          <li>¿Por qué la aceleración en esta fase es más negativa que −9.81 m/s²? ¿En qué instante vale exactamente −g?</li>
          <li>La solución exacta supone ρ, m y C<sub>d</sub> constantes. ¿Cuál de esas suposiciones es la menos cierta en tu cohete?</li>
          <li>¿Qué porcentaje de la altura le quita el aire a tu cohete? ¿Cambia mucho si lijas los bordes de las aletas?</li>
        </ul>
      </Think>
    </div>
  );
}
