"use client";

import { useEffect, useRef } from "react";

export function useUnsavedChanges(active: boolean, value: unknown) {
  const state = useRef({ active: false, baseline: "", current: "" });
  const serialized = JSON.stringify(value);
  useEffect(() => {
    if (active && !state.current.active) state.current.baseline = serialized;
    state.current.active = active;
    state.current.current = serialized;
  }, [active, serialized]);
  const confirmDiscard = () =>
    !state.current.active ||
    state.current.baseline === state.current.current ||
    window.confirm("Discard your unsaved changes?");
  useEffect(() => {
    const hasChanges = () =>
      state.current.active && state.current.baseline !== state.current.current;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (hasChanges()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const beforeNavigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element | null)?.closest<HTMLAnchorElement>(
        "a[href]",
      );
      if (
        !link ||
        link.hasAttribute("download") ||
        link.target === "_blank" ||
        link.href === window.location.href
      )
        return;
      if (hasChanges() && !window.confirm("Discard your unsaved changes?")) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", beforeNavigate, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", beforeNavigate, true);
    };
  }, []);
  return confirmDiscard;
}
