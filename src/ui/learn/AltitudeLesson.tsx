import { useMemo } from "react";
import type { Design } from "../../model";
import { G } from "../../physics/atmosphere";
import { simulate, type FlightResult } from "../../physics/simulate";
import { LineChart, type Series } from "../LineChart";
import { flightMarkers, flightSpans, series, thin } from "../phases";
import { format } from "../fields";
import { Code, Eq, LessonHeader, StageBlock, Think, YourRocket, n } from "./common";

const r = String.raw;

export function AltitudeLesson({ design: d, result: res }: { design: Design; result: FlightResult }) {
  const shown = useMemo(() => thin(res), [res]);
  const vacuum = useMemo(() => {
    const v = simulate(d, { noDrag: true, untilApogee: true });
    return typeof v === "string" ? null : v;
  }, [d]);
  const bo = res.burnout ?? { t: 0, h: 0, v: 0 };
  const coastIdeal = bo.h + (bo.v * bo.v) / (2 * G);
  const lostToDrag = vacuum ? ((vacuum.apogee.h - res.apogee.h) / vacuum.apogee.h) * 100 : 0;

  const charts = useMemo(() => {
    const out: Series[] = [{ label: "h(t) con aire", points: series(shown, (s) => s.h), color: "#0039a6" }];
    if (vacuum) out.push({ label: "h(t) sin aire (vacío)", points: series(thin(vacuum, 400), (s) => s.h), color: "#5b6270", dashed: true });
    return out;
  }, [shown, vacuum]);
  const spans = useMemo(() => flightSpans(res, d.type === "water"), [res, d.type]);
  const markers = useMemo(() => flightMarkers(res), [res]);
  const xMax = Math.max(res.apogee.t, vacuum?.apogee.t ?? 0) * 1.5;

  return (
    <div className="lesson">
      <LessonHeader
        title="4. Altura: acumular la velocidad"
        intro={<>Igual que la velocidad acumula la aceleración, la altura acumula la velocidad: <Eq tex="h(t)" /> es el área bajo <Eq tex="v(t)" />. El punto más alto, el <b>apogeo</b>, es donde la velocidad cambia de signo.</>}
      />
      <div className="lesson-grid">
        <StageBlock stage="fisica">
          <ul>
            <li>Mientras la velocidad es positiva el cohete sube; la pendiente de <Eq tex="h(t)" /> es la velocidad.</li>
            <li>En el <b>apogeo</b> la pendiente es cero: el cohete se detiene un instante ({format(res.apogee.h, 1)} m a los {format(res.apogee.t, 2)} s).</li>
            <li>El aire le quita energía al cohete durante todo el vuelo. Sin aire, el cohete subiría mucho más: compara las dos curvas de la gráfica.</li>
            <li>Al bajar con paracaídas la curva es casi una recta: velocidad constante (terminal).</li>
          </ul>
        </StageBlock>

        <StageBlock stage="matematicas">
          <Eq block tex={r`\frac{dh}{dt} = v \quad\Longrightarrow\quad h(t) = \int_0^{t} v(\tau)\,d\tau`} />
          <p>Desde el fin del empuje y sin aire, la conservación de la energía da una cota superior del apogeo:</p>
          <Eq block tex={r`\tfrac12 m v_b^2 + m g h_b = m g\,h_{max} \;\Longrightarrow\; h_{max} = h_b + \frac{v_b^2}{2g}`} />
          <YourRocket>
            <Eq block tex={r`h_{max} \le ${n(bo.h, 1)} + \frac{(${n(bo.v, 1)})^2}{2(9.81)} = ${n(coastIdeal, 1)}\ \text{m}`} />
            <Eq block tex={r`\text{Simulación con aire: } h_{max} = ${n(res.apogee.h, 1)}\ \text{m}`} />
            {vacuum && <Eq block tex={r`\text{Simulación sin aire (todo el vuelo): } ${n(vacuum.apogee.h, 1)}\ \text{m} \;\Rightarrow\; \text{el aire quita } ${n(lostToDrag, 0)}\%`} />}
          </YourRocket>
        </StageBlock>

        <StageBlock stage="computacion">
          <p>
            Para la computadora, altura y velocidad son un solo <b>sistema de ecuaciones de primer orden</b> que se integra junto. La ecuación de segundo
            orden <Eq tex="\ddot h = a" /> se convierte en dos de primer orden:
          </p>
          <Eq block tex={r`\vec y = \begin{pmatrix} h \\ v \end{pmatrix}, \qquad \frac{d\vec y}{dt} = \vec f(t,\vec y) = \begin{pmatrix} v \\ a(t,h,v) \end{pmatrix}`} />
          <p>
            El apogeo se detecta como un <b>evento</b>: el paso en que la velocidad cambia de positiva a negativa. Para precisarlo dentro del paso se
            interpola linealmente:
          </p>
          <Eq block tex={r`t^* = t_n + \Delta t\,\frac{v_n}{v_n - v_{n+1}}`} />
          <Code>{`
let estado = [0, 0];                          // [h, v] en la plataforma
for (let t = 0; t < tMax; t += dt) {
  const siguiente = pasoRK4(t, estado, dt);
  if (estado[1] > 0 && siguiente[1] <= 0) apogeo = { t, h: siguiente[0] };
  if (despego && siguiente[0] <= 0) break;   // tocó el suelo
  estado = siguiente;
}
          `}</Code>
        </StageBlock>
      </div>

      <div className="card">
        <LineChart title="Altura h(t): con aire y sin aire" xLabel="Tiempo (s)" yLabel="Altura (m)" series={charts} spans={spans} markers={markers} height={300} xMax={xMax} />
      </div>
      <Think>
        <ul>
          <li>¿Por qué la cota de energía <Eq tex="h_b + v_b^2/2g" /> es mayor que la altura simulada?</li>
          <li>¿Qué porcentaje de la altura se pierde por el aire en tu cohete? ¿Cambia mucho si lijas los bordes de las aletas (perfil redondeado)?</li>
          <li>En la gráfica real del altímetro, ¿cómo reconocerías el momento en que se abre el paracaídas?</li>
        </ul>
      </Think>
    </div>
  );
}
