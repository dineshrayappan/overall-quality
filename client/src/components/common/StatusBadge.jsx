import React from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  FileEdit,
  XCircle,
} from 'lucide-react';

const STATUS_CONFIG = {
  Approved: { cls: 'badge-success', Icon: CheckCircle2 },
  Accepted: { cls: 'badge-success', Icon: CheckCircle2 },
  Pass: { cls: 'badge-success', Icon: CheckCircle2 },
  'Within Tolerance': { cls: 'badge-success', Icon: CheckCircle2 },
  OK: { cls: 'badge-success', Icon: CheckCircle2 },
  '100%+': { cls: 'badge-success', Icon: CheckCircle2 },
  '75%+': { cls: 'badge-info', Icon: CheckCircle2 },
  'Pending Approval': { cls: 'badge-info', Icon: Clock },
  Pending: { cls: 'badge-neutral', Icon: Clock },
  Draft: { cls: 'badge-neutral', Icon: FileEdit },
  '50%+': { cls: 'badge-warning', Icon: AlertTriangle },
  Rework: { cls: 'badge-warning', Icon: AlertTriangle },
  'Returned for Correction': { cls: 'badge-warning', Icon: AlertTriangle },
  Hold: { cls: 'badge-danger', Icon: XCircle },
  Rejected: { cls: 'badge-danger', Icon: XCircle },
  Fail: { cls: 'badge-danger', Icon: XCircle },
  'Not OK': { cls: 'badge-danger', Icon: XCircle },
  'Below 50%': { cls: 'badge-danger', Icon: AlertTriangle },
  'N/A': { cls: 'badge-neutral', Icon: Clock },
  Archived: { cls: 'badge-neutral', Icon: Archive },
};

export default function StatusBadge({ value }) {
  const label = value || 'Pending';
  const cfg = STATUS_CONFIG[label] || { cls: 'badge-neutral', Icon: Clock };
  const Icon = cfg.Icon;
  return (
    <span className={`badge ${cfg.cls}`}>
      <Icon size={13} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

