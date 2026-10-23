import type { Design } from "../../model";
import { layout, pressureTerms } from "../../physics/geometry";
import type { FlightResult } from "../../physics/simulate";
import { format } from "../fields";
import { RocketView } from "../RocketView";
import { Code, Eq, LessonHeader, StageBlock, Think, YourRocket, n } from "./common";

const r = String.raw;

export function StabilityLesson({ design: d, result: res }: { design: Design; result: FlightResult }) {
  const items = res.massItems;
  const mass = items.reduce((s, i) => s + i.mass, 0);
  const moment = items.reduce((s, i) => s + i.mass * i.x, 0);
  const terms = pressureTerms(d);
  const cnSum = terms.reduce((s, t) => s + t.cn, 0);
  const cnMoment = terms.reduce((s, t) => s + t.cn * t.x, 0);
  const st = res.stabilityLoaded;
  const ref = layout(d).refDiameter;

  return (
    <div className="lesson">
      <LessonHeader
        title="5. Estabilidad: ¿por qué vuela derecho?"
        intro={<>Un cohete estable regresa solo a la vertical cuando algo lo inclina (una ráfaga, la salida de la guía). Depende de dos puntos: el <b>centro de gravedad</b> (CG) y el <b>centro de presión</b> (CP).</>}
      />
      <div className="card"><RocketView design={d} loaded={res.stabilityLoaded} empty={res.stabilityEmpty} /></div>
      <div className="lesson-grid">
        <StageBlock stage="fisica">
          <ul>
            <li>El cohete gira alrededor de su <b>centro de gravedad</b>, el punto donde se puede considerar concentrado su peso.</li>
            <li>Cuando el cohete se inclina un ángulo <Eq tex="\alpha" />, el aire lo empuja de lado. Esa fuerza actúa en el <b>centro de presión</b>.</li>
            <li>Si el CP está <b>detrás</b> del CG, la fuerza del aire produce una torca que endereza al cohete, como una veleta. Si está delante, la torca lo voltea: inestable.</li>
            <li>Por eso las aletas van atrás (mueven el CP hacia la cola) y a veces se agrega lastre en la nariz (mueve el CG hacia adelante).</li>
          </ul>
          <p>
            La distancia entre ambos, medida en diámetros del cuerpo (calibres), es el <b>margen de estabilidad</b>. Lo recomendado es entre 1 y 2.
            {d.type === "water" ? " En el cohete de agua el agua está en la cola, así que el CG se mueve hacia adelante conforme el agua sale." : " Al quemarse el propelente el CG se mueve un poco hacia la nariz."}
          </p>
        </StageBlock>

        <StageBlock stage="matematicas">
          <p>Centro de gravedad: promedio de las posiciones pesado por las masas (medidas desde la punta de la nariz):</p>
          <Eq block tex={r`x_{CG} = \frac{\sum_i m_i\,x_i}{\sum_i m_i}`} />
          <p>
            Centro de presión con el <b>método de Barrowman</b>: cada parte aporta una fuerza normal proporcional a <Eq tex="C_{N\alpha}" /> en su propio
            centro <Eq tex="x_i" />. La nariz siempre aporta <Eq tex="C_{N\alpha}=2" />; las aletas (N aletas, altura s, cuerdas <Eq tex="c_r, c_t" />):
          </p>
          <Eq block tex={r`C_{N\alpha,\,aletas} = \left(1 + \frac{R}{s+R}\right)\frac{4N\,(s/d)^2}{1+\sqrt{1+\left(\frac{2\ell_m}{c_r+c_t}\right)^2}}`} />
          <Eq block tex={r`x_{CP} = \frac{\sum_i C_{N\alpha,i}\,x_i}{\sum_i C_{N\alpha,i}} \qquad \text{margen} = \frac{x_{CP}-x_{CG}}{d}`} />
          {d.type === "water" && (
            <p>
              El hombro de la botella se angosta hacia atrás (como una cola de bote), así que su <Eq tex="C_{N\alpha}" /> es <b>negativo</b>: mueve el CP hacia
              adelante. Por eso los cohetes de agua necesitan aletas grandes.
            </p>
          )}
          <YourRocket>
            <Eq block tex={r`x_{CG} = \frac{${n(moment, 0)}\ \text{g·mm}}{${n(mass, 1)}\ \text{g}} = ${n(st.cg, 1)}\ \text{mm}`} />
            <Eq block tex={r`x_{CP} = \frac{${n(cnMoment, 1)}}{${n(cnSum, 3)}} = ${n(st.cp, 1)}\ \text{mm}`} />
            <Eq block tex={r`\text{margen} = \frac{${n(st.cp, 1)} - ${n(st.cg, 1)}}{${n(ref, 1)}} = \mathbf{${n(st.margin, 2)}\ \text{calibres}}`} />
          </YourRocket>
        </StageBlock>

        <StageBlock stage="computacion">
          <p>La computadora recorre la lista de piezas y suma. Estas son las tablas que usa con tu cohete:</p>
          <table className="summary">
            <thead><tr><th>Pieza</th><th className="num">m (g)</th><th className="num">x (mm)</th><th className="num">m·x</th></tr></thead>
            <tbody>
              {items.map((i, k) => <tr key={k}><td>{i.name}</td><td className="num">{format(i.mass, 1)}</td><td className="num">{format(i.x, 0)}</td><td className="num">{format(i.mass * i.x, 0)}</td></tr>)}
              <tr><td><b>Suma</b></td><td className="num"><b>{format(mass, 1)}</b></td><td /><td className="num"><b>{format(moment, 0)}</b></td></tr>
            </tbody>
          </table>
          <table className="summary" style={{ marginTop: 12 }}>
            <thead><tr><th>Parte (Barrowman)</th><th className="num">C<sub>Nα</sub></th><th className="num">x (mm)</th><th className="num">C<sub>Nα</sub>·x</th></tr></thead>
            <tbody>
              {terms.map((t) => <tr key={t.name}><td>{t.name}</td><td className="num">{format(t.cn, 3)}</td><td className="num">{format(t.x, 0)}</td><td className="num">{format(t.cn * t.x, 1)}</td></tr>)}
              <tr><td><b>Suma</b></td><td className="num"><b>{format(cnSum, 3)}</b></td><td /><td className="num"><b>{format(cnMoment, 1)}</b></td></tr>
            </tbody>
          </table>
          <Code>{`
// Centro de gravedad: promedio ponderado por masa
const masa = piezas.reduce((s, p) => s + p.masa, 0);
const xCG  = piezas.reduce((s, p) => s + p.masa * p.x, 0) / masa;

// Centro de presión: promedio ponderado por C_Nα (Barrowman)
const CN  = terminos.reduce((s, t) => s + t.cn, 0);
const xCP = terminos.reduce((s, t) => s + t.cn * t.x, 0) / CN;
const margen = (xCP - xCG) / diametro;
          `}</Code>
        </StageBlock>
      </div>
      <Think>
        <ul>
          <li>Agrega 10 g de lastre en la nariz en la pestaña Cohete. ¿Cuánto cambia el margen? ¿Y la altura máxima?</li>
          <li>Comprueba el CG de tu cohete real colgándolo de un hilo hasta que quede horizontal. ¿Coincide con el calculado?</li>
          <li>¿Por qué un margen demasiado grande (más de 3) también es malo cuando hay viento?</li>
        </ul>
      </Think>
    </div>
  );
}
