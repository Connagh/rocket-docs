// The GD&T characteristic symbols as SVG strokes in a 20 × 20 box, drawn rather than typed because several of the
// Unicode symbols are missing from common fonts. Each glyph is a stroked path and optionally a filled one (arrowheads).

export interface Glyph { d: string; fill?: string }

const arrow = (x: number, y: number) => `M${x},${y} l-5.2,1.2 l1.2,-5.2 z`; // a head pointing up and to the right

export const GLYPHS: Record<string, Glyph> = {
  straightness: { d: 'M3,10 L17,10' },
  flatness: { d: 'M3,14 L7.5,6 L17,6 L12.5,14 Z' },
  circularity: { d: 'M16,10 A6,6 0 1 1 4,10 A6,6 0 1 1 16,10 Z' },
  cylindricity: { d: 'M15,10 A5,5 0 1 1 5,10 A5,5 0 1 1 15,10 Z M2.5,16 L8.8,3.6 M11.2,16.4 L17.5,4' },
  profileLine: { d: 'M3,14 A7,7 0 0 1 17,14' },
  profileSurface: { d: 'M3,14 A7,7 0 0 1 17,14 Z' },
  perpendicularity: { d: 'M3,16 L17,16 M10,16 L10,4' },
  angularity: { d: 'M3,16 L17,16 M3,16 L15,6' },
  parallelism: { d: 'M4,16 L10.5,4 M9.5,16 L16,4' },
  position: { d: 'M15,10 A5,5 0 1 1 5,10 A5,5 0 1 1 15,10 Z M10,2 L10,18 M2,10 L18,10' },
  concentricity: { d: 'M16,10 A6,6 0 1 1 4,10 A6,6 0 1 1 16,10 Z M13,10 A3,3 0 1 1 7,10 A3,3 0 1 1 13,10 Z' },
  symmetry: { d: 'M5,6 L15,6 M2,10 L18,10 M5,14 L15,14' },
  runout: { d: 'M5,15 L14,6', fill: arrow(16, 4) },
  totalRunout: { d: 'M3,16 L9.5,16 M3,16 L10,9 M9.5,16 L16.5,9', fill: `${arrow(12, 7)} ${arrow(18.5, 7)}` },
};
