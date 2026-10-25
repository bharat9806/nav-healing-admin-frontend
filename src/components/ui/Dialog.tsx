"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export default function Dialog({
  children,
  className,
  onClose,
  closeDisabled = false,
}: {
  children: ReactNode;
  className: string;
  onClose: () => void;
  closeDisabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  const disabledRef = useRef(closeDisabled);
  useEffect(() => {
    closeRef.current = onClose;
    disabledRef.current = closeDisabled;
  });
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const title = root.querySelector("h2, h3");
    if (title) {
      title.id ||= titleId;
      root.setAttribute("aria-labelledby", title.id);
    }
    const focusable = () =>
      [
        ...root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ),
      ].filter((el) => el.getClientRects().length > 0);
    const initial =
      focusable().find((el) =>
        /cancel|close/i.test(
          el.textContent || el.getAttribute("aria-label") || "",
        ),
      ) ||
      focusable()[0] ||
      root;
    initial.focus();
    const siblings = [...document.body.children].filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement &&
        el !== root &&
        !["SCRIPT", "STYLE"].includes(el.tagName),
    );
    const inertStates = siblings.map((el) => [el, el.inert] as const);
    siblings.forEach((el) => {
      el.inert = true;
    });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!disabledRef.current) closeRef.current();
      }
      if (event.key === "Tab") {
        const items = focusable();
        if (!items.length) {
          event.preventDefault();
          root.focus();
          return;
        }
        const first = items[0],
          last = items[items.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            !root.contains(document.activeElement))
        ) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            !root.contains(document.activeElement))
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      inertStates.forEach(([el, inert]) => {
        el.inert = inert;
      });
      if (previous?.isConnected) previous.focus();
    };
  }, [titleId]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Dialog"
      className={className}
      onClick={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
