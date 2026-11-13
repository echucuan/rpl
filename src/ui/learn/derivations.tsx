import type { ReactNode } from "react";
import { DerivationZoom, Eq, n } from "./common";

const r = String.raw;

/*
 * Worked derivations shown with DerivationZoom in phases II–IV: the compact view gives the differential equation and its
 * solution; the zoom reveals the procedure step by step.
 */

/** v(t) with constant ΣF/m and the phase clock starting at t_i (phases II and III without drag). */
export function ConstantV({ phase, note }: { phase: string; note?: ReactNode }) {
  return (
    <DerivationZoom
      title={`${phase} · v(t) con suma de fuerzas constante`}
      ode={r`\frac{dv}{dt} = \frac{\sum F}{m} = -g, \qquad v(t_i) = v_i`}
      result={r`v(t) = v_i + \frac{\sum F}{m}\,(t - t_i)`}
      note={note}
      steps={[
        {
          title: "Identificamos la ecuación",
          body: (
            <>
              <p>Sin empuje y sin arrastre solo queda el peso, así que <Eq tex={r`\frac{\sum F}{m} = -g`} /> es <b>constante</b>. La fase empieza en <Eq tex={r`t_i`} /> con velocidad <Eq tex={r`v_i`} />:</p>
              <Eq block tex={r`\frac{dv}{dt} = \frac{\sum F}{m}, \qquad v(t_i) = v_i`} />
            </>
          ),
        },
        {
          title: "Separamos las variables",
          body: <Eq block tex={r`dv = \frac{\sum F}{m}\,dt`} />,
        },
        {
          title: "Ponemos los límites de integración",
          body: (
            <>
              <p>Ahora el reloj de la fase empieza en <Eq tex={r`t_i`} />, no en cero: al tiempo <Eq tex={r`t_i`} /> la velocidad es <Eq tex={r`v_i`} />; al tiempo <Eq tex={r`t`} />, es <Eq tex={r`v`} />.</p>
              <Eq block tex={r`\int_{v_i}^{v} dv = \int_{t_i}^{t} \frac{\sum F}{m}\,dt`} />
            </>
          ),
        },
        {
          title: "Integramos los dos lados",
          body: (
            <>
              <p>A la izquierda queda <Eq tex={r`v`} /> evaluada entre sus límites; a la derecha la constante sale de la integral:</p>
              <Eq block tex={r`\Big[\,v\,\Big]_{v_i}^{v} = \frac{\sum F}{m}\Big[\,t\,\Big]_{t_i}^{t} \quad\Rightarrow\quad v - v_i = \frac{\sum F}{m}\,(t - t_i)`} />
            </>
          ),
        },
        {
          title: "Despejamos v",
          body: (
            <>
              <Eq block tex={r`v(t) = v_i + \frac{\sum F}{m}\,(t - t_i)`} />
              <p className="hint">Comprueba: en <Eq tex={r`t = t_i`} /> el paréntesis vale cero y queda <Eq tex={r`v = v_i`} />.</p>
            </>
          ),
        },
      ]}
    />
  );
}

/** s(t) for constant ΣF/m from t_i (phases II and III without drag). */
export function ConstantS({ phase, note }: { phase: string; note?: ReactNode }) {
  return (
    <DerivationZoom
      title={`${phase} · s(t) con suma de fuerzas constante`}
      ode={r`\frac{ds}{dt} = v_i + \frac{\sum F}{m}\,(t - t_i), \qquad s(t_i) = s_i`}
      result={r`s(t) = s_i + v_i\,(t - t_i) + \frac12\,\frac{\sum F}{m}\,(t - t_i)^2`}
      note={note}
      steps={[
        {
          title: "Sustituimos el modelo de la velocidad",
          body: <Eq block tex={r`\frac{ds}{dt} = v(t) = v_i + \frac{\sum F}{m}\,(t - t_i)`} />,
        },
        {
          title: "Separamos las variables y ponemos los límites",
          body: (
            <>
              <p>Al tiempo <Eq tex={r`t_i`} /> el cohete está en <Eq tex={r`s_i`} />; al tiempo <Eq tex={r`t`} />, en <Eq tex={r`s`} />:</p>
              <Eq block tex={r`\int_{s_i}^{s} ds = \int_{t_i}^{t} \left(v_i + \frac{\sum F}{m}\,(t - t_i)\right)dt`} />
            </>
          ),
        },
        {
          title: "Lado izquierdo",
          body: <Eq block tex={r`\int_{s_i}^{s} ds = \Big[\,s\,\Big]_{s_i}^{s} = s - s_i`} />,
        },
        {
          title: "Lado derecho, término 1",
          body: (
            <>
              <p><Eq tex={r`v_i`} /> es constante:</p>
              <Eq block tex={r`\int_{t_i}^{t} v_i\,dt = v_i\Big[\,t\,\Big]_{t_i}^{t} = v_i\,(t - t_i)`} />
            </>
          ),
        },
        {
          title: "Lado derecho, término 2: cambio de variable",
          body: (
            <>
              <p>Llamamos <Eq tex={r`u = t - t_i`} />, así <Eq tex={r`du = dt`} />. Los límites cambian: cuando <Eq tex={r`t = t_i`} />, <Eq tex={r`u = 0`} />; cuando el tiempo es <Eq tex={r`t`} />, <Eq tex={r`u = t - t_i`} />. Queda la regla de la potencia:</p>
              <Eq block tex={r`\frac{\sum F}{m}\int_0^{t - t_i} u\,du = \frac{\sum F}{m}\left[\frac{u^2}{2}\right]_0^{t - t_i} = \frac12\,\frac{\sum F}{m}\,(t - t_i)^2`} />
            </>
          ),
        },
        {
          title: "Juntamos y despejamos s",
          body: (
            <>
              <Eq block tex={r`s - s_i = v_i\,(t - t_i) + \frac12\,\frac{\sum F}{m}\,(t - t_i)^2 \quad\Rightarrow\quad s(t) = s_i + v_i\,(t - t_i) + \frac12\,\frac{\sum F}{m}\,(t - t_i)^2`} />
              <p className="hint">Es el modelo de la Fase I con <Eq tex={r`t`} /> cambiado por <Eq tex={r`(t - t_i)`} />.</p>
            </>
          ),
        },
      ]}
    />
  );
}

/** Phase II with drag: v(t) with tan, while the rocket coasts up. */
export function TanV() {
  return (
    <DerivationZoom
      title="Fase II · v(t) con arrastre"
      ode={r`\frac{dv}{dt} = -\left(g + c\,v^2\right), \qquad v(t_i) = v_i`}
      result={r`v(t) = \sqrt{\frac{g}{c}}\;\tan\!\Big(\varphi - \sqrt{gc}\,(t - t_i)\Big)`}
      note={<p className="hint">Con <Eq tex={r`\varphi = \arctan\!\left(v_i\sqrt{c/g}\right)`} />, un ángulo que solo depende de la velocidad inicial.</p>}
      steps={[
        {
          title: "Identificamos la ecuación",
          body: (
            <>
              <p>El peso y el arrastre restan mientras sube. La suma de fuerzas <b>depende de v</b>, así que no podemos integrar directo respecto al tiempo:</p>
              <Eq block tex={r`\frac{dv}{dt} = -g - c\,v^2 = -\left(g + c\,v^2\right), \qquad v(t_i) = v_i`} />
            </>
          ),
        },
        {
          title: "Separamos las variables",
          body: (
            <>
              <p>Dividimos entre <Eq tex={r`g + c\,v^2`} /> y multiplicamos por <Eq tex={r`dt`} />: todo lo de <Eq tex={r`v`} /> a la izquierda.</p>
              <Eq block tex={r`\frac{dv}{g + c\,v^2} = -\,dt`} />
            </>
          ),
        },
        {
          title: "Ponemos los límites de integración",
          body: <Eq block tex={r`\int_{v_i}^{v} \frac{dv}{g + c\,v^2} = -\int_{t_i}^{t} dt`} />,
        },
        {
          title: "Lado izquierdo: integral de tablas",
          body: (
            <>
              <p>Usamos <Eq tex={r`\int \frac{dx}{a + b\,x^2} = \frac{1}{\sqrt{ab}}\arctan\!\left(x\sqrt{\tfrac{b}{a}}\right)`} />, con <Eq tex={r`a = g`} /> y <Eq tex={r`b = c`} />:</p>
              <Eq block tex={r`\int_{v_i}^{v} \frac{dv}{g + c\,v^2} = \frac{1}{\sqrt{gc}}\left[\arctan\!\left(v\sqrt{\tfrac{c}{g}}\right) - \arctan\!\left(v_i\sqrt{\tfrac{c}{g}}\right)\right]`} />
            </>
          ),
        },
        {
          title: "Lado derecho",
          body: <Eq block tex={r`-\int_{t_i}^{t} dt = -\Big[\,t\,\Big]_{t_i}^{t} = -(t - t_i)`} />,
        },
        {
          title: "Igualamos y llamamos φ a la constante",
          body: (
            <>
              <p>Multiplicamos por <Eq tex={r`\sqrt{gc}`} /> y llamamos <Eq tex={r`\varphi = \arctan\!\left(v_i\sqrt{c/g}\right)`} />, que es un número fijo:</p>
              <Eq block tex={r`\arctan\!\left(v\sqrt{\tfrac{c}{g}}\right) - \varphi = -\sqrt{gc}\,(t - t_i) \quad\Rightarrow\quad \arctan\!\left(v\sqrt{\tfrac{c}{g}}\right) = \varphi - \sqrt{gc}\,(t - t_i)`} />
            </>
          ),
        },
        {
          title: "Despejamos v con la tangente",
          body: (
            <>
              <p>La tangente deshace el arcotangente. Luego multiplicamos por <Eq tex={r`\sqrt{g/c}`} />:</p>
              <Eq block tex={r`v\sqrt{\tfrac{c}{g}} = \tan\!\Big(\varphi - \sqrt{gc}\,(t - t_i)\Big) \quad\Rightarrow\quad v(t) = \sqrt{\frac{g}{c}}\;\tan\!\Big(\varphi - \sqrt{gc}\,(t - t_i)\Big)`} />
              <p className="hint">Comprueba: en <Eq tex={r`t = t_i`} /> queda <Eq tex={r`\sqrt{g/c}\,\tan\varphi = v_i`} />. La velocidad llega a cero (el apogeo) cuando el ángulo <Eq tex={r`\varphi - \sqrt{gc}\,(t - t_i)`} /> llega a cero.</p>
            </>
          ),
        },
      ]}
    />
  );
}

/** Phase II with drag: s(t) with ln cos. */
export function TanS() {
  return (
    <DerivationZoom
      title="Fase II · s(t) con arrastre"
      ode={r`\frac{ds}{dt} = \sqrt{\frac{g}{c}}\;\tan\!\Big(\varphi - \sqrt{gc}\,(t - t_i)\Big), \qquad s(t_i) = s_i`}
      result={r`s(t) = s_i + \frac{1}{c}\,\ln\frac{\cos\!\big(\varphi - \sqrt{gc}\,(t - t_i)\big)}{\cos\varphi}`}
      steps={[
        {
          title: "Sustituimos el modelo de la velocidad",
          body: (
            <>
              <p>Para escribir menos llamamos <Eq tex={r`k = \sqrt{gc}`} />:</p>
              <Eq block tex={r`\frac{ds}{dt} = \sqrt{\frac{g}{c}}\;\tan\!\big(\varphi - k\,(t - t_i)\big)`} />
            </>
          ),
        },
        {
          title: "Separamos las variables y ponemos los límites",
          body: <Eq block tex={r`\int_{s_i}^{s} ds = \sqrt{\frac{g}{c}}\int_{t_i}^{t} \tan\!\big(\varphi - k\,(t - t_i)\big)\,dt`} />,
        },
        {
          title: "Cambio de variable",
          body: (
            <>
              <p>Llamamos <Eq tex={r`u = \varphi - k\,(t - t_i)`} />. Entonces <Eq tex={r`du = -k\,dt`} />, o sea <Eq tex={r`dt = -\frac{du}{k}`} />. Los límites: en <Eq tex={r`t_i`} />, <Eq tex={r`u = \varphi`} />; en <Eq tex={r`t`} />, <Eq tex={r`u = U = \varphi - k\,(t - t_i)`} />.</p>
              <Eq block tex={r`s - s_i = -\frac{1}{k}\sqrt{\frac{g}{c}}\int_{\varphi}^{U} \tan u\,du`} />
            </>
          ),
        },
        {
          title: "Integral de la tangente",
          body: (
            <>
              <p>De tablas, <Eq tex={r`\int \tan u\,du = -\ln\cos u`} />. Los dos signos menos se cancelan:</p>
              <Eq block tex={r`s - s_i = \frac{1}{k}\sqrt{\frac{g}{c}}\,\Big[\ln\cos u\Big]_{\varphi}^{U} = \frac{\sqrt{g/c}}{\sqrt{gc}}\Big(\ln\cos U - \ln\cos\varphi\Big)`} />
            </>
          ),
        },
        {
          title: "Simplificamos",
          body: (
            <>
              <p>La constante es <Eq tex={r`\frac{\sqrt{g/c}}{\sqrt{gc}} = \sqrt{\frac{g}{c\cdot gc}} = \frac{1}{c}`} />, y la resta de logaritmos es el logaritmo de un cociente:</p>
              <Eq block tex={r`s(t) = s_i + \frac{1}{c}\,\ln\frac{\cos\!\big(\varphi - \sqrt{gc}\,(t - t_i)\big)}{\cos\varphi}`} />
              <p className="hint">Comprueba: en <Eq tex={r`t = t_i`} /> el cociente vale 1 y <Eq tex={r`\ln 1 = 0`} />, así que <Eq tex={r`s = s_i`} />.</p>
            </>
          ),
        },
      ]}
    />
  );
}

/** Phase III with drag: v(t) with tanh, falling from rest at the apogee. */
export function TanhV({ note }: { note?: ReactNode }) {
  return (
    <DerivationZoom
      title="Fase III · v(t) con arrastre"
      ode={r`\frac{dv}{dt} = -\left(g - c\,v^2\right), \qquad v(t_i) = 0`}
      result={r`v(t) = -v_t\;\tanh\!\Big(\sqrt{gc}\,(t - t_i)\Big), \qquad v_t = \sqrt{\frac{g}{c}}`}
      note={note}
      steps={[
        {
          title: "Identificamos la ecuación",
          body: (
            <>
              <p>Ahora el cohete baja: el peso resta y el arrastre suma (apunta hacia arriba). En el apogeo la velocidad es cero:</p>
              <Eq block tex={r`\frac{dv}{dt} = -g + c\,v^2 = -\left(g - c\,v^2\right), \qquad v(t_i) = 0`} />
            </>
          ),
        },
        {
          title: "Separamos las variables y ponemos los límites",
          body: <Eq block tex={r`\int_{0}^{v} \frac{dv}{g - c\,v^2} = -\int_{t_i}^{t} dt`} />,
        },
        {
          title: "Lado izquierdo: integral de tablas",
          body: (
            <>
              <p>Usamos <Eq tex={r`\int \frac{dx}{a - b\,x^2} = \frac{1}{\sqrt{ab}}\,\text{artanh}\!\left(x\sqrt{\tfrac{b}{a}}\right)`} />, con <Eq tex={r`a = g`} /> y <Eq tex={r`b = c`} />. Como <Eq tex={r`\text{artanh}(0) = 0`} />, el límite de abajo no aporta:</p>
              <Eq block tex={r`\int_{0}^{v} \frac{dv}{g - c\,v^2} = \frac{1}{\sqrt{gc}}\,\text{artanh}\!\left(v\sqrt{\tfrac{c}{g}}\right)`} />
            </>
          ),
        },
        {
          title: "Lado derecho e igualamos",
          body: (
            <>
              <p>El lado derecho es <Eq tex={r`-(t - t_i)`} />. Multiplicamos por <Eq tex={r`\sqrt{gc}`} />:</p>
              <Eq block tex={r`\text{artanh}\!\left(v\sqrt{\tfrac{c}{g}}\right) = -\sqrt{gc}\,(t - t_i)`} />
            </>
          ),
        },
        {
          title: "Despejamos v con la tangente hiperbólica",
          body: (
            <>
              <p>La <Eq tex={r`\tanh`} /> deshace el <Eq tex={r`\text{artanh}`} />, y como es impar, <Eq tex={r`\tanh(-x) = -\tanh x`} />. Llamamos <Eq tex={r`v_t = \sqrt{g/c}`} />:</p>
              <Eq block tex={r`v\sqrt{\tfrac{c}{g}} = -\tanh\!\Big(\sqrt{gc}\,(t - t_i)\Big) \quad\Rightarrow\quad v(t) = -v_t\;\tanh\!\Big(\sqrt{gc}\,(t - t_i)\Big)`} />
              <p className="hint">El signo menos dice que baja. Como <Eq tex={r`\tanh`} /> nunca pasa de 1, la rapidez nunca pasa de <Eq tex={r`v_t`} />.</p>
            </>
          ),
        },
      ]}
    />
  );
}

/** Phase III with drag: s(t) with ln cosh. */
export function TanhS() {
  return (
    <DerivationZoom
      title="Fase III · s(t) con arrastre"
      ode={r`\frac{ds}{dt} = -v_t\,\tanh\!\Big(\sqrt{gc}\,(t - t_i)\Big), \qquad s(t_i) = s_i`}
      result={r`s(t) = s_i - \frac{1}{c}\,\ln\cosh\!\Big(\sqrt{gc}\,(t - t_i)\Big)`}
      steps={[
        {
          title: "Sustituimos el modelo de la velocidad",
          body: (
            <>
              <p>Con <Eq tex={r`k = \sqrt{gc}`} />:</p>
              <Eq block tex={r`\int_{s_i}^{s} ds = -v_t\int_{t_i}^{t} \tanh\!\big(k\,(t - t_i)\big)\,dt`} />
            </>
          ),
        },
        {
          title: "Cambio de variable",
          body: (
            <>
              <p>Llamamos <Eq tex={r`u = k\,(t - t_i)`} />, así <Eq tex={r`dt = \frac{du}{k}`} />. Los límites: en <Eq tex={r`t_i`} />, <Eq tex={r`u = 0`} />; en <Eq tex={r`t`} />, <Eq tex={r`u = k\,(t - t_i)`} />.</p>
              <Eq block tex={r`s - s_i = -\frac{v_t}{k}\int_{0}^{k(t - t_i)} \tanh u\,du`} />
            </>
          ),
        },
        {
          title: "Integral de la tangente hiperbólica",
          body: (
            <>
              <p>De tablas, <Eq tex={r`\int \tanh u\,du = \ln\cosh u`} />, y <Eq tex={r`\ln\cosh 0 = \ln 1 = 0`} />:</p>
              <Eq block tex={r`s - s_i = -\frac{v_t}{k}\Big[\ln\cosh u\Big]_0^{k(t - t_i)} = -\frac{v_t}{k}\,\ln\cosh\!\big(k\,(t - t_i)\big)`} />
            </>
          ),
        },
        {
          title: "Simplificamos",
          body: (
            <>
              <p>La constante es <Eq tex={r`\frac{v_t}{k} = \frac{\sqrt{g/c}}{\sqrt{gc}} = \frac{1}{c}`} />:</p>
              <Eq block tex={r`s(t) = s_i - \frac{1}{c}\,\ln\cosh\!\Big(\sqrt{gc}\,(t - t_i)\Big)`} />
              <p className="hint">Para tiempos largos <Eq tex={r`\ln\cosh x \approx x - \ln 2`} />: la posición baja como una recta, a velocidad terminal.</p>
            </>
          ),
        },
      ]}
    />
  );
}

/** Phase IV, linear chute D = −b·v: v(t) with an exponential. */
export function LinearChuteV({ vt, note }: { vt: number; note?: ReactNode }) {
  return (
    <DerivationZoom
      title="Fase IV · v(t) con el modelo lineal del paracaídas"
      ode={r`\frac{dv}{dt} = -g - \frac{b}{m}\,v, \qquad v(t_i) = v_i`}
      result={r`v(t) = -v_t + (v_i + v_t)\,e^{-\frac{b}{m}(t - t_i)}, \qquad v_t = \frac{mg}{b} = ${n(vt, 2)}\ \text{m/s}`}
      note={note}
      steps={[
        {
          title: "Identificamos la ecuación",
          body: (
            <>
              <p>El peso resta y el paracaídas frena con una fuerza proporcional a la velocidad. La suma de fuerzas <b>depende de v</b>:</p>
              <Eq block tex={r`\frac{dv}{dt} = -g - \frac{b}{m}\,v = -\left(g + \frac{b}{m}\,v\right), \qquad v(t_i) = v_i`} />
            </>
          ),
        },
        {
          title: "Separamos las variables y ponemos los límites",
          body: <Eq block tex={r`\int_{v_i}^{v} \frac{dv}{g + \frac{b}{m}\,v} = -\int_{t_i}^{t} dt`} />,
        },
        {
          title: "Lado izquierdo: cambio de variable",
          body: (
            <>
              <p>Llamamos <Eq tex={r`w = g + \frac{b}{m}\,v`} />, así <Eq tex={r`dw = \frac{b}{m}\,dv`} /> y <Eq tex={r`dv = \frac{m}{b}\,dw`} />. Con <Eq tex={r`\int \frac{dw}{w} = \ln w`} />:</p>
              <Eq block tex={r`\int \frac{dv}{g + \frac{b}{m}v} = \frac{m}{b}\int \frac{dw}{w} = \frac{m}{b}\,\ln\!\left(g + \frac{b}{m}\,v\right)`} />
              <p>Evaluamos entre <Eq tex={r`v_i`} /> y <Eq tex={r`v`} />; la resta de logaritmos es el logaritmo del cociente:</p>
              <Eq block tex={r`\frac{m}{b}\,\ln\!\left(\frac{g + \frac{b}{m}v}{g + \frac{b}{m}v_i}\right) = -(t - t_i)`} />
            </>
          ),
        },
        {
          title: "Quitamos el logaritmo con la exponencial",
          body: (
            <>
              <p>Multiplicamos por <Eq tex={r`b/m`} /> y aplicamos <Eq tex={r`e^{(\,)}`} /> en los dos lados:</p>
              <Eq block tex={r`g + \frac{b}{m}\,v = \left(g + \frac{b}{m}\,v_i\right)e^{-\frac{b}{m}(t - t_i)}`} />
            </>
          ),
        },
        {
          title: "Despejamos v y aparece la velocidad terminal",
          body: (
            <>
              <p>Multiplicamos todo por <Eq tex={r`m/b`} /> y llamamos <Eq tex={r`v_t = \frac{mg}{b}`} />:</p>
              <Eq block tex={r`v_t + v = (v_t + v_i)\,e^{-\frac{b}{m}(t - t_i)} \quad\Rightarrow\quad v(t) = -v_t + (v_i + v_t)\,e^{-\frac{b}{m}(t - t_i)}`} />
              <p className="hint">Comprueba: en <Eq tex={r`t = t_i`} /> la exponencial vale 1 y queda <Eq tex={r`v = v_i`} />; cuando <Eq tex={r`t`} /> crece la exponencial se va a cero y queda <Eq tex={r`v = -v_t`} />.</p>
            </>
          ),
        },
      ]}
    />
  );
}

/** Phase IV, linear chute: s(t). */
export function LinearChuteS({ note }: { note?: ReactNode }) {
  return (
    <DerivationZoom
      title="Fase IV · s(t) con el modelo lineal del paracaídas"
      ode={r`\frac{ds}{dt} = -v_t + (v_i + v_t)\,e^{-\frac{b}{m}(t - t_i)}, \qquad s(t_i) = s_i`}
      result={r`s(t) = s_i - v_t\,(t - t_i) + \frac{m}{b}\,(v_i + v_t)\left(1 - e^{-\frac{b}{m}(t - t_i)}\right)`}
      note={note}
      steps={[
        {
          title: "Separamos las variables y ponemos los límites",
          body: <Eq block tex={r`\int_{s_i}^{s} ds = \int_{t_i}^{t} \left(-v_t + (v_i + v_t)\,e^{-\frac{b}{m}(t - t_i)}\right)dt`} />,
        },
        {
          title: "Lado izquierdo y término 1",
          body: (
            <>
              <p>A la izquierda queda <Eq tex={r`s - s_i`} />. El primer término de la derecha es constante:</p>
              <Eq block tex={r`\int_{t_i}^{t} -v_t\,dt = -v_t\,(t - t_i)`} />
            </>
          ),
        },
        {
          title: "Término 2: la exponencial",
          body: (
            <>
              <p>Con <Eq tex={r`u = t - t_i`} /> (de 0 a <Eq tex={r`\tau = t - t_i`} />) y <Eq tex={r`\int e^{-k u}\,du = -\frac{1}{k}\,e^{-k u}`} />, con <Eq tex={r`k = b/m`} />:</p>
              <Eq block tex={r`(v_i + v_t)\int_0^{\tau} e^{-\frac{b}{m}u}\,du = (v_i + v_t)\left[-\frac{m}{b}\,e^{-\frac{b}{m}u}\right]_0^{\tau} = \frac{m}{b}\,(v_i + v_t)\left(1 - e^{-\frac{b}{m}\tau}\right)`} />
            </>
          ),
        },
        {
          title: "Juntamos y despejamos s",
          body: (
            <>
              <Eq block tex={r`s(t) = s_i - v_t\,(t - t_i) + \frac{m}{b}\,(v_i + v_t)\left(1 - e^{-\frac{b}{m}(t - t_i)}\right)`} />
              <p className="hint">Comprueba: en <Eq tex={r`t = t_i`} /> los dos términos valen cero y queda <Eq tex={r`s = s_i`} />.</p>
            </>
          ),
        },
      ]}
    />
  );
}

/** Phase IV, quadratic chute while falling: tanh (|v_i| < v_t) or coth (|v_i| > v_t). */
export function QuadraticChuteV({ coth, vt, phi, note }: { coth: boolean; vt: number; phi: number; note?: ReactNode }) {
  const fall = coth ? r`\coth` : r`\tanh`;
  const inv = coth ? r`\operatorname{arcoth}` : r`\operatorname{artanh}`;
  return (
    <DerivationZoom
      title="Fase IV · v(t) con el modelo cuadrático del paracaídas"
      ode={r`\frac{dv}{dt} = -\left(g - c\,v^2\right), \qquad v(t_i) = v_i`}
      result={r`v(t) = -v_t\;${fall}\!\Big(\sqrt{gc}\,(t - t_i) + \varphi\Big), \qquad v_t = \sqrt{\frac{g}{c}} = ${n(vt, 2)}\ \text{m/s}`}
      note={note}
      steps={[
        {
          title: "Identificamos la ecuación",
          body: (
            <>
              <p>Como en la Fase III, el peso resta y el arrastre (ahora del paracaídas) suma:</p>
              <Eq block tex={r`\frac{dv}{dt} = -g + c\,v^2 = -\left(g - c\,v^2\right), \qquad v(t_i) = v_i < 0`} />
            </>
          ),
        },
        {
          title: "Trabajamos con la rapidez",
          body: (
            <>
              <p>Al bajar <Eq tex={r`v < 0`} />. Llamamos <Eq tex={r`w = -v > 0`} /> a la rapidez; como <Eq tex={r`w^2 = v^2`} /> y <Eq tex={r`dv = -dw`} />:</p>
              <Eq block tex={r`\frac{dw}{dt} = g - c\,w^2 \quad\Rightarrow\quad \int_{|v_i|}^{w} \frac{dw}{g - c\,w^2} = \int_{t_i}^{t} dt = t - t_i`} />
            </>
          ),
        },
        {
          title: "Integral de tablas",
          body: (
            <>
              <p>
                Con <Eq tex={r`a = g`} />, <Eq tex={r`b = c`} /> y <Eq tex={r`x\sqrt{b/a} = w/v_t`} />:{" "}
                {coth
                  ? <>al abrirse el paracaídas el cohete va <b>más rápido</b> que <Eq tex={r`v_t`} /> (<Eq tex={r`w > v_t`} />), así que se usa <Eq tex={r`\int \frac{dx}{a - b\,x^2} = \frac{1}{\sqrt{ab}}\,\operatorname{arcoth}\!\left(x\sqrt{\tfrac{b}{a}}\right)`} />.</>
                  : <>el cohete va <b>más lento</b> que <Eq tex={r`v_t`} /> (<Eq tex={r`w < v_t`} />), así que se usa <Eq tex={r`\int \frac{dx}{a - b\,x^2} = \frac{1}{\sqrt{ab}}\,\operatorname{artanh}\!\left(x\sqrt{\tfrac{b}{a}}\right)`} />.</>}
              </p>
              <Eq block tex={r`\frac{1}{\sqrt{gc}}\left[${inv}\!\left(\frac{w}{v_t}\right) - ${inv}\!\left(\frac{|v_i|}{v_t}\right)\right] = t - t_i`} />
            </>
          ),
        },
        {
          title: "La constante φ sale de la condición inicial",
          body: (
            <>
              <p>Multiplicamos por <Eq tex={r`\sqrt{gc}`} /> y llamamos <Eq tex={r`\varphi = ${inv}\!\left(\frac{|v_i|}{v_t}\right) = ${n(phi, 4)}`} />:</p>
              <Eq block tex={r`${inv}\!\left(\frac{w}{v_t}\right) = \sqrt{gc}\,(t - t_i) + \varphi`} />
            </>
          ),
        },
        {
          title: "Despejamos y regresamos a v",
          body: (
            <>
              <p>Aplicamos <Eq tex={fall} /> en los dos lados, multiplicamos por <Eq tex={r`v_t`} /> y usamos <Eq tex={r`v = -w`} />:</p>
              <Eq block tex={r`w = v_t\;${fall}\!\Big(\sqrt{gc}\,(t - t_i) + \varphi\Big) \quad\Rightarrow\quad v(t) = -v_t\;${fall}\!\Big(\sqrt{gc}\,(t - t_i) + \varphi\Big)`} />
              <p className="hint">{coth ? <>Como <Eq tex={r`\coth x \to 1`} /> desde arriba, la rapidez <b>baja</b> hasta <Eq tex={r`v_t`} />.</> : <>Como <Eq tex={r`\tanh x \to 1`} /> desde abajo, la rapidez <b>sube</b> hasta <Eq tex={r`v_t`} />.</>}</p>
            </>
          ),
        },
      ]}
    />
  );
}

/** Phase IV, quadratic chute while falling: s(t) with ln cosh or ln sinh. */
export function QuadraticChuteS({ coth }: { coth: boolean }) {
  const fall = coth ? r`\coth` : r`\tanh`;
  const lnf = coth ? r`\sinh` : r`\cosh`;
  return (
    <DerivationZoom
      title="Fase IV · s(t) con el modelo cuadrático del paracaídas"
      ode={r`\frac{ds}{dt} = -v_t\;${fall}\!\Big(\sqrt{gc}\,(t - t_i) + \varphi\Big), \qquad s(t_i) = s_i`}
      result={r`s(t) = s_i - \frac{1}{c}\,\ln\!\left(\frac{${lnf}\big(\sqrt{gc}\,(t - t_i) + \varphi\big)}{${lnf}\,\varphi}\right)`}
      steps={[
        {
          title: "Separamos las variables y ponemos los límites",
          body: (
            <>
              <p>Con <Eq tex={r`k = \sqrt{gc}`} />:</p>
              <Eq block tex={r`\int_{s_i}^{s} ds = -v_t\int_{t_i}^{t} ${fall}\!\big(k\,(t - t_i) + \varphi\big)\,dt`} />
            </>
          ),
        },
        {
          title: "Cambio de variable",
          body: (
            <>
              <p>Llamamos <Eq tex={r`u = k\,(t - t_i) + \varphi`} />, así <Eq tex={r`dt = \frac{du}{k}`} />. En <Eq tex={r`t_i`} />, <Eq tex={r`u = \varphi`} />; en <Eq tex={r`t`} />, <Eq tex={r`u = U = k\,(t - t_i) + \varphi`} />.</p>
              <Eq block tex={r`s - s_i = -\frac{v_t}{k}\int_{\varphi}^{U} ${fall}\,u\;du`} />
            </>
          ),
        },
        {
          title: "Integral de tablas",
          body: (
            <>
              <p>De tablas, <Eq tex={coth ? r`\int \coth u\,du = \ln\sinh u` : r`\int \tanh u\,du = \ln\cosh u`} />:</p>
              <Eq block tex={r`s - s_i = -\frac{v_t}{k}\Big[\ln ${lnf} u\Big]_{\varphi}^{U} = -\frac{v_t}{k}\Big(\ln ${lnf} U - \ln ${lnf}\varphi\Big)`} />
            </>
          ),
        },
        {
          title: "Simplificamos",
          body: (
            <>
              <p>Como <Eq tex={r`\frac{v_t}{k} = \frac{\sqrt{g/c}}{\sqrt{gc}} = \frac{1}{c}`} /> y la resta de logaritmos es el logaritmo del cociente:</p>
              <Eq block tex={r`s(t) = s_i - \frac{1}{c}\,\ln\!\left(\frac{${lnf}\big(\sqrt{gc}\,(t - t_i) + \varphi\big)}{${lnf}\,\varphi}\right)`} />
              <p className="hint">Comprueba: en <Eq tex={r`t = t_i`} /> el cociente vale 1 y queda <Eq tex={r`s = s_i`} />.</p>
            </>
          ),
        },
      ]}
    />
  );
}
