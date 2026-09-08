"use client";

import type { ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { PREVIEW_SIDE_PANEL_CLASS } from "@/lib/preview-side-rail";
import { cn } from "@/lib/utils";

function ZoomButton({
  label,
  onClick,
  compact,
  children,
}: {
  label: string;
  onClick: () => void;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white",
        compact ? "size-10" : "size-8",
      )}
    >
      {children}
    </button>
  );
}

export function PreviewZoomBar({
  zoom,
  onZoomChange,
  onZoomIn,
  onZoomOut,
  compact = false,
  className,
}: {
  zoom: number;
  onZoomChange: (value: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        PREVIEW_SIDE_PANEL_CLASS,
        "pointer-events-auto flex h-full max-h-[min(52vh,28rem)] flex-col items-center gap-1.5 p-1.5",
        compact ? "w-12" : "w-11",
        className,
      )}
      aria-label="Zoom"
    >
      <ZoomButton label="Aumentar zoom" onClick={onZoomIn} compact={compact}>
        <Plus className={compact ? "size-5" : "size-4"} strokeWidth={2} />
      </ZoomButton>

      <SliderPrimitive.Root
        className="relative flex min-h-0 w-full flex-1 touch-none select-none flex-col items-center py-1"
        orientation="vertical"
        min={0}
        max={100}
        step={1}
        value={[Math.round(zoom * 100)]}
        onValueChange={([value]) => onZoomChange(value / 100)}
        aria-label="Nível de zoom"
      >
        <SliderPrimitive.Track
          className={cn(
            "relative h-full overflow-hidden rounded-full bg-white/15",
            compact ? "w-1.5" : "w-1",
          )}
        >
          <SliderPrimitive.Range className="absolute w-full bg-white/70" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            "block rounded-full border border-white/25 bg-[#e8eaed] shadow-sm transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ab4f8]/40",
            compact ? "size-5" : "size-4",
          )}
        />
      </SliderPrimitive.Root>

      <ZoomButton label="Diminuir zoom" onClick={onZoomOut} compact={compact}>
        <Minus className={compact ? "size-5" : "size-4"} strokeWidth={2} />
      </ZoomButton>
    </div>
  );
}
