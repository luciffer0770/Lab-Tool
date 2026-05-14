/** ASAP2 / A2L dataset structures used across the workbench UI. */

export type DiagnosticEntry = { level: string; message: string };

export type CharacteristicRow = {
  name: string;
  description: string;
  address: string;
  type: string;
  unit: string;
  lowerLimit: string;
  upperLimit: string;
  compuMethod: string;
  memorySegment: string;
  relatedFunction: string;
  recordLayout: string;
};

export type MeasurementRow = {
  name: string;
  description: string;
  datatype: string;
  ecuAddress: string;
  compuMethod: string;
  resolution: string;
  accuracy: string;
  lowerLimit: string;
  upperLimit: string;
  scalingFormula: string;
  daqEvent: string;
  relatedFunctions: string[];
};

export type FunctionRow = {
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
  localMeasurements: string[];
  calibrations: string[];
};

export type GroupRow = {
  name: string;
  description: string;
  subgroups: string[];
  members: string[];
};

export type CompuMethodRow = {
  name: string;
  description: string;
  rawBody: string;
};

export type AxisRow = {
  name: string;
  description: string;
  details: string[];
};

export type MemorySegmentRow = {
  name: string;
  description: string;
  addressType: string;
};

export type IfDataRow = { name: string; content: string };
export type DaqRow = { keyword: string; name: string; preview: string };

export type ExplorerNode = {
  id: string;
  label: string;
  keyword: string;
  children: ExplorerNode[];
};

export type A2LDataset = {
  meta: {
    ecuName: string;
    projectName: string;
    asap2Version: string;
    moduleName: string;
  };
  counts: Record<string, number>;
  characteristics: CharacteristicRow[];
  measurements: MeasurementRow[];
  functions: FunctionRow[];
  groups: GroupRow[];
  compuMethods: CompuMethodRow[];
  axisPoints: AxisRow[];
  memorySegments: MemorySegmentRow[];
  ifData: IfDataRow[];
  daq: DaqRow[];
  explorerTree: ExplorerNode[];
  diagnostics: DiagnosticEntry[];
  rawPreview: string;
};

export type Experiment = {
  id: number;
  title: string;
  subsystem: string;
  difficulty: string;
  learningObjectives: string[];
  beginnerExplanation: string;
  engineeringPurpose: string;
  whatToObserve: string[];
  expectedEcuBehavior: string;
  theory: { title: string; body: string }[];
  signals: {
    inputs: Record<string, string>[];
    outputs: Record<string, string>[];
    localMeasurements: Record<string, string>[];
    calibrations: Record<string, string>[];
  };
  incaProcedure: string[];
  observations: { title: string; rows: Record<string, string>[] }[];
  analysisQuestions: string[];
  reportOutline: Record<string, unknown>;
};
