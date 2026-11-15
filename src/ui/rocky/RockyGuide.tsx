/**
 * "Conoce a Rocky": the students' guide to the copilot, as an infographic where Rocky explains
 * himself. Lives at #rocky (the address the teacher shares) and in the main navigation.
 */
import type { ReactNode } from "react";
import { COPILOT_GROUPS } from "../copilot/groups";
import { openRocky } from "../copilot/openRocky";
import { Mascot, type MascotMood } from "../mascot/Mascot";
import "./rocky.css";

function Section({ n, mood, title, say, children }: { n: number; mood: MascotMood; title: string; say: ReactNode; children: ReactNode }) {
  return (
    <section className="rk-sec" aria-labelledby={`rk-h${n}`}>
      <header className="rk-sec-head">
        <span className="rk-num" aria-hidden="true">{n}</span>
        <Mascot mood={mood} size={84} title="" className="rk-sec-mascot" />
        <div className="rk-bubble">
          <h2 id={`rk-h${n}`}>{title}</h2>
          <p>{say}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

const CAN = [
  { icon: "🔍", title: "Reviso tu diseño", text: "Te explico tu estabilidad, tu apogeo y tu calificación con los números de tu cohete." },
  { icon: "🧪", title: "Simulo cambios", text: "Pruebo «¿qué pasa si…?» en una copia. Tu diseño no cambia hasta que tú lo cambies." },
  { icon: "📖", title: "Leo tu lección", text: "Uso la misma notación y las mismas ecuaciones de la fase que tienes abierta." },
];

const METHOD = [
  { key: "fis", name: "Física", what: "¿Qué fuerzas actúan?", eg: "Se acaba el empuje y el peso frena al cohete." },
  { key: "mat", name: "Matemáticas", what: "¿Qué ecuación lo describe?", eg: "m · dv/dt = −m · g" },
  { key: "com", name: "Computación", what: "¿Qué calcula el simulador?", eg: "Resuelve la ecuación paso a paso y te da tus números." },
  { key: "ing", name: "Ingeniería", what: "¿Qué podrías cambiar?", eg: "Te doy opciones. La decisión es tuya." },
];

const QUESTIONS = [
  "¿Mi cohete es estable? ¿Por qué?",
  "¿Qué pasa con el apogeo si agrando las aletas?",
  "¿Por qué mi cohete frena en esta fase?",
  "¿De dónde sale esta ecuación de la lección?",
  "¿Qué retardo de eyección me conviene?",
];

const RULES = [
  { big: "40", label: "preguntas al día", note: "Se renuevan a medianoche." },
  { big: "8", label: "preguntas por minuto", note: "Si vas muy rápido, espera un poco." },
  { big: "?!", label: "Puedo equivocarme", note: "Compruébalo con el simulador y con tu profesor." },
  { big: "🔒", label: "Sin datos personales", note: "No escribas nombre completo, teléfono ni contraseñas." },
];

const MESSAGES: [string, string][] = [
  ["«Vas muy rápido»", "Espera un minuto y vuelve a preguntar."],
  ["«Rocky está muy ocupado en tu red»", "Todo el salón preguntó a la vez. Espera un minuto."],
  ["«Ya usaste tus preguntas de hoy»", "Mañana tienes 40 nuevas."],
  ["«El grupo ya usó todas sus preguntas»", "Avisa a tu profesor."],
  ["«No me pude conectar»", "Revisa tu internet e intenta de nuevo."],
  ["«Rocky no pudo responder»", "Intenta otra vez; si sigue, avisa a tu profesor."],
  ["«Esta conversación ya es muy larga»", "Toca ↺ para empezar una nueva."],
  ["No aparece el cohete", "Recarga la página con Ctrl + F5."],
];

export function RockyGuide() {
  return (
    <article className="rocky" aria-labelledby="rk-title">
      <header className="rk-hero">
        <Mascot mood="happy" size={170} title="Rocky" className="rk-hero-mascot" />
        <div className="rk-hero-text">
          <p className="rk-kicker">Tu copiloto en Rocket Physics Lab</p>
          <h1 id="rk-title">¡Hola! Soy <span>Rocky</span></h1>
          <p className="rk-lead">Conozco cómo está programado el simulador y te ayudo a entender la física de <b>tu</b> cohete. Así es como trabajamos juntos.</p>
          <div className="rk-actions no-print">
            <button className="btn primary" onClick={() => openRocky()}>Hablar con Rocky</button>
            <button className="btn" onClick={() => print()}>Imprimir guía</button>
          </div>
        </div>
      </header>

      <Section n={1} mood="idle" title="Encuéntrame" say="Estoy en la esquina inferior derecha, en todas las pantallas.">
        <ol className="rk-steps">
          <li>
            <div className="rk-screen" aria-hidden="true">
              <i /><i /><i />
              <span className="rk-screen-fab"><Mascot size={30} title="" /></span>
            </div>
            <p><b>Toca el cohete</b> de la esquina.</p>
          </li>
          <li>
            <div className="rk-groups" aria-hidden="true">{COPILOT_GROUPS.map((g) => <span key={g}>{g}</span>)}</div>
            <p><b>Elige tu grupo.</b> Cada grupo tiene sus propias preguntas del día.</p>
          </li>
          <li>
            <div className="rk-typing" aria-hidden="true">¿Mi cohete es estable?<i /></div>
            <p><b>Escribe tu pregunta</b> y pulsa Enviar.</p>
          </li>
        </ol>
        <p className="rk-note">¿Elegiste el grupo equivocado? Toca el número de grupo arriba del chat para cambiarlo.</p>
      </Section>

      <Section n={2} mood="talking" title="Lo que puedo hacer" say={<>Trabajo con <b>tu</b> cohete, no con uno de ejemplo.</>}>
        <div className="rk-cards">
          {CAN.map((c) => (
            <div key={c.title} className="rk-card">
              <span className="rk-icon" aria-hidden="true">{c.icon}</span>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section n={3} mood="thinking" title="Así pienso" say="Cada respuesta sigue los mismos cuatro pasos que usamos en clase.">
        <ol className="rk-method">
          {METHOD.map((m) => (
            <li key={m.key} className={`rk-m ${m.key}`}>
              <h3>{m.name}</h3>
              <p className="rk-m-q">{m.what}</p>
              <p className="rk-m-eg">{m.eg}</p>
            </li>
          ))}
        </ol>
        <p className="rk-note">Ejemplo con la pregunta «¿Por qué mi cohete frena?».</p>
      </Section>

      <Section n={4} mood="happy" title="Pregúntame bien" say="Predice primero y pregunta después: así aprendes más que solo leyendo mi respuesta.">
        <ol className="rk-cycle">
          <li><b>Predice</b><span>Escribe qué crees que pasará y por qué.</span></li>
          <li><b>Pregunta</b><span>Pregúntame y lee mi razonamiento.</span></li>
          <li><b>Comprueba</b><span>Compara con tu predicción y con el simulador.</span></li>
        </ol>
        <h3 className="rk-sub">Buenas preguntas <small className="no-print">(toca una para preguntármela)</small></h3>
        <div className="rk-chips">
          {QUESTIONS.map((q) => <button key={q} onClick={() => openRocky(q)}>{q}</button>)}
        </div>
        <p className="rk-note">«Hazme la tarea» no sirve: yo te explico, no decido por ti.</p>
      </Section>

      <Section n={5} mood="idle" title="Mis reglas" say="Para que alcance para los cuatro grupos.">
        <div className="rk-rules">
          {RULES.map((r) => (
            <div key={r.label} className="rk-rule">
              <span className="rk-big" aria-hidden={!/\d/.test(r.big)}>{r.big}</span>
              <b>{r.label}</b>
              <span>{r.note}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section n={6} mood="confused" title="Si ves un mensaje" say="A veces no puedo responder. Esto significa cada aviso.">
        <table className="rk-table">
          <thead><tr><th scope="col">Mensaje</th><th scope="col">Qué hacer</th></tr></thead>
          <tbody>
            {MESSAGES.map(([m, a]) => <tr key={m}><td>{m}</td><td>{a}</td></tr>)}
          </tbody>
        </table>
      </Section>

      <footer className="rk-end">
        <Mascot mood="happy" size={64} title="" />
        <p>¡Nos vemos en el lanzamiento! <span className="print-only">echucuan.github.io/rpl/#rocky</span></p>
        <button className="btn primary no-print" onClick={() => openRocky()}>Hablar con Rocky</button>
      </footer>
    </article>
  );
}
