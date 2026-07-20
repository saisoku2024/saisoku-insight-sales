"use client";

import { useEffect, useRef, useState } from "react";

type ToolbarSelectOption = { value: string; label: string };

export function ToolbarSelect({
  value,
  options,
  onChange,
  minWidth = 170,
  ariaLabel,
}: {
  value: string;
  options: ToolbarSelectOption[];
  onChange: (value: string) => void;
  minWidth?: number;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative" style={{ minWidth }}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((isOpen) => !isOpen)}
        className="flex box-border h-11 w-full items-center border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] px-3 pr-8 text-xl leading-none text-[var(--insight-text)] shadow-[4px_4px_0_var(--insight-shadow)] transition hover:-translate-y-0.5"
      >
        {current?.label}
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--insight-muted)]">
          v
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-20 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] shadow-[4px_4px_0_var(--insight-shadow)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`block w-full px-3 py-2 text-left text-xl leading-none hover:bg-blue-50 dark:hover:bg-slate-800/60 ${
                option.value === value ? "bg-blue-100 dark:bg-slate-700" : ""
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
