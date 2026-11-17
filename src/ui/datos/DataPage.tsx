/**
 * The teacher's data page (#datos, not linked from the app): how RPL was used, for reporting it (e.g. at a
 * congress). It asks for the key set in the Worker (ADMIN_KEY) and reads the usage database through it.
 */
import { useEffect, useState } from "react";
import "./datos.css";

const URL_BASE: string | undefined = import.meta.env.VITE_COPILOT_URL || undefined;
const KEY = "rpl.datos.key";

type Num = number;
interface Summary {
  from: string;
  to: string;
  totals: { students: Num; sessions: Num; days: Num; seconds: Num; clicks: Num; edits: Num; questions: Num; askers: Num };
  sessions: { wall: Num; active: Num }[];
  byGroup: { grp: string; students: Num; sessions: Num; seconds: Num; clicks: Num; edits: Num; questions: Num }[];
  byDay: { day: string; students: Num; sessions: Num; seconds: Num }[];
  byHour: { hour: Num; seconds: Num }[];
  byRoute: { route: string; seconds: Num; views: Num; clicks: Num; edits: Num }[];
  topClicks: { route: string; target: string; n: Num }[];
  topEdits: { route: string; target: string; n: Num }[];
  students: { device: string; grp: string; sessions: Num; days: Num; seconds: Num; clicks: Num; edits: Num; questions: Num; read: Num }[];
  rocky: {
    questions: Num; read: Num; unread: Num; unknown: Num; avgAnswerWords: Num; avgSeconds: Num; tokens: Num;
    tools: { name: string; n: Num }[];
    repeated: { text: string; n: Num; students: Num }[];
    recent: { ts: Num; grp: string; question: string; answer: string; read: string; tools: string }[];
  };
}
interface Themes {
  temas: { tema: string; descripcion: string; n: Num; bloom: string; ejemplos: string[] }[];
  total: Num;
  of: Num;
}

const nf = (n: number, d = 0) => n.toLocaleString("es-MX", { maximumFractionDigits: d, minimumFractionDigits: d });
const min = (s: number) => s / 60;
const pct = (a: number, b: number) => (b ? `${nf((100 * a) / b)} %` : "—");
function median(xs: number[]) {
  if (!xs.length) return 0;
  const s = xs.toSorted((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const TOOL_NAME: Record<string, string> = { ver_diseno: "Revisar el diseño", simular_cambio: "Simular un cambio", ver_leccion: "Leer la lección" };
/** "estes/cohete/Masas" → "Rocket Tec · Cohete · Masas". */
function routeName(r: string) {
  const [prog, sub, ...rest] = r.split("/");
  const P: Record<string, string> = { estes: "Rocket Tec", water: "Rocket Challenge", inicio: "Inicio", designs: "Mis diseños", rocky: "Guía de Rocky", about: "Acerca de" };
  const cap = (s?: string) => (s ? s[0].toUpperCase() + s.slice(1) : "");
  return [P[prog] ?? cap(prog), cap(sub), ...rest].filter(Boolean).join(" · ");
}
const today = () => new Date(Date.now() - 7 * 3600_000).toISOString().slice(0, 10);

function Bars({ rows, unit, digits = 0 }: { rows: { label: string; value: number; note?: string }[]; unit: string; digits?: number }) {
  const max = Math.max(...rows.map((r) => r.value), 0) || 1;
  if (!rows.length) return <p className="dp-empty">Sin datos en estas fechas.</p>;
  return (
    <div className="dp-bars">
      {rows.map((r, i) => (
        <div className="dp-bar" key={i}>
          <span className="dp-bar-label" title={r.label}>{r.label}</span>
          <span className="dp-bar-track"><span style={{ width: `${(100 * r.value) / max}%` }} /></span>
          <span className="dp-bar-value">{nf(r.value, digits)} {unit}{r.note ? <small> {r.note}</small> : null}</span>
        </div>
      ))}
    </div>
  );
}

function Tile({ value, unit, label, sub }: { value: string; unit?: string; label: string; sub?: string }) {
  return (
    <div className="dp-tile">
      <div className="dp-tile-value">{value}{unit && <small> {unit}</small>}</div>
      <div className="dp-tile-label">{label}</div>
      {sub && <div className="dp-tile-sub">{sub}</div>}
    </div>
  );
}

export function DataPage() {
  const [key, setKey] = useState(() => {
    try { return sessionStorage.getItem(KEY) ?? ""; } catch { return ""; }
  });
  const [draft, setDraft] = useState("");
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState(today);
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [themes, setThemes] = useState<Themes | null>(null);
  const [themesBusy, setThemesBusy] = useState(false);

  const call = (path: string, init?: RequestInit) =>
    fetch(`${URL_BASE}${path}?from=${from}&to=${to}`, { ...init, headers: { Authorization: `Bearer ${key}` } });
  const fail = async (r: Response) => {
    const msg = (await r.json().catch(() => null))?.error?.message ?? `Error ${r.status}`;
    if (r.status === 401) {
      setKey("");
      try { sessionStorage.removeItem(KEY); } catch { /* */ }
    }
    setError(msg);
  };

  async function load() {
    if (!URL_BASE || !key) return;
    setBusy(true);
    setError("");
    try {
      const r = await call("/admin/summary");
      if (!r.ok) return void (await fail(r));
      setData(await r.json());
    } catch {
      setError("No me pude conectar con el servidor de Rocky.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { void load(); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function download(name: string) {
    const r = await call(`/admin/${name}.csv`);
    if (!r.ok) return fail(r);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await r.blob());
    a.download = `rpl-${name}-${from}-a-${to}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function groupThemes() {
    setThemesBusy(true);
    setError("");
    try {
      const r = await call("/admin/themes", { method: "POST" });
      if (!r.ok) return void (await fail(r));
      setThemes(await r.json());
    } finally {
      setThemesBusy(false);
    }
  }

  if (!URL_BASE) return <main id="datos-page" className="dp"><p>Esta copia del RPL no tiene servidor de Rocky, así que no registra datos de uso.</p></main>;

  if (!key)
    return (
      <main id="datos-page" className="dp dp-login">
        <form
          className="dp-card"
          onSubmit={(e) => {
            e.preventDefault();
            try { sessionStorage.setItem(KEY, draft); } catch { /* */ }
            setKey(draft);
          }}
        >
          <h1>Datos de uso del RPL</h1>
          <p>Escribe la clave de datos (ADMIN_KEY del servidor de Rocky).</p>
          <input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Clave de datos" autoFocus />
          <button className="btn primary" disabled={!draft}>Entrar</button>
          {error && <p className="dp-error">{error}</p>}
        </form>
      </main>
    );

  const d = data;
  const t = d?.totals;
  const activeSessions = d?.sessions.filter((s) => s.active > 0) ?? [];
  const perStudent = d?.students.map((s) => s.seconds) ?? [];
  const known = d ? d.rocky.read + d.rocky.unread : 0;

  return (
    <main id="datos-page" className="dp">
      <header className="dp-head">
        <div>
          <h1>Datos de uso del RPL</h1>
          <p className="dp-muted">Sin nombres: cada alumno es el identificador anónimo de su navegador y el grupo que eligió.</p>
        </div>
        <form className="dp-range" onSubmit={(e) => { e.preventDefault(); void load(); }}>
          <label>Desde <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label>Hasta <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button className="btn primary" disabled={busy}>{busy ? "Cargando…" : "Actualizar"}</button>
          <button type="button" className="btn" onClick={() => { setKey(""); setData(null); try { sessionStorage.removeItem(KEY); } catch { /* */ } }}>Salir</button>
        </form>
      </header>
      {error && <p className="dp-error">{error}</p>}

      {d && t && (
        <>
          <section className="dp-card dp-quote">
            <h2>En una frase</h2>
            <p>
              Del {d.from === "2000-01-01" ? "inicio" : d.from} al {d.to}, <b>{nf(t.students)} {t.students === 1 ? "alumno" : "alumnos"}</b> usaron el RPL en <b>{nf(t.sessions)} sesiones</b>
              {" "}a lo largo de {nf(t.days)} días, con <b>{nf(min(t.seconds) / 60, 1)} horas de uso activo</b> (mediana de{" "}
              {nf(min(median(perStudent)), 0)} min por alumno), {nf(t.clicks)} clics y {nf(t.edits)} cambios de diseño. Le hicieron{" "}
              <b>{nf(t.questions)} preguntas a Rocky</b> ({pct(t.askers, t.students)} de los alumnos preguntó al menos una vez)
              {known ? <> y leyeron completas el <b>{pct(d.rocky.read, known)}</b> de sus respuestas</> : null}.
            </p>
          </section>

          <section className="dp-tiles">
            <Tile value={nf(t.students)} label="Alumnos" sub="navegadores distintos" />
            <Tile value={nf(t.sessions)} label="Sesiones" sub={`${nf(t.days)} días con uso`} />
            <Tile value={nf(min(t.seconds) / 60, 1)} unit="h" label="Uso activo total" />
            <Tile value={nf(min(median(perStudent)), 0)} unit="min" label="Por alumno" sub="mediana del tiempo activo" />
            <Tile value={nf(min(median(activeSessions.map((s) => s.active))), 0)} unit="min" label="Por sesión" sub={`activo · ${nf(min(median(activeSessions.map((s) => s.wall))), 0)} min abierta`} />
            <Tile value={nf(t.clicks)} label="Clics" sub={`${nf(t.students ? t.clicks / t.students : 0)} por alumno`} />
            <Tile value={nf(t.edits)} label="Cambios de diseño" sub={`${nf(t.students ? t.edits / t.students : 0)} por alumno`} />
            <Tile value={nf(t.questions)} label="Preguntas a Rocky" sub={`${pct(t.askers, t.students)} de los alumnos`} />
            <Tile value={known ? pct(d.rocky.read, known) : "—"} label="Respuestas leídas" sub={`${nf(d.rocky.read)} de ${nf(known)} con dato`} />
          </section>

          <div className="dp-grid">
            <section className="dp-card">
              <h2>Por grupo</h2>
              <table className="dp-table">
                <thead><tr><th>Grupo</th><th>Alumnos</th><th>Sesiones</th><th>Horas activas</th><th>Min por alumno</th><th>Clics</th><th>Cambios</th><th>Preguntas</th></tr></thead>
                <tbody>
                  {d.byGroup.map((g) => (
                    <tr key={g.grp}>
                      <td>{g.grp || "Sin grupo"}</td><td>{nf(g.students)}</td><td>{nf(g.sessions)}</td><td>{nf(g.seconds / 3600, 1)}</td>
                      <td>{nf(g.students ? min(g.seconds) / g.students : 0)}</td><td>{nf(g.clicks)}</td><td>{nf(g.edits)}</td><td>{nf(g.questions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="dp-muted">"Sin grupo": alumnos que todavía no eligieron grupo en Rocky.</p>
            </section>

            <section className="dp-card">
              <h2>Uso por día</h2>
              <Bars rows={d.byDay.map((x) => ({ label: x.day, value: min(x.seconds), note: `· ${x.students} alumnos` }))} unit="min" />
            </section>

            <section className="dp-card">
              <h2>Uso por hora del día</h2>
              <Bars rows={d.byHour.map((x) => ({ label: `${String(x.hour).padStart(2, "0")}:00`, value: min(x.seconds) }))} unit="min" />
            </section>

            <section className="dp-card">
              <h2>Tiempo por pantalla</h2>
              <Bars rows={d.byRoute.slice(0, 20).map((x) => ({ label: routeName(x.route), value: min(x.seconds), note: `· ${nf(x.views)} visitas` }))} unit="min" />
            </section>

            <section className="dp-card">
              <h2>Lo que más clican</h2>
              <Bars rows={d.topClicks.slice(0, 20).map((x) => ({ label: `${x.target || "—"} (${routeName(x.route)})`, value: x.n }))} unit="" />
            </section>

            <section className="dp-card">
              <h2>Los campos que más cambian</h2>
              <Bars rows={d.topEdits.slice(0, 20).map((x) => ({ label: `${x.target} (${routeName(x.route)})`, value: x.n }))} unit="" />
            </section>
          </div>

          <h2 className="dp-section">Rocky</h2>
          <section className="dp-tiles">
            <Tile value={nf(d.rocky.questions)} label="Preguntas" />
            <Tile value={pct(d.rocky.read, known)} label="Leídas completas" sub={`el reloj de lectura llegó a cero · ${nf(d.rocky.unread)} sin terminar · ${nf(d.rocky.unknown)} sin dato`} />
            <Tile value={nf(d.rocky.avgAnswerWords)} label="Palabras por respuesta" sub="promedio" />
            <Tile value={nf(d.rocky.avgSeconds, 1)} unit="s" label="Tiempo de respuesta" sub="promedio" />
            <Tile value={nf(d.rocky.tokens / 1000, 0)} unit="mil" label="Tokens" sub="entrada + salida" />
          </section>

          <div className="dp-grid">
            <section className="dp-card">
              <h2>Preguntas que más se repiten</h2>
              <p className="dp-muted">Iguales sin contar mayúsculas, acentos ni signos. Para agruparlas por tema usa el botón de la derecha.</p>
              <table className="dp-table">
                <thead><tr><th>Pregunta</th><th>Veces</th><th>Alumnos</th></tr></thead>
                <tbody>{d.rocky.repeated.map((q, i) => <tr key={i}><td>{q.text}</td><td>{q.n}</td><td>{q.students}</td></tr>)}</tbody>
              </table>
            </section>

            <section className="dp-card">
              <h2>Temas de las preguntas</h2>
              <p className="dp-muted">Claude agrupa las preguntas de estas fechas por tema y nivel de Bloom (hasta las 800 más recientes). Revisa el resultado antes de citarlo.</p>
              <button className="btn primary" onClick={groupThemes} disabled={themesBusy || !d.rocky.questions}>{themesBusy ? "Agrupando…" : "Agrupar por tema"}</button>
              {themes && (
                <table className="dp-table">
                  <thead><tr><th>Tema</th><th>Preguntas</th><th>Bloom</th></tr></thead>
                  <tbody>
                    {themes.temas.filter((x) => x.n > 0).map((x, i) => (
                      <tr key={i}>
                        <td><b>{x.tema}</b><div className="dp-muted">{x.descripcion}</div><ul>{x.ejemplos.map((e, j) => <li key={j}>{e}</li>)}</ul></td>
                        <td>{x.n} <small className="dp-muted">({pct(x.n, themes.total)})</small></td>
                        <td>{x.bloom}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="dp-card">
              <h2>Herramientas que usó Rocky</h2>
              <Bars rows={d.rocky.tools.map((x) => ({ label: TOOL_NAME[x.name] ?? x.name, value: x.n }))} unit="veces" />
            </section>
          </div>

          <section className="dp-card">
            <h2>Últimas preguntas</h2>
            <div className="dp-recent">
              {d.rocky.recent.map((q, i) => (
                <details key={i}>
                  <summary>
                    <span className="dp-muted">{new Date(q.ts).toLocaleString("es-MX", { timeZone: "America/Mazatlan", dateStyle: "short", timeStyle: "short" })} · {q.grp}</span>
                    <span>{q.question}</span>
                    <span className={`dp-read ${q.read === "sí" ? "yes" : q.read === "no" ? "no" : ""}`}>{q.read === "sí" ? "leída" : q.read === "no" ? "sin terminar" : "—"}</span>
                  </summary>
                  <p>{q.answer || <i>(sin texto)</i>}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="dp-card">
            <h2>Descargar para Excel, SPSS o R</h2>
            <div className="dp-downloads">
              <button className="btn" onClick={() => download("students")}>Alumnos (una fila por alumno)</button>
              <button className="btn" onClick={() => download("turns")}>Preguntas a Rocky con respuesta</button>
              <button className="btn" onClick={() => download("events")}>Eventos (por minuto)</button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
