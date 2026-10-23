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

export function Phase4Lesson({ design: d, result: res, onPhase }: { design: Design; result: FlightResult; onPhase: (id: PhaseId) => void }) {
  const ph = phaseOf(res, 4);
  const samples = within(res.samples, ph.from, ph.to);
  const { rho, cd, mass } = phaseAverages(d, samples.length > 2 ? samples : res.samples.slice(-20));
  const A = useMemo(() => dragModel(d).refArea, [d]);
  const Ap = (Math.PI / 4) * (d.recovery.diameter / 1000) ** 2;
  const cdA = cd * A + d.recovery.cd * Ap;
  const vt = Math.sqrt((2 * mass * G) / (rho * cdA));
  const start = nearest(res.samples, ph.from);
  const v0 = Math.abs(start.v);
  const shock = (0.5 * start.density * v0 * v0 * cdA) / mass - G;
  const peak = samples.reduce((m, s) => Math.max(m, s.a), 0);
  const tLand = ph.to - ph.from;
  const energy = 0.5 * mass * res.descentRate ** 2;

  const compare = useMemo(() => [
    { label: "v simulada", points: series(samples, (s) => s.v), color: "#1d7a3e" },
    { label: "−v_t (terminal con paracaídas)", points: [{ x: ph.from, y: -vt }, { x: ph.to, y: -vt }], color: "#b3261e", dashed: true },
  ], [samples, vt, ph.from, ph.to]);

  if (!ph.exists) {
    return (
      <div className="lesson">
        <PhaseHeader result={res} id={4} onPick={onPhase} intro={<>Del momento en que se abre el paracaídas hasta que el cohete toca el suelo.</>} />
        <MissingPhase id={4}>
          <p>{ph.note}</p>
          <p>Sin paracaídas, el cohete toca el suelo a <b>{format(res.descentRate, 1)} m/s</b> ({format(res.descentRate * 3.6, 0)} km/h). Agrega uno en la pestaña Cohete para ver esta fase.</p>
        </MissingPhase>
      </div>
    );
  }

  return (
    <div className="lesson">
      <PhaseHeader
        result={res}
        id={4}
        onPick={onPhase}
        intro={<>Se abre el paracaídas a {format(start.h, 1)} m de altura. El arrastre crece de golpe, frena al cohete hasta su <b>velocidad terminal</b> y lo baja suavemente: aterriza a {format(res.descentRate, 1)} m/s después de {format(tLand, 1)} s.</>}
      />
      <div className="lesson-grid">
        <StageBlock stage="fisica">
          <ul>
            <li>El paracaídas tiene un área mucho mayor que el cohete: el arrastre se multiplica de golpe.</li>
            <li>
              Ese aumento brusco produce un <b>tirón</b> (desaceleración grande). Entre más rápido vaya el cohete al abrirse, más fuerte es el tirón: por eso
              conviene abrirlo cerca del apogeo.
            </li>
            <li>Después, el arrastre crece hasta igualar al peso: la fuerza neta es cero, la aceleración también, y el cohete baja a <b>velocidad constante</b> (terminal).</li>
            <li>La gráfica de altura se vuelve casi una recta: la pendiente es la velocidad terminal.</li>
          </ul>
          <p>Se recomienda aterrizar a menos de 6 m/s para no dañar el cohete.</p>
        </StageBlock>

        <StageBlock stage="matematicas">
          <Eq block tex={r`m\,\frac{dv}{dt} = -mg + \tfrac12\rho v^2\left(C_d A + C_{d,p} A_p\right)`} />
          <p>Velocidad terminal (cuando <Eq tex="dv/dt = 0" />) y tirón al abrirse con velocidad <Eq tex="v_0" />:</p>
          <Eq block tex={r`v_t = \sqrt{\frac{2mg}{\rho\,(C_dA + C_{d,p}A_p)}} \qquad a_{apertura} = \frac{\tfrac12\rho v_0^2(C_dA + C_{d,p}A_p)}{m} - g`} />
          <p>Tiempo aproximado de descenso y energía al tocar el suelo:</p>
          <Eq block tex={r`t_{descenso} \approx \frac{h_0}{v_t} \qquad E_c = \tfrac12 m v_{suelo}^2`} />
          <YourRocket>
            <Eq block tex={r`A_p = \tfrac{\pi}{4}(${n(d.recovery.diameter / 1000, 3)})^2 = ${n(Ap, 4)}\ \text{m}^2 \quad (${n(Ap / A, 0)}\ \text{veces el área del cohete})`} />
            <Eq block tex={r`v_t = \sqrt{\frac{2(${n(mass, 4)})(9.81)}{(${n(rho, 3)})(${n(cdA, 5)})}} = ${n(vt, 2)}\ \text{m/s} \quad (\text{simulación: } ${n(res.descentRate, 2)})`} />
            <Eq block tex={r`a_{apertura} = \frac{\tfrac12(${n(start.density, 3)})(${n(v0, 1)})^2(${n(cdA, 5)})}{${n(mass, 4)}} - 9.81 = ${n(shock, 0)}\ \text{m/s}^2 \approx ${n(shock / G, 1)}\,g`} />
            <Eq block tex={r`t_{descenso} \approx \frac{${n(start.h, 1)}}{${n(vt, 2)}} = ${n(start.h / vt, 1)}\ \text{s}\ (\text{simulación: } ${n(tLand, 1)}) \qquad E_c = ${n(energy, 2)}\ \text{J}`} />
          </YourRocket>
          <p className="hint">El modelo abre el paracaídas instantáneamente; en la realidad tarda unas décimas de segundo en inflarse y el tirón es menor (la simulación marca {format(peak / G, 1)} g).</p>
        </StageBlock>

        <StageBlock stage="computacion">
          <p>La única diferencia con las fases anteriores es que, desde el evento de apertura, el área de arrastre incluye el paracaídas. El aterrizaje es otro evento: cuando <Eq tex="h \le 0" />.</p>
          <Code>{`
% Fase 4: paracaídas abierto hasta tocar el suelo
p.CdA = p.Cd*p.A + p.Cdp*p.Ap;                % el paracaídas suma área
dt = 0.01;                                    % aquí todo cambia despacio
while y(1) > 0
    y = paso_rk4(@derivadas, t, y, dt, p);
    t = t + dt;
end
fprintf('Aterriza a %.1f m/s a los %.1f s\\n', abs(y(2)), t);

vt = sqrt(2*m*g/(rho*p.CdA));                 % velocidad terminal teórica
yline(-vt, '--', 'v_t');
          `}</Code>
        </StageBlock>
      </div>

      <PhaseFacts result={res} id={4} />
      <PhaseCharts result={res} id={4} extra={{ title: "Velocidad y velocidad terminal", yLabel: "Velocidad (m/s)", series: compare }} />
      <Think>
        <ul>
          <li>Si duplicas el diámetro del paracaídas, ¿cuánto cambia la velocidad terminal? (Pista: el área crece con <Eq tex="D^2" />.)</li>
          <li>¿Por qué el tirón al abrirse es mucho mayor si el paracaídas se abre con el cohete todavía subiendo rápido?</li>
          <li>Con viento, el cohete se desplaza mientras baja. ¿Qué paracaídas se aleja más: uno grande o uno pequeño?</li>
        </ul>
      </Think>
    </div>
  );
}
