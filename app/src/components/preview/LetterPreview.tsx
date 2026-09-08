"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Eye,
  Grid3x3,
  Group,
  Layers3,
  Lightbulb,
  RotateCcw,
  SplitSquareVertical,
  Square,
  Ungroup,
} from "lucide-react";
import { CrossSectionView } from "@/components/creator/CrossSectionView";
import { PreviewZoomBar } from "@/components/creator/PreviewZoomBar";
import { HoleDimensionPopover } from "@/components/creator/HoleDimensionPopover";
import { PartColorPopover } from "@/components/creator/PartColorPopover";
import { PieceDimensionPopover } from "@/components/creator/PieceDimensionPopover";
import { ViewerToolToggle } from "@/components/creator/ViewerToolToggle";
import { SelectionActionHandles } from "@/components/preview/SelectionActionHandles";
import { Tooltip } from "@/components/ui/tooltip";
import type { LetterSceneHandle } from "@/components/preview/LetterScene";
import {
  PREVIEW_SIDE_INSET_X,
  PREVIEW_SIDE_INSET_Y,
  PREVIEW_SIDE_PANEL_HEIGHT,
  PREVIEW_SIDE_PANEL_WIDTH,
} from "@/lib/preview-side-rail";
import { cn } from "@/lib/utils";
import { partColorKey } from "@/lib/letter-utils";
import type {
  CameraView,
  HoleShape,
  LetterOffset,
  LetterStyleInfo,
  MountingHole,
  PreviewData,
  SelectedLetterPart,
} from "@/types";

const BAMBU_CAMERA_SHORTCUTS: Record<string, Exclude<CameraView, "free">> = {
  "0": "reset",
  "1": "front",
  "2": "back",
  "3": "plateFront",
  "4": "plateBack",
  "5": "left",
  "6": "right",
};

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
  { id: "front", label: "Topo" },
  { id: "back", label: "Base" },
  { id: "plateFront", label: "Frente" },
  { id: "side", label: "Lateral" },
] as const;

type ActivePopover = "color" | "dimensions" | "hole" | null;

export function LetterPreview({
  data,
  letterStyle,
  depthMm,
  frontMm,
  wallMm,
  wallProfileId,
  showInterior,
  showLed,
  showGrid,
  showPlane,
  showCrossSection,
  explodedView,
  explodedFactor,
  mountingHoles,
  holeToolActive,
  pendingHole,
  selectedLetterIndices,
  selectedParts,
  partColors,
  partOffsets,
  letterOffsets,
  onView,
  onToggleExploded,
  onToggle,
  onAddHole,
  onUpdateHole,
  onRemoveHole,
  onViewerToolChange,
  onSelectLetter,
  onSelectPart,
  onDeselectLetter,
  onOffsetChange,
  onDepthChange,
  onWallChange,
  onPartColorChange,
  onResetPartColor,
  onDragPart,
  onDragLetter,
  cameraView,
  compact = false,
  loading = false,
  error = null,
  className,
}: {
  data: PreviewData | null;
  letterStyle?: LetterStyleInfo;
  depthMm: number;
  frontMm: number;
  wallMm: number;
  wallProfileId: string;
  showInterior: boolean;
  showLed: boolean;
  showGrid: boolean;
  showPlane: boolean;
  showCrossSection: boolean;
  explodedView: boolean;
  explodedFactor: number;
  mountingHoles: MountingHole[];
  holeToolActive: boolean;
  pendingHole?: {
    shape: HoleShape;
    width_mm: number;
    length_mm: number;
    depth_mm: number;
    corner_radius_mm: number;
  };
  selectedLetterIndices: number[];
  selectedParts: SelectedLetterPart[];
  partColors: Record<string, string>;
  partOffsets: Record<string, LetterOffset>;
  letterOffsets: Record<number, LetterOffset>;
  cameraView: CameraView;
  onView?: (view: Exclude<CameraView, "free">) => void;
  onToggleExploded?: () => void;
  onToggle?: (
    key: "showInterior" | "showLed" | "showGrid" | "showPlane" | "showCrossSection",
    value: boolean,
  ) => void;
  onAddHole?: (x: number, y: number, letterIndex: number) => void;
  onUpdateHole?: (id: string, partial: Partial<MountingHole>) => void;
  onRemoveHole?: (id: string) => void;
  onViewerToolChange?: (tool: "select" | "hole") => void;
  onSelectLetter?: (index: number, options?: { additive?: boolean }) => void;
  onSelectPart?: (selection: SelectedLetterPart, options?: { additive?: boolean }) => void;
  onDeselectLetter?: () => void;
  onOffsetChange?: (index: number, partial: Partial<LetterOffset>) => void;
  onDepthChange?: (depthMm: number) => void;
  onWallChange?: (wallMm: number) => void;
  onPartColorChange?: (selection: SelectedLetterPart, color: string) => void;
  onResetPartColor?: (selection: SelectedLetterPart) => void;
  onDragPart?: (letterIndex: number, part: SelectedLetterPart["part"], x: number, y: number) => void;
  onDragLetter?: (index: number, x: number, y: number) => void;
  compact?: boolean;
  loading?: boolean;
  error?: { message: string; suggestion?: string } | null;
  className?: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LetterSceneHandle>(null);
  const [pixelRatio, setPixelRatio] = useState(1.5);
  const [previewZoom, setPreviewZoom] = useState(0.5);
  const [popoverAnchor, setPopoverAnchor] = useState<{ x: number; y: number } | null>(null);
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [selectedHoleId, setSelectedHoleId] = useState<string | null>(null);
  const [selectionHud, setSelectionHud] = useState<{ x: number; y: number; visible: boolean } | null>(
    null,
  );
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const setAnchorFromClient = useCallback((anchor: { clientX: number; clientY: number }) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    setPopoverAnchor({
      x: anchor.clientX - rect.left,
      y: anchor.clientY - rect.top,
    });
  }, []);

  const handleSelectLetter = useCallback(
    (index: number, options?: { additive?: boolean }) => {
      setSelectedHoleId(null);
      setActivePopover(null);
      onSelectLetter?.(index, options);
    },
    [onSelectLetter],
  );

  const handleSelectPart = useCallback(
    (selection: SelectedLetterPart, options?: { additive?: boolean }) => {
      setSelectedHoleId(null);
      setActivePopover(null);
      onSelectPart?.(selection, options);
    },
    [onSelectPart],
  );

  const handleDeselect = useCallback(() => {
    setPopoverAnchor(null);
    setActivePopover(null);
    setSelectedHoleId(null);
    setSelectionHud(null);
    onDeselectLetter?.();
  }, [onDeselectLetter]);

  const handleSelectionHud = useCallback(
    (pos: { x: number; y: number; visible: boolean } | null) => {
      setSelectionHud(pos);
    },
    [],
  );

  const handleOpenColorPopover = useCallback(
    (anchor: { clientX: number; clientY: number }) => {
      setSelectedHoleId(null);
      setAnchorFromClient(anchor);
      setActivePopover("color");
    },
    [setAnchorFromClient],
  );

  const handleOpenDimensionsPopover = useCallback(
    (anchor: { clientX: number; clientY: number }) => {
      setSelectedHoleId(null);
      setAnchorFromClient(anchor);
      setActivePopover("dimensions");
    },
    [setAnchorFromClient],
  );

  const handleSelectHole = useCallback(
    (holeId: string, anchor: { clientX: number; clientY: number }) => {
      setSelectedHoleId(holeId);
      setAnchorFromClient(anchor);
      setActivePopover("hole");
    },
    [setAnchorFromClient],
  );

  const primaryPart =
    selectedParts.length > 0 ? selectedParts[selectedParts.length - 1]! : null;
  const primaryLetterIndex =
    selectedLetterIndices.length > 0
      ? selectedLetterIndices[selectedLetterIndices.length - 1]!
      : null;

  useEffect(() => {
    if (selectedLetterIndices.length === 0 && selectedParts.length === 0 && !selectedHoleId) {
      setPopoverAnchor(null);
      setActivePopover(null);
      setSelectionHud(null);
    }
  }, [selectedLetterIndices, selectedParts, selectedHoleId]);

  useEffect(() => {
    if (selectedHoleId && !mountingHoles.some((h) => h.id === selectedHoleId)) {
      setSelectedHoleId(null);
      if (activePopover === "hole") setActivePopover(null);
    }
  }, [activePopover, mountingHoles, selectedHoleId]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      setPixelRatio(Math.min(window.devicePixelRatio, 2));
      setContainerSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const blockPageZoom = (e: WheelEvent) => {
      if (el.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    el.addEventListener("wheel", blockPageZoom, { passive: false });
    return () => el.removeEventListener("wheel", blockPageZoom);
  }, []);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (!data || data.letters.length === 0) return;

      const mod = event.metaKey || event.ctrlKey;

      if (mod && !event.altKey && !event.shiftKey && event.key in BAMBU_CAMERA_SHORTCUTS) {
        event.preventDefault();
        onView?.(BAMBU_CAMERA_SHORTCUTS[event.key]);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        handleDeselect();
        return;
      }

      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        sceneRef.current?.zoomIn();
        return;
      }
      if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        sceneRef.current?.zoomOut();
        return;
      }

      if (
        event.key !== "ArrowUp" &&
        event.key !== "ArrowDown" &&
        event.key !== "ArrowLeft" &&
        event.key !== "ArrowRight"
      ) {
        return;
      }
      if (mod) return;

      const step = event.shiftKey ? 1 : 10;
      const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
      const dy = event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0;
      event.preventDefault();

      if (selectedParts.length > 0 && explodedView && onDragPart) {
        for (const part of selectedParts) {
          const key = partColorKey(part.letterIndex, part.part);
          const cur = partOffsets[key] ?? { x: 0, y: 0 };
          onDragPart(part.letterIndex, part.part, cur.x + dx, cur.y + dy);
        }
        return;
      }

      if (selectedLetterIndices.length > 0 && onDragLetter) {
        for (const index of selectedLetterIndices) {
          const cur = letterOffsets[index] ?? { x: 0, y: 0 };
          onDragLetter(index, cur.x + dx, cur.y + dy);
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    data,
    explodedView,
    handleDeselect,
    letterOffsets,
    onDragLetter,
    onDragPart,
    onView,
    partOffsets,
    selectedLetterIndices,
    selectedParts,
  ]);

  const selectedLetter =
    primaryLetterIndex !== null && data
      ? data.letters.find((l) => l.index === primaryLetterIndex)
      : null;
  const partLetter =
    primaryPart && data ? data.letters.find((l) => l.index === primaryPart.letterIndex) : null;
  const selectedHole = selectedHoleId
    ? mountingHoles.find((h) => h.id === selectedHoleId) ?? null
    : null;

  const colorLetter = explodedView ? partLetter : selectedLetter;
  const colorSelection = explodedView
    ? primaryPart
    : selectedLetter
      ? { letterIndex: selectedLetter.index, part: "body" as const }
      : null;
  const showColorPopover =
    activePopover === "color" &&
    !holeToolActive &&
    Boolean(colorLetter) &&
    Boolean(colorSelection) &&
    Boolean(onPartColorChange) &&
    Boolean(onResetPartColor) &&
    (explodedView ? selectedParts.length > 0 : selectedLetterIndices.length > 0);
  const colorTargets = explodedView
    ? selectedParts
    : selectedLetterIndices.flatMap((letterIndex) =>
        (["body", "back", "front", "support"] as const).map((part) => ({
          letterIndex,
          part,
        })),
      );
  const colorSelectionCount = explodedView
    ? selectedParts.length
    : selectedLetterIndices.length;

  const showSceneColor =
    Boolean(onPartColorChange) &&
    (explodedView ? selectedParts.length > 0 : selectedLetterIndices.length > 0);
  const showSceneDimensions =
    Boolean(onOffsetChange && onDepthChange && onWallChange) &&
    !explodedView &&
    selectedLetterIndices.length >= 1;

  const isNarrow = containerSize.width > 0 && containerSize.width < 720;
  const sideInsetX = isNarrow ? 10 : PREVIEW_SIDE_INSET_X;
  const sideInsetY = isNarrow ? 56 : PREVIEW_SIDE_INSET_Y;

  return (
    <div
      ref={viewportRef}
      className={cn("relative flex h-full min-h-0 flex-col overflow-hidden bg-[#383838]", className)}
      style={{ touchAction: "none" }}
    >
      <div className="absolute inset-0 overscroll-contain">
        {data && data.letters.length > 0 ? (
          <LetterScene
            ref={sceneRef}
            data={data}
            letterStyle={letterStyle ?? data.letter_style}
            depthMm={depthMm}
            frontMm={frontMm}
            wallMm={wallMm}
            showInterior={showInterior}
            showLed={showLed}
            showGrid={showGrid}
            showPlane={showPlane}
            explodedFactor={explodedFactor}
            wallProfileId={wallProfileId}
            mountingHoles={mountingHoles}
            holeToolActive={holeToolActive}
            pendingHole={pendingHole}
            selectedLetterIndices={selectedLetterIndices}
            selectedParts={selectedParts}
            partColors={partColors}
            partOffsets={partOffsets}
            letterOffsets={letterOffsets}
            selectedHoleId={selectedHoleId}
            onSelectLetter={handleSelectLetter}
            onSelectPart={handleSelectPart}
            onDeselectLetter={handleDeselect}
            onDragLetter={onDragLetter ?? (() => {})}
            onDragPart={onDragPart}
            onSelectionHud={handleSelectionHud}
            onSelectHole={handleSelectHole}
            onAddHole={onAddHole}
            cameraView={cameraView}
            pixelRatio={pixelRatio}
            onZoomChange={setPreviewZoom}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center sm:px-8">
            {error ? (
              <div>
                <p className="text-[15px] font-medium sm:text-[16px]">{error.message}</p>
                {error.suggestion ? (
                  <p className="mt-2 text-[13px] text-muted sm:text-[14px]">{error.suggestion}</p>
                ) : null}
              </div>
            ) : loading ? (
              <PreviewSkeleton />
            ) : (
              <p className="max-w-[16rem] text-[14px] leading-snug text-white/55">
                Digite um texto ou envie um SVG para ver o preview 3D
              </p>
            )}
          </div>
        )}
        {loading ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden">
            <div className="h-full w-1/3 animate-pulse bg-accent" />
          </div>
        ) : null}
      </div>

      {data && data.letters.length > 0 && !compact && onViewerToolChange ? (
        <div className="pointer-events-none absolute top-14 right-3 z-20 sm:top-16 sm:right-4">
          <ViewerToolToggle
            tool={holeToolActive ? "hole" : "select"}
            holeEnabled
            onChange={onViewerToolChange}
          />
        </div>
      ) : null}

      {showSceneColor || showSceneDimensions ? (
        selectionHud?.visible ? (
          <SelectionActionHandles
            className="absolute z-20 -translate-y-1/2"
            style={{ left: selectionHud.x + 12, top: selectionHud.y }}
            showColor={showSceneColor}
            showDimensions={showSceneDimensions}
            colorActive={activePopover === "color"}
            dimensionsActive={activePopover === "dimensions"}
            onColor={showSceneColor ? handleOpenColorPopover : undefined}
            onDimensions={showSceneDimensions ? handleOpenDimensionsPopover : undefined}
          />
        ) : null
      ) : null}

      {data && data.letters.length > 0 ? (
        <div
          className="pointer-events-none absolute z-10 flex flex-col"
          style={{
            left: sideInsetX,
            top: sideInsetY,
            bottom: sideInsetY,
            width: isNarrow ? 48 : PREVIEW_SIDE_PANEL_WIDTH,
          }}
        >
          {showCrossSection && !isNarrow ? (
            <CrossSectionView
              data={data}
              letterStyle={letterStyle ?? data.letter_style}
              depthMm={depthMm}
              wallMm={wallMm}
              explodedFactor={explodedFactor}
              className="pointer-events-auto"
            />
          ) : null}

          <div className="flex min-h-0 flex-1 items-stretch justify-center py-2 sm:py-3">
            <PreviewZoomBar
              zoom={previewZoom}
              compact={isNarrow}
              onZoomChange={(value) => sceneRef.current?.setZoom(value)}
              onZoomIn={() => sceneRef.current?.zoomIn()}
              onZoomOut={() => sceneRef.current?.zoomOut()}
            />
          </div>

          {!isNarrow ? (
            <div
              className="pointer-events-none shrink-0"
              style={{ width: PREVIEW_SIDE_PANEL_WIDTH, height: PREVIEW_SIDE_PANEL_HEIGHT }}
              aria-hidden
            />
          ) : null}
        </div>
      ) : null}

      {onView && data ? (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-2 sm:top-4 sm:px-4">
          <div className="pointer-events-auto flex max-w-[calc(100%-0.5rem)] items-center gap-0.5 overflow-x-auto rounded-full border border-white/10 bg-[#2a2c30]/90 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {VIEWS.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => onView(view.id)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-2 text-[11px] font-medium transition sm:px-3 sm:py-1.5 sm:text-[12px]",
                  cameraView === view.id ? "bg-white/15 text-white" : "text-white/55 hover:text-white",
                )}
              >
                {view.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onView("reset")}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-white/55 hover:text-white sm:size-8"
              aria-label="Reset camera"
            >
              <RotateCcw className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {(onToggleExploded || onToggle) && !compact ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-2 sm:bottom-4 sm:px-4">
          <div className="pointer-events-auto flex max-w-full items-center rounded-full border border-white/10 bg-[#2a2c30]/90 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#8ab4f8]"
              aria-hidden
              title="Visualização"
            >
              <Layers3 className="size-4" strokeWidth={1.75} />
            </div>
            <div className="mx-0.5 h-6 w-px shrink-0 bg-white/10" />
            <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {onToggleExploded ? (
                <Tooltip content={explodedView ? "Montar peças" : "Desmontar peças"} side="top">
                  <button
                    type="button"
                    onClick={onToggleExploded}
                    aria-label={explodedView ? "Montar" : "Desmontar"}
                    aria-pressed={explodedView}
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full transition sm:size-8",
                      explodedView
                        ? "bg-white/12 text-[#8ab4f8]"
                        : "text-white/50 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {explodedView ? (
                      <Group className="size-4" strokeWidth={1.75} />
                    ) : (
                      <Ungroup className="size-4" strokeWidth={1.75} />
                    )}
                  </button>
                </Tooltip>
              ) : null}
              {onToggle
                ? (
                    [
                      {
                        key: "showInterior" as const,
                        label: "Interior",
                        hint: showInterior ? "Ocultar interior" : "Ver cavidade interna",
                        value: showInterior,
                        Icon: Eye,
                      },
                      {
                        key: "showLed" as const,
                        label: "LED",
                        hint: showLed ? "Ocultar LED" : "Mostrar LED",
                        value: showLed,
                        Icon: Lightbulb,
                      },
                      {
                        key: "showGrid" as const,
                        label: "Grid",
                        hint: showGrid ? "Ocultar grid" : "Mostrar grid",
                        value: showGrid,
                        Icon: Grid3x3,
                      },
                      {
                        key: "showPlane" as const,
                        label: "Plano",
                        hint: showPlane ? "Ocultar plano" : "Mostrar plano de impressão",
                        value: showPlane,
                        Icon: Square,
                      },
                      {
                        key: "showCrossSection" as const,
                        label: "Seção",
                        hint: showCrossSection ? "Ocultar seção" : "Mostrar seção transversal",
                        value: showCrossSection,
                        Icon: SplitSquareVertical,
                      },
                    ] as const
                  ).map(({ key, label, hint, value, Icon }) => (
                    <Tooltip key={key} content={hint} side="top">
                      <button
                        type="button"
                        onClick={() => onToggle(key, !value)}
                        aria-label={label}
                        aria-pressed={value}
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full transition sm:size-8",
                          value
                            ? "bg-white/12 text-[#8ab4f8]"
                            : "text-white/50 hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <Icon className="size-4" strokeWidth={1.75} />
                      </button>
                    </Tooltip>
                  ))
                : null}
            </div>
          </div>
        </div>
      ) : null}

      {showColorPopover && colorLetter && colorSelection && onPartColorChange && onResetPartColor ? (
        <PartColorPopover
          selection={colorSelection}
          letter={colorLetter}
          letterStyle={letterStyle ?? data?.letter_style}
          depthMm={depthMm}
          wallMm={wallMm}
          partColors={partColors}
          anchor={popoverAnchor}
          containerSize={containerSize}
          assembled={!explodedView}
          selectionCount={colorSelectionCount}
          onColorChange={(color) => {
            for (const part of colorTargets) {
              onPartColorChange(part, color);
            }
          }}
          onResetColor={() => {
            for (const part of colorTargets) {
              onResetPartColor(part);
            }
          }}
          onClose={() => setActivePopover(null)}
        />
      ) : null}

      {selectedLetter &&
      selectedLetterIndices.length >= 1 &&
      !explodedView &&
      activePopover === "dimensions" &&
      !holeToolActive &&
      onOffsetChange &&
      onDepthChange &&
      onWallChange ? (
        <PieceDimensionPopover
          letter={selectedLetter}
          offset={letterOffsets[selectedLetter.index] ?? { x: 0, y: 0 }}
          depthMm={depthMm}
          wallMm={wallMm}
          anchor={popoverAnchor}
          containerSize={containerSize}
          selectionCount={selectedLetterIndices.length}
          onOffset={(partial) => {
            if (selectedLetterIndices.length <= 1) {
              onOffsetChange(selectedLetter.index, partial);
              return;
            }
            const current = letterOffsets[selectedLetter.index] ?? { x: 0, y: 0 };
            const dx = partial.x !== undefined ? partial.x - current.x : 0;
            const dy = partial.y !== undefined ? partial.y - current.y : 0;
            for (const index of selectedLetterIndices) {
              const cur = letterOffsets[index] ?? { x: 0, y: 0 };
              onOffsetChange(index, {
                ...(partial.x !== undefined ? { x: cur.x + dx } : {}),
                ...(partial.y !== undefined ? { y: cur.y + dy } : {}),
              });
            }
          }}
          onDepth={onDepthChange}
          onWall={onWallChange}
          onClose={() => setActivePopover(null)}
        />
      ) : null}

      {selectedHole && activePopover === "hole" && onUpdateHole && onRemoveHole ? (
        <HoleDimensionPopover
          hole={selectedHole}
          letterDepthMm={depthMm}
          anchor={popoverAnchor}
          containerSize={containerSize}
          onChange={(partial) => onUpdateHole(selectedHole.id, partial)}
          onRemove={() => {
            onRemoveHole(selectedHole.id);
            setSelectedHoleId(null);
            setActivePopover(null);
          }}
          onClose={() => {
            setSelectedHoleId(null);
            setActivePopover(null);
          }}
        />
      ) : null}
    </div>
  );
}
