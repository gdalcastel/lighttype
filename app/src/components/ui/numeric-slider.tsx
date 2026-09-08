"use client";

import { Slider } from "@/components/ui/slider";

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  hint?: string;
  compact?: boolean;
};

export function NumericSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "mm",
  onChange,
  hint,
  compact = false,
}: Props) {
  return (
    <div className={compact ? "space-y-1.5" : "space-y-2.5"}>
      <div className="flex items-baseline justify-between gap-3">
        <label className={compact ? "text-[12px] font-medium text-foreground" : "text-[13px] font-medium text-foreground"}>
          {label}
        </label>
        <div className="flex items-center gap-1.5 text-muted">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={Number.isFinite(value) ? value : min}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isNaN(next)) return;
              onChange(Math.min(max, Math.max(min, next)));
            }}
            className={
              compact
                ? "h-8 w-14 rounded-md border border-border bg-surface px-1.5 text-right text-[12px] text-foreground focus:border-foreground/30 focus:outline-none"
                : "h-10 w-[4.25rem] rounded-lg border border-border bg-surface px-2 text-right text-[13px] text-foreground focus:border-foreground/30 focus:outline-none sm:h-8 sm:w-16"
            }
            aria-label={label}
          />
          <span className="text-[11px]">{unit}</span>
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
      {hint ? <p className="text-[12px] leading-5 text-muted">{hint}</p> : null}
    </div>
  );
}
