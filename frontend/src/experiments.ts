import type { A2LDataset, CharacteristicRow, Experiment, MeasurementRow } from './types';

const MAX_EXP = 3000;

function difficulty(n: number): string {
  if (n <= 4) return 'Beginner';
  if (n <= 12) return 'Intermediate';
  return 'Advanced';
}

function charMap(chars: CharacteristicRow[]): Record<string, CharacteristicRow> {
  const m: Record<string, CharacteristicRow> = {};
  for (const c of chars) if (c.name) m[c.name] = c;
  return m;
}

function measMap(meas: MeasurementRow[]): Record<string, MeasurementRow> {
  const m: Record<string, MeasurementRow> = {};
  for (const x of meas) if (x.name) m[x.name] = x;
  return m;
}

function sigDetail(mm: Record<string, MeasurementRow>, name: string) {
  const m = mm[name] || ({} as MeasurementRow);
  return {
    name,
    description: m.description || '',
    unit: m.datatype || '',
    range: `${m.lowerLimit ?? ''} … ${m.upperLimit ?? ''}`,
    address: m.ecuAddress || '',
    engineeringExplanation: 'Live ECU signal acquired via the measurement definition.',
  };
}

function calDetail(cm: Record<string, CharacteristicRow>, name: string) {
  const c = cm[name] || ({} as CharacteristicRow);
  return {
    name,
    description: c.description || '',
    unit: c.type || '',
    range: `${c.lowerLimit ?? ''} … ${c.upperLimit ?? ''}`,
    address: c.address || '',
    engineeringExplanation: 'Tunable calibration parameter stored in ECU memory.',
  };
}

function incaProcedure(ecu: string, focus: string, measurements: string[], characteristics: string[]) {
  const steps: string[] = [
    'Open the calibration toolchain workspace tied to this vehicle project.',
    'Import the ASAP2 / A2L dataset so label metadata matches the ECU software version.',
    `Select ECU / variant context: ${ecu}.`,
    'Establish the XCP (or configured transport) link and verify any security or seed/key steps if applicable.',
    'Confirm protocol settings (transport, timing, byte order) against IF_DATA guidance in the A2L.',
  ];
  if (measurements.length) {
    const head = measurements.slice(0, 40).join(', ');
    steps.push(`Add measurements to a DAQ group with an appropriate raster: ${head}${measurements.length > 40 ? ' …' : ''}`);
  }
  if (characteristics.length) {
    const head = characteristics.slice(0, 40).join(', ');
    steps.push(`Add characteristics for short-stroke tuning with workspace backup: ${head}${characteristics.length > 40 ? ' …' : ''}`);
  }
  steps.push(
    `Name the experiment session: ${focus} — baseline log.`,
    'Run a repeatable operating point; capture MDF / log with timestamped notes.',
    'Apply a single, reversible change where appropriate; hold other variables steady.',
    'Compare overlays before/after for causal reasoning.',
    'Restore baseline parameters prior to shutdown if changes were exploratory.',
  );
  return steps;
}

function theorySections(fnName: string, desc: string) {
  return [
    {
      title: 'Control intent',
      body: desc || `The ${fnName} function encapsulates ECU software logic for a cohesive control task.`,
    },
    {
      title: 'Signal flow',
      body: 'Inputs represent sensed or modeled state; outputs drive actuators or setpoints; local measurements capture internal controller state.',
    },
    {
      title: 'Calibration coupling',
      body: 'DEF_CHARACTERISTIC and REF_CHARACTERISTIC entries expose tunable degrees of freedom.',
    },
  ];
}

function observationTables(mm: Record<string, MeasurementRow>, inputs: string[], outputs: string[]) {
  const rows: { title: string; rows: Record<string, string>[] }[] = [];
  for (const [lab, names] of [
    ['Inputs', inputs],
    ['Outputs', outputs],
  ] as const) {
    const tbl: Record<string, string>[] = [];
    for (const nm of names.slice(0, 60)) {
      const m = mm[nm] || ({} as MeasurementRow);
      tbl.push({
        signal: nm,
        unit: m.datatype || '',
        range: `${m.lowerLimit ?? ''} … ${m.upperLimit ?? ''}`,
        notes: m.description || '',
      });
    }
    if (tbl.length) rows.push({ title: `Observation matrix — ${lab}`, rows: tbl });
  }
  return rows;
}

function analysisQuestions(fn: string, cals: string[], inputs: string[], outputs: string[]) {
  const qs = [
    `What physical failure modes would first appear as anomalies in ${fn}?`,
    'Which signals are necessary vs sufficient to prove correct function behavior?',
  ];
  if (cals.length) qs.push(`How do calibrations ${cals.slice(0, 8).join(', ')} trade off performance and robustness?`);
  if (inputs.length && outputs.length) {
    qs.push(`Is the static gain from ${inputs[0]} to ${outputs[0]} consistent with subsystem intent?`);
  }
  return qs;
}

function reportOutline(ecu: string, topic: string, project: string) {
  return {
    institution:
      'National Institute of Technology Karnataka, Surathkal — Automotive Electronics Laboratory',
    title: `Technical note — ${topic}`,
    project,
    ecu,
    sections: [
      'Title and authorship',
      'Objectives and safety precautions',
      'Instrumentation and ECU connection summary',
      'Procedure chronology with screenshots / log references',
      'Observations with tabulated signal evidence',
      'Analysis and causal reasoning',
      'Conclusions and recommended follow-up experiments',
    ],
  };
}

export function buildExperiments(data: A2LDataset): Experiment[] {
  const experiments: Experiment[] = [];
  let id = 0;
  const add = (e: Omit<Experiment, 'id'>) => {
    if (experiments.length >= MAX_EXP) return;
    id += 1;
    experiments.push({ ...e, id });
  };

  const chars = data.characteristics || [];
  const meas = data.measurements || [];
  const funcs = data.functions || [];
  const groups = data.groups || [];
  const compu = data.compuMethods || [];
  const axis = data.axisPoints || [];
  const mem = data.memorySegments || [];
  const ifData = data.ifData || [];
  const daq = data.daq || [];
  const meta = data.meta;
  const ecu = meta.ecuName || 'ECU';

  const cmap = charMap(chars);
  const mmap = measMap(meas);

  for (const fn of funcs) {
    const inputs = (fn.inputs || []).filter(Boolean);
    const outputs = (fn.outputs || []).filter(Boolean);
    const locals = (fn.localMeasurements || []).filter(Boolean);
    const cals = (fn.calibrations || []).filter(Boolean);
    const nSig = inputs.length + outputs.length + locals.length + cals.length;
    add({
      title: `Subsystem study: ${fn.name}`,
      subsystem: fn.name,
      difficulty: difficulty(nSig),
      learningObjectives: [
        `Relate function ${fn.name} to listed ECU measurements and calibrations.`,
        'Identify signal flow from inputs to outputs for this subsystem.',
        'Prepare a calibration workspace that traces these labels during a steady test.',
      ],
      beginnerExplanation: `This FUNCTION block groups related ECU logic for “${fn.name}”. Measurements are live values the ECU publishes; characteristics are tunable parameters stored in memory. Observing them together shows how software implements the physical control task.`,
      engineeringPurpose: fn.description || 'Documented ECU subsystem boundary for calibration and validation.',
      whatToObserve: [
        'Correlation between input measurements and output actuation demand.',
        'Response time after calibration changes within this function scope.',
        'Limiting or diagnostic behavior when measurements approach bounds.',
      ],
      expectedEcuBehavior:
        'With consistent operating conditions, outputs should track control objectives defined by internal algorithms and the referenced calibrations.',
      theory: theorySections(fn.name, fn.description),
      signals: {
        inputs: inputs.map((n) => sigDetail(mmap, n)),
        outputs: outputs.map((n) => sigDetail(mmap, n)),
        localMeasurements: locals.map((n) => sigDetail(mmap, n)),
        calibrations: cals.map((n) => calDetail(cmap, n)),
      },
      incaProcedure: incaProcedure(ecu, fn.name, [...inputs, ...outputs, ...locals], cals),
      observations: observationTables(mmap, inputs, outputs),
      analysisQuestions: analysisQuestions(fn.name, cals, inputs, outputs),
      reportOutline: reportOutline(ecu, fn.name, meta.projectName || ''),
    });
  }

  for (const c of chars) {
    if (!c.name) continue;
    const relatedFn = c.relatedFunction || '';
    add({
      title: `Calibration trace: ${c.name}`,
      subsystem: relatedFn || 'Calibration',
      difficulty: difficulty(3),
      learningObjectives: [
        `Interpret ${c.name} scaling and limits using the linked COMPU method.`,
        'Plan a safe single-parameter change with rollback strategy.',
      ],
      beginnerExplanation: `Characteristic “${c.name}” is a stored calibration value. Changing it alters ECU decisions that depend on this parameter. Always log before/after traces.`,
      engineeringPurpose: c.description || 'Parameter identification and authority limits verification.',
      whatToObserve: ['Linked measurements before and after the change.', 'Guardrail activations if limits are approached.'],
      expectedEcuBehavior: 'Controlled shift in dependent outputs when the parameter is active.',
      theory: [{ title: 'Calibration authority', body: 'Characteristics define how control software maps stored intent to runtime behavior.' }],
      signals: {
        inputs: [],
        outputs: [],
        localMeasurements: [],
        calibrations: [calDetail(cmap, c.name)],
      },
      incaProcedure: incaProcedure(ecu, `CAL:${c.name}`, [], [c.name]),
      observations: observationTables(mmap, [], []),
      analysisQuestions: [
        `Which measurements should move first when ${c.name} is perturbed stepwise?`,
        'How does the COMPU method shape perceived engineering units in the trace?',
      ],
      reportOutline: reportOutline(ecu, `Characteristic ${c.name}`, meta.projectName || ''),
    });
  }

  for (const m of meas) {
    if (!m.name) continue;
    const rel = m.relatedFunctions || [];
    const subsystem = rel[0] || 'Measurements';
    add({
      title: `Signal acquisition: ${m.name}`,
      subsystem,
      difficulty: 'Beginner',
      learningObjectives: [
        `Configure DAQ raster suitable for bandwidth of ${m.name}.`,
        'Relate raw datatype and COMPU scaling to physical meaning.',
      ],
      beginnerExplanation: `Measurement “${m.name}” is a live ECU signal. The toolchain displays it after XCP reads the configured address with the correct datatype and scaling.`,
      engineeringPurpose: m.description || 'Signal validation and bandwidth assessment.',
      whatToObserve: ['Noise floor and quantization steps at steady state.', 'Dynamic response during transients relevant to this signal.'],
      expectedEcuBehavior: 'Signal remains within declared limits under nominal operation.',
      theory: [{ title: 'Sampling and aliasing', body: 'Choose raster fast enough for dynamics; align DAQ lists with event timing.' }],
      signals: {
        inputs: [],
        outputs: [sigDetail(mmap, m.name)],
        localMeasurements: [],
        calibrations: [],
      },
      incaProcedure: incaProcedure(ecu, `MEAS:${m.name}`, [m.name], []),
      observations: observationTables(mmap, [m.name], []),
      analysisQuestions: [
        `Which calibrations in related functions could explain drift in ${m.name}?`,
        'What COMPU method converts raw values to engineering units?',
      ],
      reportOutline: reportOutline(ecu, `Measurement ${m.name}`, meta.projectName || ''),
    });
  }

  for (const g of groups) {
    const members = (g.members || []).slice(0, 120);
    if (!members.length) continue;
    add({
      title: `Label group walkthrough: ${g.name}`,
      subsystem: 'Groups',
      difficulty: 'Beginner',
      learningObjectives: [
        'Navigate hierarchical label organization used in calibration datasets.',
        'Cross-link measurements and characteristics used together in validation.',
      ],
      beginnerExplanation: 'Groups bundle labels for repeatable experiment setup.',
      engineeringPurpose: g.description || 'Structured reuse of label sets.',
      whatToObserve: ['Coverage of critical signals for the test scenario.'],
      expectedEcuBehavior: 'No runtime change; organizational clarity for the engineer.',
      theory: [],
      signals: {
        inputs: [],
        outputs: members.filter((x) => mmap[x]).map((x) => sigDetail(mmap, x)),
        localMeasurements: [],
        calibrations: members.filter((x) => cmap[x]).map((x) => calDetail(cmap, x)),
      },
      incaProcedure: incaProcedure(ecu, `GROUP:${g.name}`, members, []),
      observations: [],
      analysisQuestions: ['Are any safety-critical labels missing from this group?'],
      reportOutline: reportOutline(ecu, `Group ${g.name}`, meta.projectName || ''),
    });
  }

  for (const cm of compu.slice(0, 400)) {
    if (!cm.name) continue;
    add({
      title: `Scaling review: ${cm.name}`,
      subsystem: 'COMPU Methods',
      difficulty: 'Intermediate',
      learningObjectives: ['Read COMPU_METHOD structure and relate coefficients to physical units.'],
      beginnerExplanation: 'COMPU methods translate raw memory values to engineering units.',
      engineeringPurpose: 'Verify correct interpretation of acquisition traces.',
      whatToObserve: ['Linearity segments, breakpoints, and saturation handling.'],
      expectedEcuBehavior: 'Consistent unit conversion across related labels.',
      theory: [],
      signals: { inputs: [], outputs: [], localMeasurements: [], calibrations: [] },
      incaProcedure: incaProcedure(ecu, `COMPU:${cm.name}`, [], []),
      observations: [],
      analysisQuestions: ['Which measurements reference this COMPU method in the A2L?'],
      reportOutline: reportOutline(ecu, `COMPU ${cm.name}`, meta.projectName || ''),
    });
  }

  for (const ax of axis.slice(0, 200)) {
    if (!ax.name) continue;
    add({
      title: `Axis / map structure: ${ax.name}`,
      subsystem: 'Axis Points',
      difficulty: 'Intermediate',
      learningObjectives: ['Interpret breakpoints used by calibration maps.'],
      beginnerExplanation: 'Axis definitions set breakpoints for tables and curves.',
      engineeringPurpose: ax.description || 'Interpolation domain verification.',
      whatToObserve: ['Monotonicity and coverage of operating range.'],
      expectedEcuBehavior: 'Interpolation behaves predictably between breakpoints.',
      theory: [],
      signals: { inputs: [], outputs: [], localMeasurements: [], calibrations: [] },
      incaProcedure: incaProcedure(ecu, `AXIS:${ax.name}`, [], []),
      observations: [],
      analysisQuestions: ['Do breakpoints align with physical actuator limits?'],
      reportOutline: reportOutline(ecu, `Axis ${ax.name}`, meta.projectName || ''),
    });
  }

  for (const seg of mem.slice(0, 120)) {
    if (!seg.name) continue;
    add({
      title: `Memory segment audit: ${seg.name}`,
      subsystem: 'Memory',
      difficulty: 'Advanced',
      learningObjectives: ['Relate MEMORY_SEGMENT metadata to calibration flashing strategy.'],
      beginnerExplanation: 'Segments classify address spaces such as flash or RAM pages.',
      engineeringPurpose: seg.description || 'Address space planning.',
      whatToObserve: ['Overlap risk and alignment constraints.'],
      expectedEcuBehavior: 'Stable addressing for all labels mapped into the segment.',
      theory: [],
      signals: { inputs: [], outputs: [], localMeasurements: [], calibrations: [] },
      incaProcedure: incaProcedure(ecu, `MEM:${seg.name}`, [], []),
      observations: [],
      analysisQuestions: ['Which calibrations declare this segment?'],
      reportOutline: reportOutline(ecu, `Memory ${seg.name}`, meta.projectName || ''),
    });
  }

  ifData.slice(0, 40).forEach((row, idx) => {
    const iname = row.name || `IF_DATA_${idx}`;
    add({
      title: `Transport configuration review: ${iname}`,
      subsystem: 'XCP / Protocol',
      difficulty: 'Advanced',
      learningObjectives: ['Extract transport parameters required for a working measurement link.'],
      beginnerExplanation: 'IF_DATA carries tool-specific protocol configuration embedded in the A2L.',
      engineeringPurpose: 'Align INCA / XCP settings with ECU expectations.',
      whatToObserve: ['IDs, byte order, segment references, and DAQ mode hints.'],
      expectedEcuBehavior: 'Successful connect and deterministic DAQ scheduling when matched.',
      theory: [],
      signals: { inputs: [], outputs: [], localMeasurements: [], calibrations: [] },
      incaProcedure: incaProcedure(ecu, `PROTO:${iname}`, [], []),
      observations: [],
      analysisQuestions: ['Does the transport match the bench wiring and gateway setup?'],
      reportOutline: reportOutline(ecu, `Protocol ${iname}`, meta.projectName || ''),
    });
  });

  daq.slice(0, 80).forEach((d) => {
    const dn = d.name || d.keyword || 'DAQ';
    add({
      title: `DAQ configuration study: ${dn}`,
      subsystem: 'DAQ',
      difficulty: 'Intermediate',
      learningObjectives: ['Understand event timing and list construction for high-rate signals.'],
      beginnerExplanation: 'DAQ blocks describe acquisition lists and timing in the ECU.',
      engineeringPurpose: 'Optimize measurement load and avoid bus overload.',
      whatToObserve: ['Raster alignment and event priorities.'],
      expectedEcuBehavior: 'Stable acquisition without dropped counters on critical signals.',
      theory: [],
      signals: { inputs: [], outputs: [], localMeasurements: [], calibrations: [] },
      incaProcedure: incaProcedure(ecu, `DAQ:${dn}`, [], []),
      observations: [],
      analysisQuestions: ['Which signals require fastest sampling in this event?'],
      reportOutline: reportOutline(ecu, `DAQ ${dn}`, meta.projectName || ''),
    });
  });

  return experiments;
}
