import { Counter } from '../models/Counter.js';

export async function nextSequence(key) {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

export async function nextMasterCode(prefix) {
  const seq = await nextSequence(`master:${prefix}`);
  return `${prefix}-${String(seq).padStart(4, '0')}`;
}

export async function nextReportNumber(prefix) {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`report:${prefix}:${year}`);
  return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
}

