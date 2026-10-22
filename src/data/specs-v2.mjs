// Specification sheets added in v2 — the classic solid-motor case steels, which v1's
// spec builder did not cover. Same shape as the entries extracted into specs.json.
// Standards are cited for orientation; always work to the current issue your programme invokes.

export const SPECS_V2 = [
  {
    name: 'D6AC',
    designation: 'D6AC STEEL (UNS K24728)',
    family: 'steel',
    base: '≈0.45C–1Cr–0.55Ni–1Mo–0.1V low-alloy ultra-high-strength steel, vacuum-arc remelted (VAR) · UNS K24728',
    composition: 'AMS 6431 (bar, forgings, tubing) · AMS 6439 (sheet, strip, plate)',
    forms: [
      { form: 'Bar', standard: 'AMS 6431', note: 'VAR melted. The machining stock for small fittings.' },
      { form: 'Forgings', standard: 'AMS 6431', note: 'Order with grain flow following the part — closures, bosses, Y-rings.' },
      { form: 'Mechanical tubing', standard: 'AMS 6431', note: '' },
      { form: 'Sheet, strip and plate', standard: 'AMS 6439', note: 'Rolled and welded cylinders for case bodies.' },
    ],
    tempers: [
      { code: 'HARDENED AND DOUBLE TEMPERED, 1520 MPa MIN UTS', note: 'Austenitise, quench, then temper twice to the drawing strength — around 1520 MPa minimum UTS is typical for cases. Heat treat per AMS 2759/2 with pyrometry to AMS 2750.' },
      { code: 'ANNEALED', note: 'As supplied, for machining and forming.' },
      { code: 'NORMALISED AND TEMPERED', note: 'Intermediate condition before welding or final heat treatment.' },
    ],
    finishes: [
      { name: 'Primer and paint', spec: 'Company paint specification', note: 'The usual protection for ultra-high-strength steel cases.' },
      { name: 'Phosphate (paint base)', spec: 'AMS 2480', note: 'Paint key and temporary protection.' },
      { name: 'Shot peen', spec: 'AMS 2430 / AMS 2432', note: 'Fatigue and stress-corrosion resistance at fillets and weld toes. Specify intensity and coverage.' },
      { name: 'Zinc-nickel electroplate', spec: 'AMS 2417 + embrittlement-relief bake to AMS 2759/9', note: 'Only where justified: electroplating ultra-high-strength steel risks hydrogen embrittlement. Bake promptly and test.' },
    ],
    callout: `MATERIAL: D6AC STEEL (UNS K24728) BAR TO AMS 6431, VAR
HEAT TREAT: HARDEN AND DOUBLE TEMPER TO 1520 MPa MIN UTS
          PER AMS 2759/2, PYROMETRY TO AMS 2750
NDT:      MAGNETIC PARTICLE TO ASTM E1444 AFTER HEAT TREATMENT
FINISH:   PRIMER AND PAINT TO <COMPANY SPEC>. NO ELECTROPLATING`,
    tips: [
      'Weld in the annealed or normalised condition, then heat treat the whole case. D6AC loses strength in the heat-affected zone, which is why 15CDV6 and maraging steels exist.',
      'At this strength, plain water can drive stress-corrosion cracking: inhibited water for hydroproof, short holds, dry promptly (see Proof testing).',
      'State the allowable decarburisation, or machine the surface after heat treatment — a decarburised skin is a soft, low-fatigue layer.',
      'Check that the material specification already invokes the cleanliness class you need (magnetic-particle cleanliness to AMS 2300 is typical for VAR steels).',
    ],
  },
  {
    name: 'Maraging 18Ni-250',
    designation: 'MARAGING STEEL 18Ni-250 (UNS K92890)',
    family: 'steel',
    base: '18Ni–8Co–5Mo–0.4Ti, vacuum-induction + vacuum-arc remelted (VIM/VAR) · UNS K92890 · W.Nr 1.6359',
    composition: 'AMS 6512 (bar, forgings, tubing, rings) · AMS 6520 (sheet, strip, plate)',
    forms: [
      { form: 'Bar', standard: 'AMS 6512', note: '' },
      { form: 'Forgings and rings', standard: 'AMS 6512', note: 'Closures and joint hardware.' },
      { form: 'Sheet, strip and plate', standard: 'AMS 6520', note: 'Rolled and welded case bodies.' },
    ],
    tempers: [
      { code: 'AGED 480 °C (900 °F)', note: 'About 480 °C (900 °F) for 3–6 h, to roughly 1700 MPa UTS. Shrinkage on ageing is small and predictable (typically under 0.1%). Heat treat per AMS 2759/3.' },
      { code: 'SOLUTION ANNEALED', note: 'Condition A: martensitic but soft. Machine, form and weld in this condition.' },
    ],
    finishes: [
      { name: 'Primer and paint', spec: 'Company paint specification', note: 'Maraging steel is not stainless — protect it.' },
      { name: 'Shot peen', spec: 'AMS 2430 / AMS 2432', note: 'After ageing, for fatigue and stress-corrosion resistance.' },
    ],
    callout: `MATERIAL: MARAGING STEEL 18Ni-250 (UNS K92890)
          BAR TO AMS 6512, VIM + VAR
HEAT TREAT: AGE 480 °C (900 °F) PER AMS 2759/3 AFTER WELDING
          AND MACHINING; PYROMETRY TO AMS 2750
NDT:      MAGNETIC PARTICLE TO ASTM E1444 AFTER AGEING
FINISH:   PRIMER AND PAINT TO <COMPANY SPEC>`,
    tips: [
      'Weld in the annealed condition and age the whole part afterwards — weld strength then approaches the parent, which is maraging steel’s big advantage over D6AC.',
      'Cobalt makes it expensive and exposes it to supply risk; check availability in the sections you need early.',
      'High strength means modest toughness and stress-corrosion sensitivity in water; the same proof-test precautions as D6AC apply.',
    ],
  },
];
