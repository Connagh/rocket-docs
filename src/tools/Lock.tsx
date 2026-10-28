// Locking check: will the joint slip (and so self-loosen), what preload the torque really gives with a prevailing-
// torque feature, how the self-loosening moment compares with the feature, and whether the feature meets the
// NASA-STD-5020B rules. Maths in src/lib/locking.ts and src/lib/bolts.ts (unit-tested).
import React from 'react';
import { THREADS, torquePreload } from '../lib/bolts';
import { holdingTorque, rampTorque, standardLooseningEstimate, slipCapacity, slipMargin, effectiveTorque, FEATURES, type FeatureKey } from '../lib/locking';
import { readFactor, awaitingMessage } from '../lib/factors';
import { Calc, Inputs, Outputs, Group, FieldRow, Num, Choice, Check, Readouts, Readout, Notes, BarGroups, A, useForm, num, fmt, type Tone } from './kit';

const sgn = (v: number) => `${v >= 0 ? '+' : ''}${fmt(v, 2)}`;

function Results() {
  const { v } = useForm();
  const notes: { tone: Tone; text: React.ReactNode }[] = [];
  const t = THREADS.find((x) => x.name === v.th) ?? THREADS[0];
  const dw = num(v.dw), dh = num(v.dh), mut = num(v.mut), muh = num(v.muh);
  if (![dw, dh, mut, muh, num(v.tmin), num(v.tmax)].every((x) => x > 0) || dw <= t.d || num(v.tmax) < num(v.tmin)) {
    return <Notes items={[{ tone: 'bad', text: 'Fill in the torque range, friction and bearing face (larger than the thread).' }]} />;
  }
  const above = v.above === 'true', run = Math.max(0, num(v.run) || 0), brk = Math.max(0, num(v.brk) || 0);
  const eff = effectiveTorque(num(v.tmin) * 1000, num(v.tmax) * 1000, above, run * 1000, brk * 1000);
  const effRo = <Readout label="Effective torque" value={`${fmt(eff.min / 1000, 1)}–${fmt(eff.max / 1000, 1)}`} unit="N·m"
    sub={above ? 'specified above running torque' : `running torque ${fmt(run, 1)} N·m comes off the minimum`} />;
  if (eff.min <= 0) {
    return (
      <>
        <Readouts>{effRo}</Readouts>
        <Notes items={[{ tone: 'bad', text: 'The running torque uses up all of the minimum torque: no preload is guaranteed.' }]} />
      </>
    );
  }
  const P = (T: number) => torquePreload(T, t, mut, muh, dw, dh).F;
  const gam = v.gam.trim() === '' ? null : Math.min(0.8, Math.max(0, num(v.gam) / 100));
  const Fnom = P((eff.min + eff.max) / 2), Fmin = P(eff.min) * (1 - (gam ?? 0)), Fmax = P(eff.max) * (1 + (gam ?? 0));

  // slip
  const phi = Math.min(1, Math.max(0, num(v.phi) || 0)), clamp = Fmin - (1 - phi) * Math.max(0, num(v.pa) || 0);
  const mui = num(v.mui), q = Math.max(1, Math.round(num(v.q) || 1)), FQ = Math.max(0, num(v.fq) || 0);
  const cap = slipCapacity(Math.max(0, clamp), mui, q);
  const fs = readFactor(v.fs);
  const ms = gam === null ? null : slipMargin(Math.max(0, clamp), mui, q, FQ, fs);
  const missing = [gam === null && 'preload scatter', FQ > 0 && fs === null && 'slip factor'].filter(Boolean) as string[];
  if (missing.length) notes.push({ tone: 'warn', text: awaitingMessage(missing, 'the slip margin') });
  if (ms !== null && ms < 0) notes.push({ tone: 'bad', text: `The joint slips under the sideways load (MS ${sgn(ms)}), so it will self-loosen however it is locked. Raise the clamp force (torque, bolt size or number), add slip planes or friction, or take the shear on a dowel or shoulder.` });
  if (clamp <= 0) notes.push({ tone: 'bad', text: 'The axial load takes away all of the minimum clamp force: the joint opens and any sideways load slides it.' });

  // static hold and the self-loosening moment
  const hold = holdingTorque(Fnom, t, mut, muh, dw, dh), ramp = rampTorque(Fnom, t), est = standardLooseningEstimate(Fnom, t);

  // the locking feature
  const key = v.ft as FeatureKey, F = FEATURES[key] ?? FEATURES.prevailing, rot = v.rot === 'true';
  const okIndep = F.independent, okRot = !rot || F.mechanical;
  notes.push({ tone: 'info', text: `${F.name}: ${F.does}` });
  if (!okIndep) notes.push({ tone: 'bad', text: 'NASA-STD-5020B §4.6.1: every threaded fastening system in spaceflight hardware needs at least one locking feature that does not depend on preload.' });
  if (!okRot) notes.push({ tone: 'bad', text: '§4.6.2: a bolt subject to rotation in operation needs a mechanical locking feature such as safety wire or a cotter pin; wire the nut and bolt to each other only.' });
  if (key === 'prevailing') {
    notes.push({ tone: 'info', text: `The feature's running torque, ${fmt(run, 1)} N·m, is far below the self-loosening moment once the joint slips (${fmt(ramp / 1000, 1)} N·m from the ramp, ${fmt(est / 1000, 1)} N·m by the standard's estimate): it keeps the fastener captive, while the preload depends on the joint never slipping. Fully formed threads must engage the feature (§4.7.4).` });
    if (!above && run === 0) notes.push({ tone: 'warn', text: 'A prevailing-torque feature with no running torque entered: measure it at installation, and either specify torque above running torque or subtract it (§4.6.4, Table 4).' });
  }
  if (key === 'adhesive') notes.push({ tone: 'info', text: '§4.6.3: develop and validate the installation process (cleaning, primer, cure) before use, and verify by torque tests on witness samples made alongside the hardware.' });
  if (key === 'wire') notes.push({ tone: 'info', text: 'Wire so that tension in the wire pulls the fastener in the tightening direction (NASM 33540, SAE AS567); check by inspection after installation.' });

  return (
    <>
      <Readouts>
        <Readout label="Preload" value={fmt(Fnom / 1000, 2)} unit="kN" primary
          sub={gam === null ? 'nominal: enter the scatter for the range' : `${fmt(Fmin / 1000, 2)}–${fmt(Fmax / 1000, 2)} kN with scatter`} />
        {effRo}
        <Readout label="Slip capacity" value={fmt(cap, 0)} unit="N"
          sub={`μ ${fmt(mui, 2)} × ${fmt(Math.max(0, clamp), 0)} N${q > 1 ? ` × ${q}` : ''}${gam === null ? ', nominal' : ', minimum clamp'}`} />
        <Readout label="Slip margin" value={ms === null ? (FQ > 0 ? 'needs your factor and scatter' : 'no sideways load') : sgn(ms)}
          tone={ms === null ? undefined : ms < 0 ? 'bad' : 'ok'} sub={ms === null ? undefined : `against ${fmt((fs ?? 1) * FQ, 0)} N factored`} />
        <Readout label="Static hold" value={`${fmt(hold / ramp, 1)}×`}
          sub={`friction ${fmt(hold / 1000, 1)} N·m holds against a ramp of ${fmt(ramp / 1000, 1)} N·m, while nothing slips`} />
        <Readout label="Locking feature" value={okIndep && okRot ? 'meets' : 'does not meet'} tone={okIndep && okRot ? 'ok' : 'bad'}
          sub={`${okIndep ? 'preload-independent' : 'depends on preload'} · verify: ${F.verify}`} />
      </Readouts>
      <BarGroups
        label="Bars comparing the sideways load with the slip capacity, and the self-loosening moment with the locking feature's running torque"
        groups={[
          { title: 'Sideways: load against grip', unit: 'N', digits: 0, bars: [['load, factored', FQ * (fs ?? 1), 'var(--rd-accent)'], ['slip capacity', cap, 'var(--rd-ok)']] },
          { title: 'Unscrewing once it slips', unit: 'N·m', digits: 1, div: 1000, bars: [['ramp F·P/2π', ramp, 'var(--rd-warn)'], ['standard estimate F·P/2', est, 'var(--rd-warn)'], ['feature running torque', key === 'prevailing' ? run * 1000 : NaN, 'var(--rd-insul)']] },
        ]}
      />
      <Notes items={notes} />
    </>
  );
}

export default function Lock() {
  const base = { th: 'M6', dw: '10', tmin: '9.5', tmax: '10.5', run: '0.4', brk: '0', above: 'false', mut: '0.12', muh: '0.12', dh: '6.6', gam: '', fq: '284', pa: '0', mui: '0.15', q: '1', phi: '0.15', fs: '', ft: 'prevailing', rot: 'false' };
  return (
    <Calc
      id="locking"
      title="Locking and slip: one bolt"
      defaults={base}
      example={{ values: { gam: '25', fs: '1.25' }, note: 'Worked-example values loaded: preload scatter ±25%, slip factor 1.25', factorFields: ['gam', 'fs'] }}
      foot="Slip capacity = interface friction × minimum clamp force × slip planes, with the clamp reduced by (1 − Φ) of the axial load. Self-loosening moment once slipping: F·P/2π from the thread ramp; NASA-STD-5020B §4.6.1 gives the larger estimate F·P/2."
    >
      <Inputs>
        <Group
          legend="Fastener and torque"
          hint="Running torque and breakaway come from the locking feature's part standard, measured at installation. Preload scatter for your tightening method comes from your programme's standard."
        >
          <FieldRow>
            <Choice
              name="th"
              label="Thread"
              options={THREADS.map((t) => ({ value: t.name, label: `${t.name} × ${t.P}` }))}
              then={(name) => {
                const t = THREADS.find((x) => x.name === name);
                return t ? { dw: String(Math.round(1.6 * t.d)), dh: String(+(t.d * 1.1).toFixed(1)) } : undefined;
              }}
            />
            <Num name="dw" label="Bearing face ⌀" unit="mm" />
          </FieldRow>
          <FieldRow>
            <Num name="tmin" label="Torque, min" unit="N·m" />
            <Num name="tmax" label="Torque, max" unit="N·m" />
          </FieldRow>
          <FieldRow>
            <Num name="run" label="Running torque, max" unit="N·m" />
            <Num name="brk" label="Breakaway, min" unit="N·m" />
          </FieldRow>
          <Check name="above" label="Torque is specified “above running torque”" />
          <FieldRow>
            <Num name="mut" label="Thread friction μt" />
            <Num name="muh" label="Head friction μb" />
          </FieldRow>
          <FieldRow>
            <Num name="dh" label="Hole ⌀" unit="mm" />
            <Num name="gam" label="Preload scatter ±" unit="%" placeholder="your value" />
          </FieldRow>
        </Group>
        <Group
          legend="Loads per bolt"
          hint={<>Φ from the <A href="../bolted-joints/">Bolted joints</A> calculator. Interface friction depends strongly on the surfaces and any coating: use a measured or specified value.</>}
        >
          <FieldRow>
            <Num name="fq" label="Sideways (transverse) load" unit="N" />
            <Num name="pa" label="Axial load" unit="N" />
          </FieldRow>
          <FieldRow>
            <Num name="mui" label="Interface friction μ" />
            <Num name="q" label="Slip planes" />
          </FieldRow>
          <FieldRow>
            <Num name="phi" label="Load factor Φ" />
            <Num name="fs" label="Slip factor" placeholder="your value" />
          </FieldRow>
        </Group>
        <Group legend="Locking feature">
          <Choice name="ft" label="Feature" options={(Object.keys(FEATURES) as FeatureKey[]).map((k) => ({ value: k, label: FEATURES[k].name }))} />
          <Check name="rot" label="The bolt is an axis of rotation in operation" />
        </Group>
      </Inputs>
      <Outputs>
        <Results />
      </Outputs>
    </Calc>
  );
}
