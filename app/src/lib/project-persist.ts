import {
  DEFAULT_PROJECT,
  type LetterPartKind,
  type ProjectConfig,
  type SelectedLetterPart,
  type ViewerPersistState,
} from "@/types";

const STORAGE_KEY = "lighttype-creator-project";
const STORAGE_VERSION = 1;

export type PersistedCamera = {
  position: [number, number, number];
  target: [number, number, number];
};

export type PersistedProject = ProjectConfig &
  ViewerPersistState & {
    camera?: PersistedCamera | null;
  };

type StoredPayload = {
  version: number;
  state: PersistedProject;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asCamera(value: unknown): PersistedCamera | null {
  if (!isRecord(value)) return null;
  const position = value.position;
  const target = value.target;
  if (!Array.isArray(position) || !Array.isArray(target)) return null;
  if (position.length !== 3 || target.length !== 3) return null;
  if (!position.every((n) => typeof n === "number") || !target.every((n) => typeof n === "number")) {
    return null;
  }
  return {
    position: [position[0], position[1], position[2]],
    target: [target[0], target[1], target[2]],
  };
}

function mergeProjectConfig(raw: Record<string, unknown>): ProjectConfig {
  const base = DEFAULT_PROJECT;
  return {
    text: asString(raw.text, base.text).slice(0, 48),
    fontId: asString(raw.fontId, base.fontId),
    heightMm: asNumber(raw.heightMm, base.heightMm),
    depthMm: asNumber(raw.depthMm, base.depthMm),
    wallMm: asNumber(raw.wallMm, base.wallMm),
    frontMm: asNumber(raw.frontMm, base.frontMm),
    spacingMm: asNumber(raw.spacingMm, base.spacingMm),
    plugProfile: asString(raw.plugProfile, base.plugProfile),
    plugPosition: asString(raw.plugPosition, base.plugPosition),
    frontMount: asString(raw.frontMount, base.frontMount),
    frontToleranceMm: asNumber(raw.frontToleranceMm, base.frontToleranceMm),
    snapFitToleranceMm: asNumber(raw.snapFitToleranceMm, base.snapFitToleranceMm),
    snapFitDepthMm: asNumber(raw.snapFitDepthMm, base.snapFitDepthMm),
    plugDiameterMm: asNullableNumber(raw.plugDiameterMm) ?? base.plugDiameterMm,
    plugLengthMm: asNullableNumber(raw.plugLengthMm) ?? base.plugLengthMm,
    plugNeckDiameterMm: asNullableNumber(raw.plugNeckDiameterMm) ?? base.plugNeckDiameterMm,
    plugNeckLengthMm: asNullableNumber(raw.plugNeckLengthMm) ?? base.plugNeckLengthMm,
    inputMode: raw.inputMode === "svg" ? "svg" : "text",
    svgContent: asNullableString(raw.svgContent),
    svgFileName: asNullableString(raw.svgFileName),
    letterStyleId: asString(raw.letterStyleId, base.letterStyleId),
    wallProfileId: asString(raw.wallProfileId, base.wallProfileId),
    friezeCount: asNumber(raw.friezeCount, base.friezeCount),
    friezeAdvanceMm: asNumber(raw.friezeAdvanceMm, base.friezeAdvanceMm),
    friezeSpacingMm: asNumber(raw.friezeSpacingMm, base.friezeSpacingMm),
    shelfRatio: asNumber(raw.shelfRatio, base.shelfRatio),
    shelfStepMm: asNumber(raw.shelfStepMm, base.shelfStepMm),
    close45Base: asBoolean(raw.close45Base, base.close45Base),
    inclinationMm: asNumber(raw.inclinationMm, base.inclinationMm),
    maxAngleDeg: asNumber(raw.maxAngleDeg, base.maxAngleDeg),
    baseEnabled: asBoolean(raw.baseEnabled, base.baseEnabled),
    baseHeightMm: asNumber(raw.baseHeightMm, base.baseHeightMm),
    baseConnectorWidthMm: asNumber(raw.baseConnectorWidthMm, base.baseConnectorWidthMm),
    basePosition: raw.basePosition === "top" ? "top" : "bottom",
    baseConnectorToleranceMm: asNumber(raw.baseConnectorToleranceMm, base.baseConnectorToleranceMm),
    baseMode: raw.baseMode === "modular" ? "modular" : "snap",
    shadowEnabled: asBoolean(raw.shadowEnabled, base.shadowEnabled),
    shadowOffsetMm: asNumber(raw.shadowOffsetMm, base.shadowOffsetMm),
    diffuserShellMm: asNumber(raw.diffuserShellMm, base.diffuserShellMm),
    diffuserToleranceMm: asNumber(raw.diffuserToleranceMm, base.diffuserToleranceMm),
    minCavityMm: asNumber(raw.minCavityMm, base.minCavityMm),
    accentLit: asBoolean(raw.accentLit, base.accentLit),
    mountingSystemId: asString(raw.mountingSystemId, base.mountingSystemId),
    materialPackId: asString(raw.materialPackId, base.materialPackId),
    modelPresetId: asNullableString(raw.modelPresetId),
    exportFormat: raw.exportFormat === "3mf" ? "3mf" : "stl",
    mountingHoles: Array.isArray(raw.mountingHoles)
      ? raw.mountingHoles
          .filter(isRecord)
          .map((hole, index) => ({
            id: asString(hole.id, `hole-restored-${index}`),
            x: asNumber(hole.x, 0),
            y: asNumber(hole.y, 0),
            shape: hole.shape === "rect" ? "rect" : "circle",
            width_mm: asNumber(hole.width_mm, 4),
            length_mm: asNumber(hole.length_mm, 4),
            depth_mm: asNumber(hole.depth_mm, 6),
            corner_radius_mm: asNumber(hole.corner_radius_mm, 0),
            face: hole.face === "body" ? "body" : "back",
            letter_index: asNumber(hole.letter_index, 0),
            name: typeof hole.name === "string" ? hole.name : undefined,
          }))
      : base.mountingHoles,
  };
}

function mergeViewerState(raw: Record<string, unknown>): ViewerPersistState {
  const letterOffsets: Record<number, { x: number; y: number }> = {};
  if (isRecord(raw.letterOffsets)) {
    for (const [key, value] of Object.entries(raw.letterOffsets)) {
      const index = Number(key);
      if (!Number.isInteger(index) || !isRecord(value)) continue;
      letterOffsets[index] = {
        x: asNumber(value.x, 0),
        y: asNumber(value.y, 0),
      };
    }
  }

  const selectedLetterIndices: number[] = [];
  if (Array.isArray(raw.selectedLetterIndices)) {
    for (const value of raw.selectedLetterIndices) {
      if (typeof value === "number" && Number.isInteger(value) && !selectedLetterIndices.includes(value)) {
        selectedLetterIndices.push(value);
      }
    }
  } else if (
    typeof raw.selectedLetterIndex === "number" &&
    Number.isInteger(raw.selectedLetterIndex)
  ) {
    selectedLetterIndices.push(raw.selectedLetterIndex);
  }

  const validParts = new Set(["body", "back", "front", "support"]);
  const parsePart = (value: unknown): SelectedLetterPart | null => {
    if (!isRecord(value)) return null;
    const letterIndex = value.letterIndex;
    const part = value.part;
    if (
      typeof letterIndex === "number" &&
      Number.isInteger(letterIndex) &&
      typeof part === "string" &&
      validParts.has(part)
    ) {
      return { letterIndex, part: part as LetterPartKind };
    }
    return null;
  };

  const selectedParts: SelectedLetterPart[] = [];
  if (Array.isArray(raw.selectedParts)) {
    for (const value of raw.selectedParts) {
      const parsed = parsePart(value);
      if (
        parsed &&
        !selectedParts.some(
          (p) => p.letterIndex === parsed.letterIndex && p.part === parsed.part,
        )
      ) {
        selectedParts.push(parsed);
      }
    }
  } else {
    const legacy = parsePart(raw.selectedPart);
    if (legacy) selectedParts.push(legacy);
  }

  const partColors: Record<string, string> = {};
  if (isRecord(raw.partColors)) {
    for (const [key, value] of Object.entries(raw.partColors)) {
      if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) {
        partColors[key] = value;
      }
    }
  }

  const partOffsets: Record<string, { x: number; y: number }> = {};
  if (isRecord(raw.partOffsets)) {
    for (const [key, value] of Object.entries(raw.partOffsets)) {
      if (!isRecord(value)) continue;
      partOffsets[key] = {
        x: asNumber(value.x, 0),
        y: asNumber(value.y, 0),
      };
    }
  }

  const activePanel = raw.activePanel;
  const validPanels = new Set(["type", "content", "tune", "export"]);
  const legacyPanelMap: Record<string, ViewerPersistState["activePanel"]> = {
    input: "content",
    params: "tune",
    holes: "tune",
    view: "tune",
    styles: "content",
  };

  const cameraView = raw.cameraView;
  const validViews = new Set([
    "free",
    "front",
    "back",
    "side",
    "reset",
    "left",
    "right",
    "plateFront",
    "plateBack",
  ]);

  const resolvedActivePanel: ViewerPersistState["activePanel"] =
    typeof activePanel === "string"
      ? validPanels.has(activePanel)
        ? (activePanel as ViewerPersistState["activePanel"])
        : (legacyPanelMap[activePanel] ?? "type")
      : "type";

  return {
    showInterior: asBoolean(raw.showInterior, false),
    showLed: asBoolean(raw.showLed, true),
    showGrid: asBoolean(raw.showGrid, true),
    showPlane: asBoolean(raw.showPlane, true),
    showCrossSection: asBoolean(raw.showCrossSection, false),
    explodedView: asBoolean(raw.explodedView, false),
    cameraView:
      typeof cameraView === "string" && validViews.has(cameraView)
        ? (cameraView as ViewerPersistState["cameraView"])
        : "reset",
    activePanel: resolvedActivePanel,
    holeToolActive: asBoolean(raw.holeToolActive, false),
    pendingHoleShape: raw.pendingHoleShape === "rect" ? "rect" : "circle",
    pendingHoleWidth: asNumber(raw.pendingHoleWidth, 4),
    pendingHoleLength: asNumber(raw.pendingHoleLength, 4),
    pendingHoleDepth: asNumber(raw.pendingHoleDepth, 6),
    pendingHoleCornerRadius: asNumber(raw.pendingHoleCornerRadius, 0),
    pendingHoleName: asString(raw.pendingHoleName, ""),
    selectedLetterIndices,
    selectedParts,
    partColors,
    partOffsets,
    letterOffsets,
  };
}

export function loadPersistedProject(): PersistedProject | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPayload | PersistedProject;
    const state = isRecord(parsed) && "state" in parsed ? parsed.state : parsed;
    if (!isRecord(state)) return null;
    return {
      ...mergeProjectConfig(state),
      ...mergeViewerState(state),
      camera: asCamera(state.camera),
    };
  } catch {
    return null;
  }
}

export function persistProjectState(state: PersistedProject) {
  if (typeof window === "undefined") return;
  const payload: StoredPayload = {
    version: STORAGE_VERSION,
    state,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function clearPersistedProject() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function syncHoleCounterFromIds(holes: { id: string }[], current: number) {
  let next = current;
  for (const hole of holes) {
    const match = /^hole-(\d+)$/.exec(hole.id);
    if (match) next = Math.max(next, Number(match[1]));
  }
  return next;
}
