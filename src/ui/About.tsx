import { MAX_PRESSURE_PSI } from "../model";
import { A10_SPECS } from "../motor";

export function About() {
  return (
    <div className="card prose">
      <h2 style={{ marginTop: 0 }}>Qué es Rocket Physics Lab</h2>
      <p>
        Un simulador para diseñar cohetes, predecir su vuelo y compararlo con lo que se mide en el lanzamiento. Funciona en el navegador,
        sin instalar nada, y los diseños se guardan solo en tu equipo. Está hecho a la medida de dos retos del Campus Sinaloa:
      </p>
      <ul>
        <li><b>Rocket Tec:</b> motor Estes {A10_SPECS.name}, nariz, aletas y porta motor impresos en PLA, cuerpo de una hoja carta de opalina enrollada, paracaídas Estes de 24" y altímetro Estes en la nariz.</li>
        <li><b>Rocket Challenge:</b> botella Topo Chico de 1.5 L con agua y aire a presión (máximo {MAX_PRESSURE_PSI} psi) y lanzador de boca completa.</li>
      </ul>

      <h2>Cómo calcula</h2>
      <ul>
        <li><b>Estabilidad:</b> método de Barrowman para el centro de presión (nariz, hombro de la botella y aletas) y suma de momentos de cada pieza para el centro de gravedad. El margen se da en calibres (diámetros del cuerpo).</li>
        <li><b>Arrastre:</b> suma de fricción de la superficie (según el número de Reynolds), presión en la nariz y en los bordes de las aletas, y arrastre de la base.</li>
        <li><b>Vuelo:</b> integración Runge-Kutta de 4.º orden de la segunda ley de Newton con masa variable, en una dimensión (lanzamiento vertical, sin viento). Atmósfera estándar ajustada a la temperatura del sitio.</li>
        <li><b>Motor {A10_SPECS.name}:</b> curva de empuje medida en su prueba de certificación; la masa del motor disminuye en proporción al impulso entregado.</li>
        <li><b>Cohete de agua:</b> el aire se expande sin intercambiar calor (adiabático) y empuja el agua por la boquilla (Bernoulli); al terminarse el agua, sale el aire que queda, a velocidad sónica mientras la presión lo permite.</li>
      </ul>

      <h2>Limitaciones</h2>
      <ul>
        <li>No hay viento ni lanzamiento inclinado: la altura real casi siempre sale un poco menor que la simulada.</li>
        <li>La posición del centro de gravedad de la nariz y las aletas se calcula con su forma; si pesas tus piezas, la masa es exacta, pero conviene medir el CG real del cohete armado colgándolo de un hilo.</li>
        <li>El motor, el paracaídas y el altímetro se pesaron en el laboratorio; las piezas impresas y la botella Topo Chico tienen valores aproximados: pesa y mide las tuyas.</li>
        <li>El paracaídas se abre instantáneamente en el modelo; en la realidad tarda unas décimas de segundo en inflarse.</li>
      </ul>

      <h2>Datos y créditos</h2>
      <p>
        Especificaciones de productos: Estes Industries (estesrockets.com). Curva de empuje del {A10_SPECS.name}: prueba de certificación de la National
        Association of Rocketry (NAR), publicada en <a href="https://www.thrustcurve.org" target="_blank" rel="noreferrer">ThrustCurve.org</a>. Los modelos
        físicos se comprobaron contra sus soluciones exactas (vacío, arrastre constante y velocidad terminal).
      </p>
      <p>
        Desarrollado para los cursos de física del Tecnológico de Monterrey, Campus Sinaloa. Rocket Physics Lab es software libre bajo la
        licencia GPL-3.0.
      </p>
    </div>
  );
}
