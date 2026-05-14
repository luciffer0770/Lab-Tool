import type { A2LDataset, Experiment } from './types';
import { buildExperiments } from './experiments';
import { parseA2lText } from './parseA2l';

const API = import.meta.env.VITE_API_URL as string | undefined;

export async function parseA2lFile(file: File): Promise<{ dataset: A2LDataset; experiments: Experiment[]; sourceFile: string }> {
  if (API) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${API.replace(/\/$/, '')}/api/parse`, { method: 'POST', body: fd });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || `HTTP ${res.status}`);
    }
    return res.json();
  }
  const text = await file.text();
  const dataset = parseA2lText(text);
  const experiments = buildExperiments(dataset);
  return { dataset, experiments, sourceFile: file.name };
}

export function getApiBase(): string | undefined {
  return API?.replace(/\/$/, '');
}
