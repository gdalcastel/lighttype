"use client";

import { useMemo, useState } from "react";
import { FONT_CATEGORIES } from "@/types";
import { FONT_CLASS } from "@/lib/fonts";
import { FontCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Font = {
  id: string;
  name: string;
  category: string;
};

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
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("popular");
  const preview = (sample.trim() || "GUILI").slice(0, 12);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fonts.filter((font) => {
      const matchesQuery = !q || font.name.toLowerCase().includes(q) || font.id.includes(q);
      const matchesCat = q ? true : font.category === category;
      return matchesQuery && matchesCat;
    });
  }, [fonts, query, category]);

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search styles"
        aria-label="Search fonts"
        className="h-11"
      />
      <div className="flex gap-1 overflow-x-auto pb-1">
        {FONT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              setCategory(cat.id);
              setQuery("");
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition",
              category === cat.id && !query
                ? "bg-foreground text-white"
                : "text-muted hover:bg-background hover:text-foreground",
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2.5">
        {visible.map((font) => (
          <FontCard
            key={font.id}
            selected={font.id === selectedId}
            onClick={() => onSelect(font.id)}
            aria-pressed={font.id === selectedId}
          >
            <p
              className={cn(
                "truncate text-[26px] leading-none tracking-tight text-foreground",
                FONT_CLASS[font.id],
              )}
            >
              {preview}
            </p>
            <p className="mt-3 text-[12px] text-muted">{font.name}</p>
          </FontCard>
        ))}
        {visible.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">No styles match that search.</p>
        ) : null}
      </div>
    </div>
  );
}
