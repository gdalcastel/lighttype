"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { NumericSlider } from "@/components/ui/numeric-slider";
import { clampPopoverBox } from "@/lib/popover-layout";
import type { LetterOffset, PreviewLetter } from "@/types";
import { cn } from "@/lib/utils";

type Anchor = { x: number; y: number };

export function PieceDimensionPopover({
  letter,
  offset,
  depthMm,
  wallMm,
  anchor,
  containerSize,
  selectionCount = 1,
  onOffset,
  onDepth,
  onWall,
  onClose,
  className,
}: {
  letter: PreviewLetter;
  offset: LetterOffset;
  depthMm: number;
  wallMm: number;
  anchor: Anchor | null;
  containerSize: { width: number; height: number };
  selectionCount?: number;
  onOffset: (partial: Partial<LetterOffset>) => void;
  onDepth: (depthMm: number) => void;
  onWall: (wallMm: number) => void;
  onClose: () => void;
  className?: string;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const pieceW = letter.bounds[2] - letter.bounds[0];
  const pieceH = letter.bounds[3] - letter.bounds[1];
  const box = clampPopoverBox(anchor, containerSize, 248);
  const multi = selectionCount > 1;

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
      aria-label={multi ? `Dimensões de ${selectionCount} peças` : `Dimensões da peça ${letter.char}`}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-3 pb-2.5 pt-3">
        <div>
          <p className="text-[13px] font-semibold text-foreground">
            {multi ? `${selectionCount} peças` : `Peça “${letter.char}”`}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {multi
              ? "Posição relativa · profundidade e parede em todas"
              : `Letra ${letter.index + 1}`}
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
        {!multi ? (
          <div className="mb-3 grid grid-cols-3 gap-2 rounded-[10px] bg-surface px-2.5 py-2 tabular-nums">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted">Larg.</p>
              <p className="text-[13px] font-medium">{pieceW.toFixed(1)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted">Alt.</p>
              <p className="text-[13px] font-medium">{pieceH.toFixed(1)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-wide text-muted">Prof.</p>
              <p className="text-[13px] font-medium">{depthMm.toFixed(1)}</p>
            </div>
          </div>
        ) : (
          <div className="mb-3 rounded-[10px] bg-surface px-2.5 py-2 text-center">
            <p className="text-[11px] text-muted">
              Ajuste X/Y move todas juntas · Prof./Parede valem para o projeto
            </p>
          </div>
        )}

        <div className="space-y-3 pb-1">
          <NumericSlider
            compact
            label={multi ? "Deslocar X" : "Posição X"}
            value={offset.x}
            min={-80}
            max={80}
            step={0.5}
            unit="mm"
            onChange={(x) => onOffset({ x })}
          />
          <NumericSlider
            compact
            label={multi ? "Deslocar Y" : "Posição Y"}
            value={offset.y}
            min={-80}
            max={80}
            step={0.5}
            unit="mm"
            onChange={(y) => onOffset({ y })}
          />
          <NumericSlider
            compact
            label="Profundidade"
            value={depthMm}
            min={12}
            max={64}
            step={0.5}
            unit="mm"
            onChange={onDepth}
          />
          <NumericSlider
            compact
            label="Parede"
            value={wallMm}
            min={1}
            max={5}
            step={0.1}
            unit="mm"
            onChange={onWall}
          />
        </div>
      </div>
    </div>
  );
}
