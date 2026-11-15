import { useId, type CSSProperties } from "react";
import { MASCOT_DESIGN, STAR, type MascotDesign, type MascotMood } from "./mascotDesign";

/**
 * The RPL mascot: the Rocket Tec isotipo (the logo's rocket) brought to life.
 * This component only draws; the look (colors, shapes, expressions, speeds) is in mascotDesign.ts.
 */

export { MASCOT_MOODS, type MascotMood } from "./mascotDesign";

interface Props {
  mood?: MascotMood;
  /** Rendered height in px; the width follows the drawing's proportions. */
  size?: number;
  /** Accessible name; pass "" when a visible label already names it. */
  title?: string;
  className?: string;
  /** Alternative design (the live editor uses it); defaults to MASCOT_DESIGN. */
  design?: MascotDesign;
}

export function Mascot({ mood = "idle", size = 120, title = "Mascota Rocket Tec", className, design = MASCOT_DESIGN }: Props) {
  const { colors: c, stroke, shapes: s, eye, cheeks, decorations: deco, animation: anim } = design;
  const m = design.moods[mood];
  const eyeClip = `mascot-eye-${useId().replace(/:/g, "")}`;

  const speeds = {
    "--m-float": `${anim.float}s`,
    "--m-blink": `${anim.blink}s`,
    "--m-flame": `${anim.flame}s`,
    "--m-talk": `${anim.talk}s`,
  } as CSSProperties;
  const iris: CSSProperties = {
    transform: `translate(${m.gaze.x}px, ${m.gaze.y}px) scale(${m.irisScale})`,
    transformOrigin: `${eye.cx}px ${eye.cy}px`,
  };
  const lidTop = eye.cy - eye.radius - 1;
  const mouthTop = m.mouth.animated ? "m-mouth-talk" : undefined;

  return (
    <svg
      className={`mascot${className ? ` ${className}` : ""}`}
      data-mood={mood}
      data-motion={m.motion}
      data-plume={m.plume}
      style={speeds}
      viewBox="-10 0 140 195"
      height={size}
      width={(size * 140) / 195}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title || undefined}
    >
      <defs>
        <clipPath id={eyeClip}>
          <circle cx={eye.cx} cy={eye.cy} r={eye.radius - 2} />
        </clipPath>
      </defs>

      <g className="m-rocket">
        {/* side fins (behind the body) */}
        <g stroke={c.outline} strokeWidth={stroke.body} strokeLinejoin="round" fill={c.primary}>
          <path d={s.finLeft} />
          <path d={s.finRight} />
        </g>
        <path d={s.finLeftHighlight} fill={c.accent} />
        <path d={s.finRightHighlight} fill={c.accent} />

        {/* exhaust: plume + cloud */}
        <g className="m-plume">
          <path d={s.plume} fill={c.accent} stroke={c.outline} strokeWidth={stroke.detail} />
          <path d={s.plumeCore} fill={c.body} />
        </g>
        <path className="m-cloud" d={s.cloud} fill={c.cloud} stroke={c.outline} strokeWidth={stroke.detail} strokeLinejoin="round" />

        {/* body and two-tone nose */}
        <path d={s.body} fill={c.body} stroke={c.outline} strokeWidth={stroke.body} strokeLinejoin="round" />
        <path d={s.noseLeft} fill={c.accent} />
        <path d={s.noseRight} fill={c.primary} />
        <path d={s.noseLine} fill="none" stroke={c.outline} strokeWidth={stroke.detail} strokeLinecap="round" />
        <path d={s.noseSeam} stroke={c.outline} strokeWidth={stroke.detail * 0.67} />

        {/* front fin */}
        <path d={s.frontFin} fill={c.outline} />

        {/* cheeks and mouth */}
        {m.cheeks && (
          <g fill={c.blush} opacity={cheeks.opacity}>
            <ellipse cx={cheeks.left.x} cy={cheeks.left.y} rx={cheeks.rx} ry={cheeks.ry} />
            <ellipse cx={cheeks.right.x} cy={cheeks.right.y} rx={cheeks.rx} ry={cheeks.ry} />
          </g>
        )}
        <g className={mouthTop}>
          {m.mouth.filled ? (
            <path d={m.mouth.d} fill={c.outline} stroke={c.outline} strokeWidth={1.5} strokeLinejoin="round" />
          ) : (
            <path d={m.mouth.d} fill="none" stroke={c.outline} strokeWidth={stroke.mouth} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {m.mouth.tongue && <path d={m.mouth.tongue} fill={c.blush} />}
        </g>

        {/* the eye (porthole) */}
        <circle cx={eye.cx} cy={eye.cy} r={eye.radius} fill={c.body} stroke={c.outline} strokeWidth={stroke.body} />
        <g clipPath={`url(#${eyeClip})`}>
          <g className="m-iris" style={iris}>
            <circle cx={eye.cx} cy={eye.cy} r={eye.irisRadius} fill={c.primary} stroke={c.outline} strokeWidth={stroke.detail} />
            <circle cx={eye.cx} cy={eye.cy} r={eye.pupilRadius} fill={c.outline} />
            <circle cx={eye.cx - 4} cy={eye.cy - 4} r={eye.highlightRadius} fill={c.body} />
            {m.sparkleEye && (
              <>
                <circle cx={eye.cx + 4.5} cy={eye.cy + 4} r={eye.highlightRadius * 0.6} fill={c.body} />
                <path d={STAR} transform={`translate(${eye.cx - 4} ${eye.cy - 4}) scale(0.55)`} fill={c.body} />
              </>
            )}
          </g>
          {m.blink && (
            <rect
              className="m-lid"
              style={{ transformOrigin: `${eye.cx}px ${lidTop}px` }}
              x={eye.cx - eye.radius - 1}
              y={lidTop}
              width={(eye.radius + 1) * 2}
              height={(eye.radius + 1) * 2}
              fill={c.body}
            />
          )}
        </g>
      </g>

      {/* mood extras */}
      {m.extras.includes("dots") && (
        <g className="m-dots" fill={c.accent}>
          {deco.dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} />)}
        </g>
      )}
      {m.extras.includes("sparks") && (
        <g className="m-sparks" fill={c.accent}>
          {deco.sparks.map((p, i) => (
            <g key={i} transform={`translate(${p.x} ${p.y}) scale(${p.scale})`}>
              <path d={STAR} />
            </g>
          ))}
        </g>
      )}
      {m.extras.includes("question") && (
        <text
          className="m-question"
          x={deco.question.x}
          y={deco.question.y}
          fill={c.primary}
          fontSize={deco.question.size}
          fontWeight="700"
          fontFamily="Inter, Arial, sans-serif"
        >
          ?
        </text>
      )}
    </svg>
  );
}
