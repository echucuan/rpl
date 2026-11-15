import { useEffect, useRef, useState } from "react";
import { Mascot } from "./Mascot";
import { MASCOT_DESIGN, MASCOT_MOODS, type MascotDesign, type MascotExtra, type MascotMood, type MoodDesign } from "./mascotDesign";

/**
 * Dev-only mascot studio (open #mascota, not linked from the app): edit the design live,
 * then "Copiar diseño" and paste it over MASCOT_DESIGN in mascotDesign.ts to keep it.
 */

const STORE = "rpl.mascot-lab.design";
const clone = (d: MascotDesign): MascotDesign => structuredClone(d);

function loadDraft(): MascotDesign {
  try {
    const raw = localStorage.getItem(STORE);
    const saved = raw ? (JSON.parse(raw) as MascotDesign) : null;
    // Only resume a draft that still has every mood (the design file may have changed since).
    if (saved?.moods && MASCOT_MOODS.every((id) => saved.moods[id]?.mouth)) return { ...clone(MASCOT_DESIGN), ...saved };
  } catch { /* no storage: start from the saved design */ }
  return clone(MASCOT_DESIGN);
}

const COLOR_LABELS: Record<keyof MascotDesign["colors"], string> = {
  outline: "Contorno",
  body: "Cuerpo",
  primary: "Impulso",
  accent: "Cielo",
  cloud: "Nube",
  blush: "Lengua / cachetes",
};
const EXTRAS: { id: MascotExtra; label: string }[] = [
  { id: "dots", label: "Puntitos" },
  { id: "sparks", label: "Estrellas" },
  { id: "question", label: "Signo ?" },
];
const MOTIONS: MoodDesign["motion"][] = ["float", "think", "fast", "hop", "tilt"];
const PLUMES: MoodDesign["plume"][] = ["normal", "strong", "weak"];

export function MascotLab() {
  const [design, setDesign] = useState<MascotDesign>(loadDraft);
  const [mood, setMood] = useState<MascotMood>("idle");
  const [note, setNote] = useState("");
  const preview = useRef<HTMLDivElement>(null);
  const m = design.moods[mood];
  const changed = JSON.stringify(design) !== JSON.stringify(MASCOT_DESIGN);

  useEffect(() => {
    try { localStorage.setItem(STORE, JSON.stringify(design)); } catch { /* ignore */ }
  }, [design]);

  const edit = (fn: (d: MascotDesign) => void) =>
    setDesign((d) => {
      const next = clone(d);
      fn(next);
      return next;
    });
  const editMood = (fn: (md: MoodDesign) => void) => edit((d) => fn(d.moods[mood]));
  const flash = (t: string) => {
    setNote(t);
    setTimeout(() => setNote(""), 2500);
  };

  async function copyDesign() {
    const text = `export const MASCOT_DESIGN: MascotDesign = ${JSON.stringify(design, null, 2)};\n`;
    try {
      await navigator.clipboard.writeText(text);
      flash("Copiado. Pégalo sobre MASCOT_DESIGN en src/ui/mascot/mascotDesign.ts");
    } catch {
      flash("No se pudo copiar al portapapeles");
    }
  }

  function downloadSvg() {
    const svg = preview.current?.querySelector("svg");
    if (!svg) return;
    const copy = svg.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.removeAttribute("style");
    const url = URL.createObjectURL(new Blob([copy.outerHTML], { type: "image/svg+xml" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `mascota-${mood}.svg` });
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setDesign(clone(MASCOT_DESIGN));
    flash("Diseño restablecido al de mascotDesign.ts");
  }

  return (
    <main className="mlab">
      <h1>Estudio de Rocky</h1>
      <p>
        Edita en vivo. Para conservar los cambios: <b>Copiar diseño</b> y pégalo en <code>src/ui/mascot/mascotDesign.ts</code>.
        Lo que mueves aquí se guarda solo en este navegador.
      </p>

      <div className="mstudio">
        <section className="mstudio-stage">
          <div className="mstudio-big" ref={preview}>
            <Mascot design={design} mood={mood} size={300} title="" />
          </div>
          <div className="mstudio-moods" role="tablist" aria-label="Estado de ánimo">
            {MASCOT_MOODS.map((id) => (
              <button key={id} role="tab" aria-selected={id === mood} onClick={() => setMood(id)}>
                <Mascot design={design} mood={id} size={64} title="" />
                <span>{design.moods[id].label}</span>
              </button>
            ))}
          </div>
          <div className="mstudio-actions">
            <button className="btn primary" onClick={copyDesign}>Copiar diseño</button>
            <button className="btn" onClick={downloadSvg}>Descargar SVG</button>
            <button className="btn" onClick={reset} disabled={!changed}>Restablecer</button>
            {changed && <small className="mstudio-dirty">Cambios sin pasar a mascotDesign.ts</small>}
            {note && <small role="status">{note}</small>}
          </div>
        </section>

        <section className="mstudio-panel">
          <fieldset>
            <legend>Colores (toda la mascota)</legend>
            <div className="mstudio-colors">
              {(Object.keys(COLOR_LABELS) as (keyof MascotDesign["colors"])[]).map((k) => (
                <label key={k}>
                  <input type="color" value={design.colors[k]} onChange={(e) => edit((d) => { d.colors[k] = e.target.value; })} />
                  <span>{COLOR_LABELS[k]}<small>{design.colors[k].toUpperCase()}</small></span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Estado: {m.label}</legend>
            <Slider label="Mirada →" min={-8} max={8} step={0.5} value={m.gaze.x} onChange={(v) => editMood((x) => { x.gaze.x = v; })} />
            <Slider label="Mirada ↓" min={-8} max={8} step={0.5} value={m.gaze.y} onChange={(v) => editMood((x) => { x.gaze.y = v; })} />
            <Slider label="Tamaño del iris" min={0.6} max={1.4} step={0.02} value={m.irisScale} onChange={(v) => editMood((x) => { x.irisScale = v; })} />
            <div className="mstudio-checks">
              <Check label="Parpadea" value={m.blink} onChange={(v) => editMood((x) => { x.blink = v; })} />
              <Check label="Brillo en el ojo" value={m.sparkleEye} onChange={(v) => editMood((x) => { x.sparkleEye = v; })} />
              <Check label="Cachetes" value={m.cheeks} onChange={(v) => editMood((x) => { x.cheeks = v; })} />
              {EXTRAS.map((e) => (
                <Check
                  key={e.id}
                  label={e.label}
                  value={m.extras.includes(e.id)}
                  onChange={(v) => editMood((x) => { x.extras = v ? [...x.extras, e.id] : x.extras.filter((y) => y !== e.id); })}
                />
              ))}
            </div>
            <div className="mstudio-row">
              <label>Movimiento
                <select value={m.motion} onChange={(e) => editMood((x) => { x.motion = e.target.value as MoodDesign["motion"]; })}>
                  {MOTIONS.map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
              <label>Llama
                <select value={m.plume} onChange={(e) => editMood((x) => { x.plume = e.target.value as MoodDesign["plume"]; })}>
                  {PLUMES.map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            </div>
            <label className="mstudio-path">Boca (path SVG)
              <textarea rows={2} value={m.mouth.d} onChange={(e) => editMood((x) => { x.mouth.d = e.target.value; })} />
            </label>
            <div className="mstudio-checks">
              <Check label="Boca abierta (rellena)" value={m.mouth.filled} onChange={(v) => editMood((x) => { x.mouth.filled = v; })} />
              <Check label="Se mueve al hablar" value={!!m.mouth.animated} onChange={(v) => editMood((x) => { x.mouth.animated = v; })} />
            </div>
          </fieldset>

          <fieldset>
            <legend>Velocidad de animación (segundos)</legend>
            <Slider label="Flotar" min={0.8} max={6} step={0.1} value={design.animation.float} onChange={(v) => edit((d) => { d.animation.float = v; })} />
            <Slider label="Parpadeo" min={1.5} max={10} step={0.1} value={design.animation.blink} onChange={(v) => edit((d) => { d.animation.blink = v; })} />
            <Slider label="Llama" min={0.08} max={0.6} step={0.01} value={design.animation.flame} onChange={(v) => edit((d) => { d.animation.flame = v; })} />
            <Slider label="Hablar" min={0.12} max={0.8} step={0.01} value={design.animation.talk} onChange={(v) => edit((d) => { d.animation.talk = v; })} />
          </fieldset>
          <p className="hint">Las formas del cohete (cuerpo, aletas, nariz, nube) se editan en <code>shapes</code> de mascotDesign.ts; ver LEEME.md.</p>
        </section>
      </div>

      <h2>Tamaños (180 · 96 · 64 · 32 px)</h2>
      <div className="mlab-row">
        {[180, 96, 64, 32].map((s) => <Mascot key={s} design={design} mood={mood} size={s} title="" />)}
      </div>

      <h2>Sobre fondo oscuro, como avatar y en el chat</h2>
      <div className="mlab-row">
        <div className="mlab-dark">
          <Mascot design={design} size={110} mood={mood} title="" />
          <Mascot design={design} size={64} mood={mood} title="" />
        </div>
        <div className="mlab-avatar dark"><Mascot design={design} mood={mood} size={54} title="" /></div>
        <div className="mlab-avatar light"><Mascot design={design} mood={mood} size={54} title="" /></div>
        <div className="mchat">
          <header>
            <div className="mlab-avatar"><Mascot design={design} size={36} mood={mood} title="" /></div>
            <div>
              <strong>Rocky</strong>
              <small>{m.label}…</small>
            </div>
          </header>
          <div className="mchat-body">
            <div className="mchat-msg me">¿Por qué mi cohete sale inestable?</div>
            <div className="mchat-bot">
              <Mascot design={design} size={30} mood={mood} title="" />
              <div className="mchat-msg bot">
                Tu centro de presión está apenas 0.4 calibres detrás del centro de gravedad. ¿Qué crees que pase si agrandamos las aletas? Simulémoslo 🚀
              </div>
            </div>
          </div>
        </div>
      </div>

      <button className="mfab" aria-label="Hablar con Rocky"><Mascot design={design} mood={mood} size={58} title="" /></button>
    </main>
  );
}

function Slider(p: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="mstudio-slider">
      <span>{p.label}</span>
      <input type="range" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} />
      <output>{p.value}</output>
    </label>
  );
}

function Check(p: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="mstudio-check">
      <input type="checkbox" checked={p.value} onChange={(e) => p.onChange(e.target.checked)} /> {p.label}
    </label>
  );
}
