"use client";

import { useEffect, useRef } from "react";
import { RotateCcw, X } from "lucide-react";
import { defaultPartColor, letterStylePreviewParams, resolvePartColor } from "@/lib/letter-utils";
import { clampPopoverBox } from "@/lib/popover-layout";
import type { LetterStyleInfo, PreviewLetter, SelectedLetterPart } from "@/types";
import { LETTER_PART_LABELS } from "@/types";
import { cn } from "@/lib/utils";

type Anchor = { x: number; y: number };

const PRESET_COLORS = [
  "#c8c8c8",
  "#a0a0a0",
  "#888888",
  "#666666",
  "#b8e986",
  "#90c870",
  "#ffffff",
  "#ffe29a",
  "#4488ff",
  "#e5484d",
  "#1a1a1a",
];

export function PartColorPopover({
  selection,
  letter,
  letterStyle,
  depthMm,
  wallMm,
  partColors,
  anchor,
  containerSize,
  onColorChange,
  onResetColor,
  onClose,
  assembled = false,
  selectionCount = 1,
  className,
}: {
  selection: SelectedLetterPart;
  letter: PreviewLetter;
  letterStyle?: LetterStyleInfo;
  depthMm: number;
  wallMm: number;
  partColors: Record<string, string>;
  anchor: Anchor | null;
  containerSize: { width: number; height: number };
  onColorChange: (color: string) => void;
  onResetColor: () => void;
  onClose: () => void;
  /** When true, color applies to the whole letter (assembled selection). */
  assembled?: boolean;
  /** Number of letters/parts receiving this color change. */
  selectionCount?: number;
  className?: string;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const styleParams = letterStylePreviewParams(letterStyle, depthMm, wallMm);
  const currentColor = resolvePartColor(selection.letterIndex, selection.part, partColors, styleParams);
  const defaultColor = defaultPartColor(selection.part, styleParams);
  const partLabel = LETTER_PART_LABELS[selection.part];
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
      aria-label={
        multi
          ? assembled
            ? `Cor de ${selectionCount} letras`
            : `Cor de ${selectionCount} peças`
          : assembled
            ? `Cor da letra ${letter.char}`
            : `Cor da peça ${partLabel}`
      }
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border/60 px-3 pb-2.5 pt-3">
        <div>
          <p className="text-[13px] font-semibold text-foreground">
            {multi
              ? assembled
                ? `${selectionCount} letras`
                : `${selectionCount} peças`
              : assembled
                ? `Letra “${letter.char}”`
                : `${partLabel} · “${letter.char}”`}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">
            {multi
              ? "Cor aplicada a toda a seleção"
              : `Letra ${letter.index + 1}${assembled ? " · peça inteira" : " · vista desmontada"}`}
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
        <div className="mb-3 flex items-center gap-3 rounded-[10px] bg-surface px-2.5 py-2.5">
          <label className="relative block size-10 shrink-0 cursor-pointer overflow-hidden rounded-[8px] border border-border shadow-inner">
            <span className="block size-full" style={{ background: currentColor }} />
            <input
              type="color"
              value={currentColor}
              onChange={(e) => onColorChange(e.target.value)}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              aria-label="Selecionar cor"
            />
          </label>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-muted">Cor</p>
            <input
              type="text"
              value={currentColor}
              onChange={(e) => {
                const value = e.target.value.trim();
                if (/^#[0-9a-fA-F]{6}$/.test(value)) onColorChange(value);
              }}
              className="mt-0.5 w-full bg-transparent font-mono text-[13px] uppercase text-foreground outline-none"
              spellCheck={false}
            />
          </div>
          <button
            type="button"
            onClick={onResetColor}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-white hover:text-foreground"
            aria-label="Restaurar cor padrão"
            title={`Padrão ${defaultColor}`}
          >
            <RotateCcw className="size-3.5" />
          </button>
        </div>

        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted">Presets</p>
        <div className="grid grid-cols-6 gap-1.5 pb-1">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onColorChange(color)}
              className={cn(
                "aspect-square rounded-[6px] border transition hover:scale-105",
                currentColor.toLowerCase() === color.toLowerCase()
                  ? "border-accent ring-2 ring-accent/20"
                  : "border-border",
              )}
              style={{ background: color }}
              aria-label={`Cor ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
