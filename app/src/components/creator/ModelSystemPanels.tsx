"use client";

import type { MaterialPackInfo, ModelPresetInfo, MountingSystemInfo } from "@/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  sign: "Letreiro",
  small: "Compacto",
  logo: "Logo",
};

export function ModelPresetPanel({
  presets,
  selectedId,
  onSelect,
}: {
  presets: ModelPresetInfo[];
  selectedId: string | null;
  onSelect: (preset: ModelPresetInfo) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
      {presets.map((p) => {
        const selected = selectedId === p.id;
        const mounting = p.ui?.mounting_label;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p)}
            aria-pressed={selected}
            className={cn(
              "group overflow-hidden rounded-[16px] border text-left transition active:scale-[0.99]",
              selected
                ? "border-accent/50 bg-accent/5 ring-1 ring-accent/25 shadow-[0_8px_24px_rgba(196,92,74,0.12)]"
                : "border-border bg-surface hover:border-border-strong hover:bg-background",
            )}
          >
            <div className="relative aspect-[16/10] overflow-hidden bg-[#efeae3]">
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image}
                  alt=""
                  className={cn(
                    "h-full w-full object-cover transition duration-300",
                    selected ? "scale-[1.02]" : "group-hover:scale-[1.03]",
                  )}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[11px] text-muted">
                  Sem imagem
                </div>
              )}
              <span className="absolute right-2 top-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted shadow-sm backdrop-blur">
                {CATEGORY_LABEL[p.category] ?? p.category}
              </span>
              {selected ? (
                <span className="absolute bottom-2 left-2 rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                  Selecionado
                </span>
              ) : null}
            </div>
            <div className="space-y-1 px-2.5 py-2.5 sm:px-3 sm:py-3">
              <p className="text-[13px] font-semibold leading-tight text-foreground sm:text-[14px]">{p.name}</p>
              <p className="text-[10px] leading-snug text-muted sm:text-[11px]">{p.subtitle}</p>
              {mounting ? (
                <p className="pt-0.5 text-[9px] font-medium uppercase tracking-[0.08em] text-muted-soft sm:text-[10px]">
                  Fixação · {mounting}
                </p>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function MaterialPackPanel({
  packs,
  selectedId,
  onSelect,
}: {
  packs: MaterialPackInfo[];
  selectedId: string;
  onSelect: (pack: MaterialPackInfo) => void;
}) {
  return (
    <div className="space-y-1.5">
      {packs.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p)}
          aria-pressed={selectedId === p.id}
          className={cn(
            "w-full rounded-[12px] border px-2.5 py-2 text-left transition",
            selectedId === p.id
              ? "border-foreground/30 bg-background"
              : "border-border hover:border-border-strong",
          )}
        >
          <p className="text-[12px] font-medium">{p.name}</p>
          <p className="text-[10px] text-muted">{p.subtitle}</p>
          {selectedId === p.id ? (
            <p className="mt-1 text-[10px] leading-snug text-muted">
              Corpo: {p.body} · Face: {p.face}
            </p>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** @deprecated Fixação agora vem embutida no modelo (passo 1). Mantido para compat. */
export function MountingSystemPanel({
  systems,
  selectedId,
  onSelect,
}: {
  systems: MountingSystemInfo[];
  selectedId: string;
  onSelect: (system: MountingSystemInfo) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {systems.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s)}
          aria-pressed={selectedId === s.id}
          className={cn(
            "rounded-[12px] border px-2.5 py-2 text-left transition",
            selectedId === s.id
              ? "border-foreground/30 bg-background"
              : "border-border hover:border-border-strong",
          )}
        >
          <p className="text-[12px] font-medium">{s.name}</p>
          <p className="text-[10px] text-muted">{s.subtitle}</p>
        </button>
      ))}
    </div>
  );
}
