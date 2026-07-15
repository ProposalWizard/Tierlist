"use client";
import { useState, useRef, useMemo, useEffect } from "react";

interface Props {
  /** Comma-separated value (e.g. "France, Germany"). Kept as a string so it
   *  drops straight into the existing condition state. */
  value: string;
  onChange: (value: string) => void;
  /** Suggestion list — exact DB strings, so a picked token always matches. */
  options: string[];
  placeholder?: string;
  /** When true (default) an unrecognised typed value can still be added, shown
   *  amber to warn it may match no players. */
  allowFreeText?: boolean;
  /** Optional accent colour for chips/dropdown (tailwind hue name). */
  tone?: "emerald" | "red";
}

const TONES = {
  emerald: {
    chip: "bg-emerald-600/20 border-emerald-500/40 text-emerald-200",
    focus: "focus-within:border-emerald-500",
    active: "bg-emerald-600 text-white",
  },
  red: {
    chip: "bg-red-600/20 border-red-500/40 text-red-200",
    focus: "focus-within:border-red-500",
    active: "bg-red-600 text-white",
  },
};

function splitTokens(v: string): string[] {
  return v.split(",").map(s => s.trim()).filter(Boolean);
}

export default function TokenAutocomplete({
  value,
  onChange,
  options,
  placeholder,
  allowFreeText = true,
  tone = "emerald",
}: Props) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const t = TONES[tone];

  const tokens = useMemo(() => splitTokens(value), [value]);
  const tokenSet = useMemo(() => new Set(tokens.map(x => x.toLowerCase())), [tokens]);

  const lowerOptions = useMemo(
    () => options.map(o => ({ label: o, lower: o.toLowerCase() })),
    [options],
  );

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return lowerOptions
      .filter(o => o.lower.includes(q) && !tokenSet.has(o.lower))
      .slice(0, 8)
      .map(o => o.label);
  }, [text, lowerOptions, tokenSet]);

  // A token is "known" if it's a case-insensitive substring of at least one
  // option — mirrors the evaluator's own matching, so an unknown chip provably
  // matches nothing.
  const isKnown = (token: string) => {
    if (options.length === 0) return true; // vocab not loaded yet — don't cry wolf
    const tl = token.toLowerCase();
    return lowerOptions.some(o => o.lower.includes(tl));
  };

  const commit = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (!tokenSet.has(v.toLowerCase())) {
      onChange([...tokens, v].join(", "));
    }
    setText("");
    setOpen(false);
    setHighlight(0);
  };

  const removeAt = (i: number) => {
    onChange(tokens.filter((_, idx) => idx !== i).join(", "));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") ) {
      e.preventDefault();
      if (open && suggestions[highlight]) commit(suggestions[highlight]);
      else if (allowFreeText) commit(text);
      return;
    }
    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault(); setOpen(true);
      setHighlight(h => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === "Backspace" && !text && tokens.length) {
      removeAt(tokens.length - 1);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className={`flex flex-wrap items-center gap-1 bg-gray-700 border border-gray-600 rounded px-1.5 py-1 ${t.focus}`}>
        {tokens.map((tok, i) => {
          const known = isKnown(tok);
          return (
            <span
              key={`${tok}-${i}`}
              title={known ? undefined : "Not found in the player list — check the spelling (may match 0 players)"}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold border ${known ? t.chip : "bg-amber-500/15 border-amber-500/50 text-amber-300"}`}
            >
              {!known && <span aria-hidden>⚠</span>}
              {tok}
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="text-current/70 hover:text-white leading-none"
              >
                ×
              </button>
            </span>
          );
        })}
        <input
          type="text"
          value={text}
          onChange={e => { setText(e.target.value); setOpen(true); setHighlight(0); }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => { if (text.trim() && allowFreeText) commit(text); }}
          placeholder={tokens.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none py-0.5"
        />
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-gray-600 bg-gray-800 shadow-xl">
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={s}
              onMouseDown={(e) => { e.preventDefault(); commit(s); }}
              onMouseEnter={() => setHighlight(i)}
              className={`block w-full text-left px-3 py-1.5 text-xs font-medium transition ${i === highlight ? t.active : "text-gray-200 hover:bg-gray-700"}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
