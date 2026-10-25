"use client";

import { useId, useState, type KeyboardEvent } from "react";

export function useComboboxKeyboard<T>({
  open,
  setOpen,
  options,
  onSelect,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  options: T[];
  onSelect: (value: T) => void;
}) {
  const id = useId();
  const [active, setActive] = useState(-1);
  const choose = (index: number) => {
    if (index >= 0 && index < options.length) {
      onSelect(options[index]);
      setOpen(false);
      setActive(-1);
    }
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      if (options.length)
        setActive((value) =>
          event.key === "ArrowDown"
            ? (value + 1) % options.length
            : value <= 0
              ? options.length - 1
              : value - 1,
        );
    } else if (open && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : options.length - 1);
    } else if (
      open &&
      event.key === "Enter" &&
      active >= 0 &&
      active < options.length
    ) {
      event.preventDefault();
      choose(active);
    } else if (open && event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setActive(-1);
    } else if (event.key === "Tab") {
      setOpen(false);
      setActive(-1);
    }
  };
  return {
    inputProps: {
      id: `${id}-input`,
      role: "combobox" as const,
      "aria-autocomplete": "list" as const,
      "aria-expanded": open,
      "aria-controls": open ? id : undefined,
      "aria-activedescendant":
        open && active >= 0 && active < options.length
          ? `${id}-${active}`
          : undefined,
      onKeyDown,
    },
    listProps: {
      id,
      role: "listbox" as const,
      "aria-label": "Product results",
    },
    optionProps: (index: number) => ({
      id: `${id}-${index}`,
      role: "option" as const,
      "aria-selected": index === active,
      onMouseMove: () => setActive(index),
    }),
  };
}
