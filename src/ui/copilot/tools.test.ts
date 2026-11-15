import { describe, expect, it } from "vitest";
import { newEstesDesign, newWaterDesign } from "../../model";
import { runTool, simularCambio, verDiseno } from "./tools";

describe("copilot tools", () => {
  it("ver_diseno returns the design and its flight summary", () => {
    const d = newEstesDesign();
    const out = verDiseno(d);
    expect(out.programa).toMatch(/Rocket Tec/);
    expect(out.diseno).toBe(d);
    expect(out.ultimo_vuelo).toHaveProperty("apogeo_m");
    expect(out.ultimo_vuelo).toHaveProperty("calificacion.resultado");
  });

  it("simular_cambio compares before and after without touching the student's design", () => {
    const d = newEstesDesign(); // starts without fins
    const span = d.fins.span;
    const out = simularCambio(d, {
      cambios: [{ ruta: "fins.count", valor: 3 }, { ruta: "fins.span", valor: span * 1.5 }],
      motivo: "ponerle aletas grandes",
    });
    expect(d.fins.count).toBe(0);
    expect(d.fins.span).toBe(span);
    if (!("despues" in out)) throw new Error("expected a simulation");
    expect(out.cambios_aplicados).toEqual([
      { ruta: "fins.count", antes: 0, despues: 3 },
      { ruta: "fins.span", antes: span, despues: span * 1.5 },
    ]);
    const before = out.antes as { estabilidad_vacio: { margen_calibres: number } };
    const after = out.despues as { estabilidad_vacio: { margen_calibres: number } };
    expect(after.estabilidad_vacio.margen_calibres).toBeGreaterThan(before.estabilidad_vacio.margen_calibres);
  });

  it("explains bad paths and types instead of guessing", () => {
    const d = newWaterDesign();
    const out = simularCambio(d, {
      cambios: [
        { ruta: "aletas.envergadura", valor: 10 },
        { ruta: "water.pressure", valor: "mucha" },
        { ruta: "water", valor: 3 },
        { ruta: "type", valor: "estes" },
      ],
    });
    expect(out).not.toHaveProperty("despues");
    expect(out.errores).toHaveLength(4);
    expect(out.errores?.[0]).toMatch(/no existe/);
    expect(out.errores?.[1]).toMatch(/number/);
    expect(out.errores?.[2]).toMatch(/grupo de campos/);
    expect(out.errores?.[3]).toMatch(/no se puede cambiar/);
  });

  it("ver_leccion reads the screen even without an open design", () => {
    const screen = { pantalla: "Lección de la fase 2", texto: "$F = m a$" };
    expect(runTool("ver_leccion", {}, null, () => screen)).toEqual({ content: JSON.stringify(screen), isError: false });
    expect(runTool("ver_leccion", {}, null).isError).toBe(true);
  });

  it("runTool reports errors for unknown tools and for no open design", () => {
    expect(runTool("ver_diseno", {}, null).isError).toBe(true);
    expect(runTool("borrar_todo", {}, newEstesDesign()).isError).toBe(true);
    const ok = runTool("simular_cambio", { cambios: [{ ruta: "water.pressure", valor: 60 }], motivo: "menos presión" }, newWaterDesign());
    expect(ok.isError).toBe(false);
    expect(JSON.parse(ok.content).despues).toHaveProperty("apogeo_m");
  });
});
