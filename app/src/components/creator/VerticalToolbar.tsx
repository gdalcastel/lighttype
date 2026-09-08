"use client";

import { Download, Layers, PenLine, SlidersHorizontal } from "lucide-react";
import { CREATOR_STEPS, type PanelId } from "@/types";
import { cn } from "@/lib/utils";

const ICONS: Record<PanelId, typeof PenLine> = {
  type: Layers,
  content: PenLine,
  tune: SlidersHorizontal,
  export: Download,
};

export function VerticalToolbar({
  active,
  onSelect,
  completed,
}: {
  active: PanelId;
  onSelect: (panel: PanelId) => void;
  /** Steps already satisfied (e.g. type chosen, has text). */
  completed?: Partial<Record<PanelId, boolean>>;
}) {
  const activeIdx = CREATOR_STEPS.findIndex((s) => s.id === active);

  return (
    <nav
      className={cn(
        "z-30 shrink-0 border-border bg-surface",
        /* Mobile: bottom tab bar */
        "order-last flex w-full items-stretch justify-around border-t px-1 pt-1",
        "pb-[max(0.35rem,var(--safe-bottom))]",
        /* Desktop: left rail */
        "md:order-first md:w-[58px] md:flex-col md:items-center md:justify-start md:gap-1 md:border-t-0 md:border-r md:px-0 md:py-4 md:pb-4",
      )}
      aria-label="Fluxo do creator"
    >
      <p className="mb-2 hidden px-1 text-center text-[9px] font-medium uppercase tracking-[0.14em] text-muted md:block">
        Fluxo
      </p>
      {CREATOR_STEPS.map(({ id, label, short }, index) => {
        const Icon = ICONS[id];
        const isActive = active === id;
        const isDone = Boolean(completed?.[id]) || index < activeIdx;
        return (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            title={label}
            onClick={() => onSelect(id)}
              className={cn(
                "group relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-[12px] px-0.5 py-1.5 transition-all duration-200",
                "md:w-11 md:flex-none md:min-h-0 md:px-1",
                isActive
                  ? "bg-accent/10 text-accent md:bg-accent md:text-white md:shadow-[0_2px_8px_rgba(229,72,77,0.35)]"
                  : "text-muted active:bg-background hover:bg-background hover:text-foreground",
              )}
            >
              <Icon
                className={cn("size-5 md:size-[15px]", isActive && "md:text-white")}
                strokeWidth={isActive ? 2 : 1.65}
              />
              <span
                className={cn(
                  "max-w-full truncate px-0.5 text-center text-[9px] font-medium leading-tight md:text-[9px]",
                  isActive ? "text-accent md:text-white/90" : "text-muted group-hover:text-foreground",
                )}
              >
                {short}
              </span>
            {isDone && !isActive ? (
              <span className="absolute top-1.5 right-[18%] size-1.5 rounded-full bg-accent md:hidden" aria-hidden />
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
