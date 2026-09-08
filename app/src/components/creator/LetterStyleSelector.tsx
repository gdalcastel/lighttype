"use client";

import { useEffect, useMemo, useState } from "react";
import { LetterStylePreview3D } from "@/components/creator/LetterStylePreview3D";
import { letterStylePartCount } from "@/lib/letter-utils";
import { fetchAllLetterStylePreviews } from "@/lib/style-preview-cache";
import { cn } from "@/lib/utils";
import { DEFAULT_PROJECT, type LetterStyleInfo, type PreviewData } from "@/types";

export function LetterStyleSelector({
  styles,
  selectedId,
  onSelect,
  fontId,
  depthMm,
  frontMm,
  wallMm,
  wallProfileId,
}: {
  styles: LetterStyleInfo[];
  selectedId: string;
  onSelect: (id: string) => void;
  fontId: string;
  depthMm: number;
  frontMm: number;
  wallMm: number;
  wallProfileId: string;
}) {
  const [previews, setPreviews] = useState<Record<string, PreviewData>>({});
  const [loading, setLoading] = useState(true);

  const previewConfig = useMemo(
    () => ({
      ...DEFAULT_PROJECT,
      fontId,
      depthMm,
      frontMm,
      wallMm,
      wallProfileId,
    }),
    [depthMm, fontId, frontMm, wallMm, wallProfileId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchAllLetterStylePreviews(previewConfig, styles)
      .then((next) => {
        if (!cancelled) {
          setPreviews(next);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [previewConfig, styles]);

  return (
    <div className="grid grid-cols-2 gap-2">
      {styles.map((style) => {
        const preview = previews[style.id];
        const partCount = letterStylePartCount(style, depthMm, wallMm);

        return (
          <button
            key={style.id}
            type="button"
            onClick={() => onSelect(style.id)}
            aria-pressed={style.id === selectedId}
            disabled={!style.available}
            className={cn(
              "rounded-[12px] border p-2.5 text-left transition",
              style.id === selectedId
                ? "border-accent bg-accent-soft shadow-[0_0_0_1px_rgba(229,72,77,0.15)]"
                : "border-border bg-surface hover:border-border-strong",
              !style.available && "opacity-40",
            )}
          >
            {preview ? (
              <LetterStylePreview3D
                data={preview}
                style={style}
                depthMm={depthMm}
                frontMm={frontMm}
                wallMm={wallMm}
              />
            ) : (
              <div
                className={cn(
                  "h-[96px] w-full rounded-md bg-[#e4e9ef]",
                  loading && "animate-pulse",
                )}
                aria-hidden
              />
            )}
            <p className="mt-2 text-[11px] font-medium leading-tight text-foreground">{style.name}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted">{style.subtitle}</p>
            <p className="mt-0.5 text-[10px] leading-tight text-muted">
              {partCount} {partCount === 1 ? "peça" : "peças"} por letra
            </p>
          </button>
        );
      })}
    </div>
  );
}
