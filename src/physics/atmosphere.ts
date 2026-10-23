// International Standard Atmosphere (troposphere) shifted to the measured ground temperature.

export const G = 9.80665;
export const R_AIR = 287.053;
export const GAMMA = 1.4;
const LAPSE = 0.0065; // K/m

export interface Air {
  density: number; // kg/m³
  pressure: number; // Pa
  temperature: number; // K
  soundSpeed: number; // m/s
  kinematicViscosity: number; // m²/s
}

export function groundPressure(altitude: number): number {
  return 101325 * Math.pow(1 - 2.25577e-5 * altitude, 5.25588);
}

/** Air properties at `height` metres above a site at `siteAltitude` with ground temperature `groundC`. */
export function air(height: number, siteAltitude: number, groundC: number): Air {
  const t0 = groundC + 273.15;
  const temperature = Math.max(t0 - LAPSE * height, 150);
  const pressure = groundPressure(siteAltitude) * Math.pow(temperature / t0, G / (R_AIR * LAPSE));
  const density = pressure / (R_AIR * temperature);
  // Sutherland's law for dynamic viscosity
  const mu = 1.458e-6 * Math.pow(temperature, 1.5) / (temperature + 110.4);
  return {
    density,
    pressure,
    temperature,
    soundSpeed: Math.sqrt(GAMMA * R_AIR * temperature),
    kinematicViscosity: mu / density,
  };
}
