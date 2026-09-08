"use client";

import { NumericSlider } from "@/components/ui/numeric-slider";
import { Toggle } from "@/components/ui/toggle";
import type { WallProfileInfo } from "@/types";
import { cn } from "@/lib/utils";

export function WallProfilePanel({
  profiles,
  profileId,
  friezeCount,
  friezeAdvanceMm,
  friezeSpacingMm,
  shelfRatio,
  shelfStepMm,
  close45Base,
  inclinationMm,
  maxAngleDeg,
  onChange,
}: {
  profiles: WallProfileInfo[];
  profileId: string;
  friezeCount: number;
  friezeAdvanceMm: number;
  friezeSpacingMm: number;
  shelfRatio: number;
  shelfStepMm: number;
  close45Base: boolean;
  inclinationMm: number;
  maxAngleDeg: number;
  onChange: (partial: Record<string, unknown>) => void;
}) {
  const isFrieze = profileId === "frieze";
  const isShelf = profileId === "shelf";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange({ wallProfileId: p.id })}
            aria-pressed={profileId === p.id}
            className={cn(
              "rounded-[10px] border px-2.5 py-2 text-left transition",
              profileId === p.id
                ? "border-foreground/30 bg-background"
                : "border-border hover:border-border-strong",
            )}
          >
            <p className="text-[12px] font-medium">{p.name}</p>
            <p className="text-[10px] text-muted">{p.subtitle}</p>
          </button>
        ))}
      </div>

      {isShelf ? (
        <div className="space-y-3 border-t border-border pt-3">
          <NumericSlider
            compact
            label="Altura da prateleira"
            value={Math.round(shelfRatio * 100)}
            min={35}
            max={75}
            step={1}
            unit="%"
            onChange={(pct) => onChange({ shelfRatio: pct / 100 })}
          />
          <NumericSlider
            compact
            label="Degrau da prateleira"
            value={shelfStepMm}
            min={0.4}
            max={2.5}
            step={0.1}
            unit="mm"
            onChange={(shelfStepMm) => onChange({ shelfStepMm })}
          />
          <p className="text-[11px] leading-snug text-muted">
            Parede mais grossa na zona do LED e mais fina no bolso da face, formando o assento.
          </p>
        </div>
      ) : null}

      {isFrieze ? (
        <div className="space-y-3 border-t border-border pt-3">
          <NumericSlider
            compact
            label="Quantidade de frisos"
            value={friezeCount}
            min={1}
            max={6}
            step={1}
            onChange={(friezeCount) => onChange({ friezeCount })}
          />
          <NumericSlider
            compact
            label="Avanço do friso"
            value={friezeAdvanceMm}
            min={0.5}
            max={4}
            step={0.1}
            unit="mm"
            onChange={(friezeAdvanceMm) => onChange({ friezeAdvanceMm })}
          />
          <NumericSlider
            compact
            label="Espaço entre frisos"
            value={friezeSpacingMm}
            min={0.5}
            max={6}
            step={0.1}
            unit="mm"
            onChange={(friezeSpacingMm) => onChange({ friezeSpacingMm })}
          />
          <Toggle
            label="Fechar em 45° na base"
            checked={close45Base}
            onCheckedChange={(close45Base) => onChange({ close45Base })}
          />
          <NumericSlider
            compact
            label="Inclinação"
            value={inclinationMm}
            min={0}
            max={8}
            step={0.5}
            unit="mm"
            onChange={(inclinationMm) => onChange({ inclinationMm })}
          />
          <NumericSlider
            compact
            label="Ângulo máximo"
            value={maxAngleDeg}
            min={20}
            max={60}
            step={1}
            unit="°"
            onChange={(maxAngleDeg) => onChange({ maxAngleDeg })}
          />
        </div>
      ) : null}
    </div>
  );
}
