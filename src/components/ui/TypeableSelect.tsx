'use client';

import { useEffect, useMemo, useState } from 'react';
import { CustomSelect, SelectOption } from './CustomSelect';
import s from './TypeableSelect.module.scss';

type Props = {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  align?: 'left' | 'right';
  direction?: 'up' | 'down';
  minWidth?: string;
  fullWidth?: boolean;
  customOptionLabel?: string;
  customPlaceholder?: string;
};

const CUSTOM_VALUE = '__custom__';

export function TypeableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  align = 'right',
  direction = 'down',
  minWidth,
  fullWidth = false,
  customOptionLabel = 'Type custom value',
  customPlaceholder = 'Type value',
}: Props) {
  const hasCustomValue = useMemo(
    () => !!value && !options.some((option) => String(option.value) === String(value)),
    [options, value],
  );
  const [isTyping, setIsTyping] = useState(hasCustomValue);

  useEffect(() => {
    if (hasCustomValue) {
      setIsTyping(true);
    }
  }, [hasCustomValue]);

  const selectOptions = useMemo(
    () => [...options, { label: customOptionLabel, value: CUSTOM_VALUE }],
    [customOptionLabel, options],
  );

  if (isTyping) {
    return (
      <div className={`${s.wrap} ${fullWidth ? s.wrapFull : ''} ${className}`}>
        <div className={s.inputShell}>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={s.input}
            placeholder={customPlaceholder}
            autoFocus
          />
          <button
            type="button"
            className={s.modeButton}
            onClick={() => {
              setIsTyping(false);
            }}
            aria-label="Back to dropdown options"
          >
            Options
          </button>
        </div>
      </div>
    );
  }

  return (
    <CustomSelect
      options={selectOptions}
      value={value || ''}
      onChange={(nextValue) => {
        const normalized = String(nextValue);
        if (normalized === CUSTOM_VALUE) {
          setIsTyping(true);
          onChange(hasCustomValue ? value : '');
          return;
        }
        onChange(normalized);
      }}
      placeholder={placeholder}
      className={className}
      align={align}
      direction={direction}
      minWidth={minWidth}
      fullWidth={fullWidth}
    />
  );
}
