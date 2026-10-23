import { MAX_PRESSURE_PSI } from "../model";
import { MOTORS, PARTS } from "../catalog";

export function About() {
  return (
    <div className="card prose">
      <h2 style={{ marginTop: 0 }}>Qué es Rocket Physics Lab</h2>
      <p>
        Un simulador para diseñar cohetes, predecir su vuelo y compararlo con lo que se mide en el lanzamiento. Funciona en el navegador,
        sin instalar nada, y los diseños se guardan solo en tu equipo.
      </p>

      <h2>Cómo calcula</h2>
      <ul>
        <li><b>Estabilidad:</b> método de Barrowman para el centro de presión (nariz, hombro de la botella y aletas) y suma de momentos de cada pieza para el centro de gravedad. El margen se da en calibres (diámetros del cuerpo).</li>
        <li><b>Arrastre:</b> suma de fricción de la superficie (según el número de Reynolds), presión en la nariz y en los bordes de las aletas, y arrastre de la base.</li>
        <li><b>Vuelo:</b> integración Runge-Kutta de 4.º orden de la segunda ley de Newton con masa variable, en una dimensión (lanzamiento vertical, sin viento). Atmósfera estándar ajustada a la temperatura del sitio.</li>
        <li><b>Motores Estes:</b> curvas de empuje medidas (certificación NAR) de {MOTORS.length} motores, con la masa que pierden al quemarse.</li>
        <li><b>Cohete de agua:</b> el aire se expande sin intercambiar calor (adiabático) y empuja el agua por la boquilla (Bernoulli); al terminarse el agua, sale el aire que queda, a velocidad sónica mientras la presión lo permite. Presión máxima: {MAX_PRESSURE_PSI} psi.</li>
      </ul>

      <h2>Limitaciones</h2>
      <ul>
        <li>No hay viento ni lanzamiento inclinado: la altura real casi siempre sale un poco menor que la simulada.</li>
        <li>La posición del centro de gravedad de la nariz y las aletas se calcula con su forma; si pesas tus piezas, la masa es exacta, pero conviene medir el CG real del cohete armado colgándolo de un hilo.</li>
        <li>Las medidas de los kits Estes y de la botella Topo Chico son aproximadas: mide y pesa las tuyas.</li>
        <li>Arriba de Mach 0.7 el modelo de arrastre pierde precisión (no ocurre con motores Estes en cohetes normales).</li>
      </ul>

      <h2>Datos y créditos</h2>
      <p>
        Las curvas de empuje de los motores Estes y el catálogo de {PARTS.length} piezas Estes provienen de las bases de datos de{" "}
        <a href="https://openrocket.info" target="_blank" rel="noreferrer">OpenRocket</a> (catálogo de piezas con licencia Apache 2.0; curvas de{" "}
        <a href="https://www.thrustcurve.org" target="_blank" rel="noreferrer">ThrustCurve.org</a>). Los resultados se validaron contra el
        cohete de ejemplo de OpenRocket 24.12 (diferencia menor a 10 % en altura máxima).
      </p>
      <p>
        Desarrollado para los cursos de física del Tecnológico de Monterrey, Campus Sinaloa. Rocket Physics Lab es software libre bajo la
        licencia GPL-3.0.
      </p>
    </div>
  );
}
