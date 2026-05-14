import { saveAs } from 'file-saver';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import * as XLSX from 'xlsx';
import type { A2LDataset, Experiment } from '../types';

export async function downloadWordReport(dataset: A2LDataset, experiments: Experiment[]) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'A2L Engineering Workbench — Technical Report',
            heading: HeadingLevel.TITLE,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Institution: ', bold: true }),
              new TextRun('National Institute of Technology Karnataka, Surathkal — Automotive Electronics Laboratory'),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Project: ', bold: true }),
              new TextRun(dataset.meta.projectName || ''),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'ECU / Module: ', bold: true }),
              new TextRun(dataset.meta.ecuName || ''),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'ASAP2 version: ', bold: true }),
              new TextRun(dataset.meta.asap2Version || ''),
            ],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Dataset summary', heading: HeadingLevel.HEADING_1 }),
          ...Object.entries(dataset.counts).map(
            ([k, v]) =>
              new Paragraph({
                bullet: { level: 0 },
                children: [new TextRun(`${k}: ${v}`)],
              }),
          ),
          new Paragraph({ text: '' }),
          new Paragraph({ text: 'Selected experiments', heading: HeadingLevel.HEADING_1 }),
          ...experiments.slice(0, 35).flatMap((ex) => [
            new Paragraph({
              text: `Experiment ${ex.id}: ${ex.title}`,
              heading: HeadingLevel.HEADING_2,
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Subsystem: ', bold: true }),
                new TextRun(`${ex.subsystem} | Difficulty: ${ex.difficulty}`),
              ],
            }),
            new Paragraph(ex.engineeringPurpose),
            ...ex.incaProcedure.slice(0, 18).map(
              (step, i) =>
                new Paragraph({
                  children: [new TextRun({ text: `${i + 1}. `, bold: true }), new TextRun(step)],
                }),
            ),
            new Paragraph({ text: '' }),
          ]),
        ],
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, 'a2l_report.docx');
}

export function downloadExcelWorkbook(dataset: A2LDataset) {
  const wb = XLSX.utils.book_new();
  const ch = XLSX.utils.json_to_sheet(dataset.characteristics);
  XLSX.utils.book_append_sheet(wb, ch, 'Characteristics');
  const ms = XLSX.utils.json_to_sheet(dataset.measurements);
  XLSX.utils.book_append_sheet(wb, ms, 'Measurements');
  const fn = XLSX.utils.json_to_sheet(
    dataset.functions.map((f) => ({
      name: f.name,
      description: f.description,
      inputs: (f.inputs || []).join(', '),
      outputs: (f.outputs || []).join(', '),
      locals: (f.localMeasurements || []).join(', '),
      calibrations: (f.calibrations || []).join(', '),
    })),
  );
  XLSX.utils.book_append_sheet(wb, fn, 'Functions');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/octet-stream' }), 'a2l_tables.xlsx');
}

export function downloadExperimentsJson(experiments: Experiment[]) {
  const blob = new Blob([JSON.stringify(experiments, null, 2)], { type: 'application/json' });
  saveAs(blob, 'experiments.json');
}
