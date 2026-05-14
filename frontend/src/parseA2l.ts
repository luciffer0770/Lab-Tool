import type {
  A2LDataset,
  AxisRow,
  CharacteristicRow,
  CompuMethodRow,
  DaqRow,
  ExplorerNode,
  FunctionRow,
  GroupRow,
  IfDataRow,
  MeasurementRow,
  MemorySegmentRow,
} from './types';

type Block = {
  keyword: string;
  name: string;
  body: string;
  children: Block[];
};

type BlockInternal = Block & { _bodyStart: number };

function stripComments(text: string): string {
  let out = '';
  let i = 0;
  const n = text.length;
  while (i < n) {
    if (text.startsWith('/*', i)) {
      const j = text.indexOf('*/', i + 2);
      if (j === -1) break;
      i = j + 2;
      continue;
    }
    if (text.startsWith('//', i)) {
      const j = text.indexOf('\n', i);
      if (j === -1) break;
      i = j;
      continue;
    }
    out += text[i];
    i += 1;
  }
  return out;
}

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t[0] === '"' && t[t.length - 1] === '"') {
    return t.slice(1, -1).replace(/\\"/g, '"');
  }
  return t;
}

function tokenizeLines(body: string): string[][] {
  const lines: string[][] = [];
  for (const raw of body.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const parts: string[] = [];
    let buf = '';
    let inQuote = false;
    let escape = false;
    for (const ch of line) {
      if (escape) {
        buf += ch;
        escape = false;
        continue;
      }
      if (ch === '\\' && inQuote) {
        escape = true;
        buf += ch;
        continue;
      }
      if (ch === '"') {
        inQuote = !inQuote;
        buf += ch;
        continue;
      }
      if (/\s/.test(ch) && !inQuote) {
        if (buf) {
          parts.push(buf);
          buf = '';
        }
        continue;
      }
      buf += ch;
    }
    if (buf) parts.push(buf);
    if (parts.length) lines.push(parts);
  }
  return lines;
}

function parseBlockTree(text: string): { roots: Block[]; diagnostics: string[] } {
  const diagnostics: string[] = [];
  const roots: Block[] = [];
  const stack: BlockInternal[] = [];
  let i = 0;
  const n = text.length;
  const beginRe = /\/begin\s+(\w+)\s*/gi;
  const endRe = /\/end\s+(\w+)\s*/gi;

  while (i < n) {
    beginRe.lastIndex = i;
    endRe.lastIndex = i;
    const mb = beginRe.exec(text);
    const me = endRe.exec(text);
    if (!mb && !me) break;
    const mbPos = mb ? mb.index : Infinity;
    const mePos = me ? me.index : Infinity;
    if (mb && mbPos <= mePos) {
      const kw = mb[1].toUpperCase();
      let pos = mb.index + mb[0].length;
      let name = '';
      const mname = text.slice(pos).match(/^(\w+|"[^"]*")\s*/);
      if (mname) {
        name = unquote(mname[1]);
        pos += mname[0].length;
      }
      const node: BlockInternal = {
        keyword: kw,
        name,
        body: '',
        children: [],
        _bodyStart: pos,
      };
      if (stack.length) stack[stack.length - 1].children.push(node);
      else roots.push(node);
      stack.push(node);
      i = pos;
      continue;
    }
    if (me) {
      const kw = me[1].toUpperCase();
      if (!stack.length) {
        diagnostics.push(`/end ${kw} without /begin`);
        i = me.index + me[0].length;
        continue;
      }
      const node = stack.pop()!;
      const body = text.slice(node._bodyStart, me.index);
      node.body = body.trim();
      delete (node as Partial<BlockInternal>)._bodyStart;
      i = me.index + me[0].length;
      continue;
    }
    break;
  }
  if (stack.length) {
    for (const b of stack) diagnostics.push(`Unclosed block ${b.keyword}`);
  }
  return { roots, diagnostics };
}

function findProjectModule(roots: Block[]): { project?: Block; module?: Block } {
  let project: Block | undefined;
  let module: Block | undefined;
  for (const r of roots) {
    if (r.keyword === 'PROJECT') {
      project = r;
      for (const c of r.children) {
        if (c.keyword === 'MODULE') {
          module = c;
          break;
        }
      }
      break;
    }
  }
  if (!module) {
    for (const r of roots) {
      if (r.keyword === 'MODULE') {
        module = r;
        break;
      }
    }
  }
  return { project, module };
}

function collectDescendants(node: Block | undefined, keyword: string): Block[] {
  if (!node) return [];
  const k = keyword.toUpperCase();
  const out: Block[] = [];
  for (const c of node.children) {
    if (c.keyword === k) out.push(c);
    out.push(...collectDescendants(c, keyword));
  }
  return out;
}

function dedupeBlocks(blocks: Block[]): Block[] {
  const seen = new Set<string>();
  const out: Block[] = [];
  for (const b of blocks) {
    if (!b.name || seen.has(b.name)) continue;
    seen.add(b.name);
    out.push(b);
  }
  return out;
}

function parseMeasurementBlock(b: Block): MeasurementRow {
  const lines = tokenizeLines(b.body);
  let description = '';
  let datatype = '';
  let ecuAddress = '';
  let compuMethod = '';
  let resolution = '';
  let accuracy = '';
  let lowerLimit = '';
  let upperLimit = '';
  for (const parts of lines) {
    const tag = parts[0]?.toUpperCase() ?? '';
    if (tag === 'DESCRIPTION') description = unquote(parts.slice(1).join(' '));
    else if (tag === 'DATATYPE') datatype = parts[1] ?? '';
    else if (tag === 'ECU_ADDRESS') ecuAddress = parts.slice(1).join(' ');
    else if (tag === 'COMPU_METHOD') compuMethod = parts[1] ?? '';
    else if (tag === 'RESOLUTION') resolution = parts.slice(1).join(' ');
    else if (tag === 'ACCURACY') accuracy = parts.slice(1).join(' ');
    else if (tag === 'LOWER_LIMIT') lowerLimit = parts.slice(1).join(' ');
    else if (tag === 'UPPER_LIMIT') upperLimit = parts.slice(1).join(' ');
  }
  return {
    name: b.name,
    description,
    datatype,
    ecuAddress,
    compuMethod,
    resolution,
    accuracy,
    lowerLimit,
    upperLimit,
    scalingFormula: '',
    daqEvent: '',
    relatedFunctions: [],
  };
}

function parseCharacteristicBlock(b: Block): CharacteristicRow {
  const lines = tokenizeLines(b.body);
  let description = '';
  let address = '';
  let fmt = '';
  let width = '';
  let compuMethod = '';
  let lowerLimit = '';
  let upperLimit = '';
  let relatedFunction = '';
  let recordLayout = '';
  let memorySegment = '';
  for (const parts of lines) {
    const tag = parts[0]?.toUpperCase() ?? '';
    if (tag === 'DESCRIPTION') description = unquote(parts.slice(1).join(' '));
    else if (tag === 'ECU_ADDRESS') address = parts.slice(1).join(' ');
    else if (tag === 'FORMAT') fmt = parts[1] ?? '';
    else if (tag === 'NUMBER') width = parts[1] ?? '';
    else if (tag === 'COMPU_METHOD') compuMethod = parts[1] ?? '';
    else if (tag === 'LOWER_LIMIT') lowerLimit = parts.slice(1).join(' ');
    else if (tag === 'UPPER_LIMIT') upperLimit = parts.slice(1).join(' ');
    else if (tag === 'FUNCTION') relatedFunction = parts[1] ?? '';
    else if (tag === 'RECORD_LAYOUT') recordLayout = parts[1] ?? '';
    else if (tag === 'MEMORY_SEGMENT') memorySegment = parts[1] ?? '';
  }
  return {
    name: b.name,
    description,
    address,
    type: fmt || width || 'VALUE',
    unit: '',
    lowerLimit,
    upperLimit,
    compuMethod,
    memorySegment,
    relatedFunction,
    recordLayout,
  };
}

function parseFunctionBlock(b: Block): FunctionRow {
  const lines = tokenizeLines(b.body);
  let description = '';
  const inputs: string[] = [];
  const outputs: string[] = [];
  const localMeasurements: string[] = [];
  const calibrations: string[] = [];
  const refs: string[] = [];
  for (const parts of lines) {
    const tag = parts[0]?.toUpperCase() ?? '';
    if (tag === 'DESCRIPTION') description = unquote(parts.slice(1).join(' '));
    else if (tag === 'IN_MEASUREMENT') {
      if (parts[1]) inputs.push(parts[1]);
    } else if (tag === 'OUT_MEASUREMENT') {
      if (parts[1]) outputs.push(parts[1]);
    } else if (tag === 'LOC_MEASUREMENT') {
      if (parts[1]) localMeasurements.push(parts[1]);
    } else if (tag === 'DEF_CHARACTERISTIC') {
      for (const p of parts.slice(1)) if (p) calibrations.push(p);
    } else if (tag === 'REF_CHARACTERISTIC') {
      if (parts[1]) refs.push(parts[1]);
    }
  }
  return {
    name: b.name,
    description,
    inputs,
    outputs,
    localMeasurements,
    calibrations: calibrations.concat(refs),
  };
}

function parseGroupBlock(b: Block): GroupRow {
  const lines = tokenizeLines(b.body);
  let description = '';
  const subgroups: string[] = [];
  const members: string[] = [];
  for (const parts of lines) {
    const tag = parts[0]?.toUpperCase() ?? '';
    if (tag === 'DESCRIPTION') description = unquote(parts.slice(1).join(' '));
    else if (tag === 'SUB_GROUP') {
      if (parts[1]) subgroups.push(parts[1]);
    } else if (tag === 'REF_MEASUREMENT' || tag === 'REF_CHARACTERISTIC') {
      if (parts[1]) members.push(parts[1]);
    }
  }
  return { name: b.name, description, subgroups, members };
}

function parseCompu(b: Block): CompuMethodRow {
  return { name: b.name, description: '', rawBody: (b.body || '').slice(0, 4000) };
}

function parseAxis(b: Block): AxisRow {
  const lines = tokenizeLines(b.body);
  let description = '';
  const details: string[] = [];
  for (const parts of lines) {
    const tag = parts[0]?.toUpperCase() ?? '';
    if (tag === 'DESCRIPTION') description = unquote(parts.slice(1).join(' '));
    else if (tag === 'AXIS_PTS_REF' || tag === 'FIX_AXIS_PAR_DIST' || tag === 'STD_AXIS') {
      details.push(parts.slice(1).join(' '));
    }
  }
  return { name: b.name, description, details };
}

function parseMem(b: Block): MemorySegmentRow {
  const lines = tokenizeLines(b.body);
  let description = '';
  let addressType = '';
  for (const parts of lines) {
    const tag = parts[0]?.toUpperCase() ?? '';
    if (tag === 'DESCRIPTION') description = unquote(parts.slice(1).join(' '));
    else if (tag === 'ADDRESS_TYPE' || tag === 'PRG_TYPE') addressType = parts.slice(1).join(' ');
  }
  return { name: b.name, description, addressType };
}

function flattenIfData(node: Block | undefined): IfDataRow[] {
  const rows: IfDataRow[] = [];
  const walk = (n?: Block) => {
    if (!n) return;
    for (const c of n.children) {
      if (c.keyword === 'IF_DATA') rows.push({ name: c.name, content: (c.body || '').slice(0, 8000) });
      walk(c);
    }
  };
  walk(node);
  return rows;
}

function collectDaq(node: Block | undefined): DaqRow[] {
  const rows: DaqRow[] = [];
  const walk = (n?: Block) => {
    if (!n) return;
    for (const c of n.children) {
      if (c.keyword === 'DAQ_EVENT' || c.keyword === 'DAQ' || c.keyword === 'DAQ_CONFIG') {
        rows.push({ keyword: c.keyword, name: c.name, preview: (c.body || '').slice(0, 2000) });
      }
      walk(c);
    }
  };
  walk(node);
  return rows;
}

function buildExplorerTree(roots: Block[]): ExplorerNode[] {
  const conv = (node: Block, depth: number): ExplorerNode => ({
    id: `${node.keyword}:${node.name}:${depth}`,
    label: node.name || node.keyword,
    keyword: node.keyword,
    children: node.children.slice(0, 200).map((ch) => conv(ch, depth + 1)),
  });
  return roots.map((r) => conv(r, 0));
}

export function parseA2lText(content: string): A2LDataset {
  const text = stripComments(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const { roots, diagnostics } = parseBlockTree(text);
  const { project, module } = findProjectModule(roots);

  const projectName = project?.name ?? '';
  const moduleName = module?.name ?? '';
  let asap2Version = '';
  if (project) {
    for (const parts of tokenizeLines(project.body)) {
      if (parts[0]?.toUpperCase() === 'VERSION') asap2Version = unquote(parts.slice(1).join(' '));
    }
  }

  const rawChars = collectDescendants(module, 'CHARACTERISTIC');
  const rawMeas = collectDescendants(module, 'MEASUREMENT');
  const rawFuncs = collectDescendants(module, 'FUNCTION');

  const characteristics = dedupeBlocks(rawChars).map(parseCharacteristicBlock);
  const measurements = dedupeBlocks(rawMeas).map(parseMeasurementBlock);
  const functions = dedupeBlocks(rawFuncs).map(parseFunctionBlock);
  const groups = dedupeBlocks(collectDescendants(module, 'GROUP')).map(parseGroupBlock);
  const compuMethods = dedupeBlocks(collectDescendants(module, 'COMPU_METHOD')).map(parseCompu);
  const axisPoints = dedupeBlocks(collectDescendants(module, 'AXIS_PTS')).map(parseAxis);
  const memorySegments = dedupeBlocks(collectDescendants(module, 'MEMORY_SEGMENT')).map(parseMem);

  for (const m of measurements) {
    const rel: string[] = [];
    for (const f of functions) {
      if (f.inputs.includes(m.name) || f.outputs.includes(m.name) || f.localMeasurements.includes(m.name)) {
        rel.push(f.name);
      }
    }
    m.relatedFunctions = rel;
  }

  const diagMsgs = [...diagnostics];
  const pushDup = (label: string, raw: Block[], deduped: unknown[]) => {
    if (raw.length > deduped.length) {
      diagMsgs.push(
        `Duplicate ${label} block names collapsed: ${raw.length} definitions -> ${deduped.length} unique`,
      );
    }
  };
  pushDup('CHARACTERISTIC', rawChars, characteristics);
  pushDup('MEASUREMENT', rawMeas, measurements);
  pushDup('FUNCTION', rawFuncs, functions);

  const ifData = flattenIfData(module);
  const daq = collectDaq(module);

  const labels =
    characteristics.length +
    measurements.length +
    functions.length +
    groups.length +
    compuMethods.length +
    axisPoints.length +
    memorySegments.length;

  const diagLevels = diagMsgs.slice(0, 80).map((m) => {
    const ml = m.toLowerCase();
    let level = 'info';
    if (ml.includes('mismatch') || ml.includes('without') || ml.includes('unclosed') || ml.includes('duplicate')) {
      level = 'warning';
    }
    return { level, message: m };
  });

  return {
    meta: {
      ecuName: moduleName || projectName || 'Unknown ECU',
      projectName: projectName || 'Calibration Project',
      asap2Version: asap2Version || 'unknown',
      moduleName,
    },
    counts: {
      characteristics: characteristics.length,
      measurements: measurements.length,
      functions: functions.length,
      groups: groups.length,
      compuMethods: compuMethods.length,
      axisPoints: axisPoints.length,
      memorySegments: memorySegments.length,
      daqEvents: daq.length,
      labels,
    },
    characteristics,
    measurements,
    functions,
    groups,
    compuMethods,
    axisPoints,
    memorySegments,
    ifData,
    daq,
    explorerTree: buildExplorerTree(roots),
    diagnostics: diagLevels,
    rawPreview: content.slice(0, 120000),
  };
}
