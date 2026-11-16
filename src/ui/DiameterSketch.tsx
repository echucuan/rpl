import { MOTOR_MOUNT, NOSE_SLEEVE, type Design } from "../model";
import { layout } from "../physics/geometry";
import { RocketView, type RocketZoom } from "./RocketView";

/**
 * Where a Rocket Tec's fixed diameter is measured: a close-up of the student's own rocket drawing, with the diameter
 * the note is about in blue and what sets it in gray. The nose's base is as wide as the tube (Ø28), which is as wide
 * as the motor mount's sleeve inside it (Ø27) lets it be.
 */
export function DiameterZoom({ d, focus }: { d: Design; focus: "nose" | "body" }) {
  const l = layout(d);
  const zoom: RocketZoom =
    focus === "nose"
      ? {
          from: l.bodyStart - 42,
          to: l.bodyStart + NOSE_SLEEVE.length + 12,
          dims: [
            { x: l.bodyStart - 4, diameter: d.nose.diameter, label: `Ø${d.nose.diameter}`, main: true },
            { x: l.bodyStart + NOSE_SLEEVE.length / 2, diameter: NOSE_SLEEVE.diameter, label: `Ø${NOSE_SLEEVE.diameter}` },
          ],
        }
      : {
          from: l.tubeEnd - 56,
          to: l.bodyEnd + 6,
          dims: [
            { x: l.tubeEnd - 40, diameter: d.body.diameter, label: `Ø${d.body.diameter}`, main: true },
            { x: l.tubeEnd - 10, diameter: MOTOR_MOUNT.sleeveDiameter, label: `Ø${MOTOR_MOUNT.sleeveDiameter}` },
          ],
        };
  return (
    <div className="diameter-zoom">
      <RocketView design={d} zoom={zoom} />
      <ul className="zoom-key">
        {focus === "nose" ? (
          <>
            <li className="main">Ø{d.nose.diameter} aquí: la base de la ojiva, igual que el tubo por fuera</li>
            <li>Ø{NOSE_SLEEVE.diameter} su manga, que entra floja en el tubo</li>
          </>
        ) : (
          <>
            <li className="main">Ø{d.body.diameter} aquí: el tubo de opalina por fuera</li>
            <li>Ø{MOTOR_MOUNT.sleeveDiameter} la manga del porta motor, dentro del tubo: es su diámetro interior</li>
          </>
        )}
      </ul>
    </div>
  );
}
