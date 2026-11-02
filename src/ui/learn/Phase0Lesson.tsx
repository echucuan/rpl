import { MAX_PRESSURE_PSI, PSI, type WaterDesign } from "../../model";
import { R_AIR, air } from "../../physics/atmosphere";
import { WATER_DENSITY } from "../../physics/propulsion";
import type { FlightResult } from "../../physics/simulate";
import { format } from "../fields";
import type { SubTab } from "../Workspace";
import { Eq, YourRocket } from "./common";

const r = String.raw;
const asset = (name: string) => `${import.meta.env.BASE_URL}lanzador/${name}`;

/** Parts of the V02 launcher; volumes come from the STL files (cm³, solid). */
const PARTS: { n: string; name: string; qty: number; file?: string; volume?: number; supports: boolean; infill: string; note?: string }[] = [
  { n: "01", name: "Base HEX", qty: 1, file: "V02-Pieza01-Base-HEX.stl", volume: 137.6, supports: true, infill: "30 %" },
  { n: "02", name: "Patas HEX", qty: 3, file: "V02-Pieza02-Patas-HEX.stl", volume: 53.6, supports: true, infill: "20 %" },
  { n: "03", name: "Collar HEX", qty: 1, file: "V02-Pieza03-Collar-HEX.stl", volume: 29.9, supports: true, infill: "30 %" },
  { n: "04", name: "Trabas HEX", qty: 6, file: "V02-Pieza04-Trabas-HEX.stl", volume: 1.7, supports: false, infill: "100 %" },
  { n: "05", name: "Seguro", qty: 1, file: "V02-Pieza05-Seguro.stl", volume: 8.2, supports: false, infill: "100 %" },
  { n: "06", name: "Porta válvula", qty: 1, supports: false, infill: "–", note: "Diseño pendiente: pronto estará aquí su archivo." },
];

const MATERIALS: { qty: string; name: string; detail: string }[] = [
  { qty: "1", name: "Botella Topo Chico de 1.5 L", detail: "Sin golpes, rayones ni deformaciones. Es el cuerpo del cohete y el tanque de presión." },
  { qty: "1", name: "Válvula sellomática tipo pivote TR413", detail: "La válvula de llanta por la que entra el aire. Va dentro del porta válvula." },
  { qty: "1", name: "O-ring", detail: "Sella el cuello de la botella contra el porta válvula. Medida pendiente." },
  { qty: "1", name: "Popote rígido (como los de los vasos Stanley)", detail: "No sirven los desechables: se doblan o se aplastan. Lleva el aire desde la válvula, a través del agua, hasta la parte de arriba de la botella." },
  { qty: "1", name: "Manguera de extensión para inflador de llantas", detail: "Une el inflador con la válvula, para inflar a distancia." },
  { qty: "1", name: "Inflador (compresor) de 12 V con manómetro digital", detail: "Que llegue al menos a 90 psi y se apague solo al alcanzar la presión programada." },
  { qty: "1", name: "Batería de 12 V (AGM sellada, 40 Ah)", detail: "Por ejemplo LinkedPro LK4012 o equivalente, con su carga completa antes de la práctica." },
  { qty: "3", name: "Ligas", detail: "Jalan el collar hacia abajo para abrir las trabas cuando se retira el seguro." },
  { qty: "1", name: "Cuerda o piola de 3 m", detail: "Se amarra al seguro: se jala desde 3 m para lanzar." },
  { qty: "–", name: "Lentes de protección", detail: "Para todas las personas en la zona de lanzamiento." },
];

/** Phase 0 (Rocket Challenge only): what the experiment is, its variables, the launcher and how to compare. */
export function Phase0Lesson({ design: d, result: res, onGo }: { design: WaterDesign; result: FlightResult | null; onGo: (s: SubTab) => void }) {
  const w = d.water;
  const kgPerL = WATER_DENSITY / 1000;
  const waterKg = w.waterVolume * kgPerL;
  const airL = Math.max(w.bottleVolume - w.waterVolume, 0);
  const atm = air(0, d.launch.altitude, d.launch.temperature).pressure;
  const pAbs = w.pressure * PSI + atm;
  const airKg = (pAbs * airL) / 1000 / (R_AIR * (d.launch.temperature + 273.15));
  const total = res?.samples[0].mass;
  const dry = total !== undefined ? total - waterKg - airKg : undefined;
  const nozzleArea = (Math.PI * w.nozzleDiameter ** 2) / 4;
  const plastic = PARTS.reduce((s, p) => s + (p.volume ?? 0) * p.qty, 0);
  const descent = res?.landing ? res.landing.t - res.apogee.t : undefined;

  return (
    <div className="lesson experiment">
      <div className="lesson-head card">
        <h2><span className="phase-title-num" style={{ background: "#0f6d9d" }}>0</span> Fase 0: El experimento</h2>
        <p>
          <b>No gana quien llega más alto.</b> Un cohete, como cualquier máquina, se comporta de forma <b>determinista</b>: si conocemos sus condiciones
          (masa, agua, presión, forma), la física, las matemáticas y la computación nos permiten <b>predecir</b> su vuelo. Tu reto es predecir, medir,
          comparar y explicar las diferencias.
        </p>
        <ol className="steps">
          <li><b>Predice:</b> diseña tu cohete en la pestaña Cohete y anota lo que dice la simulación.</li>
          <li><b>Mide:</b> lánzalo; el sensor de altura da la altura máxima y el video, los tiempos.</li>
          <li><b>Compara y explica:</b> escribe tus mediciones en Gráficas y busca de dónde vienen las diferencias.</li>
        </ol>
      </div>

      <div className="card prose-wide">
        <h2>Qué simula este laboratorio (y qué no)</h2>
        <div className="alert info" style={{ marginBottom: 12 }}>
          La simulación es solo para <b>lanzamientos verticales</b>: la base debe estar nivelada y la botella apuntando hacia arriba.
        </div>
        <ul>
          <li><b>Una sola dimensión:</b> el cohete sube y baja en línea recta. No hay viento, ni lanzamiento inclinado, ni giros.</li>
          <li><b>Empuje:</b> el aire comprimido se expande sin intercambiar calor con el exterior (adiabático) y empuja el agua por la boca de la botella; al acabarse el agua sale el aire que queda.</li>
          <li><b>Botella rígida:</b> el modelo no considera que el PET se estire con la presión.</li>
          <li><b>Paracaídas:</b> se abre al instante en el apogeo; en la realidad tarda unas décimas de segundo.</li>
          <li><b>Aire:</b> atmósfera estándar ajustada a la altitud y temperatura del sitio que escribas en Lanzamiento.</li>
        </ul>
        <p className="hint">Por eso la altura real casi siempre sale un poco menor que la simulada. Encontrar cuánto y por qué es parte del experimento.</p>
      </div>

      <div className="card prose-wide">
        <h2>Las variables de tu cohete</h2>
        <p>Antes de lanzar, entiende qué significa cada número que escribes en la pestaña Cohete.</p>
        <dl className="variables">
          <dt>Masa de agua <Eq tex={r`m_w`} /> <span className="unit-tag">kg</span></dt>
          <dd>
            La pesas en la báscula. Con la densidad del agua (<Eq tex={r`\rho_w = ${WATER_DENSITY}\ \text{kg/m}^3`} />, casi 1 kg por litro) se convierte en
            volumen: <Eq tex={r`V_w = m_w / \rho_w`} />. El agua es la <b>masa que se expulsa</b> para producir el empuje.
          </dd>
          <dt>Volumen de aire <Eq tex={r`V_a`} /> <span className="unit-tag">L</span></dt>
          <dd>
            Lo que queda de la botella sin agua: <Eq tex={r`V_a = V_{\text{botella}} - V_w`} />. El aire comprimido es el <b>resorte</b> que guarda la
            energía. Con poca agua el empuje dura muy poco; con mucha, el aire se expande demasiado y la presión se acaba antes de expulsar toda el agua.
          </dd>
          <dt>Presión <Eq tex={r`P`} /> <span className="unit-tag">psi</span></dt>
          <dd>
            La que marca el manómetro del inflador: es la presión <b>manométrica</b>, por encima de la atmosférica. Dentro de la botella la presión
            absoluta es <Eq tex={r`P_{\text{abs}} = P + P_{\text{atm}}`} />, con <Eq tex={r`1\ \text{psi} = 6894.76\ \text{Pa}`} />. Máximo {MAX_PRESSURE_PSI} psi.
          </dd>
          <dt>Boquilla <Eq tex={r`d`} /> <span className="unit-tag">mm</span></dt>
          <dd>Diámetro de la boca de la botella, por donde sale el agua. Con el lanzador de boca completa es el diámetro interior del cuello.</dd>
          <dt>Masa en seco <span className="unit-tag">kg</span></dt>
          <dd>Todo lo que vuela sin contar agua ni aire: botella, nariz, aletas, paracaídas y lastre. Pesa tu cohete armado.</dd>
        </dl>
        <YourRocket>
          <Eq block tex={r`V_w = \frac{${waterKg.toFixed(3)}\ \text{kg}}{${WATER_DENSITY}\ \text{kg/m}^3} = ${(w.waterVolume).toFixed(3)}\ \text{L} \qquad V_a = ${w.bottleVolume.toFixed(2)} - ${w.waterVolume.toFixed(3)} = ${airL.toFixed(3)}\ \text{L}`} />
          <Eq block tex={r`P_{\text{abs}} = ${w.pressure.toFixed(0)}\ \text{psi} \times 6894.76 + ${(atm / 1000).toFixed(1)}\ \text{kPa} = ${(pAbs / 1000).toFixed(1)}\ \text{kPa} \qquad A_{\text{boquilla}} = \frac{\pi d^2}{4} = ${nozzleArea.toFixed(0)}\ \text{mm}^2`} />
          {dry !== undefined && total !== undefined && (
            <Eq block tex={r`m_{\text{despegue}} = \underbrace{${dry.toFixed(3)}}_{\text{seco}} + \underbrace{${waterKg.toFixed(3)}}_{\text{agua}} + \underbrace{${airKg.toFixed(3)}}_{\text{aire}} = ${total.toFixed(3)}\ \text{kg}`} />
          )}
        </YourRocket>
      </div>

      <div className="card prose-wide">
        <h2>La base de lanzamiento</h2>
        <p>Es un lanzador de <b>boca completa</b>: el agua sale por todo el cuello de la botella. Así funciona:</p>
        <ol>
          <li>Con agua dentro, la botella se coloca <b>boca abajo</b> sobre el porta válvula; el <b>o-ring</b> sella el cuello.</li>
          <li>El <b>popote</b> entra en la botella: lleva el aire de la válvula, a través del agua, hasta la parte de arriba.</li>
          <li>Las <b>6 trabas</b> se cierran sobre el anillo del cuello y el <b>collar</b>, arriba, las mantiene cerradas.</li>
          <li>El <b>seguro</b> detiene el collar. Las <b>3 ligas</b> jalan el collar hacia abajo todo el tiempo.</li>
          <li>Al jalar la <b>cuerda</b> sale el seguro: las ligas bajan el collar, las trabas se abren y la presión dispara la botella.</li>
        </ol>
        <div className="gallery">
          <Figure src="ensamblaje-01.png" caption="Base armada: patas, base, collar, trabas y seguro (la U)." />
          <Figure src="ensamblaje-02.png" caption="Vista de frente." />
          <Figure src="ensamblaje-04.png" caption="Vista desde arriba: las 6 trabas alrededor del cuello." />
          <Figure src="montaje-completo.jpg" caption="Montaje en el laboratorio: batería, inflador, manguera, base y cuerda." />
          <Figure src="porta-valvula-y-popote.jpg" caption="Porta válvula con la válvula, el o-ring y el popote." />
          <Figure src="botella-con-popote.jpg" caption="La botella boca abajo sobre la base, con el popote dentro." />
        </div>
      </div>

      <div className="card prose-wide">
        <h2>Piezas para imprimir</h2>
        <p>PLA, capa de 0.2 mm. Descarga cada archivo y revisa la cantidad.</p>
        <div className="table-scroll">
          <table className="summary parts">
            <thead><tr><th>Pieza</th><th className="num">Cantidad</th><th>Soportes</th><th className="num">Relleno</th><th>Archivo</th></tr></thead>
            <tbody>
              {PARTS.map((p) => (
                <tr key={p.n}>
                  <td><b>Pieza{p.n}</b> {p.name}{p.note && <div className="hint">{p.note}</div>}</td>
                  <td className="num">{p.qty}</td>
                  <td>{p.file ? (p.supports ? "Sí" : "No") : "–"}</td>
                  <td className="num">{p.infill}</td>
                  <td>{p.file ? <a className="btn small" href={asset(p.file)} download>Descargar STL</a> : <span className="hint">Pendiente</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Todas juntas suman {format(plastic, 0)} cm³ de plástico: como máximo {format(plastic * 1.24, 0)} g de PLA si se imprimieran macizas; con estos
          rellenos se usa bastante menos. Piezas de la base de lanzamiento V02 · Tecnológico de Monterrey, Campus Sinaloa · licencia{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/deed.es" target="_blank" rel="noreferrer">CC BY 4.0</a> (<a href={asset("LICENCIA.txt")} target="_blank" rel="noreferrer">ver licencia</a>).
        </p>
      </div>

      <div className="card prose-wide">
        <h2>Materiales</h2>
        <p>Busca estos artículos o un equivalente con las mismas características.</p>
        <ul className="materials">
          {MATERIALS.map((m) => (
            <li key={m.name}><span className="qty">{m.qty}</span><div><b>{m.name}</b><br /><span className="hint">{m.detail}</span></div></li>
          ))}
        </ul>
        <h3>Conexión del inflador a la batería</h3>
        <p>
          El inflador trae un enchufe de encendedor de coche y la batería tiene terminales de tornillo. Cambia el enchufe por <b>pinzas de caimán</b> y
          respeta la polaridad: el cable de la punta central del enchufe es el <b>positivo (+)</b> y va a la pinza roja, en la terminal + de la batería;
          el del contacto lateral es el <b>negativo (−)</b> y va a la pinza negra, en la terminal −. Antes de conectar, confirma la polaridad con un multímetro.
        </p>
        <div className="gallery two">
          <Figure src="inflador.jpg" caption="Inflador de 12 V con manómetro digital: se programa la presión y se apaga solo." />
          <Figure src="bateria.jpg" caption="Batería AGM de 12 V y 40 Ah con las terminales del inflador." />
        </div>
      </div>

      <div className="card prose-wide">
        <h2>Lanzamiento y seguridad</h2>
        <ol>
          <li>Revisa que la botella no tenga golpes, grietas ni deformaciones.</li>
          <li>Pesa el agua (kg) y escríbela en tu diseño, junto con la presión que vas a usar (máximo {MAX_PRESSURE_PSI} psi).</li>
          <li>Coloca la botella en la base, cierra las trabas, sube el collar y pon el seguro con la cuerda amarrada.</li>
          <li>Programa la presión en el inflador. Todos se ponen <b>lentes de protección</b>.</li>
          <li>Enciende el inflador y <b>aléjate 3 m</b> (el largo de la cuerda) mientras llena: se apaga solo al llegar a la presión.</li>
          <li>Nadie se acerca ni se para sobre la botella con presión. Empieza a grabar el video y jala la cuerda.</li>
          <li>Si el cohete no despega, no te acerques: avisa al profesor para liberar la presión antes de revisar.</li>
        </ol>
      </div>

      <div className="card prose-wide">
        <h2>Qué vas a medir y comparar</h2>
        <table className="summary">
          <thead><tr><th>Medición</th><th>Cómo se mide</th><th className="num">Tu predicción</th></tr></thead>
          <tbody>
            <tr><td>Altura máxima</td><td>Sensor de altura en el cohete</td><td className="num">{res ? `${format(res.apogee.h, 1)} m` : "–"}</td></tr>
            <tr><td>Tiempo hasta el apogeo</td><td>Video: del despegue al punto más alto</td><td className="num">{res ? `${format(res.apogee.t, 2)} s` : "–"}</td></tr>
            <tr><td>Tiempo del apogeo al aterrizaje</td><td>Video: del punto más alto al suelo</td><td className="num">{descent !== undefined ? `${format(descent, 2)} s` : "–"}</td></tr>
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 8 }}>
          Para el video: cámara fija, que se vea todo el vuelo y, si se puede, a 60 cuadros por segundo. Cuenta cuadros para medir los tiempos con precisión.
        </p>
        {!res && <div className="alert warning" style={{ marginTop: 8 }}>Tu diseño tiene un error y no se puede simular: corrígelo en la pestaña Cohete.</div>}
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn" onClick={() => onGo("cohete")}>Diseñar mi cohete</button>
          <button type="button" className="btn primary" onClick={() => onGo("graficas")}>Comparar en Gráficas →</button>
        </div>
      </div>
    </div>
  );
}

function Figure({ src, caption }: { src: string; caption: string }) {
  return (
    <figure>
      <a href={asset(src)} target="_blank" rel="noreferrer"><img src={asset(src)} alt={caption} loading="lazy" /></a>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
