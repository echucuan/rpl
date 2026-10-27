import { describe, expect, it } from "vitest";
import { newEstesDesign, newWaterDesign, type Design } from "../model";
import {
  afterExport, discard, draftOf, exportSnapshot, fingerprint, guardFor, isDirty, project, projectFile, readDraft, saveStatus,
  shouldWarnOnUnload, type Project, type ProgramType, type Writer,
} from "./project";
import { readDesignFile } from "./storage";

const both = (estes: Project, water: Project = project(newWaterDesign(), "new")): Record<ProgramType, Project> => ({ estes, water });
const edit = (p: Project, fn: (d: Design) => Design): Project => ({ ...p, design: fn(structuredClone(p.design)) });
const heavierNose = (d: Design) => ({ ...d, nose: { ...d.nose, mass: d.nose.mass + 3 } });
const longerBody = (d: Design) => ({ ...d, body: { ...d.body, length: d.body.length + 20 } });

/** Writer that only finishes when the test says so. */
function slowWriter() {
  let finish!: (r: "downloaded") => void;
  const files: string[] = [];
  const writer: Writer = (_name, content) => { files.push(content); return new Promise((res) => { finish = res; }); };
  return { writer, files, finish: () => finish("downloaded") };
}
const okWriter = (source: "downloaded" | "written"): Writer => async () => source;

describe("cambios sin guardar", () => {
  it("1. abrir un proyecto y navegar sin cambios no pide confirmación", () => {
    const p = project({ ...newEstesDesign(), name: "Prueba" }, "opened");
    expect(isDirty(p)).toBe(false);
    for (const to of ["inicio", "water", "designs", "about"] as const) expect(guardFor("estes", { kind: "tab", to }, both(p))).toBeNull();
    expect(shouldWarnOnUnload(both(p))).toBe(false);
  });

  it("2. cambiar la masa y pulsar Inicio pide confirmación", () => {
    const p = edit(project(newEstesDesign(), "new"), heavierNose);
    expect(saveStatus(p)).toBe("dirty");
    expect(guardFor("estes", { kind: "tab", to: "inicio" }, both(p))).toBe("estes");
  });

  it("3. cambiar parámetros y pasar al otro simulador pide confirmación", () => {
    const w = edit(project(newWaterDesign(), "new"), (d) => (d.type === "water" ? { ...d, water: { ...d.water, pressure: d.water.pressure - 10 } } : d));
    const ps = both(project(newEstesDesign(), "new"), w);
    expect(guardFor("water", { kind: "tab", to: "estes" }, ps)).toBe("water");
    // The other simulator's own clean state does not trigger anything.
    expect(guardFor("estes", { kind: "tab", to: "water" }, ps)).toBeNull();
  });

  it("4. cambiar dimensiones y recargar: aviso del navegador y borrador que solo se recupera si el alumno acepta", () => {
    const p = edit(project(newEstesDesign(), "new"), longerBody);
    expect(shouldWarnOnUnload(both(p))).toBe(true);
    const stored = JSON.parse(JSON.stringify(draftOf(p)));
    const r = readDraft(stored, "estes");
    expect(r.action).toBe("ask");
    if (r.action !== "drop") expect(fingerprint(r.project.design)).toBe(fingerprint(p.design));
  });

  it("5. cambiar datos y cerrar la pestaña activa el aviso; sin cambios no", () => {
    const clean = project(newEstesDesign(), "new");
    expect(shouldWarnOnUnload(both(clean))).toBe(false);
    expect(shouldWarnOnUnload(both(edit(clean, heavierNose)))).toBe(true);
  });

  it("6. descargar y seguir trabajando vuelve a marcar cambios", async () => {
    let p = edit(project(newEstesDesign(), "new"), heavierNose);
    p = afterExport(p, await exportSnapshot(p.design, "a.rpl.json", okWriter("downloaded")));
    expect(saveStatus(p)).toBe("started"); // never "guardado": only handed to the browser
    expect(isDirty(p)).toBe(false);
    p = edit(p, longerBody);
    expect(saveStatus(p)).toBe("dirty");
  });

  it("6b. con escritura confirmada por el navegador el estado es 'written'", async () => {
    let p = edit(project(newEstesDesign(), "new"), heavierNose);
    p = afterExport(p, await exportSnapshot(p.design, "a.rpl.json", okWriter("written")));
    expect(saveStatus(p)).toBe("written");
  });

  it("7. cancelar la navegación conserva los parámetros", () => {
    const p = edit(project(newEstesDesign(), "new"), heavierNose);
    const ps = both(p);
    guardFor("estes", { kind: "tab", to: "about" }, ps);
    expect(ps.estes.design).toBe(p.design);
    expect(isDirty(ps.estes)).toBe(true);
  });

  it("8. salir sin guardar regresa al último archivo", () => {
    const opened = project({ ...newEstesDesign(), name: "Mío" }, "imported");
    const p = discard(edit(opened, heavierNose));
    expect(isDirty(p)).toBe(false);
    expect(p.design.nose.mass).toBe(opened.design.nose.mass);
  });

  it("9. importar un archivo sin modificarlo no deja cambios pendientes", async () => {
    const file = new File([projectFile({ ...newWaterDesign(), name: "Botella" })], "botella.rpl.json");
    const d = await readDesignFile(file);
    if (typeof d === "string") throw new Error(d);
    const p = project(d, "imported");
    expect(saveStatus(p)).toBe("clean");
    expect(guardFor("water", { kind: "tab", to: "inicio" }, both(project(newEstesDesign(), "new"), p))).toBeNull();
  });

  it("10. importar y modificar un parámetro sí deja cambios pendientes", () => {
    const p = edit(project({ ...newEstesDesign(), name: "Importado" }, "imported"), heavierNose);
    expect(isDirty(p)).toBe(true);
  });

  it("11. cambiar un valor y regresarlo al original deja el proyecto sin cambios", () => {
    const base = project(newEstesDesign(), "new");
    const changed = edit(base, heavierNose);
    const back = edit(changed, (d) => ({ ...d, nose: { ...d.nose, mass: base.design.nose.mass } }));
    expect(isDirty(changed)).toBe(true);
    expect(isDirty(back)).toBe(false);
  });

  it("12. si la exportación falla, los cambios siguen pendientes", async () => {
    const p = edit(project(newEstesDesign(), "new"), heavierNose);
    const out = await exportSnapshot(p.design, "a.rpl.json", async () => { throw new Error("disco lleno"); });
    const after = afterExport({ ...p, exporting: fingerprint(p.design) }, out);
    expect(isDirty(after)).toBe(true);
    expect(saveStatus(after)).toBe("error");
    expect(after.error).toContain("disco lleno");
  });

  it("12b. cerrar el cuadro de 'Guardar como' no es error ni guarda", async () => {
    const p = edit(project(newEstesDesign(), "new"), heavierNose);
    const after = afterExport(p, await exportSnapshot(p.design, "a.rpl.json", async () => "cancelled"));
    expect(saveStatus(after)).toBe("dirty");
  });

  it("13. lo que se cambia mientras se prepara el archivo sigue pendiente", async () => {
    let p = edit(project(newEstesDesign(), "new"), heavierNose);
    const slow = slowWriter();
    const exporting = exportSnapshot(p.design, "a.rpl.json", slow.writer);
    p = { ...p, exporting: fingerprint(p.design) };
    expect(saveStatus(p)).toBe("preparing");
    expect(shouldWarnOnUnload(both(p))).toBe(true);
    const snapshotMass = p.design.nose.mass;
    p = edit(p, longerBody); // typed while the file is being written
    slow.finish();
    p = afterExport(p, await exporting);
    expect(isDirty(p)).toBe(true);
    expect(JSON.parse(slow.files[0]).design.nose.mass).toBe(snapshotMass);
    expect(JSON.parse(slow.files[0]).design.body.length).not.toBe(p.design.body.length);
  });

  it("14. Atrás/Adelante: salir del simulador pide confirmación; moverse entre sus pestañas no", () => {
    const ps = both(edit(project(newEstesDesign(), "new"), heavierNose));
    expect(guardFor("estes", { kind: "tab", to: "inicio" }, ps)).toBe("estes");
    expect(guardFor("estes", { kind: "tab", to: "estes", sub: "graficas" }, ps)).toBeNull();
    expect(guardFor("about", { kind: "tab", to: "estes" }, ps)).toBeNull();
  });

  it("15. abrir otro proyecto o empezar uno nuevo con cambios pendientes pide confirmación", () => {
    const ps = both(edit(project(newEstesDesign(), "new"), heavierNose));
    expect(guardFor("designs", { kind: "open", design: newEstesDesign(), source: "opened" }, ps)).toBe("estes");
    expect(guardFor("estes", { kind: "new", type: "estes" }, ps)).toBe("estes");
    // Opening a water design does not replace the Rocket Tec work.
    expect(guardFor("designs", { kind: "open", design: newWaterDesign(), source: "opened" }, ps)).toBeNull();
  });
});

describe("archivo y borrador", () => {
  it("el archivo exportado conserva el formato versión 1 y se vuelve a abrir igual", async () => {
    const d = { ...heavierNose(newEstesDesign()), name: "Cohete 1" };
    const text = projectFile(d);
    expect(JSON.parse(text)).toMatchObject({ app: "Rocket Physics Lab Sinaloa", version: 1 });
    const back = await readDesignFile(new File([text], "c.rpl.json"));
    expect(typeof back).not.toBe("string");
    expect(fingerprint(back as Design)).toBe(fingerprint(d));
  });

  it("el orden de las claves no cuenta como cambio", () => {
    const d = newEstesDesign();
    const reordered = Object.fromEntries(Object.entries(d).reverse()) as unknown as Design;
    expect(fingerprint(reordered)).toBe(fingerprint(d));
  });

  it("un borrador sin cambios se retoma solo; uno viejo se descarta", () => {
    const p = project(newEstesDesign(), "imported");
    expect(readDraft(draftOf(p), "estes").action).toBe("resume");
    const old = draftOf(edit(p, heavierNose), "2020-01-01T00:00:00Z");
    expect(readDraft(old, "estes").action).toBe("drop");
    expect(readDraft(draftOf(p), "water").action).toBe("drop");
  });

  it("borradores de la versión anterior (solo el diseño) se ofrecen si tienen cambios", () => {
    expect(readDraft(newEstesDesign(), "estes").action).toBe("resume");
    expect(readDraft(heavierNose(newEstesDesign()), "estes").action).toBe("ask");
  });
});
