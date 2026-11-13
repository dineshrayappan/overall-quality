import React, { useEffect, useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { downloadProtectedFile, fetchProtectedBlob, getErrorMessage } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ModalDialog from './ModalDialog.jsx';

export default function PdfPreviewModal({ open, onClose, moduleSlug, reportId, reportNumber }) {
  const { hasPerm } = useAuth();
  const [blobUrl, setBlobUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !moduleSlug || !reportId) return undefined;
    let active = true;
    let url = '';
    setLoading(true);
    setError('');

    fetchProtectedBlob(`/exports/pdf/${moduleSlug}/${reportId}?inline=true`)
      .then((blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch((err) => {
        if (active) setError(getErrorMessage(err, 'Unable to load PDF preview.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
      setBlobUrl('');
    };
  }, [open, moduleSlug, reportId]);

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={`PDF Preview — ${reportNumber || 'Report'}`}
    >
      <div className="btn-row" style={{ marginBlockEnd: '0.85rem' }}>
        {hasPerm('exports', 'pdf') ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() =>
              downloadProtectedFile(
                `/exports/pdf/${moduleSlug}/${reportId}`,
                `${reportNumber || 'report'}.pdf`
              )
            }
          >
            <Download size={14} aria-hidden="true" />
            <span>Download PDF</span>
          </button>
        ) : null}
        {hasPerm('exports', 'excel') ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              downloadProtectedFile(
                `/exports/excel/individual/${moduleSlug}/${reportId}`,
                `${reportNumber || 'report'}.xlsx`
              )
            }
          >
            <FileSpreadsheet size={14} aria-hidden="true" />
            <span>Download Excel</span>
          </button>
        ) : null}
      </div>

      {loading ? <p className="muted">Generating PDF preview...</p> : null}
      {error ? <div className="alert alert-error">{error}</div> : null}
      {blobUrl ? (
        <iframe
          src={blobUrl}
          title={`PDF Preview ${reportNumber}`}
          style={{
            width: '100%',
            height: '68vh',
            border: '1px solid var(--border)',
            borderRadius: '6px',
          }}
        />
      ) : null}
    </ModalDialog>
  );
}

