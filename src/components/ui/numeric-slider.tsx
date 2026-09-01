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
}: Props) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <label className="text-[13px] font-medium text-foreground">{label}</label>
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
            className="h-8 w-16 rounded-lg border border-border bg-surface px-2 text-right text-[13px] text-foreground focus:border-foreground/30 focus:outline-none"
            aria-label={label}
          />
          <span className="text-[12px]">{unit}</span>
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
