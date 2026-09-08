"use client";

import { useEffect, useRef } from "react";
import { Trash2, X } from "lucide-react";
import { NumericSlider } from "@/components/ui/numeric-slider";
import { clampPopoverBox } from "@/lib/popover-layout";
import type { MountingHole } from "@/types";
import { cn } from "@/lib/utils";

type Anchor = { x: number; y: number };

export function HoleDimensionPopover({
  hole,
  letterDepthMm,
  anchor,
  containerSize,
  onChange,
  onRemove,
  onClose,
  className,
}: {
  hole: MountingHole;
  letterDepthMm: number;
  anchor: Anchor | null;
  containerSize: { width: number; height: number };
  onChange: (partial: Partial<MountingHole>) => void;
  onRemove: () => void;
  onClose: () => void;
  className?: string;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const maxCorner = Math.max(0, Math.min(hole.width_mm, hole.length_mm) / 2);
  const isCircle = hole.shape === "circle";
  const box = clampPopoverBox(anchor, containerSize, 248);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={popoverRef}
      className={cn(
        "pointer-events-auto absolute z-20 flex flex-col overflow-hidden rounded-[12px] border border-border bg-white/95 shadow-[0_12px_32px_rgba(34,34,34,0.12)] backdrop-blur",
        className,
      )}
      style={{ left: box.left, top: box.top, width: box.width, maxHeight: box.maxHeight }}
      role="dialog"
      aria-label={hole.name ? `Dimensões do furo ${hole.name}` : "Dimensões do furo"}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-3 pb-2.5 pt-3">
        <div>
          <p className="text-[13px] font-semibold text-foreground">
            {hole.name?.trim() || "Furo de montagem"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            Letra {hole.letter_index + 1} · {isCircle ? "circular" : "retangular"}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-surface hover:text-foreground"
          aria-label="Fechar"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]">
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {(["circle", "rect"] as const).map((shape) => (
            <button
              key={shape}
              type="button"
              onClick={() =>
                onChange({
                  shape,
                  length_mm: shape === "circle" ? hole.width_mm : Math.max(hole.length_mm, hole.width_mm),
                  corner_radius_mm:
                    shape === "circle" ? hole.width_mm / 2 : Math.min(hole.corner_radius_mm, maxCorner),
                })
              }
              aria-pressed={hole.shape === shape}
              className={cn(
                "rounded-[10px] border px-2.5 py-2 text-left transition",
                hole.shape === shape
                  ? "border-foreground/30 bg-background"
                  : "border-border hover:border-border-strong",
              )}
            >
              <p className="text-[12px] font-medium">{shape === "circle" ? "Circular" : "Retangular"}</p>
              <p className="text-[10px] text-muted">
                {shape === "circle" ? "Diâmetro" : "Largura × comprimento"}
              </p>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <NumericSlider
            compact
            label={isCircle ? "Diâmetro" : "Largura"}
            value={hole.width_mm}
            min={2}
            max={20}
            step={0.5}
            unit="mm"
            onChange={(width_mm) =>
              onChange(
                isCircle
                  ? { width_mm, length_mm: width_mm, corner_radius_mm: width_mm / 2 }
                  : { width_mm, corner_radius_mm: Math.min(hole.corner_radius_mm, width_mm / 2) },
              )
            }
          />
          {!isCircle ? (
            <>
              <NumericSlider
                compact
                label="Comprimento"
                value={hole.length_mm}
                min={2}
                max={30}
                step={0.5}
                unit="mm"
                onChange={(length_mm) =>
                  onChange({
                    length_mm,
                    corner_radius_mm: Math.min(
                      hole.corner_radius_mm,
                      Math.min(hole.width_mm, length_mm) / 2,
                    ),
                  })
                }
              />
              <NumericSlider
                compact
                label="Raio dos cantos"
                value={hole.corner_radius_mm}
                min={0}
                max={maxCorner}
                step={0.5}
                unit="mm"
                hint="0 = cantos retos"
                onChange={(corner_radius_mm) =>
                  onChange({ corner_radius_mm: Math.min(corner_radius_mm, maxCorner) })
                }
              />
            </>
          ) : null}
          <NumericSlider
            compact
            label="Profundidade"
            value={hole.depth_mm}
            min={1}
            max={Math.max(40, letterDepthMm + 2)}
            step={0.5}
            unit="mm"
            hint={hole.depth_mm >= letterDepthMm - 0.05 ? "Passante" : undefined}
            onChange={(depth_mm) => onChange({ depth_mm })}
          />
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-[10px] border border-border px-3 py-2 text-[12px] font-medium text-muted transition hover:border-accent/40 hover:bg-accent-soft hover:text-accent"
        >
          <Trash2 className="size-3.5" />
          Remover furo
        </button>
      </div>
    </div>
  );
}
