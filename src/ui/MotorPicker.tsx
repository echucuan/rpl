import type { ReactNode } from "react";
import type { EstesDesign } from "../model";
import { MAKERS, MOTORS, motorSpec, type MakerId, type MotorId } from "../motor";
import { SelectField } from "./fields";

/**
 * Manufacturer and motor lists for Rocket Tec. Choosing another motor loads its published masses;
 * the scale masses the student typed are kept while the motor stays the same.
 */
export function MotorPicker({ d, onChange, note }: { d: EstesDesign; onChange: (d: EstesDesign) => void; note?: ReactNode }) {
  const spec = motorSpec(d.motor.id);
  const choose = (id: MotorId) => {
    if (id === spec.id) return;
    const next = motorSpec(id);
    onChange({ ...d, motor: { ...d.motor, id, mass: next.rated.mass, propellant: next.rated.propellant } });
  };
  const maker = MAKERS.find((m) => m.id === spec.maker) ?? MAKERS[0];
  return (
    <>
      <SelectField<MakerId>
        label="Fabricante"
        value={maker.id}
        options={MAKERS.map((m) => ({ value: m.id, label: m.name }))}
        onChange={(id) => choose(MAKERS.find((m) => m.id === id)!.motors[0])}
      />
      <SelectField<MotorId>
        label="Motor"
        value={spec.id}
        options={maker.motors.map((id) => ({ value: id, label: MOTORS[id].name }))}
        onChange={choose}
        title={note}
      />
    </>
  );
}
