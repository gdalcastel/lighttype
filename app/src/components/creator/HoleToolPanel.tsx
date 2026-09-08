"use client";

import { BookmarkPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumericSlider } from "@/components/ui/numeric-slider";
import type { HoleShape, HoleTemplate, MountingHole } from "@/types";
import { cn } from "@/lib/utils";

function holeSizeLabel(hole: MountingHole) {
  if (hole.shape === "circle") return `Ø ${hole.width_mm} mm`;
  const corners =
    hole.corner_radius_mm > 0 ? ` · R ${hole.corner_radius_mm} mm` : " · cantos retos";
  return `${hole.width_mm} × ${hole.length_mm} mm${corners}`;
}

function templateSizeLabel(template: HoleTemplate) {
  if (template.shape === "circle") return `Ø ${template.width_mm} mm`;
  const corners =
    template.corner_radius_mm > 0 ? ` · R ${template.corner_radius_mm} mm` : " · cantos retos";
  return `${template.width_mm} × ${template.length_mm} mm${corners}`;
}

export function HoleToolPanel({
  holes,
  templates,
  shape,
  width,
  length,
  depth,
  cornerRadius,
  name,
  onShape,
  onWidth,
  onLength,
  onDepth,
  onCornerRadius,
  onName,
  onSaveTemplate,
  onApplyTemplate,
  onRemoveTemplate,
  onRemove,
}: {
  holes: MountingHole[];
  templates: HoleTemplate[];
  shape: HoleShape;
  width: number;
  length: number;
  depth: number;
  cornerRadius: number;
  name: string;
  onShape: (shape: HoleShape) => void;
  onWidth: (v: number) => void;
  onLength: (v: number) => void;
  onDepth: (v: number) => void;
  onCornerRadius: (v: number) => void;
  onName: (name: string) => void;
  onSaveTemplate: () => void;
  onApplyTemplate: (id: string) => void;
  onRemoveTemplate: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const maxCorner = Math.max(0, Math.min(width, length) / 2);

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed text-muted">
        Passe o mouse sobre a peça na vista traseira e clique para adicionar furos de montagem com a
        configuração abaixo.
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        {(["circle", "rect"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onShape(s)}
            aria-pressed={shape === s}
            className={cn(
              "rounded-[10px] border px-2.5 py-2 text-left transition",
              shape === s
                ? "border-foreground/30 bg-background"
                : "border-border hover:border-border-strong",
            )}
          >
            <p className="text-[12px] font-medium">{s === "circle" ? "Circular" : "Retangular"}</p>
            <p className="text-[10px] text-muted">
              {s === "circle" ? "Furo redondo" : "Largura × comprimento"}
            </p>
          </button>
        ))}
      </div>

      <NumericSlider
        compact
        label={shape === "circle" ? "Diâmetro" : "Largura"}
        value={width}
        min={2}
        max={20}
        step={0.5}
        unit="mm"
        onChange={onWidth}
      />
      {shape === "rect" ? (
        <>
          <NumericSlider
            compact
            label="Comprimento"
            value={length}
            min={2}
            max={30}
            step={0.5}
            unit="mm"
            onChange={onLength}
          />
          <NumericSlider
            compact
            label="Raio dos cantos"
            value={cornerRadius}
            min={0}
            max={maxCorner}
            step={0.5}
            unit="mm"
            hint="0 = cantos retos"
            onChange={(v) => onCornerRadius(Math.min(v, maxCorner))}
          />
        </>
      ) : null}
      <NumericSlider
        compact
        label="Profundidade"
        value={depth}
        min={1}
        max={40}
        step={0.5}
        unit="mm"
        onChange={onDepth}
      />

      <div className="space-y-1.5 border-t border-border pt-3">
        <label className="text-[12px] font-medium text-foreground" htmlFor="hole-name">
          Nome do furo
        </label>
        <div className="flex gap-1.5">
          <input
            id="hole-name"
            type="text"
            value={name}
            maxLength={48}
            placeholder="Ex: furo M4, parafuso lateral…"
            onChange={(e) => onName(e.target.value)}
            className="h-8 min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 text-[12px] text-foreground placeholder:text-muted focus:border-foreground/30 focus:outline-none"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 px-2.5"
            onClick={onSaveTemplate}
            disabled={!name.trim()}
            title="Salvar modelo para reutilizar"
          >
            <BookmarkPlus className="size-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted">
          Dê um nome e salve o modelo para aplicar as mesmas dimensões em novos furos.
        </p>
      </div>

      {templates.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Modelos salvos ({templates.length})
          </p>
          {templates.map((template) => (
            <div
              key={template.id}
              className="flex items-center gap-2 rounded-[10px] border border-border bg-background px-2.5 py-2"
            >
              <button
                type="button"
                onClick={() => onApplyTemplate(template.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-[12px] font-medium">{template.name}</p>
                <p className="text-[10px] text-muted">
                  {templateSizeLabel(template)} · {template.depth_mm} mm prof.
                </p>
              </button>
              <button
                type="button"
                aria-label="Remover modelo"
                onClick={() => onRemoveTemplate(template.id)}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-accent-soft hover:text-accent"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {holes.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            Furos ({holes.length})
          </p>
          {holes.map((hole) => (
            <div
              key={hole.id}
              className="flex items-center gap-2 rounded-[10px] border border-border bg-background px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium">
                  {hole.name?.trim() || `(${hole.x.toFixed(1)}, ${hole.y.toFixed(1)}) mm`}
                </p>
                <p className="text-[10px] text-muted">
                  {hole.name?.trim()
                    ? `(${hole.x.toFixed(1)}, ${hole.y.toFixed(1)}) mm · `
                    : ""}
                  {holeSizeLabel(hole)} · {hole.depth_mm} mm prof. ·{" "}
                  {hole.face === "back" ? "Fundo" : "Corpo"}
                </p>
              </div>
              <button
                type="button"
                aria-label="Remover furo"
                onClick={() => onRemove(hole.id)}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-accent-soft hover:text-accent"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted">Nenhum furo adicionado.</p>
      )}
    </div>
  );
}
