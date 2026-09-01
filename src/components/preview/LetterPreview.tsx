"use client";

import dynamic from "next/dynamic";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreviewData } from "@/types";

const LetterScene = dynamic(() => import("./LetterScene").then((m) => m.LetterScene), {
  ssr: false,
  loading: () => <PreviewSkeleton />,
});

function PreviewSkeleton() {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center">
      <div className="h-10 w-10 animate-pulse rounded-full bg-border" />
    </div>
  );
}

const VIEWS = [
  { id: "front", label: "Front" },
  { id: "back", label: "Back" },
  { id: "side", label: "Side" },
] as const;

export function LetterPreview({
  data,
  depthMm,
  frontMm,
  showInterior,
  showLed,
  showBar,
  cameraView,
  onView,
  onToggle,
  compact = false,
  loading = false,
  error = null,
}: {
  data: PreviewData | null;
  depthMm: number;
  frontMm: number;
  showInterior: boolean;
  showLed: boolean;
  showBar: boolean;
  cameraView: "free" | "front" | "back" | "side" | "reset";
  onView?: (view: "front" | "back" | "side" | "reset") => void;
  onToggle?: (key: "showInterior" | "showLed" | "showBar", value: boolean) => void;
  compact?: boolean;
  loading?: boolean;
  error?: { message: string; suggestion?: string } | null;
}) {
  return (
    <div className="relative flex h-full min-h-[320px] flex-col overflow-hidden rounded-[24px] bg-[#f7f3ee]">
      <div className="absolute inset-0">
        {data && data.letters.length > 0 ? (
          <LetterScene
            data={data}
            depthMm={depthMm}
            frontMm={frontMm}
            showInterior={showInterior}
            showLed={showLed}
            showBar={showBar}
            cameraView={cameraView}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center">
            {error ? (
              <div>
                <p className="text-[16px] font-medium">{error.message}</p>
                {error.suggestion ? (
                  <p className="mt-2 text-[14px] text-muted">{error.suggestion}</p>
                ) : null}
              </div>
            ) : loading ? (
              <PreviewSkeleton />
            ) : (
              <div>
                <p className="text-[18px] font-medium tracking-tight">Type something to see your letters.</p>
                <p className="mt-2 text-[14px] text-muted">The 3D preview updates as you type.</p>
              </div>
            )}
          </div>
        )}
        {loading ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden">
            <div className="h-full w-1/3 animate-pulse bg-accent" />
          </div>
        ) : null}
      </div>

      {onView && data ? (
        <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-white/90 p-1 shadow-[0_8px_24px_rgba(34,34,34,0.06)] backdrop-blur">
            {VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => onView(view.id)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12px] font-medium transition",
                  cameraView === view.id ? "bg-foreground text-white" : "text-muted hover:text-foreground",
                )}
              >
                {view.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onView("reset")}
              className="flex size-8 items-center justify-center rounded-full text-muted hover:text-foreground"
              aria-label="Reset camera"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {onToggle && !compact ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-full border border-border bg-white/90 p-1 shadow-[0_8px_24px_rgba(34,34,34,0.06)] backdrop-blur">
            {(
              [
                ["showInterior", "Show interior", showInterior],
                ["showLed", "Show LED", showLed],
                ["showBar", "Show mounting bar", showBar],
              ] as const
            ).map(([key, label, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => onToggle(key, !value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12px] font-medium transition",
                  value ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
