// Ageing of hardware in storage: Arrhenius acceleration, mean kinetic temperature of a storage record, and
// service-life prediction from accelerated tests at several temperatures (single-mechanism Arrhenius model).
// Temperatures in °C at the interface, kelvin inside; times in any consistent unit.

export const R = 8.314462618; // J/(mol·K)
export const kelvin = (c: number) => c + 273.15;

/** How many times faster ageing runs at tTest than at tService: exp[(Ea/R)(1/Ts − 1/Tt)]. Ea in kJ/mol. */
export const accelerationFactor = (eaKJ: number, tService: number, tTest: number) =>
  Math.exp(((eaKJ * 1000) / R) * (1 / kelvin(tService) - 1 / kelvin(tTest)));

/** Temperature rise (K) that doubles the ageing rate at temperature t, for activation energy Ea. */
export function doublingInterval(eaKJ: number, t: number) {
  const T = kelvin(t), b = (eaKJ * 1000) / R;
  // solve b (1/T − 1/(T + d)) = ln 2  →  d = T² ln2 / (b − T ln2)
  return (T * T * Math.LN2) / (b - T * Math.LN2);
}

/**
 * Mean kinetic temperature of equally spaced readings: the constant temperature that ages as much as the record.
 * T_MKT = (Ea/R) / −ln[(1/n) Σ exp(−Ea/(R T_i))]. Returns °C.
 */
export function meanKineticTemperature(eaKJ: number, readings: number[]) {
  const b = (eaKJ * 1000) / R;
  // factor out the hottest reading to keep the exponentials in range
  const tMax = Math.max(...readings.map(kelvin));
  const s = readings.reduce((acc, c) => acc + Math.exp(-b / kelvin(c) + b / tMax), 0) / readings.length;
  return b / (b / tMax - Math.log(s)) - 273.15;
}

/**
 * Least-squares fit of ln(time) = A + B/T to accelerated test results (time to reach the end-of-life criterion).
 * Ea = B·R. Returns the fit, its r², and a function for the life at any temperature.
 */
export function arrheniusFit(points: { t: number; life: number }[]) {
  const xs = points.map((p) => 1 / kelvin(p.t)), ys = points.map((p) => Math.log(p.life));
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let k = 0; k < n; k++) { sxy += (xs[k] - mx) * (ys[k] - my); sxx += (xs[k] - mx) ** 2; syy += (ys[k] - my) ** 2; }
  const B = sxy / sxx, A = my - B * mx;
  return {
    A, B,
    eaKJ: (B * R) / 1000,
    r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 1,
    lifeAt: (t: number) => Math.exp(A + B / kelvin(t)),
  };
}
