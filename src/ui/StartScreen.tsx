import type { Design } from "../model";
import { MAX_PRESSURE_PSI } from "../model";

export const PROGRAMS: Record<Design["type"], { name: string; fuel: string; logo: string }> = {
  estes: { name: "Rocket Tec", fuel: "Combustible sólido", logo: "brand/rocket-tec.png" },
  water: { name: "Rocket Challenge", fuel: "Agua y aire a presión", logo: "brand/rocket-challenge.png" },
};

export const logoUrl = (type: Design["type"]) => `${import.meta.env.BASE_URL}${PROGRAMS[type].logo}`;

/** First screen: the student picks the propulsion, which decides the whole workspace. */
export function StartScreen({ onPick }: { onPick: (type: Design["type"]) => void }) {
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
            <li>Motor Estes A10-3T de pólvora negra</li>
            <li>Nariz, aletas y porta motor de PLA; cuerpo de opalina enrollada</li>
            <li>Paracaídas Estes de 24" y altímetro Estes en la nariz</li>
          </ul>
          <span className="program-go">Diseñar con combustible sólido →</span>
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
          <span className="program-go">Diseñar con agua y aire a presión →</span>
        </button>
      </div>
      <p className="start-foot">
        En ambos casos verás el vuelo simulado y podrás aprender, paso a paso, cómo se calcula cada gráfica: <b>Física → Matemáticas → Computación</b>.
      </p>
    </div>
  );
}
