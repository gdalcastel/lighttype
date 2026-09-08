"use client";

import { useMemo, useState } from "react";
import { FONT_CATEGORIES } from "@/types";
import { FONT_CLASS } from "@/lib/fonts";
import { cn } from "@/lib/utils";

type Font = {
  id: string;
  name: string;
  category: string;
  description?: string;
};

const CATEGORIES = [{ id: "all", name: "Todas" }, ...FONT_CATEGORIES];

export function FontSelector({
  fonts,
  selectedId,
  sample,
  onSelect,
}: {
  fonts: Font[];
  selectedId: string;
  sample: string;
  onSelect: (id: string) => void;
}) {
  const [category, setCategory] = useState("all");
  const glyph = (sample.trim() || "A").slice(0, 2);

  const visible = useMemo(() => {
    if (category === "all") return fonts;
    return fonts.filter((font) => font.category === category);
  }, [fonts, category]);

  return (
    <div className="space-y-2">
      <div className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategory(cat.id)}
            className={cn(
              "min-h-9 shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition",
              category === cat.id
                ? "bg-foreground text-white"
                : "text-muted hover:bg-background hover:text-foreground",
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-1.5">
        {visible.map((font) => (
          <button
            key={font.id}
            type="button"
            title={`${font.name}${font.description ? ` — ${font.description}` : ""}`}
            onClick={() => onSelect(font.id)}
            aria-pressed={font.id === selectedId}
            className={cn(
              "flex h-12 items-center justify-center rounded-[12px] border transition sm:h-11 sm:rounded-[10px]",
              font.id === selectedId
                ? "border-foreground/30 bg-background shadow-[0_0_0_1px_rgba(34,34,34,0.08)]"
                : "border-border bg-surface hover:border-border-strong",
            )}
          >
            <span className={cn("truncate px-1 text-[20px] leading-none", FONT_CLASS[font.id])}>
              {glyph}
            </span>
          </button>
        ))}
        {visible.length === 0 ? (
          <p className="col-span-3 py-4 text-center text-[12px] text-muted">Nenhuma fonte</p>
        ) : null}
      </div>
    </div>
  );
}
