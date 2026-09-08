"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { PreviewData } from "@/types";
import { FONT_CLASS } from "@/lib/fonts";
import { cn } from "@/lib/utils";

function roundedRectPath(x: number, y: number, w: number, h: number, r: number) {
  const cr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (cr <= 0.01) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  return [
    `M ${x + cr} ${y}`,
    `H ${x + w - cr}`,
    `A ${cr} ${cr} 0 0 1 ${x + w} ${y + cr}`,
    `V ${y + h - cr}`,
    `A ${cr} ${cr} 0 0 1 ${x + w - cr} ${y + h}`,
    `H ${x + cr}`,
    `A ${cr} ${cr} 0 0 1 ${x} ${y + h - cr}`,
    `V ${y + cr}`,
    `A ${cr} ${cr} 0 0 1 ${x + cr} ${y}`,
    "Z",
  ].join(" ");
}

function MountingHoleOutline({
  hole,
  index,
}: {
  hole: PreviewData["mounting_holes"][number];
  index: number;
}) {
  const stroke = { fill: "none", stroke: "#1971c2", strokeWidth: 2.4 };
  if (hole.shape === "circle" || (hole.width_mm === hole.length_mm && hole.corner_radius_mm >= hole.width_mm / 2 - 0.05)) {
    return <circle key={`hole-${index}`} cx={hole.x} cy={hole.y} r={hole.width_mm / 2} {...stroke} />;
  }
  const x = hole.x - hole.width_mm / 2;
  const y = hole.y - hole.length_mm / 2;
  return (
    <path
      key={`hole-${index}`}
      d={roundedRectPath(x, y, hole.width_mm, hole.length_mm, hole.corner_radius_mm)}
      {...stroke}
    />
  );
}

export function Preview2D({
  data,
  fontId,
  className,
  collapsible = true,
}: {
  data: PreviewData | null;
  fontId: string;
  className?: string;
  /** When true (default), tapping the preview collapses it and shows Expandir. */
  collapsible?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (!data || data.letters.length === 0) return null;

  const [minx, miny, maxx, maxy] = data.bounds;
  const pad = 12;
  const w = maxx - minx + pad * 2;
  const h = maxy - miny + pad * 2;
  const layoutW = data.layout_width;
  const layoutH = data.layout_height;
  const glyph = (data.text.trim() || "A").split("\n")[0]?.slice(0, 2) ?? "A";

  if (collapsible && collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-[12px] border border-border bg-white px-3 py-2.5 text-left transition hover:border-border-strong active:bg-background",
          className,
        )}
        aria-expanded={false}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("shrink-0 text-[18px] leading-none", FONT_CLASS[fontId])}>{glyph}</span>
          <span className="truncate text-[12px] text-muted">
            W {layoutW.toFixed(1)} · H {layoutH.toFixed(1)} mm
          </span>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-white">
          Expandir
          <ChevronUp className="size-3.5" strokeWidth={2.25} />
        </span>
      </button>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-[12px] border border-border bg-white", className)}>
      {collapsible ? (
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="flex w-full items-center justify-between gap-2 border-b border-border/70 px-3 py-2 text-left transition hover:bg-background/60"
          aria-expanded
          aria-label="Recolher preview"
        >
          <span className="text-[11px] font-medium text-muted">Preview · toque para recolher</span>
          <ChevronDown className="size-4 text-muted" strokeWidth={2} />
        </button>
      ) : null}

      <button
        type="button"
        disabled={!collapsible}
        onClick={() => {
          if (collapsible) setCollapsed(true);
        }}
        className={cn(
          "block w-full p-3 text-left",
          collapsible && "cursor-pointer active:bg-background/40",
          !collapsible && "cursor-default",
        )}
        aria-label={collapsible ? "Recolher preview" : "Preview 2D"}
      >
        <svg
          viewBox={`${minx - pad} ${miny - pad} ${w} ${h}`}
          className="pointer-events-none mx-auto block w-full max-h-[120px]"
          aria-hidden
        >
          {data.shadow_cover?.outer.map((ring, ri) => (
            <polygon
              key={`shadow-${ri}`}
              points={ring.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="#8B5FBF33"
              stroke="#8B5FBF"
              strokeWidth={1.2}
            />
          ))}
          {data.shadow_cover?.holes.map((ring, ri) => (
            <polygon
              key={`shadow-hole-${ri}`}
              points={ring.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="#8B5FBF18"
              stroke="#8B5FBF"
              strokeWidth={0.9}
              strokeDasharray="3 2"
            />
          ))}
          {data.letters.map((letter) =>
            letter.outer.map((ring, ri) => (
              <polygon
                key={`${letter.index}-${ri}`}
                points={ring.map(([x, y]) => `${x},${y}`).join(" ")}
                fill="#f0f0f0"
                stroke="#333"
                strokeWidth={0.8}
              />
            )),
          )}
          {data.letters.map((letter) =>
            letter.holes.map((ring, ri) => (
              <polygon
                key={`h-${letter.index}-${ri}`}
                points={ring.map(([x, y]) => `${x},${y}`).join(" ")}
                fill="#fff"
                stroke="#333"
                strokeWidth={0.5}
              />
            )),
          )}
          {data.letters.map((letter) =>
            letter.connection_base?.groove?.outer.map((ring, ri) => (
              <polygon
                key={`groove-${letter.index}-${ri}`}
                points={ring.map(([x, y]) => `${x},${y}`).join(" ")}
                fill="#dbeafe"
                stroke="#2563eb"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            )),
          )}
          {data.letters.map((letter) =>
            letter.connection_base?.male_tab?.outer.map((ring, ri) => (
              <polygon
                key={`male-${letter.index}-${ri}`}
                points={ring.map(([x, y]) => `${x},${y}`).join(" ")}
                fill="#dcfce7"
                stroke="#16a34a"
                strokeWidth={1}
              />
            )),
          )}
          {data.letters.map((letter) =>
            letter.connection_base?.side_tunnels?.left.outer.map((ring, ri) => (
              <polygon
                key={`tunnel-l-${letter.index}-${ri}`}
                points={ring.map(([x, y]) => `${x},${y}`).join(" ")}
                fill="#fff7ed"
                stroke="#ea580c"
                strokeWidth={1.2}
                strokeDasharray="3 2"
              />
            )),
          )}
          {data.mounting_holes.map((hole, i) => (
            <MountingHoleOutline key={`hole-${i}`} hole={hole} index={i} />
          ))}
        </svg>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
          <span className={cn("text-[22px] leading-none whitespace-pre-line", FONT_CLASS[fontId])}>
            {glyph}
          </span>
          <div className="flex gap-3 tabular-nums">
            <span>
              W <strong className="text-foreground">{layoutW.toFixed(1)}</strong> mm
            </span>
            <span>
              H <strong className="text-foreground">{layoutH.toFixed(1)}</strong> mm
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}
