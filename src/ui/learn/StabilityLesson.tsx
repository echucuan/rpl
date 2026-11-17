import { type ReactNode } from "react";
import { hasMotor, type Design } from "../../model";
import { layout, pressureTerms, type MassItem, type Stability } from "../../physics/geometry";
import { format } from "../fields";
import { RocketView } from "../RocketView";
import { useStage } from "../stage";
import { stabilityStatus } from "../stabilityStatus";
import type { SubTab } from "../Workspace";
import { StabilityAnimation } from "./StabilityAnimation";
import { Code, Eq, LessonDialog, Think, YourRocket, n } from "./common";

const r = String.raw;

/** The colour of the Estabilidad steps (the menu dots and the page numbers). */
export const STABILITY_COLOR = "#0f7a6c";

/** The four pages of Estabilidad: Observa, CM, CP, Ajusta. */
export type StabilityPart = 1 | 2 | 3 | 4;

/** What the stability pages need: the pieces and both centres, before and after the motor burns (or the water leaves). */
export interface Statics {
  items: MassItem[];
  loaded: Stability;
  empty: Stability;
  mass: number;
}

const cm = (mm: number) => format(mm / 10, 1);
/** The two moments the centres are given for. */
const moments = (d: Design) => (d.type === "water" ? (["con agua", "sin agua"] as const) : (["al despegar", "al apagarse el motor"] as const));
/** The moment the verdict is judged on: the smaller margin (water rockets: empty, as they fly most of the way). */
const judged = (d: Design, s: Statics) => (d.type === "water" || s.empty.margin < s.loaded.margin ? s.empty : s.loaded);

/** The short status under each step in the menu. */
export function stabilityStepNotes(d: Design, s: Statics): Record<StabilityPart, string> {
  const st = stabilityStatus(d.type, s.loaded, s.empty);
  return {
    1: "el viento y la veleta",
    2: `CM a ${cm(s.loaded.cg)} cm de la punta`,
    3: `CP a ${cm(s.loaded.cp)} cm de la punta`,
    4: `${st.label} · ${st.detail}`,
  };
}

/**
 * Estabilidad in four pages, one screen each: watch what the wind does with the CP ahead of or behind the CM, find
 * the CM from the pieces, find the CP with Barrowman, and fix the margin. It needs no flight, so it works without a motor.
 */
export function StabilityLesson({ design: d, statics: s, part, onGo }: { design: Design; statics: Statics; part: StabilityPart; onGo: (s: SubTab) => void }) {
  const stage = useStage(part);
  const items = s.items;
  const moment = items.reduce((t, i) => t + i.mass * i.x, 0);
  const terms = pressureTerms(d);
  const cnSum = terms.reduce((t, x) => t + x.cn, 0);
  const cnMoment = terms.reduce((t, x) => t + x.cn * x.x, 0);
  const ref = layout(d).refDiameter;
  const [first, second] = moments(d);
  const noMotor = d.type === "estes" && !hasMotor(d);
  const st = stabilityStatus(d.type, s.loaded, s.empty);

  const HEADS: Record<StabilityPart, { title: string; text: ReactNode }> = {
    1: { title: "Observa", text: <>Arrastra la barra para soplar una ráfaga: el cohete gira alrededor del <b>CM</b> y el aire lo empuja en el <b>CP</b>.</> },
    2: { title: "CM", text: <>El <b>centro de masa</b> (CM) es el promedio de dónde está cada pieza, pesado con su masa.</> },
    3: { title: "CP", text: <>El <b>centro de presión</b> (CP) es donde actúa la fuerza del aire; Barrowman lo calcula con la forma del cohete.</> },
    4: { title: "Ajusta", text: <>El <b>margen</b> es la distancia del CM al CP en diámetros del cuerpo (calibres): la meta es de 1 a 2.</> },
  };

  return (
    <div className="lesson stab-lesson">
      <div className="lesson-head card step-head">
        <h2><span className="phase-title-num" style={{ background: STABILITY_COLOR }}>{part}</span> {HEADS[part].title}</h2>
        <p>{HEADS[part].text}</p>
      </div>

      {part === 1 && (
        <div ref={stage} className="card step-stage">
          <StabilityAnimation compact margin={judged(d, s).margin} />
        </div>
      )}

      {part === 2 && (
        <div ref={stage} className="card step-stage">
          <div className="stage-cols stage-fill">
            <div>
              <div className="stab-view stage-fill"><RocketView design={d} loaded={s.loaded} empty={s.empty} /></div>
              <div className="stab-stats">
                <Stat value={cm(s.loaded.cg)} unit="cm" label={`CM ${first}`} sub="desde la punta" strong />
                <Stat value={cm(s.empty.cg)} unit="cm" label={`CM ${second}`} sub="desde la punta" />
                <Stat value={format(s.loaded.mass, 1)} unit="g" label="Masa" sub={first} />
              </div>
              {noMotor ? (
                <p className="alert warning">Tu cohete aún no tiene motor. Cuando lo pongas, su masa en la cola moverá el CM hacia atrás y el margen bajará.</p>
              ) : (
                <p className="hint">
                  {d.type === "water"
                    ? "El agua está en la cola: conforme sale, el CM se mueve hacia la ojiva."
                    : "Al quemarse el propelente, el motor pesa menos y el CM se mueve un poco hacia la ojiva."}
                </p>
              )}
              <Think>
                <p className="think-text">
                  Cuelga tu cohete {d.type === "estes" ? "con su motor " : ""}de un hilo y muévelo hasta que quede horizontal: el hilo marca el CM.
                  Mide desde la punta. ¿Se parece a {cm(s.loaded.cg)} cm?
                </p>
              </Think>
            </div>
            <div className="stage-scroll">
              <table className="summary">
                <thead><tr><th>Pieza</th><th className="num">m (g)</th><th className="num">x (mm)</th><th className="num">m·x</th></tr></thead>
                <tbody>
                  {items.map((i, k) => <tr key={k}><td>{i.name}</td><td className="num">{format(i.mass, 1)}</td><td className="num">{format(i.x, 0)}</td><td className="num">{format(i.mass * i.x, 0)}</td></tr>)}
                  <tr className="sum"><td>Suma</td><td className="num">{format(s.loaded.mass, 1)}</td><td /><td className="num">{format(moment, 0)}</td></tr>
                </tbody>
              </table>
              <YourRocket>
                <Eq block tex={r`x_{CM} = \frac{\sum m_i\,x_i}{\sum m_i} = \frac{${n(moment, 0)}\ \text{g·mm}}{${n(s.loaded.mass, 1)}\ \text{g}} = ${n(s.loaded.cg, 1)}\ \text{mm}`} />
              </YourRocket>
            </div>
          </div>
        </div>
      )}

      {part === 3 && (
        <div ref={stage} className="card step-stage">
          <div className="stage-cols stage-fill">
            <div>
              <div className="stab-view stage-fill"><RocketView design={d} loaded={s.loaded} empty={s.empty} /></div>
              <div className="stab-stats">
                <Stat value={cm(s.loaded.cp)} unit="cm" label="CP" sub="desde la punta" strong />
                <Stat value={cm(s.loaded.cg)} unit="cm" label={`CM ${first}`} sub="para comparar" />
                <Stat value={format(cnSum, 2)} label={<>C<sub>Nα</sub> total</>} sub="cuánto empuja el aire" />
              </div>
              <ul className="stab-points">
                <li>Cada parte que el aire empuja de lado aporta una fuerza (su <Eq tex="C_{N\alpha}" />) en su propio centro <Eq tex="x_i" />. El CP es el promedio, pesado con esas fuerzas.</li>
                <li>La ojiva siempre aporta <Eq tex="C_{N\alpha}=2" /> adelante; las <b>aletas</b> aportan atrás y jalan el CP hacia la cola, como las plumas de una flecha.</li>
                {d.type === "water" && <li>El hombro de la botella se angosta hacia atrás: su <Eq tex="C_{N\alpha}" /> es negativo y mueve el CP hacia adelante. Por eso necesita aletas grandes.</li>}
                {d.fins.count === 0 && <li><b>Tu cohete no tiene aletas:</b> casi todo el empuje del aire queda en la ojiva y el CP queda muy adelante.</li>}
              </ul>
            </div>
            <div className="stage-scroll">
              <table className="summary">
                <thead><tr><th>Parte (Barrowman)</th><th className="num">C<sub>Nα</sub></th><th className="num">x (mm)</th><th className="num">C<sub>Nα</sub>·x</th></tr></thead>
                <tbody>
                  {terms.map((t) => <tr key={t.name}><td>{t.name}</td><td className="num">{format(t.cn, 3)}</td><td className="num">{format(t.x, 0)}</td><td className="num">{format(t.cn * t.x, 1)}</td></tr>)}
                  <tr className="sum"><td>Suma</td><td className="num">{format(cnSum, 3)}</td><td /><td className="num">{format(cnMoment, 1)}</td></tr>
                </tbody>
              </table>
              <YourRocket>
                <Eq block tex={r`x_{CP} = \frac{\sum C_{N\alpha,i}\,x_i}{\sum C_{N\alpha,i}} = \frac{${n(cnMoment, 1)}}{${n(cnSum, 3)}} = ${n(s.loaded.cp, 1)}\ \text{mm}`} />
              </YourRocket>
              <LessonDialog label="Ver las ecuaciones de Barrowman y el código" title="Barrowman y el código de tu cohete">
                <p>Las aletas (N aletas, altura s, cuerdas <Eq tex="c_r, c_t" />, R el radio del cuerpo, <Eq tex="\ell_m" /> la línea media):</p>
                <Eq block tex={r`C_{N\alpha,\,aletas} = \left(1 + \frac{R}{s+R}\right)\frac{4N\,(s/d)^2}{1+\sqrt{1+\left(\frac{2\ell_m}{c_r+c_t}\right)^2}}`} />
                <Eq block tex={r`x_{CP} = \frac{\sum_i C_{N\alpha,i}\,x_i}{\sum_i C_{N\alpha,i}} \qquad \text{margen} = \frac{x_{CP}-x_{CM}}{d}`} />
                <Code>{`
% Piezas: masa (g) y posición de su centro (mm desde la punta)
masa = [${items.map((i) => i.mass.toFixed(1)).join(" ")}];
x    = [${items.map((i) => i.x.toFixed(0)).join(" ")}];
xCM  = sum(masa.*x)/sum(masa);          % centro de masa

% Barrowman: C_Nalpha y posición de cada parte
CN   = [${terms.map((t) => t.cn.toFixed(3)).join(" ")}];
xN   = [${terms.map((t) => t.x.toFixed(0)).join(" ")}];
xCP  = sum(CN.*xN)/sum(CN);             % centro de presión

d = ${ref.toFixed(1)};                       % diámetro (mm)
margen = (xCP - xCM)/d;
fprintf('CM = %.1f mm, CP = %.1f mm, margen = %.2f calibres\\n', xCM, xCP, margen);
                `}</Code>
              </LessonDialog>
            </div>
          </div>
        </div>
      )}

      {part === 4 && (
        <div ref={stage} className="card step-stage">
          <div className="stage-cols stage-fill">
            <div>
              <div className={`stab-verdict ${st.level}`}>
                <span className="stab-verdict-label">{st.label}</span>
                <span className="stab-verdict-value">{format(st.margin, 2)} <small>calibres</small></span>
              </div>
              <MarginGauge marks={[{ label: first, margin: s.loaded.margin }, { label: second, margin: s.empty.margin }]} />
              <YourRocket>
                <Eq block tex={r`\text{margen} = \frac{x_{CP} - x_{CM}}{d} = \frac{${n(judged(d, s).cp, 1)} - ${n(judged(d, s).cg, 1)}}{${n(ref, 1)}} = \mathbf{${n(judged(d, s).margin, 2)}}`} />
              </YourRocket>
              <p className="hint">
                Se juzga con el margen más chico{d.type === "water" ? " (sin agua, como vuela casi todo el tiempo)" : ""}: {format(s.loaded.margin, 2)} cal {first} y {format(s.empty.margin, 2)} cal {second}.
              </p>
            </div>
            <div className="stage-scroll">
              {noMotor && (
                <div className="alert warning stab-no-motor">
                  <span>Tu cohete aún no tiene motor: cuando lo pongas, su masa en la cola bajará el margen. Ponlo antes de ajustar.</span>
                  <button type="button" className="btn small" onClick={() => onGo("cohete2")}>Cohete · Motor</button>
                </div>
              )}
              <Advice d={d} s={s} level={st.level} onGo={onGo} />
              <Think>
                <ul>
                  <li>Agrega 10 g de lastre en la ojiva. ¿Cuánto cambia el margen? ¿Y {d.type === "estes" ? "el apogeo" : "la altura máxima"}?</li>
                  <li>¿Por qué un margen demasiado grande (más de 3) también es malo cuando hay viento?</li>
                </ul>
              </Think>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, unit, label, sub, strong }: { value: string; unit?: string; label: ReactNode; sub?: string; strong?: boolean }) {
  return (
    <div className={`stab-stat${strong ? " strong" : ""}`}>
      <b>{value}{unit && <small> {unit}</small>}</b>
      <span>{label}</span>
      {sub && <small>{sub}</small>}
    </div>
  );
}

/** The margin on a ruler: unstable under 1, the goal from 1 to 2, overstable over 3. */
function MarginGauge({ marks }: { marks: { label: string; margin: number }[] }) {
  const MIN = -2, MAX = 4;
  const X = (m: number) => ((Math.max(MIN, Math.min(MAX, m)) - MIN) / (MAX - MIN)) * 100;
  // Two margins that land on the same spot (no motor, or a light propellant) read as one mark.
  const shown = marks.length === 2 && Math.abs(marks[0].margin - marks[1].margin) < 0.15
    ? [{ label: `${marks[0].label} y ${marks[1].label}`, margin: marks[0].margin }]
    : marks;
  const zones = [
    { from: MIN, to: 0, cls: "bad", text: "se voltea" },
    { from: 0, to: 1, cls: "warn", text: "justo" },
    { from: 1, to: 2, cls: "good", text: "meta" },
    { from: 2, to: 3, cls: "ok", text: "" },
    { from: 3, to: MAX, cls: "warn", text: "sobreestable" },
  ];
  return (
    <figure className="margin-gauge" aria-label={`Margen: ${marks.map((m) => `${format(m.margin, 2)} calibres ${m.label}`).join(", ")}`}>
      <div className="mg-bar">
        {zones.map((z) => (
          <span key={z.from} className={`mg-zone ${z.cls}`} style={{ left: `${X(z.from)}%`, width: `${X(z.to) - X(z.from)}%` }}>{z.text}</span>
        ))}
        {shown.map((m, i) => {
          const off = m.margin < MIN ? " off left" : m.margin > MAX ? " off right" : "";
          const edge = X(m.margin) < 18 ? " at-start" : X(m.margin) > 82 ? " at-end" : "";
          return (
            <span key={m.label} className={`mg-mark${i ? " second" : ""}${off}${edge}`} style={{ left: `${X(m.margin)}%` }}>
              <span className="mg-tag">{off.includes("left") ? "◀ " : ""}{m.label}: {format(m.margin, 2)}{off.includes("right") ? " ▶" : ""}</span>
            </span>
          );
        })}
      </div>
      <div className="mg-ticks" aria-hidden="true">
        {Array.from({ length: MAX - MIN + 1 }, (_, i) => MIN + i).map((t) => <span key={t} style={{ left: `${X(t)}%` }}>{t}</span>)}
      </div>
      <figcaption>calibres (CP detrás del CM →)</figcaption>
    </figure>
  );
}

/** What to move, by how much where it can be estimated, with a button to the step of Cohete that changes it. */
function Advice({ d, s, level, onGo }: { d: Design; s: Statics; level: "stable" | "unstable" | "over"; onGo: (s: SubTab) => void }) {
  const j = judged(d, s);
  const ref = layout(d).refDiameter;
  // Nose weight that would bring the margin to 1 caliber: (M·x_CM + m·x_b) / (M + m) = x_CP − d.
  const xb = d.nose.length * 0.6;
  const target = j.cp - ref;
  const ballast = target > xb ? (j.mass * (j.cg - target)) / (target - xb) : Infinity;
  const ballastOk = Number.isFinite(ballast) && ballast > 0 && ballast <= j.mass;
  if (level === "stable")
    return (
      <div className="stab-advice good">
        <h3>{j.margin <= 2 ? "Está en la meta" : "Estable, un poco arriba de la meta"}</h3>
        <p>
          Con una ráfaga tu cohete gira la ojiva hacia el viento y regresa a la vertical.
          {j.margin > 2 && " Pasa de 2 calibres: con viento fuerte apuntará contra él. Si quieres afinarlo, quita lastre o achica un poco las aletas."}
          {" "}Ya puedes simular el vuelo.
        </p>
        <button type="button" className="btn primary" onClick={() => onGo("fase1")}>🚀 El vuelo</button>
      </div>
    );
  if (level === "over")
    return (
      <div className="stab-advice warn">
        <h3>Demasiado estable</h3>
        <p>Se endereza rápido, pero con viento apunta contra él y se desvía de la vertical. Acércalo a 2 calibres:</p>
        <ul>
          <li>Quita lastre de la ojiva, si tiene.</li>
          <li>Usa aletas un poco más chicas.</li>
        </ul>
        <div className="stab-actions">
          <button type="button" className="btn" onClick={() => onGo("cohete6")}>Cohete · Masas</button>
          <button type="button" className="btn" onClick={() => onGo("cohete3")}>Cohete · Aletas</button>
        </div>
      </div>
    );
  return (
    <div className="stab-advice bad">
      <h3>Hay que mover el CP hacia atrás o el CM hacia adelante</h3>
      <ul>
        <li>
          <b>Aletas más grandes</b> (más altura) o más atrás: jalan el CP hacia la cola.
          {d.fins.count === 0 && " Tu cohete no tiene aletas: es lo primero que necesita."}
        </li>
        <li>
          <b>Lastre en la ojiva</b> (plastilina): mueve el CM hacia adelante.{" "}
          {ballastOk
            ? <>Con unos <b>{format(Math.ceil(ballast), 0)} g</b> llegarías a 1 calibre, pero volará más bajo.</>
            : <>Con tu CP tan adelante, el lastre solo no alcanza: empieza por las aletas.</>}
        </li>
      </ul>
      <div className="stab-actions">
        <button type="button" className="btn primary" onClick={() => onGo("cohete3")}>Cohete · Aletas</button>
        <button type="button" className="btn" onClick={() => onGo("cohete6")}>Cohete · Masas</button>
      </div>
    </div>
  );
}

