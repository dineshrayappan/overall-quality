import React, { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export default function SearchableSelect({
  label,
  options = [],
  value = '',
  onChange,
  placeholder = 'Search or select...',
  required = false,
  disabled = false,
  getOptionValue = (opt) => opt._id || opt.value,
  getOptionLabel = (opt) => opt.name || opt.label || '',
  getOptionSubLabel = (opt) => opt.code || '',
}) {
  const inputId = useId();
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedObj = options.find((o) => String(getOptionValue(o)) === String(value));

  useEffect(() => {
    const onOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const filtered = options.filter((opt) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const primary = String(getOptionLabel(opt)).toLowerCase();
    const sub = String(getOptionSubLabel(opt)).toLowerCase();
    return primary.includes(q) || sub.includes(q);
  });

  const displayValue = open ? query : selectedObj ? getOptionLabel(selectedObj) : '';

  return (
    <div className="field" ref={containerRef}>
      {label ? (
        <label htmlFor={inputId}>
          {label} {required ? <span aria-hidden="true">*</span> : null}
        </label>
      ) : null}
      <div className="ss-wrapper">
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          <input
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            value={displayValue}
            placeholder={
              options.length > 0 ? `${placeholder} (${options.length})` : `${placeholder} (No options)`
            }
            disabled={disabled}
            required={required && !value}
            autoComplete="off"
            onFocus={() => {
              if (!disabled) setOpen(true);
            }}
            onClick={() => {
              if (!disabled && !open) setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
              } else if (e.key === 'ArrowDown' && !open && !disabled) {
                setOpen(true);
              }
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            style={{ paddingInlineEnd: '4.2rem' }}
          />
          <div
            style={{
              position: 'absolute',
              insetInlineEnd: '0.4rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
            }}
          >
            {value && !disabled ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                aria-label={`Clear ${label || 'selection'}`}
                onClick={() => {
                  onChange('');
                  setQuery('');
                }}
                style={{ minBlockSize: '28px', padding: '0 0.35rem', border: 0 }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-label={`Toggle ${label || 'options'}`}
              disabled={disabled}
              onMouseDown={(e) => {
                // Prevent input blur/focus-flap from immediately re-opening on toggle click
                e.preventDefault();
              }}
              onClick={() => setOpen((prev) => !prev)}
              style={{ minBlockSize: '28px', padding: '0 0.35rem', border: 0 }}
            >
              <ChevronDown size={15} aria-hidden="true" />
            </button>
          </div>
        </div>

        {open && !disabled ? (
          <div className="ss-menu" role="listbox">
            {filtered.length === 0 ? (
              <div style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No matching records found.
              </div>
            ) : (
              filtered.map((opt) => {
                const val = getOptionValue(opt);
                const lbl = getOptionLabel(opt);
                const sub = getOptionSubLabel(opt);
                const isSelected = String(val) === String(value);
                return (
                  <button
                    key={val}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`ss-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(val, opt);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <span>{lbl}</span>
                    {sub ? <span className="muted">{sub}</span> : null}
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

