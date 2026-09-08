"use client";

import { Palette, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";

function ActionButton({
  label,
  onClick,
  children,
  active,
}: {
  label: string;
  onClick: (anchor: { clientX: number; clientY: number }) => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        onClick({
          clientX: rect.left + rect.width / 2,
          clientY: rect.bottom,
        });
      }}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full transition sm:size-8",
        active ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

/** DOM overlay — vertical icon stack beside the selected object. */
export function SelectionActionHandles({
  showColor,
  showDimensions,
  colorActive,
  dimensionsActive,
  onColor,
  onDimensions,
  style,
  className,
}: {
  showColor?: boolean;
  showDimensions?: boolean;
  colorActive?: boolean;
  dimensionsActive?: boolean;
  onColor?: (anchor: { clientX: number; clientY: number }) => void;
  onDimensions?: (anchor: { clientX: number; clientY: number }) => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  if (!showColor && !showDimensions) return null;

  return (
    <div
      className={cn(
        "pointer-events-auto flex flex-col items-center gap-0.5 rounded-full border border-white/10 bg-[#2a2c30]/95 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
        className,
      )}
      style={style}
      role="toolbar"
      aria-label="Ações da seleção"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {showColor && onColor ? (
        <ActionButton label="Cor" active={colorActive} onClick={onColor}>
          <Palette className="size-3.5" strokeWidth={1.75} />
        </ActionButton>
      ) : null}
      {showDimensions && onDimensions ? (
        <ActionButton label="Dimensões" active={dimensionsActive} onClick={onDimensions}>
          <Ruler className="size-3.5" strokeWidth={1.75} />
        </ActionButton>
      ) : null}
    </div>
  );
}
