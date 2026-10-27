import type { Design } from "../model";

export const PROGRAMS: Record<Design["type"], { name: string; fuel: string; logo: string }> = {
  estes: { name: "Rocket Tec", fuel: "Combustible sólido", logo: "brand/rocket-tec.png" },
  water: { name: "Rocket Challenge", fuel: "Agua y aire a presión", logo: "brand/rocket-challenge.png" },
};

export const logoUrl = (type: Design["type"]) => `${import.meta.env.BASE_URL}${PROGRAMS[type].logo}`;

const CARDS: { type: Design["type"]; tone: string; alt: string; text: string }[] = [
  {
    type: "estes",
    tone: "solid",
    alt: "Logotipo de Rocket Tec Sinaloa 2026",
    text: "Diseña y simula un cohete impulsado por un motor de combustible sólido. Analiza su trayectoria y comportamiento físico.",
  },
  {
    type: "water",
    tone: "water",
    alt: "Logotipo de Rocket Challenge Sinaloa 2026",
    text: "Explora la propulsión mediante agua y aire comprimido. Diseña tu cohete y analiza las variables de su lanzamiento.",
  },
];

/** First screen: the student picks the propulsion, which decides the whole workspace. */
export function StartScreen({ onPick }: { onPick: (type: Design["type"]) => void }) {
  return (
    <section className="start" aria-labelledby="start-title">
      <div className="start-head">
        <h2 id="start-title">Elige tu tipo de cohete</h2>
        <p>Selecciona el sistema de propulsión para comenzar a diseñar y simular.</p>
      </div>
      <div className="start-cards">
        {CARDS.map((c) => (
          <button key={c.type} type="button" className={`program-card ${c.tone}`} onClick={() => onPick(c.type)}>
            <span className="program-logo"><img src={logoUrl(c.type)} alt={c.alt} /></span>
            <span className="program-fuel">{PROGRAMS[c.type].fuel}</span>
            <span className="program-name">{PROGRAMS[c.type].name}</span>
            <span className="program-text">{c.text}</span>
            <span className="program-go">Diseñar cohete <span aria-hidden="true">→</span></span>
          </button>
        ))}
      </div>
      <p className="start-foot">
        Método de aprendizaje: <b>Física → Matemáticas → Computación</b>
      </p>
    </section>
  );
}
