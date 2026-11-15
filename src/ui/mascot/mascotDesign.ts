/**
 * Everything that defines how the mascot LOOKS lives in this file: colors, line widths,
 * shapes, the eye, the mouth and extras of each mood, and the animation speeds.
 * Mascot.tsx only draws what is here, so the design is edited here (see LEEME.md).
 *
 * Coordinates are SVG user units on a 140 × 195 canvas (viewBox "-10 0 140 195");
 * the rocket's center line is x = 60. Tip: shapes can be redrawn in Figma/Illustrator
 * on that canvas and their path "d" pasted here.
 */

export type MascotMood = "idle" | "thinking" | "talking" | "happy" | "confused";
export type MascotExtra = "dots" | "sparks" | "question";

export interface MouthDesign {
  /** Outline of the mouth (an SVG path). */
  d: string;
  /** true: filled shape (open mouth); false: just a line (closed mouth). */
  filled: boolean;
  /** Optional tongue drawn inside an open mouth. */
  tongue?: string;
  /** Opens and closes like talking (speed: animation.talk). */
  animated?: boolean;
}

export interface MoodDesign {
  label: string;
  when: string;
  /** Where the iris looks: offset in units from the eye's center (+x right, +y down). */
  gaze: { x: number; y: number };
  /** Iris size: 1 = normal, >1 bigger (excited), <1 smaller (confused). */
  irisScale: number;
  /** Blinks from time to time. */
  blink: boolean;
  /** Extra glints in the eye (star + second highlight). */
  sparkleEye: boolean;
  /** Rosy cheeks. */
  cheeks: boolean;
  mouth: MouthDesign;
  /** Decorations around the rocket. */
  extras: MascotExtra[];
  /** Body motion (defined in mascot.css): float, think, fast, hop, tilt. */
  motion: "float" | "think" | "fast" | "hop" | "tilt";
  /** Exhaust plume: normal, strong (talking) or weak (sputtering). */
  plume: "normal" | "strong" | "weak";
}

export interface MascotDesign {
  colors: {
    /** Outlines, pupil, mouth (Rocket Tec "Azul profundo"). */
    outline: string;
    /** Body and eye white. */
    body: string;
    /** Fins, right half of the nose, iris (Rocket Tec "Azul impulso"). */
    primary: string;
    /** Left half of the nose, fin highlights, plume, decorations (Rocket Tec "Azul cielo"). */
    accent: string;
    /** Exhaust cloud. */
    cloud: string;
    /** Tongue and cheeks. */
    blush: string;
  };
  /** Line widths in canvas units. */
  stroke: { body: number; detail: number; mouth: number };
  /** Static shapes of the rocket (SVG paths). */
  shapes: {
    body: string;
    noseLeft: string;
    noseRight: string;
    noseLine: string;
    noseSeam: string;
    finLeft: string;
    finRight: string;
    finLeftHighlight: string;
    finRightHighlight: string;
    frontFin: string;
    plume: string;
    plumeCore: string;
    cloud: string;
  };
  eye: { cx: number; cy: number; radius: number; irisRadius: number; pupilRadius: number; highlightRadius: number };
  cheeks: { left: { x: number; y: number }; right: { x: number; y: number }; rx: number; ry: number; opacity: number };
  /** Where each mood extra is drawn. */
  decorations: {
    dots: { x: number; y: number; r: number }[];
    sparks: { x: number; y: number; scale: number }[];
    question: { x: number; y: number; size: number };
  };
  /** Animation durations in seconds. */
  animation: { float: number; blink: number; flame: number; talk: number };
  moods: Record<MascotMood, MoodDesign>;
}

/** 4-point star like the ones in the Rocket Tec logo (centered at 0,0, radius 7). */
export const STAR = "M0 -7 Q1 -1 7 0 Q1 1 0 7 Q-1 1 -7 0 Q-1 -1 0 -7Z";

const smile = "M51 96 Q60 104 69 96";

export const MASCOT_DESIGN: MascotDesign = {
  colors: {
    outline: "#072F70",
    body: "#FFFFFF",
    primary: "#0751B5",
    accent: "#469AFF",
    cloud: "#DCEBFF",
    blush: "#469AFF",
  },
  stroke: { body: 4, detail: 3, mouth: 3.5 },
  shapes: {
    body: "M60 6 C78 22 86 50 86 90 L84 132 C84 138 80 142 74 142 L46 142 C40 142 36 138 36 132 L34 90 C34 50 42 22 60 6 Z",
    noseLeft: "M60 8 C50 17 44 28 41 40 Q50 44 60 44 Z",
    noseRight: "M60 8 C70 17 76 28 79 40 Q70 44 60 44 Z",
    noseLine: "M41 40 Q60 47 79 40",
    noseSeam: "M60 8 V44",
    finLeft: "M38 94 C21 103 15 124 18 152 C25 144 31 141 37 141 Z",
    finRight: "M82 94 C99 103 105 124 102 152 C95 144 89 141 83 141 Z",
    finLeftHighlight: "M34 106 C26 114 23 128 23 142 C27 139 31 137 35 137 Z",
    finRightHighlight: "M86 106 C94 114 97 128 97 142 C93 139 89 137 85 137 Z",
    frontFin: "M60 112 C64 121 66 134 64 152 Q60 157 56 152 C54 134 56 121 60 112 Z",
    plume: "M49 140 C49 153 51 162 53 170 L67 170 C69 162 71 153 71 140 Z",
    plumeCore: "M55 140 C55 151 57 160 58 167 L62 167 C63 160 65 151 65 140 Z",
    cloud: "M40 176 a10 10 0 0 1 12 -12 a10 10 0 0 1 16 0 a10 10 0 0 1 12 12 a8 8 0 0 1 -8 8 h-24 a8 8 0 0 1 -8 -8Z",
  },
  eye: { cx: 60, cy: 70, radius: 17, irisRadius: 11, pupilRadius: 5.5, highlightRadius: 3 },
  cheeks: { left: { x: 43, y: 95 }, right: { x: 77, y: 95 }, rx: 4.5, ry: 2.6, opacity: 0.55 },
  decorations: {
    dots: [{ x: 98, y: 40, r: 3.5 }, { x: 108, y: 30, r: 4.5 }, { x: 120, y: 18, r: 5.5 }],
    sparks: [{ x: 12, y: 40, scale: 1 }, { x: 108, y: 28, scale: 1.2 }, { x: 104, y: 96, scale: 0.7 }],
    question: { x: 104, y: 40, size: 30 },
  },
  animation: { float: 3.2, blink: 4.5, flame: 0.22, talk: 0.32 },
  moods: {
    idle: {
      label: "En espera",
      when: "Panel abierto, esperando una pregunta",
      gaze: { x: 0, y: 0 },
      irisScale: 1,
      blink: true,
      sparkleEye: false,
      cheeks: false,
      mouth: { d: smile, filled: false },
      extras: [],
      motion: "float",
      plume: "normal",
    },
    thinking: {
      label: "Pensando",
      when: "Mientras llega la respuesta o corre una simulación",
      gaze: { x: 5, y: -6 },
      irisScale: 1,
      blink: true,
      sparkleEye: false,
      cheeks: false,
      mouth: { d: "M54 100 Q60.5 101.5 67 97", filled: false },
      extras: ["dots"],
      motion: "think",
      plume: "normal",
    },
    talking: {
      label: "Hablando",
      when: "Mientras escribe la respuesta (streaming)",
      gaze: { x: 0, y: 0 },
      irisScale: 1,
      blink: true,
      sparkleEye: false,
      cheeks: false,
      mouth: {
        d: "M53.5 99 a6.5 5 0 1 0 13 0 a6.5 5 0 1 0 -13 0Z",
        filled: true,
        tongue: "M56.2 101.8 a3.8 1.9 0 1 0 7.6 0 a3.8 1.9 0 1 0 -7.6 0Z",
        animated: true,
      },
      extras: [],
      motion: "fast",
      plume: "strong",
    },
    happy: {
      label: "Contento",
      when: "Vuelo exitoso, buena pregunta, lección terminada",
      gaze: { x: 0, y: 0 },
      irisScale: 1.12,
      blink: false,
      sparkleEye: true,
      cheeks: true,
      mouth: {
        d: "M49 95 Q60 95 71 95 Q70 107 60 107 Q50 107 49 95 Z",
        filled: true,
        tongue: "M54 103.6 Q60 99.6 66 103.6 Q63 106.2 60 106.2 Q57 106.2 54 103.6 Z",
      },
      extras: ["sparks"],
      motion: "hop",
      plume: "normal",
    },
    confused: {
      label: "Confundido",
      when: "Error de conexión o pregunta fuera de tema",
      gaze: { x: -3, y: 2 },
      irisScale: 1,
      blink: true,
      sparkleEye: false,
      cheeks: false,
      mouth: { d: "M51 100 q3 -3.4 6 0 t6 0 t6 0", filled: false },
      extras: ["question"],
      motion: "tilt",
      plume: "weak",
    },
  },
};

export const MASCOT_MOODS = Object.keys(MASCOT_DESIGN.moods) as MascotMood[];
