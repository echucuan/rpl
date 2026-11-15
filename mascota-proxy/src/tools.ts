import type Anthropic from "@anthropic-ai/sdk";

/**
 * Tools the copilot can use. They are declared here (the Worker decides what exists) and RUN IN THE
 * BROWSER, which calls the RPL simulator with the student's own design. The names and inputs must
 * match the handlers in the app (src/ui/copilot/).
 */
export const TOOLS: Anthropic.Tool[] = [
  {
    name: "ver_diseno",
    description:
      "Devuelve el diseño del cohete que el alumno tiene abierto en este momento (programa Rocket Tec o Rocket Challenge, " +
      "dimensiones, masas, motor o agua y presión, paracaídas, sitio de lanzamiento) y el resumen de su último vuelo simulado " +
      "(apogeo, velocidad máxima, márgenes de estabilidad, velocidad de descenso, calificación y advertencias). " +
      "Úsala antes de opinar sobre el cohete del alumno; no supongas valores.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    name: "simular_cambio",
    description:
      "Simula una variante del diseño actual SIN modificar el diseño del alumno y devuelve la comparación antes/después " +
      "(apogeo, velocidad máxima, márgenes de estabilidad cargado y vacío, velocidad de descenso, calificación, advertencias). " +
      "Úsala para responder preguntas del tipo \"¿qué pasa si…?\" con números reales del simulador. " +
      "Cada cambio indica la ruta del campo en el diseño (por ejemplo \"fins.span\", \"nose.length\", \"recovery.diameter\", " +
      "\"water.pressure\", \"water.waterVolume\") y el nuevo valor en las unidades del diseño (mm, g, L, psi). " +
      "Si una ruta no existe, el resultado lo dirá; llama primero a ver_diseno para conocer las rutas.",
    input_schema: {
      type: "object",
      properties: {
        cambios: {
          type: "array",
          description: "Campos a cambiar en la copia del diseño.",
          items: {
            type: "object",
            properties: {
              ruta: { type: "string", description: "Ruta con puntos, p. ej. \"fins.span\"." },
              valor: { type: ["number", "string", "boolean"], description: "Nuevo valor." },
            },
            required: ["ruta", "valor"],
            additionalProperties: false,
          },
        },
        motivo: { type: "string", description: "Qué se quiere averiguar con esta simulación, en una frase." },
      },
      required: ["cambios", "motivo"],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: "ver_leccion",
    description:
      "Devuelve el texto de la pantalla que el alumno tiene abierta en RPL (una lección de fase, la prueba estática, " +
      "estabilidad, simulaciones o el diseño del cohete), con sus ecuaciones en LaTeX y con los números de su propio cohete. " +
      "Úsala cuando pregunte por algo de la lección o de lo que está viendo, para explicar con la misma notación, los mismos " +
      "pasos (Física, Matemáticas, Computación) y el mismo código MATLAB que aparecen en su pantalla.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
];
