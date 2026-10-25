// ISO 286 limits and fits for sizes up to 500 mm: standard tolerance grades IT1–IT16, fundamental deviations for the
// common shaft letters (d e f g h js k m n p r s) and the matching hole letters, with the hole deviations derived by
// ISO 286-1's rules (including the Δ correction). Plus the change of a fit with temperature for dissimilar materials.
// Deviations in micrometres; sizes in millimetres. Check critical values against the standard itself.

/** Main size steps, "over a up to and including b". */
const MAIN = [0, 3, 6, 10, 18, 30, 50, 80, 120, 180, 250, 315, 400, 500];
/** Intermediate steps used by r and s (and other letters from p onwards). */
const FINE = [0, 3, 6, 10, 18, 30, 50, 65, 80, 100, 120, 140, 160, 180, 200, 225, 250, 280, 315, 355, 400, 450, 500];

const IT: Record<number, number[]> = {
  1: [0.8, 1, 1, 1.2, 1.5, 1.5, 2, 2.5, 3.5, 4.5, 6, 7, 8],
  2: [1.2, 1.5, 1.5, 2, 2.5, 2.5, 3, 4, 5, 7, 8, 9, 10],
  3: [2, 2.5, 2.5, 3, 4, 4, 5, 6, 8, 10, 12, 13, 15],
  4: [3, 4, 4, 5, 6, 7, 8, 10, 12, 14, 16, 18, 20],
  5: [4, 5, 6, 8, 9, 11, 13, 15, 18, 20, 23, 25, 27],
  6: [6, 8, 9, 11, 13, 16, 19, 22, 25, 29, 32, 36, 40],
  7: [10, 12, 15, 18, 21, 25, 30, 35, 40, 46, 52, 57, 63],
  8: [14, 18, 22, 27, 33, 39, 46, 54, 63, 72, 81, 89, 97],
  9: [25, 30, 36, 43, 52, 62, 74, 87, 100, 115, 130, 140, 155],
  10: [40, 48, 58, 70, 84, 100, 120, 140, 160, 185, 210, 230, 250],
  11: [60, 75, 90, 110, 130, 160, 190, 220, 250, 290, 320, 360, 400],
};
// grades 12–16 are ten times grades 7–11
for (let g = 12; g <= 16; g++) IT[g] = IT[g - 5].map((v) => v * 10);

// Shaft fundamental deviations, µm: upper deviation es for d–h, lower deviation ei for k–s.
const ES_SHAFT: Record<string, number[]> = {
  d: [-20, -30, -40, -50, -65, -80, -100, -120, -145, -170, -190, -210, -230],
  e: [-14, -20, -25, -32, -40, -50, -60, -72, -85, -100, -110, -125, -135],
  f: [-6, -10, -13, -16, -20, -25, -30, -36, -43, -50, -56, -62, -68],
  g: [-2, -4, -5, -6, -7, -9, -10, -12, -14, -15, -17, -18, -20],
  h: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
};
const EI_SHAFT: Record<string, number[]> = {
  k: [0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 5], // for grades IT4–IT7; zero otherwise
  m: [2, 4, 6, 7, 8, 9, 11, 13, 15, 17, 20, 21, 23],
  n: [4, 8, 10, 12, 15, 17, 20, 23, 27, 31, 34, 37, 40],
  p: [6, 12, 15, 18, 22, 26, 32, 37, 43, 50, 56, 62, 68],
};
const EI_FINE: Record<string, number[]> = {
  r: [10, 15, 19, 23, 28, 34, 41, 43, 51, 54, 63, 65, 68, 77, 80, 84, 94, 98, 108, 114, 126, 132],
  s: [14, 19, 23, 28, 35, 43, 53, 59, 71, 79, 92, 100, 108, 122, 130, 140, 158, 170, 190, 208, 232, 252],
};

export const SHAFT_LETTERS = ['d', 'e', 'f', 'g', 'h', 'js', 'k', 'm', 'n', 'p', 'r', 's'] as const;
export const HOLE_LETTERS = ['D', 'E', 'F', 'G', 'H', 'JS', 'K', 'M', 'N', 'P', 'R', 'S'] as const;
export const GRADES = [4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const step = (steps: number[], d: number) => {
  if (!(d > 0 && d <= 500)) throw new RangeError('ISO 286 tables here cover 0–500 mm');
  let i = 0;
  while (d > steps[i + 1]) i++;
  return i;
};

/** Standard tolerance ITn, µm. */
export const itValue = (d: number, grade: number) => {
  if (!IT[grade]) throw new RangeError(`IT${grade} not tabulated`);
  return IT[grade][step(MAIN, d)];
};

/** The half-width of a js or JS zone: IT/2, with odd values in IT7–IT11 rounded down to even (ISO 286-1). */
const jsHalf = (t: number, grade: number) => (grade >= 7 && grade <= 11 && t % 2 === 1 ? (t - 1) / 2 : t / 2);

/** Shaft limits, µm from nominal: upper es and lower ei. */
export function shaftDeviations(d: number, letter: string, grade: number) {
  const t = itValue(d, grade), i = step(MAIN, d);
  if (letter === 'js') { const h = jsHalf(t, grade); return { es: h, ei: -h }; }
  if (ES_SHAFT[letter]) { const es = ES_SHAFT[letter][i]; return { es, ei: es - t }; }
  let ei: number;
  if (letter === 'k') ei = grade >= 4 && grade <= 7 ? EI_SHAFT.k[i] : 0;
  else if (EI_SHAFT[letter]) ei = EI_SHAFT[letter][i];
  else if (EI_FINE[letter]) ei = EI_FINE[letter][step(FINE, d)];
  else throw new RangeError(`shaft letter ${letter} not tabulated`);
  return { es: ei + t, ei };
}

/** Hole limits, µm from nominal: upper ES and lower EI, by the ISO 286-1 rules from the shaft deviations. */
export function holeDeviations(d: number, letter: string, grade: number) {
  const t = itValue(d, grade), lower = letter.toLowerCase();
  if (letter === 'JS') { const h = jsHalf(t, grade); return { ES: h, EI: -h }; }
  if (ES_SHAFT[lower]) { const EI = 0 - ES_SHAFT[lower][step(MAIN, d)] || 0; return { ES: EI + t, EI }; } // || 0 avoids −0 for H
  // K to S: ES = −ei of the shaft letter, plus Δ = ITn − IT(n−1) for the finer grades
  const delta = d <= 3 || grade < 2 ? 0 : t - itValue(d, grade - 1);
  let ES: number;
  if (letter === 'K') ES = grade <= 8 ? -(EI_SHAFT.k[step(MAIN, d)]) + delta : 0;
  else if (letter === 'M') ES = -EI_SHAFT.m[step(MAIN, d)] + (grade <= 8 ? delta : 0);
  else if (letter === 'N') ES = grade <= 8 ? -EI_SHAFT.n[step(MAIN, d)] + delta : 0;
  else if (letter === 'P') ES = -EI_SHAFT.p[step(MAIN, d)] + (grade <= 7 ? delta : 0);
  else if (letter === 'R' || letter === 'S') ES = -EI_FINE[lower][step(FINE, d)] + (grade <= 7 ? delta : 0);
  else throw new RangeError(`hole letter ${letter} not tabulated`);
  return { ES, EI: ES - t };
}

/**
 * A fit: hole and shaft limits in mm and the clearance range in mm (negative is interference). Its type is clearance
 * if the smallest clearance is positive, interference if the largest is negative, otherwise transition.
 */
export function isoFit(d: number, hole: string, holeGrade: number, shaft: string, shaftGrade: number) {
  const H = holeDeviations(d, hole, holeGrade), S = shaftDeviations(d, shaft, shaftGrade);
  const cMax = (H.ES - S.ei) / 1000, cMin = (H.EI - S.es) / 1000;
  return {
    hole: { min: d + H.EI / 1000, max: d + H.ES / 1000, ES: H.ES, EI: H.EI },
    shaft: { min: d + S.ei / 1000, max: d + S.es / 1000, es: S.es, ei: S.ei },
    cMin, cMax,
    kind: cMin >= 0 ? 'clearance' : cMax <= 0 ? 'interference' : 'transition',
  };
}

/** Change in diametral clearance at temperature T for a shaft and hole of different expansion, assembled at 20 °C. */
export const clearanceShift = (d: number, alphaShaft: number, alphaHole: number, T: number) => -d * (alphaShaft - alphaHole) * (T - 20);
