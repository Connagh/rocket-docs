// Motor-level mass budget: propellant mass fraction and what each inert kilogram costs.
// Ideal rocket equation only — no gravity or drag losses, single stage.

export const G0 = 9.80665; // m/s², standard gravity (defines specific impulse in seconds)

export interface MassBudget {
  propellant: number; // kg
  inert: number; // kg — case, insulation, nozzle and all other motor hardware
  payload: number; // kg — everything the motor pushes that is not the motor
  isp: number; // s, delivered specific impulse
}

export function motorPerformance(b: MassBudget) {
  const m0 = b.propellant + b.inert + b.payload; // at ignition
  const mf = b.inert + b.payload; // at burnout
  const c = b.isp * G0; // effective exhaust velocity, m/s
  return {
    m0, mf, c,
    fraction: b.propellant / (b.propellant + b.inert), // motor propellant mass fraction ζ
    massRatio: m0 / mf,
    dv: c * Math.log(m0 / mf), // Tsiolkovsky
    // d(Δv)/d(m_inert) = c (1/m0 − 1/mf) = −c·mp / (m0·mf); reported as a positive cost
    dvPerKgInert: (c * b.propellant) / (m0 * mf),
    // Extra propellant needed per extra inert kg to hold Δv: keeping m0/mf fixed gives R − 1.
    exchange: b.propellant / mf,
  };
}

/** Inert mass that gives motor mass fraction ζ for a given propellant mass. */
export const inertForFraction = (propellant: number, zeta: number) => (propellant * (1 - zeta)) / zeta;
