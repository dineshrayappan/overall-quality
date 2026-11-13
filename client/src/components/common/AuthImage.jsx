import React, { useEffect, useState } from 'react';
import { fetchProtectedBlob } from '../../api/client.js';

export default function AuthImage({ attachmentId, alt = 'Inspection image', style = {}, onClick }) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!attachmentId) return undefined;
    let active = true;
    let objectUrl = '';

    fetchProtectedBlob(`/attachments/${attachmentId}/file`)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachmentId]);

  if (error) {
    return <span className="muted">Image unavailable</span>;
  }
  if (!src) {
    return <span className="muted">Loading...</span>;
  }

  return (
    <img
      src={src}
      alt={alt}
      onClick={onClick}
      style={{
        display: 'block',
        objectFit: 'cover',
        borderRadius: '6px',
        border: '1px solid var(--border-strong)',
        ...style,
      }}
    />
  );
}

