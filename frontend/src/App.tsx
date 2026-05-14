import { useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, type ColDef } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  BookOpen,
  Boxes,
  Cpu,
  Database,
  Download,
  FileJson,
  Gauge,
  Layers,
  LayoutDashboard,
  LineChart,
  Network,
  Radar,
  Search,
  Settings,
  Shield,
  Upload,
  Wrench,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { ReactFlow, Background, Controls, MiniMap, useEdgesState, useNodesState, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { parseA2lFile, getApiBase } from './api';
import { WorkbenchProvider, useWorkbench } from './context/WorkbenchContext';
import { downloadExcelWorkbook, downloadWordReport, downloadExperimentsJson } from './lib/reports';
import { TagScroll } from './components/TagScroll';
import type { A2LDataset, ExplorerNode } from './types';

ModuleRegistry.registerModules([AllCommunityModule]);

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'explorer', label: 'A2L Explorer', icon: FileJson },
  { id: 'characteristics', label: 'Characteristics', icon: Wrench },
  { id: 'measurements', label: 'Measurements', icon: Activity },
  { id: 'functions', label: 'Functions', icon: Cpu },
  { id: 'groups', label: 'Groups', icon: Layers },
  { id: 'axis', label: 'Axis Points', icon: LineChart },
  { id: 'compu', label: 'COMPU Methods', icon: Gauge },
  { id: 'memory', label: 'Memory Map', icon: Database },
  { id: 'xcp', label: 'XCP & Protocols', icon: Radar },
  { id: 'daq', label: 'DAQ Events', icon: Boxes },
  { id: 'architecture', label: 'ECU Architecture', icon: Network },
  { id: 'experiments', label: 'Experiments', icon: BookOpen },
  { id: 'inca', label: 'INCA Learning Guide', icon: BookOpen },
  { id: 'signals', label: 'Signal Relationships', icon: Network },
  { id: 'reports', label: 'Reports', icon: Download },
  { id: 'diagnostics', label: 'Diagnostics', icon: Shield },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

const COLORS = ['#0076CE', '#D71920', '#00A3E0', '#78BE20', '#5A5A5A'];

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-line-soft bg-white p-4 shadow-panel transition hover:shadow-hover">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink-primary">{value}</p>
    </div>
  );
}

function ExplorerTree({
  nodes,
  onSelect,
}: {
  nodes: ExplorerNode[];
  onSelect: (n: ExplorerNode) => void;
}) {
  const Row = ({ n, depth }: { n: ExplorerNode; depth: number }) => {
    const [open, setOpen] = useState(depth < 2);
    const has = n.children?.length > 0;
    return (
      <div className="select-none">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-white"
          style={{ paddingLeft: 8 + depth * 12 }}
          onClick={() => {
            if (has) setOpen(!open);
            onSelect(n);
          }}
        >
          <span className="text-ink-muted">{has ? (open ? '▾' : '▸') : '•'}</span>
          <span className="font-mono text-[11px] text-brand-blue">{n.keyword}</span>
          <span className="truncate text-ink-primary">{n.label}</span>
        </button>
        {has && open && n.children.map((c) => <Row key={c.id} n={c} depth={depth + 1} />)}
      </div>
    );
  };
  return (
    <div className="max-h-[560px] overflow-auto rounded-xl border border-line-soft bg-surface-panel p-2">
      {nodes.map((n) => (
        <Row key={n.id} n={n} depth={0} />
      ))}
    </div>
  );
}

function ExperimentsPanel({ beginnerMode }: { beginnerMode: boolean }) {
  const { experiments, dataset } = useWorkbench();
  const [openId, setOpenId] = useState<number | null>(null);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return experiments;
    return experiments.filter(
      (e) =>
        e.title.toLowerCase().includes(f) ||
        e.subsystem.toLowerCase().includes(f) ||
        e.difficulty.toLowerCase().includes(f),
    );
  }, [experiments, filter]);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter experiments…"
          className="w-full max-w-md rounded-lg border border-line-soft bg-white px-3 py-2 text-sm shadow-sm"
        />
        <span className="text-xs text-ink-muted">
          Showing {filtered.length} of {experiments.length} experiments for {dataset?.meta.ecuName || 'ECU'}
        </span>
      </div>
      <div className="flex-1 space-y-3 overflow-auto pr-1">
        <AnimatePresence initial={false}>
          {filtered.map((ex) => (
            <motion.div
              layout
              key={ex.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="rounded-xl border border-line-soft bg-white shadow-panel"
            >
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
                onClick={() => setOpenId(openId === ex.id ? null : ex.id)}
              >
                <div>
                  <p className="text-xs font-semibold text-brand-blue">Experiment {ex.id}</p>
                  <p className="text-base font-semibold text-ink-primary">{ex.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-brand-cyan/10 px-2 py-0.5 text-[11px] font-medium text-brand-blue">
                      {ex.subsystem}
                    </span>
                    <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-[11px] font-medium text-ink-secondary">
                      {ex.difficulty}
                    </span>
                    <span className="rounded-full bg-surface-sidebar px-2 py-0.5 text-[11px] text-ink-muted">
                      Signals:{' '}
                      {ex.signals.inputs.length +
                        ex.signals.outputs.length +
                        ex.signals.localMeasurements.length +
                        ex.signals.calibrations.length}
                    </span>
                  </div>
                </div>
                <span className="text-ink-muted">{openId === ex.id ? '−' : '+'}</span>
              </button>
              {openId === ex.id && (
                <div className="space-y-4 border-t border-line-soft px-4 py-4 text-sm text-ink-secondary">
                  {beginnerMode && (
                    <section>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-brand-blue">Beginner overview</h4>
                      <p className="mt-1 leading-relaxed">{ex.beginnerExplanation}</p>
                    </section>
                  )}
                  <section>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-brand-red">Learning objectives</h4>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {ex.learningObjectives.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </section>
                  <section className="grid gap-3 md:grid-cols-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-ink-primary">Engineering purpose</h4>
                      <p className="mt-1">{ex.engineeringPurpose}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-ink-primary">Expected ECU behavior</h4>
                      <p className="mt-1">{ex.expectedEcuBehavior}</p>
                    </div>
                  </section>
                  <section>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-brand-cyan">What to observe</h4>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {ex.whatToObserve.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-ink-primary">Theory</h4>
                    <div className="mt-2 space-y-2">
                      {ex.theory.map((t) => (
                        <div key={t.title} className="rounded-lg border border-line-soft bg-surface-panel p-3">
                          <p className="text-sm font-semibold text-ink-primary">{t.title}</p>
                          <p className="mt-1 text-sm leading-relaxed">{t.body}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section className="grid gap-3 md:grid-cols-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-brand-blue">Inputs</h4>
                      <div className="mt-1 space-y-1 text-xs">
                        {ex.signals.inputs.map((s) => (
                          <div key={s.name} className="rounded-md border border-line-soft bg-white p-2">
                            <p className="font-mono text-[11px] text-brand-blue">{s.name}</p>
                            <p>{s.description || '—'}</p>
                          </div>
                        ))}
                        {!ex.signals.inputs.length && <p className="text-ink-muted">—</p>}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-brand-blue">Outputs</h4>
                      <div className="mt-1 space-y-1 text-xs">
                        {ex.signals.outputs.map((s) => (
                          <div key={s.name} className="rounded-md border border-line-soft bg-white p-2">
                            <p className="font-mono text-[11px] text-brand-blue">{s.name}</p>
                            <p>{s.description || '—'}</p>
                          </div>
                        ))}
                        {!ex.signals.outputs.length && <p className="text-ink-muted">—</p>}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-brand-cyan">Local measurements</h4>
                      <div className="mt-1 space-y-1 text-xs">
                        {ex.signals.localMeasurements.map((s) => (
                          <div key={s.name} className="rounded-md border border-line-soft bg-white p-2">
                            <p className="font-mono text-[11px] text-brand-cyan">{s.name}</p>
                            <p>{s.description || '—'}</p>
                          </div>
                        ))}
                        {!ex.signals.localMeasurements.length && <p className="text-ink-muted">—</p>}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-brand-red">Calibrations</h4>
                      <div className="mt-1 space-y-1 text-xs">
                        {ex.signals.calibrations.map((s) => (
                          <div key={s.name} className="rounded-md border border-line-soft bg-white p-2">
                            <p className="font-mono text-[11px] text-brand-red">{s.name}</p>
                            <p>{s.description || '—'}</p>
                          </div>
                        ))}
                        {!ex.signals.calibrations.length && <p className="text-ink-muted">—</p>}
                      </div>
                    </div>
                  </section>
                  <section>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-ink-primary">INCA-style procedure</h4>
                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                      {ex.incaProcedure.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                  </section>
                  {ex.observations?.length > 0 && (
                    <section>
                      <h4 className="text-xs font-bold uppercase tracking-wide text-ink-primary">Observation tables</h4>
                      {ex.observations.map((o) => (
                        <div key={o.title} className="mt-2 overflow-auto rounded-lg border border-line-soft">
                          <p className="bg-surface-sidebar px-3 py-2 text-xs font-semibold">{o.title}</p>
                          <table className="min-w-full text-xs">
                            <thead className="bg-surface-panel text-left text-ink-muted">
                              <tr>
                                {Object.keys(o.rows[0] || {}).map((k) => (
                                  <th key={k} className="px-2 py-1">
                                    {k}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {o.rows.map((r, i) => (
                                <tr key={i} className={i % 2 ? 'bg-white' : 'bg-surface-panel/60'}>
                                  {Object.values(r).map((v, j) => (
                                    <td key={j} className="px-2 py-1 font-mono text-[11px]">
                                      {String(v)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </section>
                  )}
                  <section>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-status-warning">Analysis questions</h4>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {ex.analysisQuestions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-ink-primary">NITK-style report outline</h4>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {(ex.reportOutline.sections as string[] | undefined)?.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </section>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ArchitectureFlow({ data }: { data: A2LDataset }) {
  const { nodes, edges } = useMemo(() => {
    const ns: Node[] = data.functions.map((f, i) => ({
      id: f.name,
      position: { x: (i % 4) * 260, y: Math.floor(i / 4) * 140 },
      data: { label: f.name },
      style: {
        fontSize: 11,
        borderRadius: 12,
        border: '1px solid #D9E1EA',
        padding: 8,
        background: '#fff',
        width: 220,
      },
    }));
    const es: Edge[] = [];
    const names = data.functions.map((f) => f.name);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = data.functions[i];
        const b = data.functions[j];
        const sa = new Set([...a.inputs, ...a.outputs, ...a.localMeasurements]);
        const inter = [...b.inputs, ...b.outputs, ...b.localMeasurements].filter((x) => sa.has(x));
        if (inter.length) {
          es.push({ id: `${a.name}-${b.name}`, source: a.name, target: b.name });
        }
      }
    }
    return { nodes: ns, edges: es };
  }, [data.functions]);

  const [n, , onNodesChange] = useNodesState(nodes);
  const [e, , onEdgesChange] = useEdgesState(edges);

  if (!nodes.length) {
    return <p className="text-sm text-ink-muted">No FUNCTION blocks found to visualize.</p>;
  }

  return (
    <div className="h-[520px] rounded-xl border border-line-soft bg-white shadow-panel">
      <ReactFlow nodes={n} edges={e} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView>
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}

function InnerApp() {
  const {
    dataset,
    experiments,
    sourceFile,
    activeTab,
    setActiveTab,
    beginnerMode,
    setBeginnerMode,
    advancedMode,
    setAdvancedMode,
    search,
    setSearch,
    loadParsed,
    pushLog,
    consoleLines,
    clear,
    setSelectedExplorer,
    setContextDetail,
    contextDetail,
  } = useWorkbench();

  const fileRef = useRef<HTMLInputElement>(null);

  const onUpload = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try {
      pushLog(`Uploading ${f.name} (${(f.size / 1024).toFixed(1)} KB)…`);
      const parsed = await parseA2lFile(f);
      loadParsed(parsed);
      setActiveTab('dashboard');
    } catch (e) {
      pushLog(`Error: ${(e as Error).message}`);
    }
  };

  const charCols: ColDef[] = useMemo(
    () => [
      { field: 'name', headerName: 'Name', minWidth: 160, pinned: 'left' },
      { field: 'description', headerName: 'Description', flex: 1, minWidth: 200 },
      { field: 'address', headerName: 'Address', width: 140 },
      { field: 'type', headerName: 'Type', width: 90 },
      { field: 'lowerLimit', headerName: 'Lower', width: 90 },
      { field: 'upperLimit', headerName: 'Upper', width: 90 },
      { field: 'compuMethod', headerName: 'COMPU', width: 120 },
      { field: 'memorySegment', headerName: 'Segment', width: 120 },
      { field: 'relatedFunction', headerName: 'Function', width: 160 },
    ],
    [],
  );

  const measCols: ColDef[] = useMemo(
    () => [
      { field: 'name', headerName: 'Signal', minWidth: 160, pinned: 'left' },
      { field: 'description', headerName: 'Description', flex: 1, minWidth: 200 },
      { field: 'datatype', headerName: 'Datatype', width: 110 },
      { field: 'ecuAddress', headerName: 'ECU Address', width: 140 },
      { field: 'compuMethod', headerName: 'COMPU', width: 120 },
      { field: 'resolution', headerName: 'Resolution', width: 110 },
      { field: 'lowerLimit', headerName: 'Lower', width: 90 },
      { field: 'upperLimit', headerName: 'Upper', width: 90 },
      {
        field: 'relatedFunctions',
        headerName: 'Functions',
        valueGetter: (p) => (p.data?.relatedFunctions || []).join(', '),
        flex: 1,
        minWidth: 200,
      },
    ],
    [],
  );

  const donutData = useMemo(() => {
    if (!dataset) return [];
    const c = dataset.counts;
    return [
      { name: 'Measurements', value: c.measurements || 0 },
      { name: 'Characteristics', value: c.characteristics || 0 },
      { name: 'Functions', value: c.functions || 0 },
      { name: 'Other', value: (c.groups || 0) + (c.compuMethods || 0) + (c.axisPoints || 0) },
    ].filter((d) => d.value > 0);
  }, [dataset]);

  const barData = useMemo(() => {
    if (!dataset) return [];
    return (dataset.functions || []).slice(0, 12).map((f) => ({
      name: f.name.slice(0, 18),
      cal: f.calibrations?.length || 0,
      meas: (f.inputs?.length || 0) + (f.outputs?.length || 0) + (f.localMeasurements?.length || 0),
    }));
  }, [dataset]);

  const renderWorkspace = () => {
    if (!dataset) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-line-soft bg-white p-10 text-center shadow-panel">
          <Upload className="h-10 w-10 text-brand-blue" />
          <div>
            <p className="text-lg font-semibold text-ink-primary">Upload an ASAP2 / A2L file</p>
            <p className="mt-2 max-w-xl text-sm text-ink-secondary">
              Parsing runs in your browser for offline use. Optionally set <span className="font-mono">VITE_API_URL</span>{' '}
              to use the FastAPI service for identical JSON output.
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-blue/90"
            onClick={() => fileRef.current?.click()}
          >
            Choose file
          </button>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Kpi label="Measurements" value={dataset.counts.measurements || 0} />
              <Kpi label="Characteristics" value={dataset.counts.characteristics || 0} />
              <Kpi label="Functions" value={dataset.counts.functions || 0} />
              <Kpi label="Experiments" value={experiments.length} />
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-line-soft bg-white p-4 shadow-panel lg:col-span-1">
                <p className="text-sm font-semibold text-ink-primary">Label mix</p>
                <div className="h-64">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                        {donutData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <RTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border border-line-soft bg-white p-4 shadow-panel lg:col-span-2">
                <p className="text-sm font-semibold text-ink-primary">Subsystem footprint (top functions)</p>
                <div className="h-64">
                  <ResponsiveContainer>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <RTooltip />
                      <Bar dataKey="meas" fill="#0076CE" name="Measurements" />
                      <Bar dataKey="cal" fill="#D71920" name="Calibrations" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-line-soft bg-white p-4 shadow-panel">
                <p className="text-sm font-semibold">Parser health</p>
                <p className="mt-2 text-sm text-ink-secondary">
                  {dataset.diagnostics.filter((d) => d.level === 'warning').length} warnings,{' '}
                  {dataset.diagnostics.length} diagnostic lines.
                </p>
              </div>
              <div className="rounded-xl border border-line-soft bg-white p-4 shadow-panel">
                <p className="text-sm font-semibold">ECU architecture summary</p>
                <p className="mt-2 text-sm text-ink-secondary">
                  {dataset.functions.length} FUNCTION blocks model subsystem boundaries for learning experiments.
                </p>
              </div>
            </div>
          </div>
        );
      case 'explorer':
        return (
          <div className="grid h-[620px] gap-3 lg:grid-cols-2">
            <ExplorerTree
              nodes={dataset.explorerTree}
              onSelect={(n) => {
                setSelectedExplorer(n);
                setContextDetail({ keyword: n.keyword, label: n.label });
              }}
            />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Raw A2L preview</p>
              <pre className="max-h-[560px] flex-1 overflow-auto rounded-xl border border-line-soft bg-white p-3 font-mono text-[11px] leading-relaxed text-ink-secondary shadow-inner">
                {advancedMode ? dataset.rawPreview : dataset.rawPreview.slice(0, 20000)}
              </pre>
            </div>
          </div>
        );
      case 'characteristics':
        return (
          <div className="ag-theme-quartz h-[620px] w-full rounded-xl border border-line-soft shadow-panel">
            <AgGridReact
              rowData={dataset.characteristics}
              columnDefs={charCols}
              defaultColDef={{ sortable: true, filter: true, resizable: true }}
              rowClass="border-b border-line-grid"
              getRowStyle={() => ({ borderLeft: '3px solid #D71920' })}
              quickFilterText={search}
            />
          </div>
        );
      case 'measurements':
        return (
          <div className="ag-theme-quartz h-[620px] w-full rounded-xl border border-line-soft shadow-panel">
            <AgGridReact
              rowData={dataset.measurements}
              columnDefs={measCols}
              defaultColDef={{ sortable: true, filter: true, resizable: true }}
              getRowStyle={() => ({ borderLeft: '3px solid #0076CE' })}
              quickFilterText={search}
            />
          </div>
        );
      case 'functions':
        return (
          <div className="grid gap-3 md:grid-cols-2">
            {dataset.functions.map((f) => (
              <div key={f.name} className="rounded-xl border border-line-soft bg-white p-4 shadow-panel">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-brand-blue">Function</p>
                    <h3 className="text-lg font-semibold text-ink-primary">{f.name}</h3>
                    <p className="mt-1 text-sm text-ink-secondary">{f.description || '—'}</p>
                  </div>
                  <div className="text-right text-xs text-ink-muted">
                    <p>Cal: {f.calibrations?.length || 0}</p>
                    <p>
                      Meas:{' '}
                      {(f.inputs?.length || 0) + (f.outputs?.length || 0) + (f.localMeasurements?.length || 0)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-brand-blue">Inputs</p>
                    <TagScroll items={f.inputs || []} accent="blue" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-brand-blue">Outputs</p>
                    <TagScroll items={f.outputs || []} accent="blue" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-brand-cyan">Local measurements</p>
                    <TagScroll items={f.localMeasurements || []} accent="cyan" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-brand-red">Calibrations</p>
                    <TagScroll items={f.calibrations || []} accent="red" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      case 'groups':
        return (
          <div className="space-y-3">
            {dataset.groups.map((g) => (
              <div key={g.name} className="rounded-xl border border-line-soft bg-white p-4 shadow-panel">
                <p className="text-xs font-semibold text-brand-blue">Group</p>
                <h3 className="text-lg font-semibold">{g.name}</h3>
                <p className="text-sm text-ink-secondary">{g.description || '—'}</p>
                <p className="mt-2 text-xs font-semibold text-ink-muted">Subgroups</p>
                <TagScroll items={g.subgroups || []} accent="neutral" />
                <p className="mt-3 text-xs font-semibold text-ink-muted">Members</p>
                <TagScroll items={g.members || []} accent="neutral" />
              </div>
            ))}
          </div>
        );
      case 'axis':
        return (
          <div className="grid gap-3 md:grid-cols-2">
            {dataset.axisPoints.map((a) => (
              <div key={a.name} className="rounded-xl border border-line-soft bg-white p-4 shadow-panel">
                <h3 className="font-semibold">{a.name}</h3>
                <p className="text-sm text-ink-secondary">{a.description || '—'}</p>
                <TagScroll items={a.details || []} accent="neutral" />
              </div>
            ))}
          </div>
        );
      case 'compu':
        return (
          <div className="space-y-3">
            {dataset.compuMethods.map((c) => (
              <div key={c.name} className="rounded-xl border border-line-soft bg-white p-4 shadow-panel">
                <h3 className="font-semibold">{c.name}</h3>
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-surface-panel p-2 font-mono text-[11px] text-ink-secondary">
                  {c.rawBody}
                </pre>
              </div>
            ))}
          </div>
        );
      case 'memory':
        return (
          <div className="grid gap-3 md:grid-cols-2">
            {dataset.memorySegments.map((m) => (
              <div key={m.name} className="rounded-xl border border-line-soft bg-white p-4 shadow-panel">
                <h3 className="font-semibold">{m.name}</h3>
                <p className="text-sm">{m.description || '—'}</p>
                <p className="mt-2 text-xs text-ink-muted">{m.addressType}</p>
                <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-line-grid">
                  <div className="h-full w-2/3 bg-gradient-to-r from-brand-blue to-brand-cyan" />
                </div>
                <p className="mt-1 text-[10px] text-ink-muted">Illustrative utilization bar (address map heuristic).</p>
              </div>
            ))}
          </div>
        );
      case 'xcp':
        return (
          <div className="space-y-3">
            {dataset.ifData.map((row, i) => (
              <div key={i} className="rounded-xl border border-brand-cyan/30 bg-white p-4 shadow-panel">
                <h3 className="font-semibold text-brand-blue">{row.name || `IF_DATA_${i}`}</h3>
                <pre className="mt-2 max-h-64 overflow-auto font-mono text-[11px] text-ink-secondary">{row.content}</pre>
              </div>
            ))}
          </div>
        );
      case 'daq':
        return (
          <div className="space-y-3">
            {dataset.daq.map((d, i) => (
              <div key={i} className="rounded-xl border border-line-soft bg-white p-4 shadow-panel">
                <p className="text-xs font-semibold text-brand-cyan">{d.keyword}</p>
                <h3 className="font-semibold">{d.name}</h3>
                <pre className="mt-2 max-h-48 overflow-auto text-xs text-ink-secondary">{d.preview}</pre>
              </div>
            ))}
          </div>
        );
      case 'architecture':
        return <ArchitectureFlow key={`arch-${dataset.meta.ecuName}-${dataset.functions.length}`} data={dataset} />;
      case 'experiments':
        return <ExperimentsPanel beginnerMode={beginnerMode} />;
      case 'inca':
        return (
          <div className="prose prose-sm max-w-none rounded-xl border border-line-soft bg-white p-6 shadow-panel">
            <h2>INCA learning guide</h2>
            <p>
              This guide explains how ECU calibration workflows connect ASAP2 metadata, XCP transport, DAQ lists, and
              measurement overlays. Enable beginner mode in Settings for inline simplifications across the workbench.
            </p>
            <h3>ECU basics</h3>
            <p>
              The ECU executes control software that reads sensors, applies calibrations, and drives actuators. The A2L
              file documents the symbolic labels, addresses, scaling, and grouping used by calibration tools.
            </p>
            <h3>XCP and measurement</h3>
            <p>
              XCP provides read/write access to memory-backed labels. Measurements are read-only views of runtime
              signals; characteristics are writable calibration parameters when memory permissions allow.
            </p>
            <h3>DAQ</h3>
            <p>
              DAQ lists schedule periodic acquisition of selected measurements. Raster selection balances temporal
              resolution against bus load.
            </p>
            <h3>ETK / rapid prototyping (conceptual)</h3>
            <p>
              Rapid prototyping interfaces allow deeper on-target iteration; always follow laboratory safety and
              configuration rules for your bench.
            </p>
          </div>
        );
      case 'signals':
        return <ArchitectureFlow key={`sig-${dataset.meta.ecuName}-${dataset.functions.length}`} data={dataset} />;
      case 'reports':
        return (
          <div className="rounded-xl border border-line-soft bg-white p-6 shadow-panel">
            <h3 className="text-lg font-semibold">Exports</h3>
            <p className="mt-2 text-sm text-ink-secondary">
              Generate structured technical artifacts aligned with NITK laboratory reporting practice.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg border border-line-soft bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:shadow"
                onClick={() => downloadWordReport(dataset, experiments)}
              >
                Word report
              </button>
              <button
                type="button"
                className="rounded-lg border border-line-soft bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:shadow"
                onClick={() => downloadExcelWorkbook(dataset)}
              >
                Excel tables
              </button>
              <button
                type="button"
                className="rounded-lg border border-line-soft bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:shadow"
                onClick={() => downloadExperimentsJson(experiments)}
              >
                Experiments JSON
              </button>
            </div>
            <p className="mt-4 text-xs text-ink-muted">
              PDF export can be added via print-to-PDF from the browser once the Word document is finalized.
            </p>
          </div>
        );
      case 'diagnostics':
        return (
          <div className="space-y-2">
            {dataset.diagnostics.map((d, i) => (
              <div
                key={i}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  d.level === 'warning' ? 'border-status-warning/50 bg-status-warning/10' : 'border-line-soft bg-white'
                }`}
              >
                <span className="font-mono text-[11px] text-ink-muted">{d.level}</span> — {d.message}
              </div>
            ))}
          </div>
        );
      case 'settings':
        return (
          <div className="space-y-4 rounded-xl border border-line-soft bg-white p-6 shadow-panel">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={beginnerMode} onChange={(e) => setBeginnerMode(e.target.checked)} />
              Beginner explanations (clearer language in experiments and guides)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={advancedMode} onChange={(e) => setAdvancedMode(e.target.checked)} />
              Advanced engineering mode (extended raw preview in explorer)
            </label>
            <p className="text-xs text-ink-muted">
              API base: {getApiBase() || 'not set — browser parsing enabled (offline-first)'}
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-main text-ink-primary">
      <header className="flex flex-wrap items-center gap-3 border-b border-line-soft bg-white px-4 py-3 shadow-panel">
        <div className="min-w-[220px]">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-red">A2L Engineering Workbench</p>
          <p className="text-xs text-ink-secondary">Automotive Electronics Laboratory — NITK Surathkal</p>
        </div>
        <div className="mx-2 hidden h-8 w-px bg-line-soft md:block" />
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-brand-red px-3 py-2 text-sm font-semibold text-white shadow hover:bg-brand-red/90"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Upload A2L
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-line-soft bg-white px-3 py-2 text-sm font-semibold shadow-sm hover:shadow"
          onClick={() => dataset && downloadExcelWorkbook(dataset)}
          disabled={!dataset}
        >
          <Download className="h-4 w-4" />
          Export
        </button>
        <div className="relative flex-1 min-w-[160px] max-w-md">
          <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Global search (tables / quick filters)"
            className="w-full rounded-lg border border-line-soft bg-surface-panel py-2 pl-8 pr-3 text-sm shadow-inner"
          />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
          <span className="rounded-full bg-brand-green/15 px-2 py-1 font-medium text-ink-primary">
            Parser: {dataset ? 'OK' : 'idle'}
          </span>
          <span className="rounded-full bg-surface-sidebar px-2 py-1">ECU: {dataset?.meta.ecuName || '—'}</span>
          <span className="rounded-full bg-surface-sidebar px-2 py-1">Experiments: {experiments.length}</span>
          <button type="button" className="rounded-full border border-line-soft px-2 py-1" onClick={() => clear()}>
            Clear
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".a2l,.aml,.txt" className="hidden" onChange={(e) => onUpload(e.target.files)} />
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 flex-col border-r border-line-soft bg-surface-sidebar md:flex">
          <div className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Navigation</div>
          <nav className="flex-1 space-y-1 overflow-auto px-2 pb-4">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                    active ? 'bg-white text-brand-blue shadow' : 'text-ink-secondary hover:bg-white/70'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-line-soft bg-surface-panel px-3 py-2 md:hidden">
            <select
              className="w-full rounded-lg border border-line-soft bg-white px-2 py-2 text-sm"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
            >
              {TABS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-4">{renderWorkspace()}</div>
        </main>

        <aside className="hidden w-80 flex-col border-l border-line-soft bg-white xl:flex">
          <div className="border-b border-line-soft px-4 py-3 text-sm font-semibold">Context</div>
          <div className="flex-1 space-y-3 overflow-auto p-4 text-sm text-ink-secondary">
            <p className="font-semibold text-ink-primary">{sourceFile || 'No file loaded'}</p>
            <p>
              ASAP2 version <span className="font-mono">{dataset?.meta.asap2Version || '—'}</span>
            </p>
            <p>Use the experiments tab for step-by-step INCA-style procedures derived from this dataset.</p>
            {contextDetail && (
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-surface-panel p-2 font-mono text-[11px]">
                {JSON.stringify(contextDetail, null, 2)}
              </pre>
            )}
          </div>
        </aside>
      </div>

      <footer className="max-h-40 overflow-auto border-t border-line-soft bg-surface-panel px-4 py-2 font-mono text-[11px] text-ink-secondary">
        {consoleLines.slice(-12).map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <WorkbenchProvider>
      <InnerApp />
    </WorkbenchProvider>
  );
}
