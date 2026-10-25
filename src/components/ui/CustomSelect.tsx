"use client";

import { useEffect, useId, useRef, useState } from "react";
import s from "./CustomSelect.module.scss";

export type SelectOption = {
  label: string;
  value: string | number;
};

type Props = {
  id?: string;
  options: SelectOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
  direction?: "up" | "down";
  minWidth?: string;
  fullWidth?: boolean;
};

export function CustomSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Select...",
  className = "",
  align = "right",
  direction = "down",
  minWidth,
  fullWidth = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open)
      listRef.current
        ?.querySelectorAll<HTMLElement>('[role="option"]')
        [activeIndex]?.focus();
  }, [open, activeIndex]);

  const openList = () => {
    setActiveIndex(
      Math.max(
        0,
        options.findIndex((o) => String(o.value) === String(value)),
      ),
    );
    setOpen(true);
  };
  const closeList = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openList();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeList();
    }
  };
  const handleOptionKey = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex(
        (index + (e.key === "ArrowDown" ? 1 : -1) + options.length) %
          options.length,
      );
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setActiveIndex(e.key === "Home" ? 0 : options.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(options[index].value);
      closeList();
    } else if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      closeList();
    }
  };

  return (
    <div
      className={`${s.wrap} ${fullWidth ? s.wrapFull : ""} ${className}`}
      style={minWidth ? { minWidth } : undefined}
      ref={wrapRef}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className={`${s.trigger} ${fullWidth ? s.triggerFull : ""} ${open ? s.triggerOpen : ""}`}
        onClick={() => {
          if (open) setOpen(false);
          else openList();
        }}
        onKeyDown={handleKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
      >
        <span className={s.triggerLabel}>{selected?.label ?? placeholder}</span>
        <svg
          className={`${s.chevron} ${open ? s.chevronOpen : ""}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          className={`${s.list} ${fullWidth ? s.listFull : ""} ${align === "left" ? s.listLeft : s.listRight} ${direction === "up" ? s.listUp : s.listDown}`}
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Options"
        >
          {options.map((opt, index) => {
            const isActive = String(opt.value) === String(value);
            return (
              <li
                key={opt.value}
                role="option"
                tabIndex={-1}
                onKeyDown={(e) => handleOptionKey(e, index)}
                aria-selected={isActive}
                className={`${s.item} ${isActive ? s.itemActive : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  closeList();
                }}
              >
                <span className={s.itemLabel}>{opt.label}</span>
                {isActive && (
                  <svg
                    className={s.check}
                    viewBox="0 0 16 16"
                    fill="currentColor"
                    aria-hidden="true"
                  >
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
