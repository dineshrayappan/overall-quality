import React, { useState } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { api, getErrorMessage } from '../../api/client.js';
import AuthImage from './AuthImage.jsx';
import ModalDialog from './ModalDialog.jsx';

export default function PhotoUploader({
  moduleName = 'size_set',
  itemKey = '',
  inspectionId = '',
  attachmentIds = [],
  onChange,
  disabled = false,
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewId, setPreviewId] = useState('');

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('module', moduleName);
      if (itemKey) formData.append('itemKey', itemKey);
      if (inspectionId) formData.append('inspectionId', inspectionId);
      formData.append('file', file);

      const res = await api.post('/attachments/upload', formData);
      const uploadedId = res.data?.data?._id;
      if (uploadedId) {
        onChange?.([...attachmentIds, uploadedId]);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Image upload failed.'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', alignItems: 'center' }}>
        {attachmentIds.map((id) => (
          <div key={id} style={{ position: 'relative', display: 'inline-block' }}>
            <AuthImage
              attachmentId={id}
              alt="Defect evidence"
              onClick={() => setPreviewId(id)}
              style={{ width: 46, height: 46, cursor: 'pointer' }}
            />
            {!disabled ? (
              <button
                type="button"
                aria-label="Remove image"
                onClick={() => onChange?.(attachmentIds.filter((x) => x !== id))}
                style={{
                  position: 'absolute',
                  insetBlockStart: -6,
                  insetInlineEnd: -6,
                  background: '#b91c1c',
                  color: '#fff',
                  border: 0,
                  borderRadius: '999px',
                  width: 18,
                  height: 18,
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={10} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ))}
        {!disabled ? (
          <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
            <ImagePlus size={14} aria-hidden="true" />
            <span>{uploading ? 'Uploading...' : 'Photo'}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={uploading}
              style={{ display: 'none' }}
            />
          </label>
        ) : null}
      </div>
      {error ? (
        <div style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: '0.25rem' }}>
          {error}
        </div>
      ) : null}

      <ModalDialog
        open={Boolean(previewId)}
        onClose={() => setPreviewId('')}
        title="Inspection Photograph"
      >
        {previewId ? (
          <AuthImage
            attachmentId={previewId}
            alt="Full-size inspection defect"
            style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
          />
        ) : null}
      </ModalDialog>
    </div>
  );
}

