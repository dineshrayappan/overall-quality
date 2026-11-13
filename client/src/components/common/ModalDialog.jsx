import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

export default function ModalDialog({ open, onClose, title, size = 'md', children }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose?.();
    };
    const isOutside = (e) => {
      const r = dialog.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    const handlePointerDown = (e) => {
      pressedOutsideRef.current = isOutside(e);
    };
    const handlePointerUp = (e) => {
      if (pressedOutsideRef.current && isOutside(e)) {
        dialog.close();
      }
      pressedOutsideRef.current = false;
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('pointerdown', handlePointerDown);
    dialog.addEventListener('pointerup', handlePointerUp);
    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('pointerdown', handlePointerDown);
      dialog.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className={`qms-dialog ${size === 'sm' ? 'qms-dialog-sm' : ''}`}
    >
      <div className="qms-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close dialog"
          autoFocus
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="qms-dialog-body">{open ? children : null}</div>
    </dialog>
  );
}

