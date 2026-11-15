# Rocky (la mascota) — cómo editar su diseño

La mascota es el isotipo del logo (el cohete) convertido en personaje: la ventanilla es su ojo y la llama muestra qué tan "ocupado" está.

| Archivo | Qué contiene | ¿Se edita para cambiar el diseño? |
|---|---|---|
| `mascotDesign.ts` | **Todo el aspecto**: colores, grosores, formas, ojo, boca y extras de cada estado, velocidades | **Sí, aquí** |
| `mascot.css` | Cómo se ve cada tipo de movimiento (`float`, `hop`…) y de llama | Solo si quieres un movimiento nuevo |
| `Mascot.tsx` | Dibuja lo que dice `mascotDesign.ts` | No hace falta |
| `MascotLab.tsx` | Estudio de edición en vivo (solo en desarrollo) | No hace falta |

## Forma rápida: el estudio en vivo

1. `npm run dev` y abre **http://localhost:5174/rpl/#mascota**
2. Elige un estado (En espera, Pensando…) y mueve colores, mirada, tamaño del iris, boca, extras, movimiento y velocidades.
3. Cuando te guste: **Copiar diseño** y pégalo **en lugar de** `export const MASCOT_DESIGN = {…};` en `mascotDesign.ts`.
4. **Restablecer** regresa a lo que está guardado en `mascotDesign.ts`.

Lo que mueves en el estudio solo vive en tu navegador hasta que lo pegas en el archivo.

## Cambiar formas (cuerpo, aletas, nariz, nube)

Las formas son *paths* SVG dentro de `shapes` en `mascotDesign.ts`, dibujados en un lienzo de **140 × 195** (`viewBox="-10 0 140 195"`), con la línea central del cohete en **x = 60**.

Para rediseñarlas con herramientas visuales:

1. En el estudio, **Descargar SVG** (baja el estado que tengas seleccionado).
2. Ábrelo en Figma, Illustrator o Inkscape y edita la forma **sin cambiar el tamaño del lienzo**.
3. Copia el atributo `d="…"` del path editado y pégalo en la forma correspondiente de `shapes` (`body`, `finLeft`, `noseLeft`, `cloud`…).

## Cambiar un estado de ánimo

Cada estado en `moods` tiene:

- `label` / `when`: nombre y cuándo se usa.
- `gaze`: hacia dónde mira (x a la derecha, y hacia abajo).
- `irisScale`: tamaño del iris (1 = normal).
- `blink`, `sparkleEye`, `cheeks`: parpadeo, brillo en el ojo, cachetes.
- `mouth`: `d` (forma), `filled` (abierta/rellena o solo línea), `tongue` (opcional), `animated` (se mueve al hablar).
- `extras`: `"dots"` (puntitos de pensar), `"sparks"` (estrellas), `"question"` (signo ?). Su posición está en `decorations`.
- `motion`: `float`, `think`, `fast`, `hop`, `tilt`.
- `plume`: `normal`, `strong`, `weak`.

## Agregar un estado nuevo

1. Agrega el nombre al tipo `MascotMood` en `mascotDesign.ts` (por ejemplo `"sleepy"`).
2. Agrega su entrada en `moods` (copia una existente y ajústala).
3. TypeScript te avisa si falta algo (`npm run typecheck`). Aparece solo en el estudio.

## Paleta oficial (kit de identidad Rocket Tec)

| Nombre | Hex | Uso en la mascota |
|---|---|---|
| Azul profundo | `#072F70` | `outline` |
| Azul impulso | `#0751B5` | `primary` |
| Azul cielo | `#469AFF` | `accent`, `blush` |
| Blanco | `#FFFFFF` | `body` |
