"use client";

import * as Switch from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

export function Toggle({
  checked,
  onCheckedChange,
  label,
  description,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span>
        <span className="block text-[14px] font-medium text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[12px] leading-5 text-muted">{description}</span>
        ) : null}
      </span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          "relative h-6 w-10 shrink-0 rounded-full border transition",
          checked ? "border-accent bg-accent" : "border-border bg-border",
        )}
        aria-label={label}
      >
        <Switch.Thumb
          className={cn(
            "block size-5 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform",
            checked && "translate-x-[18px]",
          )}
        />
      </Switch.Root>
    </label>
  );
}
