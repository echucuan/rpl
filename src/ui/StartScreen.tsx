import type { Design } from "../model";
import { MAX_PRESSURE_PSI } from "../model";
import { MOTORS } from "../catalog";

export const PROGRAMS: Record<Design["type"], { name: string; fuel: string; logo: string }> = {
  estes: { name: "Rocket Tec", fuel: "Combustible sólido", logo: "brand/rocket-tec.png" },
  water: { name: "Rocket Challenge", fuel: "Agua y aire a presión", logo: "brand/rocket-challenge.png" },
};

export const logoUrl = (type: Design["type"]) => `${import.meta.env.BASE_URL}${PROGRAMS[type].logo}`;

/** First screen: the student picks the propulsion, which decides the whole workspace. */
export function StartScreen({ onPick }: { onPick: (type: Design["type"]) => void }) {
  const smallest = MOTORS[0].name, largest = MOTORS[MOTORS.length - 1].name;
  return (
    <div className="start">
      <div className="start-head">
        <h2>¿Qué tipo de combustible va a usar tu cohete?</h2>
        <p>Elige uno para empezar a diseñar. Puedes cambiar después desde el menú de arriba.</p>
      </div>
      <div className="start-cards">
        <button type="button" className="program-card solid" onClick={() => onPick("estes")}>
          <img src={logoUrl("estes")} alt="Logotipo de Rocket Tec Sinaloa 2026" />
          <span className="program-fuel">Combustible sólido</span>
          <span className="program-name">Rocket Tec</span>
          <ul>
            <li>Motores Estes de pólvora negra, de {smallest} a {largest}</li>
            <li>Piezas del catálogo Estes o impresas en PLA Aero</li>
            <li>Paracaídas con carga de eyección</li>
          </ul>
          <span className="program-go">Diseñar con motor Estes →</span>
        </button>
        <button type="button" className="program-card water" onClick={() => onPick("water")}>
          <img src={logoUrl("water")} alt="Logotipo de Rocket Challenge Sinaloa 2026" />
          <span className="program-fuel">Agua y aire a presión</span>
          <span className="program-name">Rocket Challenge</span>
          <ul>
            <li>Botella Topo Chico de 1.5 L con lanzador de boca completa</li>
            <li>Tú eliges el agua y la presión (máximo {MAX_PRESSURE_PSI} psi)</li>
            <li>Aletas, nariz y lastre impresos en PLA Aero</li>
          </ul>
          <span className="program-go">Diseñar cohete de agua →</span>
        </button>
      </div>
      <p className="start-foot">
        En ambos casos verás el vuelo simulado y podrás aprender, paso a paso, cómo se calcula cada gráfica: <b>Física → Matemáticas → Computación</b>.
      </p>
    </div>
  );
}
