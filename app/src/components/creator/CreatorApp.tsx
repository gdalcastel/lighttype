"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, FileArchive, Layers, Lock, Boxes, Printer, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NumericSlider } from "@/components/ui/numeric-slider";
import { Progress } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { Toggle } from "@/components/ui/toggle";
import { DownloadCheckoutModal } from "@/components/creator/DownloadCheckoutModal";
import { FontSelector } from "@/components/creator/FontSelector";
import { HoleToolPanel } from "@/components/creator/HoleToolPanel";
import { InputModeTabs } from "@/components/creator/SvgUploader";
import { LetterStyleSelector } from "@/components/creator/LetterStyleSelector";
import { Preview2D } from "@/components/creator/Preview2D";
import { NfcWritePanel } from "@/components/creator/NfcWritePanel";
import { VerticalToolbar } from "@/components/creator/VerticalToolbar";
import { WallProfilePanel } from "@/components/creator/WallProfilePanel";
import { ModelPresetPanel } from "@/components/creator/ModelSystemPanels";
import { Logo } from "@/components/layout/Header";
import { LetterPreview } from "@/components/preview/LetterPreview";
import {
  configToPreviewBody,
  downloadUrl,
  fetchFonts,
  fetchJob,
  fetchLetterStyles,
  fetchModelPresets,
  fetchPreview,
  fetchWallProfiles,
  isLocalHost,
  startStlJob,
} from "@/lib/api";
import { launchBambuHandoff } from "@/lib/bambu-connect";
import { isNativeApp } from "@/lib/native";
import { hydrateCreatorStoreFromStorage, useCreatorStore } from "@/lib/store";
import { snapLetterX } from "@/lib/letter-snap";
import { partColorKey } from "@/lib/letter-utils";
import { cn } from "@/lib/utils";
import type {
  JobStatus,
  LetterStyleInfo,
  ModelPresetInfo,
  ModelPresetUi,
  PreviewData,
  ProjectConfig,
  WallProfileInfo,
} from "@/types";
import { CREATOR_STEPS, DEPTH_PRESETS_MM } from "@/types";

const MODEL_PRESET_ALIASES: Record<string, string> = {
  "led-modular-kit": "led-desk-rail",
};

const DEFAULT_MODEL_UI: ModelPresetUi = {
  show_base: true,
  lock_base: false,
  show_shadow: true,
  show_holes: true,
  show_plug: false,
  show_letter_style: true,
};

type ExportAction = "download" | "bambu";

function triggerDownload(jobId: string) {
  const a = document.createElement("a");
  a.href = downloadUrl(jobId);
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function CreatorApp() {
  const store = useCreatorStore();
  const holeToolActive = store.holeToolActive;
  const [tuneTab, setTuneTab] = useState<"geometry" | "holes">("geometry");
  const [fonts, setFonts] = useState<{ id: string; name: string; category: string; description?: string }[]>([]);
  const [letterStyles, setLetterStyles] = useState<LetterStyleInfo[]>([]);
  const [wallProfiles, setWallProfiles] = useState<WallProfileInfo[]>([]);
  const [modelPresets, setModelPresets] = useState<ModelPresetInfo[]>([]);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewError, setPreviewError] = useState<{ message: string; suggestion?: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [readyJobId, setReadyJobId] = useState<string | null>(null);
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [localHost, setLocalHost] = useState(false);
  const [nativeApp, setNativeApp] = useState(false);
  const [bambuLaunching, setBambuLaunching] = useState(false);
  const [pendingAction, setPendingAction] = useState<ExportAction>("download");
  const [panelExpanded, setPanelExpanded] = useState(false);
  const downloadedRef = useRef<string | null>(null);
  const pendingActionRef = useRef<ExportAction>("download");

  function setExportAction(action: ExportAction) {
    pendingActionRef.current = action;
    setPendingAction(action);
  }

  const activeLetterStyle = useMemo(
    () => letterStyles.find((s) => s.id === store.letterStyleId) ?? preview?.letter_style,
    [letterStyles, preview?.letter_style, store.letterStyleId],
  );

  const resolvedModelPresetId = useMemo(() => {
    if (!store.modelPresetId) return null;
    return MODEL_PRESET_ALIASES[store.modelPresetId] ?? store.modelPresetId;
  }, [store.modelPresetId]);

  const activeModelPreset = useMemo(
    () => modelPresets.find((p) => p.id === resolvedModelPresetId) ?? null,
    [modelPresets, resolvedModelPresetId],
  );

  const modelUi = useMemo(
    () => ({ ...DEFAULT_MODEL_UI, ...activeModelPreset?.ui }),
    [activeModelPreset],
  );

  useEffect(() => {
    if (!modelUi.show_holes) {
      setTuneTab((tab) => (tab === "holes" ? "geometry" : tab));
      if (useCreatorStore.getState().holeToolActive) {
        useCreatorStore.getState().setViewer({ holeToolActive: false });
      }
    }
  }, [modelUi.show_holes]);

  const previewKey = useMemo(
    () =>
      JSON.stringify({
        ...configToPreviewBody(store),
        mountingHoles: store.mountingHoles,
      }),
    [
      store.text,
      store.fontId,
      store.heightMm,
      store.depthMm,
      store.frontMm,
      store.wallMm,
      store.spacingMm,
      store.inputMode,
      store.svgContent,
      store.letterStyleId,
      store.frontMount,
      store.frontToleranceMm,
      store.snapFitToleranceMm,
      store.snapFitDepthMm,
      store.wallProfileId,
      store.friezeCount,
      store.friezeAdvanceMm,
      store.friezeSpacingMm,
      store.shelfRatio,
      store.shelfStepMm,
      store.baseEnabled,
      store.baseHeightMm,
      store.baseConnectorWidthMm,
      store.basePosition,
      store.baseConnectorToleranceMm,
      store.baseMode,
      store.shadowEnabled,
      store.shadowOffsetMm,
      store.diffuserShellMm,
      store.diffuserToleranceMm,
      store.minCavityMm,
      store.accentLit,
      store.mountingSystemId,
      store.materialPackId,
      store.mountingHoles,
    ],
  );

  const generateKey = useMemo(
    () =>
      JSON.stringify({
        ...configToPreviewBody(store),
        depthMm: store.depthMm,
        frontMm: store.frontMm,
        frontToleranceMm: store.frontToleranceMm,
        snapFitToleranceMm: store.snapFitToleranceMm,
        snapFitDepthMm: store.snapFitDepthMm,
        frontMount: store.frontMount,
        close45Base: store.close45Base,
        inclinationMm: store.inclinationMm,
        maxAngleDeg: store.maxAngleDeg,
        exportFormat: store.exportFormat,
      }),
    [store],
  );

  useEffect(() => {
    hydrateCreatorStoreFromStorage();
  }, []);

  useEffect(() => {
    setLocalHost(isLocalHost());
    setNativeApp(isNativeApp());
  }, []);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          useCreatorStore.getState().redo();
        } else {
          useCreatorStore.getState().undo();
        }
        return;
      }
      if (key === "y" && !event.shiftKey) {
        event.preventDefault();
        useCreatorStore.getState().redo();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const target = store.explodedView ? 1 : 0;
    const start = useCreatorStore.getState().explodedFactor;
    if (Math.abs(start - target) < 0.01) return;
    let frame: number;
    const t0 = performance.now();
    const duration = 400;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      useCreatorStore.getState().setViewer({ explodedFactor: start + (target - start) * eased });
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [store.explodedView]);

  useEffect(() => {
    Promise.all([fetchFonts(), fetchLetterStyles(), fetchWallProfiles(), fetchModelPresets()])
      .then(([f, s, w, presets]) => {
        setFonts(f.fonts);
        setLetterStyles(s.styles);
        setWallProfiles(w.profiles);
        setModelPresets(presets.presets);

        const state = useCreatorStore.getState();
        const rawId = state.modelPresetId;
        const resolvedId = rawId ? (MODEL_PRESET_ALIASES[rawId] ?? rawId) : null;
        const matched = resolvedId
          ? presets.presets.find((p) => p.id === resolvedId)
          : null;

        if (matched && rawId !== matched.id) {
          // Migra alias legado (ex.: led-modular-kit) e reaplica o patch do modelo.
          useCreatorStore.getState().patch({
            ...matched.patch,
            modelPresetId: matched.id,
          } as Partial<ProjectConfig>);
        } else if (!matched && presets.presets.length === 1) {
          const only = presets.presets[0];
          useCreatorStore.getState().patch({
            ...only.patch,
            modelPresetId: only.id,
          } as Partial<ProjectConfig>);
        } else if (matched && rawId === matched.id) {
          // Garante mountingSystemId alinhado ao modelo sem resetar medidas do usuário.
          const mountId = matched.mounting_system_id ?? matched.patch.mountingSystemId;
          if (typeof mountId === "string" && state.mountingSystemId !== mountId) {
            useCreatorStore.getState().patch({ mountingSystemId: mountId });
          }
        }
      })
      .catch(() => toast.error("Não foi possível carregar os catálogos."));
  }, []);

  const applyPresetPatch = (patch: Record<string, unknown>, extra?: Partial<ProjectConfig>) => {
    store.patch({ ...patch, ...extra } as Partial<ProjectConfig>);
  };

  useEffect(() => {
    const hasInput =
      store.inputMode === "svg" ? Boolean(store.svgContent) : store.text.trim().length > 0;
    if (!hasInput) {
      setPreview(null);
      setPreviewError(null);
      setLoadingPreview(false);
      return;
    }
    const handle = window.setTimeout(async () => {
      setLoadingPreview(true);
      try {
        const data = await fetchPreview(useCreatorStore.getState());
        setPreview(data);
        setPreviewError(null);
      } catch (err) {
        const error = err as Error & { suggestion?: string };
        setPreviewError({ message: error.message, suggestion: error.suggestion });
      } finally {
        setLoadingPreview(false);
      }
    }, 280);
    return () => window.clearTimeout(handle);
  }, [previewKey]);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed") return;
    const t = window.setInterval(async () => {
      try {
        const next = await fetchJob(job.job_id);
        setJob(next);
      } catch {
        window.clearInterval(t);
      }
    }, 450);
    return () => window.clearInterval(t);
  }, [job]);

  useEffect(() => {
    if (job?.status !== "completed" || !job.job_id) return;
    setReadyJobId(job.job_id);
    setReadyKey(pendingKey);
    if (downloadedRef.current === job.job_id) return;
    downloadedRef.current = job.job_id;
    if (pendingActionRef.current === "bambu") {
      void launchBambuForJob(job.job_id);
    } else {
      triggerDownload(job.job_id);
    }
    // launchBambuForJob is stable enough for post-complete handoff
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to job completion
  }, [job, pendingKey]);

  const hasInput =
    store.inputMode === "svg" ? Boolean(store.svgContent) : store.text.trim().length > 0;
  const shownPreview = hasInput ? preview : null;
  const shownError = hasInput ? previewError : null;
  const generating = Boolean(job && job.status !== "completed" && job.status !== "failed");
  const canRedownload = Boolean(readyJobId && readyKey === generateKey);
  const exportBusy = generating || bambuLaunching;

  async function launchBambuForJob(jobId: string) {
    if (!isLocalHost()) {
      triggerDownload(jobId);
      toast.message("3MF baixado", {
        description: "Abra o arquivo no Bambu Studio para imprimir.",
        action: {
          label: "Como integrar",
          onClick: () =>
            window.open(
              "https://wiki.bambulab.com/en/software/third-party-integration",
              "_blank",
              "noopener,noreferrer",
            ),
        },
      });
      return;
    }
    setBambuLaunching(true);
    try {
      launchBambuHandoff({ jobId });
      toast.message("Abrindo no Bambu Studio", {
        description: "Se o Studio pedir confirmação, aceite para carregar o projeto.",
      });
    } catch (err) {
      const error = err as Error & { suggestion?: string };
      toast.error(error.message, { description: error.suggestion });
      triggerDownload(jobId);
    } finally {
      setBambuLaunching(false);
    }
  }

  async function onExport(action: ExportAction, checkoutToken?: string) {
    if (!hasInput || exportBusy) return;
    setExportAction(action);

    const stateBefore = useCreatorStore.getState();
    if (action === "bambu" && stateBefore.exportFormat !== "3mf") {
      store.patch({ exportFormat: "3mf" });
    }

    const canReuseReady =
      !checkoutToken &&
      canRedownload &&
      Boolean(readyJobId) &&
      (action === "download" || stateBefore.exportFormat === "3mf");

    if (canReuseReady && readyJobId) {
      if (action === "bambu") {
        await launchBambuForJob(readyJobId);
      } else {
        triggerDownload(readyJobId);
      }
      return;
    }

    const localBypass = isLocalHost();
    if (!checkoutToken && !localBypass) {
      setCheckoutOpen(true);
      return;
    }

    try {
      const state =
        action === "bambu"
          ? { ...useCreatorStore.getState(), exportFormat: "3mf" as const }
          : useCreatorStore.getState();
      const started = await startStlJob(state, {
        checkoutToken: checkoutToken ?? (localBypass ? "localhost" : undefined),
      });
      setPendingKey(
        action === "bambu"
          ? JSON.stringify({ ...JSON.parse(generateKey), exportFormat: "3mf" })
          : generateKey,
      );
      setJob({
        job_id: started.job_id,
        status: started.status,
        stage: "queued",
        stage_label: "Queued",
        progress: 4,
        error: null,
        result: null,
      });
    } catch (err) {
      const error = err as Error & { suggestion?: string };
      toast.error(error.message, { description: error.suggestion });
    }
  }

  function handleCheckoutComplete(downloadToken: string) {
    void onExport(pendingActionRef.current, downloadToken);
  }

  function openDownloadCheckout() {
    if (!hasInput || exportBusy) return;
    setExportAction("download");
    if (canRedownload && readyJobId) {
      triggerDownload(readyJobId);
      return;
    }
    if (isLocalHost()) {
      void onExport("download");
      return;
    }
    setCheckoutOpen(true);
  }

  function openBambuConnect() {
    if (!hasInput || exportBusy) return;
    setExportAction("bambu");
    const already3mf = useCreatorStore.getState().exportFormat === "3mf";
    if (!already3mf) {
      store.patch({ exportFormat: "3mf" });
    }
    if (already3mf && canRedownload && readyJobId) {
      void launchBambuForJob(readyJobId);
      return;
    }
    if (isLocalHost()) {
      void onExport("bambu");
      return;
    }
    setCheckoutOpen(true);
  }

  function handleAddHole(x: number, y: number, letterIndex: number) {
    const shape = store.pendingHoleShape;
    const width = store.pendingHoleWidth;
    const length = shape === "circle" ? width : store.pendingHoleLength;
    const cornerRadius = shape === "circle" ? width / 2 : store.pendingHoleCornerRadius;
    const name = store.pendingHoleName.trim() || undefined;
    store.addMountingHole({
      x,
      y,
      shape,
      width_mm: width,
      length_mm: length,
      depth_mm: store.pendingHoleDepth,
      corner_radius_mm: cornerRadius,
      face: "back",
      letter_index: letterIndex,
      name,
    });
    toast.success(name ? `Furo "${name}" adicionado` : "Furo adicionado");
  }

  function handleSaveHoleTemplate() {
    const id = store.saveHoleTemplate();
    if (id) toast.success("Modelo de furo salvo");
    else toast.error("Informe um nome para salvar o modelo");
  }

  function handleDragPart(letterIndex: number, part: "body" | "back" | "front" | "support", x: number, y: number) {
    const state = useCreatorStore.getState();
    const selected = state.selectedParts;
    const isMulti =
      selected.length > 1 &&
      selected.some((p) => p.letterIndex === letterIndex && p.part === part);

    if (isMulti) {
      const key = partColorKey(letterIndex, part);
      const prev = state.partOffsets[key] ?? { x: 0, y: 0 };
      const dx = x - prev.x;
      const dy = y - prev.y;
      if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return;

      for (const item of selected) {
        if (item.part === "back") {
          for (const hole of state.mountingHoles) {
            if (hole.letter_index === item.letterIndex) {
              store.updateMountingHole(hole.id, { x: hole.x + dx, y: hole.y + dy });
            }
          }
          store.setPartOffset(item.letterIndex, item.part, { x: 0, y: 0 });
          continue;
        }
        const itemKey = partColorKey(item.letterIndex, item.part);
        const cur = state.partOffsets[itemKey] ?? { x: 0, y: 0 };
        const next =
          item.letterIndex === letterIndex && item.part === part
            ? { x, y }
            : { x: cur.x + dx, y: cur.y + dy };
        store.setPartOffset(item.letterIndex, item.part, next);
      }
      return;
    }

    if (part === "back") {
      const key = partColorKey(letterIndex, part);
      const prev = state.partOffsets[key] ?? { x: 0, y: 0 };
      const dx = x - prev.x;
      const dy = y - prev.y;
      if (Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9) {
        for (const hole of state.mountingHoles) {
          if (hole.letter_index === letterIndex) {
            store.updateMountingHole(hole.id, { x: hole.x + dx, y: hole.y + dy });
          }
        }
        store.setPartOffset(letterIndex, part, { x: 0, y: 0 });
        return;
      }
    }
    store.setPartOffset(letterIndex, part, { x, y });
  }

  function handleDragLetter(index: number, x: number, y: number) {
    const state = useCreatorStore.getState();
    const selected = state.selectedLetterIndices;
    const isMulti = selected.length > 1 && selected.includes(index);

    if (isMulti) {
      const prev = state.letterOffsets[index] ?? { x: 0, y: 0 };
      const dx = x - prev.x;
      const dy = y - prev.y;
      if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return;
      for (const letterIndex of selected) {
        const cur = state.letterOffsets[letterIndex] ?? { x: 0, y: 0 };
        store.setLetterOffset(letterIndex, {
          x: letterIndex === index ? x : cur.x + dx,
          y: letterIndex === index ? y : cur.y + dy,
        });
      }
      return;
    }

    if (store.baseEnabled && preview?.letters) {
      x = snapLetterX(
        preview.letters,
        index,
        store.spacingMm,
        x,
        useCreatorStore.getState().letterOffsets,
      );
    }
    store.setLetterOffset(index, { x, y });
  }

  function renderPanel() {
    switch (store.activePanel) {
      case "type":
        return (
          <div className="space-y-5">
            <Section
              step="Passo 1 de 4"
              title="Modelo"
              description="Escolha o letreiro LED com a fixação já definida. Depois personalize o texto."
            >
              <ModelPresetPanel
                presets={modelPresets}
                selectedId={resolvedModelPresetId}
                onSelect={(preset) => {
                  applyPresetPatch(
                    {
                      ...preset.patch,
                      ...(preset.ui?.show_holes ? {} : { mountingHoles: [] }),
                    },
                    { modelPresetId: preset.id },
                  );
                  if (preset.ui?.suggest_holes) {
                    toast.message("No passo Ajustes, use a aba Furos para posicionar a fixação");
                  } else {
                    toast.success(`“${preset.name}” aplicado`);
                  }
                }}
              />
            </Section>
          </div>
        );
      case "content":
        return (
          <div className="space-y-4">
            <Section
              step="Passo 2 de 4"
              title="Personalizar"
              description={
                activeModelPreset
                  ? `${activeModelPreset.name} · ${modelUi.mounting_label ?? "fixação fixa"}. Texto e fonte.`
                  : "Texto, fonte e conteúdo do letreiro."
              }
            >
              <InputModeTabs
                mode={store.inputMode}
                onMode={(inputMode) => store.patch({ inputMode })}
                fileName={store.svgFileName}
                onSvgLoad={(svgContent, svgFileName) =>
                  store.patch({ svgContent, svgFileName, inputMode: "svg" })
                }
                textContent={
                  <>
                    <textarea
                      value={store.text}
                      onChange={(e) => store.setText(e.target.value)}
                      placeholder="Digite aqui"
                      aria-label="Texto"
                      maxLength={48}
                      rows={3}
                      className="min-h-[96px] w-full resize-y rounded-[14px] border border-border bg-surface px-4 py-3 text-[17px] leading-relaxed tracking-wide text-foreground placeholder:text-muted-soft transition-colors duration-150 hover:border-border-strong focus:border-foreground/30 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:min-h-[88px]"
                    />
                    {previewError ? (
                      <p className="text-[12px] leading-4 text-accent">{previewError.message}</p>
                    ) : null}
                    <Preview2D data={shownPreview} fontId={store.fontId} />
                    <Section title="Fonte" className="space-y-2">
                      <FontSelector
                        fonts={fonts}
                        selectedId={store.fontId}
                        sample={store.text}
                        onSelect={store.setFontId}
                      />
                    </Section>
                  </>
                }
                svgContent={
                  shownPreview ? <Preview2D data={shownPreview} fontId={store.fontId} /> : null
                }
              />
            </Section>
            {modelUi.show_letter_style ? (
              <Section
                title="Estilo de letra"
                description="Só mude se o preset não cobrir o que você quer."
              >
                <LetterStyleSelector
                  styles={letterStyles}
                  selectedId={store.letterStyleId}
                  fontId={store.fontId}
                  depthMm={store.depthMm}
                  frontMm={store.frontMm}
                  wallMm={store.wallMm}
                  wallProfileId={store.wallProfileId}
                  onSelect={(letterStyleId) => {
                    const style = letterStyles.find((s) => s.id === letterStyleId);
                    const patch: Record<string, unknown> = {
                      letterStyleId,
                      frontMount: style?.front_mount ?? store.frontMount,
                      modelPresetId: null,
                    };
                    if (style?.front_mount === "diffuser") {
                      patch.wallProfileId = "shelf";
                      patch.frontMm = Math.min(store.frontMm, 1.0);
                      patch.frontToleranceMm = 0.15;
                      patch.diffuserToleranceMm = 0.15;
                      patch.diffuserShellMm = 0.85;
                      if (store.depthMm < 40) patch.depthMm = 50;
                      if (store.wallMm < 2.5) patch.wallMm = 3.0;
                    }
                    if (style?.id === "open-back") {
                      patch.minCavityMm = Math.max(store.minCavityMm, 8);
                      patch.accentLit = false;
                    }
                    store.patch(patch as Partial<typeof store>);
                  }}
                />
              </Section>
            ) : null}
          </div>
        );
      case "tune": {
        const showHolesTab = Boolean(modelUi.show_holes);
        const effectiveTuneTab = showHolesTab ? tuneTab : "geometry";
        return (
          <div className="space-y-5">
            <Section
              step="Passo 3 de 4"
              title="Ajustes finos"
              description={
                activeModelPreset
                  ? `Parâmetros do modelo “${activeModelPreset.name}”. Pule se já estiver certo.`
                  : "Dimensões, cavidade, parede e furos. Pule se o preset já estiver certo."
              }
            >
              {showHolesTab ? (
                <div className="flex gap-1.5 rounded-[12px] border border-border bg-background p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setTuneTab("geometry");
                      store.setViewer({ holeToolActive: false });
                    }}
                    className={`min-h-10 flex-1 rounded-[9px] px-3 py-2 text-[13px] font-medium transition sm:min-h-0 sm:py-1.5 sm:text-[12px] ${
                      effectiveTuneTab === "geometry"
                        ? "bg-surface text-foreground shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Geometria
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTuneTab("holes");
                      store.setViewer({ holeToolActive: true });
                    }}
                    className={`min-h-10 flex-1 rounded-[9px] px-3 py-2 text-[13px] font-medium transition sm:min-h-0 sm:py-1.5 sm:text-[12px] ${
                      effectiveTuneTab === "holes"
                        ? "bg-surface text-foreground shadow-sm"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Furos
                  </button>
                </div>
              ) : null}
            </Section>

            {effectiveTuneTab === "geometry" ? (
              <>
                <Section title="Tamanho" className="space-y-2">
                  <div className="space-y-3.5">
                    <NumericSlider
                      compact
                      label="Altura"
                      value={store.heightMm}
                      min={30}
                      max={250}
                      onChange={(heightMm) => store.patch({ heightMm })}
                    />
                    <div className="space-y-1.5">
                      <NumericSlider
                        compact
                        label="Profundidade"
                        value={store.depthMm}
                        min={12}
                        max={64}
                        step={0.5}
                        onChange={(depthMm) => store.patch({ depthMm })}
                      />
                      <div className="flex gap-1.5">
                        {DEPTH_PRESETS_MM.map((mm) => (
                          <button
                            key={mm}
                            type="button"
                            onClick={() => store.patch({ depthMm: mm })}
                            className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                              store.depthMm === mm
                                ? "border-accent bg-accent/10 text-foreground"
                                : "border-border text-muted hover:border-accent/40"
                            }`}
                          >
                            {mm} mm
                          </button>
                        ))}
                      </div>
                    </div>
                    <NumericSlider
                      compact
                      label="Espaçamento"
                      value={store.spacingMm}
                      min={0}
                      max={40}
                      onChange={(spacingMm) => store.patch({ spacingMm })}
                    />
                    <NumericSlider
                      compact
                      label="Parede"
                      value={store.wallMm}
                      min={1}
                      max={5}
                      step={0.1}
                      onChange={(wallMm) => store.patch({ wallMm })}
                    />
                  </div>
                </Section>
                <Section title="Cavidade inteligente" className="space-y-3">
                  <NumericSlider
                    compact
                    label="Largura mínima da cavidade"
                    value={store.minCavityMm}
                    min={3}
                    max={14}
                    step={0.5}
                    unit="mm"
                    onChange={(minCavityMm) => store.patch({ minCavityMm, modelPresetId: null })}
                  />
                  <p className="text-[11px] leading-snug text-muted">
                    Pontas mais finas que isso ficam maciças (ex.: V, serifas). Contadores de A/B/R
                    permanecem ocos.
                  </p>
                  <Toggle
                    label="Acentos iluminados"
                    description="Diacríticos ocos com diffuser próprio. Desligado = acento sólido."
                    checked={store.accentLit}
                    onCheckedChange={(accentLit) => store.patch({ accentLit, modelPresetId: null })}
                  />
                </Section>
                {modelUi.show_base ? (
                  <Section
                    title="Base de encaixe"
                    description={
                      modelUi.lock_base
                        ? `Definida pelo modelo${modelUi.mounting_label ? ` · ${modelUi.mounting_label}` : ""}.`
                        : undefined
                    }
                    className="space-y-3"
                  >
                    {!modelUi.lock_base ? (
                      <Toggle
                        label="Habilitar base"
                        description="Faixa inferior/superior com encaixes laterais para unir as letras."
                        checked={store.baseEnabled}
                        onCheckedChange={(baseEnabled) => store.patch({ baseEnabled })}
                      />
                    ) : null}
                    {store.baseEnabled ? (
                      <div className="space-y-3.5">
                        {!modelUi.lock_base ? (
                          <>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => store.patch({ baseMode: "snap" })}
                                className={`flex-1 rounded-[10px] border px-3 py-2 text-[13px] font-medium transition ${
                                  store.baseMode === "snap"
                                    ? "border-accent bg-accent/10 text-foreground"
                                    : "border-border text-muted hover:border-accent/40"
                                }`}
                              >
                                Snap integrado
                              </button>
                              <button
                                type="button"
                                onClick={() => store.patch({ baseMode: "modular" })}
                                className={`flex-1 rounded-[10px] border px-3 py-2 text-[13px] font-medium transition ${
                                  store.baseMode === "modular"
                                    ? "border-accent bg-accent/10 text-foreground"
                                    : "border-border text-muted hover:border-accent/40"
                                }`}
                              >
                                Modular
                              </button>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => store.patch({ basePosition: "bottom" })}
                                className={`flex-1 rounded-[10px] border px-3 py-2 text-[13px] font-medium transition ${
                                  store.basePosition === "bottom"
                                    ? "border-accent bg-accent/10 text-foreground"
                                    : "border-border text-muted hover:border-accent/40"
                                }`}
                              >
                                Embaixo
                              </button>
                              <button
                                type="button"
                                onClick={() => store.patch({ basePosition: "top" })}
                                className={`flex-1 rounded-[10px] border px-3 py-2 text-[13px] font-medium transition ${
                                  store.basePosition === "top"
                                    ? "border-accent bg-accent/10 text-foreground"
                                    : "border-border text-muted hover:border-accent/40"
                                }`}
                              >
                                Em cima
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="text-[11px] leading-snug text-muted">
                            {store.baseMode === "modular"
                              ? "Sockets dos dois lados. O ZIP inclui connector, distance, dummy e end caps."
                              : "Macho/fêmea integrados entre letras vizinhas."}
                          </p>
                        )}
                        <NumericSlider
                          compact
                          label="Altura da base"
                          value={store.baseHeightMm}
                          min={4}
                          max={30}
                          step={0.5}
                          onChange={(baseHeightMm) => store.patch({ baseHeightMm })}
                        />
                        <NumericSlider
                          compact
                          label="Largura do conector"
                          value={store.baseConnectorWidthMm}
                          min={4}
                          max={20}
                          step={0.5}
                          onChange={(baseConnectorWidthMm) => store.patch({ baseConnectorWidthMm })}
                        />
                        <NumericSlider
                          compact
                          label="Tolerância do encaixe"
                          value={store.baseConnectorToleranceMm}
                          min={0.1}
                          max={0.8}
                          step={0.05}
                          onChange={(baseConnectorToleranceMm) =>
                            store.patch({ baseConnectorToleranceMm })
                          }
                        />
                      </div>
                    ) : null}
                  </Section>
                ) : null}
                {modelUi.show_shadow ? (
                  <Section title="Efeito sombra" className="space-y-3">
                    {!modelUi.lock_base ? (
                      <Toggle
                        label="Habilitar sombra"
                        description="Cover unificada na traseira que une todas as letras, com borda ajustável."
                        checked={store.shadowEnabled}
                        onCheckedChange={(shadowEnabled) => store.patch({ shadowEnabled })}
                      />
                    ) : (
                      <p className="text-[11px] leading-snug text-muted">
                        Cover unificada na traseira — definida pelo modelo de parede.
                      </p>
                    )}
                    {store.shadowEnabled ? (
                      <NumericSlider
                        compact
                        label="Largura da borda"
                        value={store.shadowOffsetMm}
                        min={1}
                        max={20}
                        step={0.5}
                        onChange={(shadowOffsetMm) => store.patch({ shadowOffsetMm })}
                      />
                    ) : null}
                  </Section>
                ) : null}
                {modelUi.show_plug ? (
                  <Section
                    title="Plug da barra"
                    description="Dimensões do encaixe no perfil eletrificado (protótipo)."
                    className="space-y-3"
                  >
                    <p className="rounded-[12px] border border-border bg-background px-3 py-2 text-[11px] leading-snug text-muted">
                      Profile A · protótipo visual. Ajuste fino disponível após medidas reais do
                      trilho.
                    </p>
                  </Section>
                ) : null}
                <Section title="Perfil de parede" className="space-y-2">
                  <WallProfilePanel
                    profiles={wallProfiles}
                    profileId={store.wallProfileId}
                    friezeCount={store.friezeCount}
                    friezeAdvanceMm={store.friezeAdvanceMm}
                    friezeSpacingMm={store.friezeSpacingMm}
                    shelfRatio={store.shelfRatio}
                    shelfStepMm={store.shelfStepMm}
                    close45Base={store.close45Base}
                    inclinationMm={store.inclinationMm}
                    maxAngleDeg={store.maxAngleDeg}
                    onChange={(partial) => store.patch(partial as Partial<typeof store>)}
                  />
                </Section>
                <Section title="Face" className="space-y-2">
                  <div className="space-y-3.5">
                    <NumericSlider
                      compact
                      label="Espessura"
                      value={store.frontMm}
                      min={0.8}
                      max={4}
                      step={0.1}
                      onChange={(frontMm) => store.patch({ frontMm })}
                    />
                    {store.frontMount === "diffuser" || store.letterStyleId === "printed-diffuser" ? (
                      <>
                        <NumericSlider
                          compact
                          label="Parede do diffuser"
                          value={store.diffuserShellMm}
                          min={0.6}
                          max={1.5}
                          step={0.05}
                          onChange={(diffuserShellMm) => store.patch({ diffuserShellMm })}
                        />
                        <NumericSlider
                          compact
                          label="Folga do diffuser"
                          value={store.diffuserToleranceMm}
                          min={0.08}
                          max={0.4}
                          step={0.01}
                          onChange={(diffuserToleranceMm) => store.patch({ diffuserToleranceMm })}
                        />
                      </>
                    ) : (
                      <>
                        <NumericSlider
                          compact
                          label="Tolerância"
                          value={store.frontToleranceMm}
                          min={0.1}
                          max={0.8}
                          step={0.05}
                          onChange={(frontToleranceMm) => store.patch({ frontToleranceMm })}
                        />
                        <NumericSlider
                          compact
                          label="Gap snap-fit"
                          value={store.snapFitToleranceMm}
                          min={0.1}
                          max={0.8}
                          step={0.05}
                          onChange={(snapFitToleranceMm) => store.patch({ snapFitToleranceMm })}
                        />
                        <NumericSlider
                          compact
                          label="Profundidade snap-fit"
                          value={store.snapFitDepthMm}
                          min={0.4}
                          max={2.5}
                          step={0.1}
                          onChange={(snapFitDepthMm) => store.patch({ snapFitDepthMm })}
                        />
                      </>
                    )}
                  </div>
                </Section>
              </>
            ) : (
              <HoleToolPanel
                holes={store.mountingHoles}
                templates={store.savedHoleTemplates}
                shape={store.pendingHoleShape}
                width={store.pendingHoleWidth}
                length={store.pendingHoleLength}
                depth={store.pendingHoleDepth}
                cornerRadius={store.pendingHoleCornerRadius}
                name={store.pendingHoleName}
                onShape={(pendingHoleShape) =>
                  store.setViewer({
                    pendingHoleShape,
                    pendingHoleCornerRadius:
                      pendingHoleShape === "circle" ? 0 : store.pendingHoleCornerRadius,
                  })
                }
                onWidth={(pendingHoleWidth) =>
                  store.setViewer({
                    pendingHoleWidth,
                    pendingHoleLength:
                      store.pendingHoleShape === "circle" ? pendingHoleWidth : store.pendingHoleLength,
                  })
                }
                onLength={(pendingHoleLength) => store.setViewer({ pendingHoleLength })}
                onDepth={(pendingHoleDepth) => store.setViewer({ pendingHoleDepth })}
                onCornerRadius={(pendingHoleCornerRadius) =>
                  store.setViewer({ pendingHoleCornerRadius })
                }
                onName={(pendingHoleName) => store.setViewer({ pendingHoleName })}
                onSaveTemplate={handleSaveHoleTemplate}
                onApplyTemplate={store.applyHoleTemplate}
                onRemoveTemplate={store.removeHoleTemplate}
                onRemove={store.removeMountingHole}
              />
            )}
          </div>
        );
      }
      case "export":
        return (
          <div className="space-y-4">
            <Section
              step="Passo 4 de 4"
              title="Exportar"
              description="Escolha o formato e baixe as peças prontas para impressão."
            >
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => store.patch({ exportFormat: "stl" })}
                  aria-pressed={store.exportFormat === "stl"}
                  className={cn(
                    "rounded-[14px] border px-3 py-3 text-left transition",
                    store.exportFormat === "stl"
                      ? "border-accent/50 bg-accent/5 ring-1 ring-accent/20"
                      : "border-border hover:border-border-strong hover:bg-background",
                  )}
                >
                  <div className="flex flex-col gap-2">
                    <FileArchive className="size-4 shrink-0 text-accent" />
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">ZIP com STLs</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted">
                        Uma peça por arquivo .stl
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => store.patch({ exportFormat: "3mf" })}
                  aria-pressed={store.exportFormat === "3mf"}
                  className={cn(
                    "rounded-[14px] border px-3 py-3 text-left transition",
                    store.exportFormat === "3mf"
                      ? "border-accent/50 bg-accent/5 ring-1 ring-accent/20"
                      : "border-border hover:border-border-strong hover:bg-background",
                  )}
                >
                  <div className="flex flex-col gap-2">
                    <Boxes className="size-4 shrink-0 text-accent" />
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">3MF multi-bandeja</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted">
                        Uma peça por bandeja — Bambu / Orca
                      </p>
                    </div>
                  </div>
                </button>
              </div>
            </Section>

            {nativeApp ? <NfcWritePanel defaultText={store.text.trim() || "LightType"} /> : null}

            <div className="overflow-hidden rounded-[16px] border border-border bg-background">
              <div className="border-b border-border bg-surface px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-[10px] bg-accent-soft">
                    {store.exportFormat === "3mf" ? (
                      <Boxes className="size-4 text-accent" />
                    ) : (
                      <FileArchive className="size-4 text-accent" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">
                      {store.exportFormat === "3mf" ? "Arquivo 3MF" : "Pacote STL (ZIP)"}
                    </p>
                    {shownPreview ? (
                      <p className="truncate text-[12px] text-muted">
                        {shownPreview.letters.length}{" "}
                        {shownPreview.letters.length === 1 ? "letra" : "letras"}
                        {store.text.trim() ? ` · “${store.text.trim()}”` : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="space-y-2.5 px-4 py-3">
                <div className="flex items-start gap-2.5 text-[12px] leading-relaxed text-muted">
                  <Layers className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    {store.exportFormat === "3mf"
                      ? "Corpo, diffuser e acessórios — cada um na sua bandeja"
                      : "Corpo e face removível de cada letra, em arquivos STL separados"}
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-[12px] leading-relaxed text-muted">
                  <FileArchive className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    {store.exportFormat === "3mf"
                      ? "Um único .3mf compatível com Bambu Studio / Orca Slicer"
                      : "Todos os arquivos empacotados em um único ZIP"}
                  </span>
                </div>
                <div className="flex items-start gap-2.5 text-[12px] leading-relaxed text-muted">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
                  <span>Pronto para impressão 3D</span>
                </div>
              </div>
            </div>

            {generating ? <Progress value={job?.progress ?? 6} /> : null}
            {job?.status === "failed" ? (
              <div className="space-y-1">
                <p className="text-[12px] leading-4 text-accent">
                  {job.error?.message ?? "Erro ao gerar arquivos."}
                </p>
                {job.error?.suggestion ? (
                  <p className="text-[11px] leading-4 text-muted">{job.error.suggestion}</p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-2">
              <Button
                size="lg"
                className="w-full"
                onClick={() => openDownloadCheckout()}
                disabled={!hasInput || exportBusy}
              >
                <Download className="size-4" />
                {generating && pendingAction === "download"
                  ? "Gerando…"
                  : store.exportFormat === "3mf"
                    ? "Baixar 3MF"
                    : "Baixar pacote STL"}
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="w-full"
                onClick={() => openBambuConnect()}
                disabled={!hasInput || exportBusy}
              >
                <Printer className="size-4" />
                {bambuLaunching || (generating && pendingAction === "bambu")
                  ? "Abrindo Bambu Studio…"
                  : "Abrir no Bambu Studio"}
              </Button>
            </div>
            <p className="text-center text-[11px] leading-relaxed text-muted">
              {localHost
                ? "Abre o 3MF direto no Bambu Studio."
                : "Fora do localhost, baixamos o 3MF para você abrir no Studio."}
            </p>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted">
              <Lock className="size-3" />
              <span>
                {localHost
                  ? "Modo local — download direto sem checkout"
                  : "Checkout seguro com verificação por e-mail"}
              </span>
            </div>
            <button
              type="button"
              onClick={() => store.setActivePanel("tune")}
              className="w-full text-center text-[12px] text-muted hover:text-foreground"
            >
              ← Voltar aos ajustes
            </button>
          </div>
        );
      default:
        return null;
    }
  }

  const stepCompleted = {
    type: Boolean(store.modelPresetId),
    content: hasInput,
    tune: hasInput,
    export: false,
  };

  const activeStep = CREATOR_STEPS.find((s) => s.id === store.activePanel);

  const letterPreview = (
    <LetterPreview
      data={shownPreview}
      letterStyle={activeLetterStyle}
      depthMm={store.depthMm}
      frontMm={store.frontMm}
      wallMm={store.wallMm}
      wallProfileId={store.wallProfileId}
      showInterior={store.showInterior}
      showLed={store.showLed}
      showGrid={store.showGrid}
      showPlane={store.showPlane}
      showCrossSection={store.showCrossSection}
      explodedView={store.explodedView}
      explodedFactor={store.explodedFactor}
      mountingHoles={store.mountingHoles}
      holeToolActive={holeToolActive}
      pendingHole={
        holeToolActive
          ? {
              shape: store.pendingHoleShape,
              width_mm: store.pendingHoleWidth,
              length_mm:
                store.pendingHoleShape === "circle"
                  ? store.pendingHoleWidth
                  : store.pendingHoleLength,
              depth_mm: store.pendingHoleDepth,
              corner_radius_mm:
                store.pendingHoleShape === "circle"
                  ? store.pendingHoleWidth / 2
                  : store.pendingHoleCornerRadius,
            }
          : undefined
      }
      selectedLetterIndices={
        store.activePanel === "export" ? [] : store.selectedLetterIndices
      }
      selectedParts={store.activePanel === "export" ? [] : store.selectedParts}
      partColors={store.partColors}
      partOffsets={store.partOffsets}
      letterOffsets={store.letterOffsets}
      cameraView={store.cameraView}
      loading={loadingPreview && hasInput}
      error={shownError}
      onView={(cameraView) => store.setViewer({ cameraView })}
      onToggleExploded={() =>
        store.setViewer({
          explodedView: !store.explodedView,
          ...(store.explodedView ? { partOffsets: {} } : {}),
        })
      }
      onToggle={(key, value) => store.setViewer({ [key]: value })}
      onAddHole={handleAddHole}
      onUpdateHole={(id, partial) => store.updateMountingHole(id, partial)}
      onRemoveHole={(id) => store.removeMountingHole(id)}
      onViewerToolChange={(tool) => {
        const nextHole = tool === "hole";
        store.setViewer({ holeToolActive: nextHole });
        if (nextHole) {
          setTuneTab("holes");
          if (store.activePanel === "export") store.clearSelection();
          else if (store.activePanel !== "tune") store.setActivePanel("tune");
        } else {
          setTuneTab("geometry");
        }
      }}
      onSelectLetter={
        store.activePanel === "export" ? undefined : store.setSelectedLetter
      }
      onSelectPart={
        store.activePanel === "export" ? undefined : store.setSelectedPart
      }
      onDeselectLetter={store.clearSelection}
      onOffsetChange={
        store.activePanel === "export" ? undefined : store.setLetterOffset
      }
      onDepthChange={(depthMm) => store.patch({ depthMm })}
      onWallChange={(wallMm) => store.patch({ wallMm })}
      onPartColorChange={(selection, color) =>
        store.setPartColor(selection.letterIndex, selection.part, color)
      }
      onResetPartColor={(selection) => store.resetPartColor(selection.letterIndex, selection.part)}
      onDragPart={store.activePanel === "export" ? undefined : handleDragPart}
      onDragLetter={store.activePanel === "export" ? undefined : handleDragLetter}
    />
  );

  return (
    <div className="app-shell flex flex-col overflow-hidden md:flex-row">
      {/* Desktop: FLUXO + painel à esquerda · Mobile: preview + sheet + barra inferior */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col md:flex-row">
        {/* Menu de ações — ao lado do FLUXO no desktop; sheet no mobile */}
        <aside
          className={cn(
            "z-30 flex flex-col border-border bg-surface",
            /* Desktop: primeira coluna do grupo (ao lado do FLUXO) */
            "md:relative md:order-first md:flex md:h-full md:w-[22%] md:min-w-[280px] md:max-w-[360px] md:shrink-0 md:border-r",
            /* Mobile sheet */
            panelExpanded
              ? "absolute inset-x-0 bottom-0 h-[min(72%,40rem)] rounded-t-[20px] border-t shadow-[0_-16px_48px_rgba(34,34,34,0.18)] md:static md:h-full md:rounded-none md:shadow-none"
              : "hidden md:flex",
          )}
        >
          <div className="mx-auto mt-2 hidden h-1 w-10 shrink-0 rounded-full bg-border max-md:block" aria-hidden />
          <div className="flex h-11 shrink-0 items-center justify-between gap-3 px-4 md:h-12">
            <div className="flex min-w-0 items-center gap-2">
              <Logo className="text-[15px]" />
              {activeStep ? (
                <p className="truncate text-[11px] font-medium text-muted md:hidden">
                  {activeStep.step}/4 · {activeStep.label}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setPanelExpanded(false)}
              className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-background md:hidden"
              aria-label="Recolher menu de ações"
            >
              <ChevronDown className="size-5" strokeWidth={2} />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 pb-5 [-webkit-overflow-scrolling:touch]">
            {renderPanel()}
          </div>
        </aside>

        {/* Preview 3D */}
        <section className="relative min-h-0 min-w-0 flex-1">
          {letterPreview}

          {/* Backdrop quando o menu está aberto no mobile */}
          {panelExpanded ? (
            <button
              type="button"
              className="absolute inset-0 z-[25] bg-foreground/25 md:hidden"
              aria-label="Fechar menu de ações"
              onClick={() => setPanelExpanded(false)}
            />
          ) : null}
        </section>
      </div>

      <VerticalToolbar
        active={store.activePanel}
        onSelect={(panel) => {
          if (panel === "export") store.clearSelection();
          store.setActivePanel(panel);
          // No mobile, trocar de aba abre o menu de ações
          if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
            setPanelExpanded(true);
          }
        }}
        completed={stepCompleted}
      />

      <DownloadCheckoutModal
        open={checkoutOpen}
        onOpenChange={(open) => {
          setCheckoutOpen(open);
        }}
        onComplete={handleCheckoutComplete}
      />
    </div>
  );
}
