"use client";

import { create } from "zustand";
import {
  loadHoleTemplates,
  newHoleTemplateId,
  persistHoleTemplates,
} from "@/lib/hole-templates";
import {
  clearPersistedProject,
  loadPersistedProject,
  persistProjectState,
  syncHoleCounterFromIds,
  type PersistedCamera,
  type PersistedProject,
} from "@/lib/project-persist";
import {
  DEFAULT_PROJECT,
  type HoleShape,
  type HoleTemplate,
  type LetterOffset,
  type LetterPartKind,
  type MountingHole,
  type PanelId,
  type ProjectConfig,
  type SelectedLetterPart,
  type ViewerPersistState,
} from "@/types";

export type HolePreviewPos = {
  letterIndex: number;
  x: number;
  y: number;
};

type ViewerState = ViewerPersistState & {
  explodedFactor: number;
  savedHoleTemplates: HoleTemplate[];
  camera: PersistedCamera | null;
  holePreviewPos: HolePreviewPos | null;
};

type CreatorState = ProjectConfig &
  ViewerState & {
    setText: (text: string) => void;
    setFontId: (fontId: string) => void;
    patch: (partial: Partial<ProjectConfig>) => void;
    setViewer: (partial: Partial<ViewerState>) => void;
    setCamera: (camera: PersistedCamera | null) => void;
    setActivePanel: (panel: PanelId) => void;
    setHolePreviewPos: (pos: HolePreviewPos | null) => void;
    setSelectedLetter: (index: number | null, options?: { additive?: boolean }) => void;
    setSelectedPart: (part: SelectedLetterPart | null, options?: { additive?: boolean }) => void;
    clearSelection: () => void;
    setPartColor: (letterIndex: number, part: LetterPartKind, color: string) => void;
    resetPartColor: (letterIndex: number, part: LetterPartKind) => void;
    setPartOffset: (letterIndex: number, part: LetterPartKind, offset: Partial<LetterOffset>) => void;
    setLetterOffset: (index: number, offset: Partial<LetterOffset>) => void;
    addMountingHole: (hole: Omit<MountingHole, "id">) => void;
    removeMountingHole: (id: string) => void;
    updateMountingHole: (id: string, partial: Partial<MountingHole>) => void;
    saveHoleTemplate: () => string | null;
    removeHoleTemplate: (id: string) => void;
    applyHoleTemplate: (id: string) => void;
    reset: () => void;
    resetLetterOffsets: () => void;
    undo: () => boolean;
    redo: () => boolean;
    canUndo: () => boolean;
    canRedo: () => boolean;
  };

const DEFAULT_VIEWER: ViewerPersistState = {
  showInterior: false,
  showLed: true,
  showGrid: true,
  showPlane: true,
  showCrossSection: false,
  explodedView: false,
  cameraView: "reset",
  activePanel: "type",
  holeToolActive: false,
  pendingHoleShape: "circle",
  pendingHoleWidth: 4,
  pendingHoleLength: 4,
  pendingHoleDepth: 6,
  pendingHoleCornerRadius: 0,
  pendingHoleName: "",
  selectedLetterIndices: [],
  selectedParts: [],
  partColors: {},
  partOffsets: {},
  letterOffsets: {},
};

const DEFAULT_SESSION: Pick<ViewerState, "holePreviewPos" | "explodedFactor" | "savedHoleTemplates" | "camera"> = {
  holePreviewPos: null,
  explodedFactor: 0,
  savedHoleTemplates: [],
  camera: null,
};

type CreatorDataState = Omit<
  CreatorState,
  | "setText"
  | "setFontId"
  | "patch"
  | "setViewer"
  | "setCamera"
  | "setActivePanel"
  | "setHolePreviewPos"
  | "setSelectedLetter"
  | "setSelectedPart"
  | "clearSelection"
  | "setPartColor"
  | "resetPartColor"
  | "setPartOffset"
  | "setLetterOffset"
  | "addMountingHole"
  | "removeMountingHole"
  | "updateMountingHole"
  | "saveHoleTemplate"
  | "removeHoleTemplate"
  | "applyHoleTemplate"
  | "reset"
  | "resetLetterOffsets"
  | "undo"
  | "redo"
  | "canUndo"
  | "canRedo"
>;

/** Project fields restored by Cmd+Z / Cmd+Shift+Z. */
type UndoSnapshot = Pick<
  CreatorDataState,
  | "text"
  | "fontId"
  | "heightMm"
  | "depthMm"
  | "wallMm"
  | "frontMm"
  | "spacingMm"
  | "plugProfile"
  | "plugPosition"
  | "frontMount"
  | "frontToleranceMm"
  | "snapFitToleranceMm"
  | "snapFitDepthMm"
  | "plugDiameterMm"
  | "plugLengthMm"
  | "plugNeckDiameterMm"
  | "plugNeckLengthMm"
  | "inputMode"
  | "svgContent"
  | "svgFileName"
  | "letterStyleId"
  | "wallProfileId"
  | "friezeCount"
  | "friezeAdvanceMm"
  | "friezeSpacingMm"
  | "shelfRatio"
  | "shelfStepMm"
  | "close45Base"
  | "inclinationMm"
  | "maxAngleDeg"
  | "mountingHoles"
  | "baseEnabled"
  | "baseHeightMm"
  | "baseConnectorWidthMm"
  | "basePosition"
  | "baseConnectorToleranceMm"
  | "baseMode"
  | "shadowEnabled"
  | "shadowOffsetMm"
  | "diffuserShellMm"
  | "diffuserToleranceMm"
  | "minCavityMm"
  | "accentLit"
  | "mountingSystemId"
  | "materialPackId"
  | "modelPresetId"
  | "exportFormat"
  | "partColors"
  | "partOffsets"
  | "letterOffsets"
>;

const MAX_UNDO = 60;
const undoStack: UndoSnapshot[] = [];
const redoStack: UndoSnapshot[] = [];
let lastCoalesceKey: string | null = null;

function takeUndoSnapshot(state: CreatorState): UndoSnapshot {
  return {
    text: state.text,
    fontId: state.fontId,
    heightMm: state.heightMm,
    depthMm: state.depthMm,
    wallMm: state.wallMm,
    frontMm: state.frontMm,
    spacingMm: state.spacingMm,
    plugProfile: state.plugProfile,
    plugPosition: state.plugPosition,
    frontMount: state.frontMount,
    frontToleranceMm: state.frontToleranceMm,
    snapFitToleranceMm: state.snapFitToleranceMm,
    snapFitDepthMm: state.snapFitDepthMm,
    plugDiameterMm: state.plugDiameterMm,
    plugLengthMm: state.plugLengthMm,
    plugNeckDiameterMm: state.plugNeckDiameterMm,
    plugNeckLengthMm: state.plugNeckLengthMm,
    inputMode: state.inputMode,
    svgContent: state.svgContent,
    svgFileName: state.svgFileName,
    letterStyleId: state.letterStyleId,
    wallProfileId: state.wallProfileId,
    friezeCount: state.friezeCount,
    friezeAdvanceMm: state.friezeAdvanceMm,
    friezeSpacingMm: state.friezeSpacingMm,
    shelfRatio: state.shelfRatio,
    shelfStepMm: state.shelfStepMm,
    close45Base: state.close45Base,
    inclinationMm: state.inclinationMm,
    maxAngleDeg: state.maxAngleDeg,
    mountingHoles: state.mountingHoles.map((h) => ({ ...h })),
    baseEnabled: state.baseEnabled,
    baseHeightMm: state.baseHeightMm,
    baseConnectorWidthMm: state.baseConnectorWidthMm,
    basePosition: state.basePosition,
    baseConnectorToleranceMm: state.baseConnectorToleranceMm,
    baseMode: state.baseMode,
    shadowEnabled: state.shadowEnabled,
    shadowOffsetMm: state.shadowOffsetMm,
    diffuserShellMm: state.diffuserShellMm,
    diffuserToleranceMm: state.diffuserToleranceMm,
    minCavityMm: state.minCavityMm,
    accentLit: state.accentLit,
    mountingSystemId: state.mountingSystemId,
    materialPackId: state.materialPackId,
    modelPresetId: state.modelPresetId,
    exportFormat: state.exportFormat,
    partColors: { ...state.partColors },
    partOffsets: Object.fromEntries(
      Object.entries(state.partOffsets).map(([k, v]) => [k, { ...v }]),
    ),
    letterOffsets: Object.fromEntries(
      Object.entries(state.letterOffsets).map(([k, v]) => [k, { ...v }]),
    ),
  };
}

function recordUndo(get: () => CreatorState, coalesceKey?: string) {
  if (coalesceKey && coalesceKey === lastCoalesceKey && undoStack.length > 0) {
    return;
  }
  undoStack.push(takeUndoSnapshot(get()));
  while (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
  lastCoalesceKey = coalesceKey ?? null;
}

function applyUndoSnapshot(set: (partial: Partial<CreatorState>) => void, snapshot: UndoSnapshot) {
  holeCounter = syncHoleCounterFromIds(snapshot.mountingHoles, 0);
  set(snapshot);
}

/** Always defaults — never read localStorage here (SSR/client first paint must match). */
function buildDefaultState(): CreatorDataState {
  return {
    ...DEFAULT_PROJECT,
    ...DEFAULT_VIEWER,
    ...DEFAULT_SESSION,
  };
}

function stateFromPersisted(persisted: PersistedProject): CreatorDataState {
  const { camera, ...rest } = persisted;
  const activePanel = rest.activePanel ?? "type";
  return {
    ...rest,
    activePanel,
    holeToolActive: Boolean(rest.holeToolActive),
    ...DEFAULT_SESSION,
    explodedFactor: rest.explodedView ? 1 : 0,
    savedHoleTemplates: loadHoleTemplates(),
    camera: camera ?? null,
  };
}

function toPersistedProject(state: CreatorState): PersistedProject {
  return {
    text: state.text,
    fontId: state.fontId,
    heightMm: state.heightMm,
    depthMm: state.depthMm,
    wallMm: state.wallMm,
    frontMm: state.frontMm,
    spacingMm: state.spacingMm,
    plugProfile: state.plugProfile,
    plugPosition: state.plugPosition,
    frontMount: state.frontMount,
    frontToleranceMm: state.frontToleranceMm,
    snapFitToleranceMm: state.snapFitToleranceMm,
    snapFitDepthMm: state.snapFitDepthMm,
    plugDiameterMm: state.plugDiameterMm,
    plugLengthMm: state.plugLengthMm,
    plugNeckDiameterMm: state.plugNeckDiameterMm,
    plugNeckLengthMm: state.plugNeckLengthMm,
    inputMode: state.inputMode,
    svgContent: state.svgContent,
    svgFileName: state.svgFileName,
    letterStyleId: state.letterStyleId,
    wallProfileId: state.wallProfileId,
    friezeCount: state.friezeCount,
    friezeAdvanceMm: state.friezeAdvanceMm,
    friezeSpacingMm: state.friezeSpacingMm,
    shelfRatio: state.shelfRatio,
    shelfStepMm: state.shelfStepMm,
    close45Base: state.close45Base,
    inclinationMm: state.inclinationMm,
    maxAngleDeg: state.maxAngleDeg,
    mountingHoles: state.mountingHoles,
    baseEnabled: state.baseEnabled,
    baseHeightMm: state.baseHeightMm,
    baseConnectorWidthMm: state.baseConnectorWidthMm,
    basePosition: state.basePosition,
    baseConnectorToleranceMm: state.baseConnectorToleranceMm,
    baseMode: state.baseMode,
    shadowEnabled: state.shadowEnabled,
    shadowOffsetMm: state.shadowOffsetMm,
    diffuserShellMm: state.diffuserShellMm,
    diffuserToleranceMm: state.diffuserToleranceMm,
    minCavityMm: state.minCavityMm,
    accentLit: state.accentLit,
    mountingSystemId: state.mountingSystemId,
    materialPackId: state.materialPackId,
    modelPresetId: state.modelPresetId,
    exportFormat: state.exportFormat,
    showInterior: state.showInterior,
    showLed: state.showLed,
    showGrid: state.showGrid,
    showPlane: state.showPlane,
    showCrossSection: state.showCrossSection,
    explodedView: state.explodedView,
    cameraView: state.cameraView,
    activePanel: state.activePanel,
    holeToolActive: state.holeToolActive,
    pendingHoleShape: state.pendingHoleShape,
    pendingHoleWidth: state.pendingHoleWidth,
    pendingHoleLength: state.pendingHoleLength,
    pendingHoleDepth: state.pendingHoleDepth,
    pendingHoleCornerRadius: state.pendingHoleCornerRadius,
    pendingHoleName: state.pendingHoleName,
    selectedLetterIndices: state.selectedLetterIndices,
    selectedParts: state.selectedParts,
    partColors: state.partColors,
    partOffsets: state.partOffsets,
    letterOffsets: state.letterOffsets,
    camera: state.camera,
  };
}

const initialState = buildDefaultState();
let holeCounter = 0;

export const useCreatorStore = create<CreatorState>((set, get) => ({
  ...initialState,
  setText: (text) => {
    recordUndo(get, "text");
    set({ text: text.replace(/\r\n?/g, "\n").slice(0, 48), letterOffsets: {} });
  },
  setFontId: (fontId) => {
    recordUndo(get);
    set({ fontId, letterOffsets: {} });
  },
  patch: (partial) => {
    const spacingKeys = [
      "spacingMm",
      "heightMm",
      "baseEnabled",
      "baseHeightMm",
      "baseConnectorWidthMm",
      "basePosition",
    ] as const;
    const shouldResetOffsets = spacingKeys.some((key) => key in partial);
    const coalesceKey = `patch:${Object.keys(partial).sort().join(",")}`;
    recordUndo(get, coalesceKey);
    set((s) => ({
      ...partial,
      ...(shouldResetOffsets ? { letterOffsets: {} } : {}),
    }));
  },
  setViewer: (partial) =>
    set((s) => ({
      ...partial,
      ...(partial.explodedView === false ? { selectedParts: [] } : {}),
      ...(partial.cameraView && partial.cameraView !== "free" ? { camera: null } : {}),
    })),
  setCamera: (camera) => set({ camera }),
  setActivePanel: (activePanel) => set({ activePanel }),
  setHolePreviewPos: (holePreviewPos) => set({ holePreviewPos }),
  setSelectedLetter: (index, options) =>
    set((s) => {
      if (index === null) return { selectedLetterIndices: [], selectedParts: [] };
      const additive = options?.additive ?? false;
      if (additive) {
        const exists = s.selectedLetterIndices.includes(index);
        return {
          selectedLetterIndices: exists
            ? s.selectedLetterIndices.filter((i) => i !== index)
            : [...s.selectedLetterIndices, index],
          selectedParts: [],
        };
      }
      // Clique sem modificador em item já multi-selecionado: mantém o grupo (para arrastar juntos)
      if (s.selectedLetterIndices.includes(index) && s.selectedLetterIndices.length > 1) {
        return {
          selectedLetterIndices: [
            ...s.selectedLetterIndices.filter((i) => i !== index),
            index,
          ],
          selectedParts: [],
        };
      }
      return { selectedLetterIndices: [index], selectedParts: [] };
    }),
  setSelectedPart: (part, options) =>
    set((s) => {
      if (part === null) return { selectedParts: [], selectedLetterIndices: [] };
      const additive = options?.additive ?? false;
      const same = (a: SelectedLetterPart, b: SelectedLetterPart) =>
        a.letterIndex === b.letterIndex && a.part === b.part;
      if (additive) {
        const exists = s.selectedParts.some((p) => same(p, part));
        return {
          selectedParts: exists
            ? s.selectedParts.filter((p) => !same(p, part))
            : [...s.selectedParts, part],
          selectedLetterIndices: [],
        };
      }
      if (
        s.selectedParts.some((p) => same(p, part)) &&
        s.selectedParts.length > 1
      ) {
        return {
          selectedParts: [...s.selectedParts.filter((p) => !same(p, part)), part],
          selectedLetterIndices: [],
        };
      }
      return { selectedParts: [part], selectedLetterIndices: [] };
    }),
  clearSelection: () => set({ selectedLetterIndices: [], selectedParts: [] }),
  setPartColor: (letterIndex, part, color) => {
    recordUndo(get, "color");
    set((s) => ({
      partColors: { ...s.partColors, [`${letterIndex}:${part}`]: color },
    }));
  },
  resetPartColor: (letterIndex, part) => {
    recordUndo(get, "color");
    set((s) => {
      const key = `${letterIndex}:${part}`;
      if (!(key in s.partColors)) return s;
      const partColors = { ...s.partColors };
      delete partColors[key];
      return { partColors };
    });
  },
  setPartOffset: (letterIndex, part, offset) => {
    recordUndo(get, "partOffset");
    set((s) => {
      const key = `${letterIndex}:${part}`;
      return {
        partOffsets: {
          ...s.partOffsets,
          [key]: { ...(s.partOffsets[key] ?? { x: 0, y: 0 }), ...offset },
        },
      };
    });
  },
  setLetterOffset: (index, offset) => {
    recordUndo(get, "letterOffset");
    set((s) => ({
      letterOffsets: {
        ...s.letterOffsets,
        [index]: { ...(s.letterOffsets[index] ?? { x: 0, y: 0 }), ...offset },
      },
    }));
  },
  addMountingHole: (hole) => {
    recordUndo(get);
    set((s) => ({
      mountingHoles: [...s.mountingHoles, { ...hole, id: `hole-${++holeCounter}` }],
    }));
  },
  removeMountingHole: (id) => {
    recordUndo(get);
    set((s) => ({ mountingHoles: s.mountingHoles.filter((h) => h.id !== id) }));
  },
  updateMountingHole: (id, partial) => {
    recordUndo(get, `hole:${id}:${Object.keys(partial).sort().join(",")}`);
    set((s) => ({
      mountingHoles: s.mountingHoles.map((h) => (h.id === id ? { ...h, ...partial } : h)),
    }));
  },
  saveHoleTemplate: () => {
    const s = get();
    const name = s.pendingHoleName.trim();
    if (!name) return null;
    const template: HoleTemplate = {
      id: newHoleTemplateId(),
      name,
      shape: s.pendingHoleShape,
      width_mm: s.pendingHoleWidth,
      length_mm: s.pendingHoleShape === "circle" ? s.pendingHoleWidth : s.pendingHoleLength,
      depth_mm: s.pendingHoleDepth,
      corner_radius_mm: s.pendingHoleShape === "circle" ? s.pendingHoleWidth / 2 : s.pendingHoleCornerRadius,
    };
    const savedHoleTemplates = [...s.savedHoleTemplates, template];
    persistHoleTemplates(savedHoleTemplates);
    set({ savedHoleTemplates });
    return template.id;
  },
  removeHoleTemplate: (id) =>
    set((s) => {
      const savedHoleTemplates = s.savedHoleTemplates.filter((t) => t.id !== id);
      persistHoleTemplates(savedHoleTemplates);
      return { savedHoleTemplates };
    }),
  applyHoleTemplate: (id) => {
    const template = get().savedHoleTemplates.find((t) => t.id === id);
    if (!template) return;
    set({
      pendingHoleShape: template.shape,
      pendingHoleWidth: template.width_mm,
      pendingHoleLength: template.length_mm,
      pendingHoleDepth: template.depth_mm,
      pendingHoleCornerRadius: template.corner_radius_mm,
      pendingHoleName: template.name,
    });
  },
  reset: () => {
    clearPersistedProject();
    holeCounter = 0;
    undoStack.length = 0;
    redoStack.length = 0;
    lastCoalesceKey = null;
    set({
      ...DEFAULT_PROJECT,
      ...DEFAULT_VIEWER,
      ...DEFAULT_SESSION,
      cameraView: "reset",
      savedHoleTemplates: loadHoleTemplates(),
    });
  },
  resetLetterOffsets: () => {
    recordUndo(get);
    set({ letterOffsets: {} });
  },
  canUndo: () => undoStack.length > 0,
  canRedo: () => redoStack.length > 0,
  undo: () => {
    if (undoStack.length === 0) return false;
    const current = takeUndoSnapshot(get());
    const previous = undoStack.pop()!;
    redoStack.push(current);
    lastCoalesceKey = null;
    applyUndoSnapshot(set, previous);
    return true;
  },
  redo: () => {
    if (redoStack.length === 0) return false;
    const current = takeUndoSnapshot(get());
    const next = redoStack.pop()!;
    undoStack.push(current);
    lastCoalesceKey = null;
    applyUndoSnapshot(set, next);
    return true;
  },
}));

if (typeof window !== "undefined") {
  let persistTimer: number | null = null;
  useCreatorStore.subscribe((state) => {
    if (persistTimer) window.clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      persistProjectState(toPersistedProject(state));
    }, 250);
  });
}

/** Restore localStorage after mount to avoid React hydration mismatch #418. */
export function hydrateCreatorStoreFromStorage() {
  const persisted = loadPersistedProject();
  const templates = loadHoleTemplates();
  if (!persisted && templates.length === 0) return;

  if (persisted) {
    const next = stateFromPersisted(persisted);
    holeCounter = syncHoleCounterFromIds(next.mountingHoles, 0);
    useCreatorStore.setState(next);
    return;
  }

  useCreatorStore.setState({ savedHoleTemplates: templates });
}
