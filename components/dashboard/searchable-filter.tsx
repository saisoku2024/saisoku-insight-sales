"use client";

import { useEffect, useRef, useState } from "react";

export type SearchableFilterOption = {
  value: string;
  label: string;
  sublabel?: string;
};

interface SearchableFilterProps {
  value: string;
  options: SearchableFilterOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  minChars?: number;
  minWidth?: number;
  ariaLabel?: string;
}

export function SearchableFilter({
  value,
  options,
  onChange,
  placeholder = "Search...",
  minChars = 3,
  minWidth = 200,
  ariaLabel,
}: SearchableFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [prevValue, setPrevValue] = useState(value);
  const [searchQuery, setSearchQuery] = useState(() => {
    if (!value) return "";
    return options.find((opt) => opt.value === value)?.label || "";
  });
  const ref = useRef<HTMLDivElement>(null);

  // Sync internal text when selected value prop changes
  if (prevValue !== value) {
    setPrevValue(value);
    if (!value) {
      setSearchQuery("");
    } else {
      const found = options.find((opt) => opt.value === value);
      if (found) setSearchQuery(found.label);
    }
  }

  // Click outside to close dropdown
  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const queryTrimmed = searchQuery.trim();
  const isThresholdMet = queryTrimmed.length >= minChars;

  // Filter options based on typed text
  const filteredOptions = isThresholdMet
    ? options.filter((opt) => {
        const q = queryTrimmed.toLowerCase();
        return (
          opt.label.toLowerCase().includes(q) ||
          (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
          opt.value.toLowerCase().includes(q)
        );
      })
    : [];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setSearchQuery(text);
    setIsOpen(true);

    // If user cleared text completely, reset filter
    if (!text.trim()) {
      onChange("");
    }
  };

  const handleSelectOption = (opt: SearchableFilterOption) => {
    setSearchQuery(opt.label);
    onChange(opt.value);
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearchQuery("");
    onChange("");
    setIsOpen(false);
  };

  return (
    <div ref={ref} className="relative" style={{ minWidth }}>
      <div className="relative flex items-center">
        <input
          type="text"
          aria-label={ariaLabel || placeholder}
          placeholder={placeholder}
          value={searchQuery}
          onFocus={() => setIsOpen(true)}
          onChange={handleInputChange}
          className="box-border h-11 w-full border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] pl-3 pr-9 text-xl leading-none text-[var(--insight-text)] shadow-[4px_4px_0_var(--insight-shadow)] outline-none transition focus:border-[var(--insight-blue)]"
        />

        {searchQuery ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3.5 flex h-6 w-6 items-center justify-center rounded-full text-base font-bold text-[var(--insight-muted)] hover:text-red-500"
            title="Clear filter"
          >
            ✕
          </button>
        ) : (
          <span className="pointer-events-none absolute right-3 text-base text-[var(--insight-muted)]">
            🔍
          </span>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-30 max-h-60 w-full overflow-y-auto border-[3px] border-[var(--insight-border)] bg-[var(--insight-panel)] shadow-[4px_4px_0_var(--insight-shadow)]">
          {/* Default Option to show All */}
          <button
            type="button"
            onClick={() => handleSelectOption({ value: "", label: placeholder })}
            className={`block w-full px-3 py-2 text-left text-lg leading-none border-b border-[var(--insight-border)]/20 hover:bg-blue-50 dark:hover:bg-slate-800/60 ${
              !value ? "font-bold text-[var(--insight-blue)]" : ""
            }`}
          >
            — {placeholder} (Semua) —
          </button>

          {!isThresholdMet ? (
            <div className="px-3 py-2.5 text-base text-[var(--insight-muted)] italic">
              Ketik min. {minChars} huruf untuk mencari...
            </div>
          ) : filteredOptions.length === 0 ? (
            <div className="px-3 py-2.5 text-base text-[var(--insight-muted)]">
              Tidak ada hasil yang cocok
            </div>
          ) : (
            filteredOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectOption(opt)}
                className={`block w-full px-3 py-2 text-left text-lg leading-none hover:bg-blue-50 dark:hover:bg-slate-800/60 ${
                  opt.value === value ? "bg-blue-100 font-semibold dark:bg-slate-700" : ""
                }`}
              >
                <div>{opt.label}</div>
                {opt.sublabel && (
                  <div className="text-xs text-[var(--insight-muted)] font-normal">
                    {opt.sublabel}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
