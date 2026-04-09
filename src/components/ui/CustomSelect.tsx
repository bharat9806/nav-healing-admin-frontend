'use client';

import { useEffect, useRef, useState } from 'react';
import s from './CustomSelect.module.scss';

export type SelectOption = {
  label: string;
  value: string | number;
};

type Props = {
  options: SelectOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  className?: string;
  align?: 'left' | 'right';
  minWidth?: string;
};

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  align = 'right',
  minWidth,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setOpen(false);
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); }
  };

  return (
    <div className={`${s.wrap} ${className}`} ref={wrapRef}>
      <button
        type="button"
        className={`${s.trigger} ${open ? s.triggerOpen : ''}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={handleKey}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={s.triggerLabel}>{selected?.label ?? placeholder}</span>
        <svg
          className={`${s.chevron} ${open ? s.chevronOpen : ''}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M5 7.5L10 12.5L15 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          className={`${s.list} ${align === 'left' ? s.listLeft : s.listRight}`}
          style={minWidth ? { minWidth } : undefined}
          role="listbox"
          aria-label="Options"
        >
          {options.map((opt) => {
            const isActive = String(opt.value) === String(value);
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isActive}
                className={`${s.item} ${isActive ? s.itemActive : ''}`}
                onMouseDown={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                <span className={s.itemLabel}>{opt.label}</span>
                {isActive && (
                  <svg className={s.check} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <path d="M6.267 11.547L2.5 7.78l1.18-1.18 2.587 2.587 5.807-5.807 1.18 1.18-6.987 6.987z" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
