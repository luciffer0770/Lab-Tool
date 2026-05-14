import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { A2LDataset, Experiment, ExplorerNode } from '../types';

type Ctx = {
  dataset: A2LDataset | null;
  experiments: Experiment[];
  sourceFile: string | null;
  activeTab: string;
  setActiveTab: (t: string) => void;
  beginnerMode: boolean;
  setBeginnerMode: (v: boolean) => void;
  advancedMode: boolean;
  setAdvancedMode: (v: boolean) => void;
  search: string;
  setSearch: (s: string) => void;
  selectedExplorer: ExplorerNode | null;
  setSelectedExplorer: (n: ExplorerNode | null) => void;
  contextDetail: Record<string, unknown> | null;
  setContextDetail: (d: Record<string, unknown> | null) => void;
  consoleLines: string[];
  pushLog: (line: string) => void;
  loadParsed: (payload: { dataset: A2LDataset; experiments: Experiment[]; sourceFile: string }) => void;
  clear: () => void;
};

const WorkbenchContext = createContext<Ctx | null>(null);

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<A2LDataset | null>(null);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [sourceFile, setSourceFile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [beginnerMode, setBeginnerMode] = useState(true);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedExplorer, setSelectedExplorer] = useState<ExplorerNode | null>(null);
  const [contextDetail, setContextDetail] = useState<Record<string, unknown> | null>(null);
  const [consoleLines, setConsoleLines] = useState<string[]>([
    'Ready. Upload an ASAP2 / A2L file to parse locally in the browser (offline), or set VITE_API_URL for API parsing.',
  ]);

  const pushLog = useCallback((line: string) => {
    setConsoleLines((prev) => [...prev.slice(-400), `[${new Date().toISOString()}] ${line}`]);
  }, []);

  const loadParsed = useCallback((payload: { dataset: A2LDataset; experiments: Experiment[]; sourceFile: string }) => {
    setDataset(payload.dataset);
    setExperiments(payload.experiments);
    setSourceFile(payload.sourceFile);
    setConsoleLines((prev) => [
      ...prev.slice(-400),
      `[${new Date().toISOString()}] Parsed ${payload.sourceFile}: ${payload.experiments.length} experiments generated.`,
    ]);
  }, []);

  const clear = useCallback(() => {
    setDataset(null);
    setExperiments([]);
    setSourceFile(null);
    setContextDetail(null);
    setConsoleLines((prev) => [...prev.slice(-400), `[${new Date().toISOString()}] Workspace cleared.`]);
  }, []);

  const value = useMemo(
    () => ({
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
      selectedExplorer,
      setSelectedExplorer,
      contextDetail,
      setContextDetail,
      consoleLines,
      pushLog,
      loadParsed,
      clear,
    }),
    [
      dataset,
      experiments,
      sourceFile,
      activeTab,
      beginnerMode,
      advancedMode,
      search,
      selectedExplorer,
      contextDetail,
      consoleLines,
      pushLog,
      loadParsed,
      clear,
    ],
  );

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

/* Context + hook: hook exported for ergonomics; Fast Refresh limitation acknowledged. */
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkbench() {
  const v = useContext(WorkbenchContext);
  if (!v) throw new Error('useWorkbench must be used within WorkbenchProvider');
  return v;
}
