export type Ring = number[][];

export type FriezeBand = {
  outer: Ring[];
  holes: Ring[];
  step: number;
  index: number;
};

export type RingContour = {
  outer: Ring[];
  holes: Ring[];
};

export type ShadowCoverPreview = RingContour;

export type SnapFitPreview = {
  enabled: boolean;
  tight: boolean;
  channel_z: number;
  channel_height: number;
  lip_depth: number;
  groove: RingContour;
  lip: RingContour;
  front_inset: RingContour;
};

export type DiffuserPreview = {
  enabled: boolean;
  shelf_z: number;
  pocket_height: number;
  shell_mm: number;
  face_mm: number;
  tolerance_mm: number;
  island_count?: number;
  outer: RingContour;
  inner: RingContour;
  flange: RingContour;
  shell_wall: RingContour;
};

export type SupportRibPreview = {
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  depth: number;
};

export type ConnectionBasePreview = {
  position: string;
  mode?: string;
  outer: Ring[];
  holes: Ring[];
  groove: RingContour;
  male_tab?: RingContour;
  side_tunnels?: {
    left: RingContour;
    right?: RingContour;
  };
  right_groove?: RingContour | null;
  wall_slots?: RingContour;
  y_range: [number, number];
  connector_width_mm: number;
  spacing_mm?: number;
};

export type PreviewLetter = {
  char: string;
  index: number;
  x: number;
  width: number;
  height: number;
  bounds: [number, number, number, number];
  glyph_bounds?: [number, number, number, number];
  outer: Ring[];
  holes: Ring[];
  inner: Ring[];
  inner_holes: Ring[];
  has_cavity: boolean;
  frieze_bands?: FriezeBand[];
  snap_fit?: SnapFitPreview | null;
  diffuser?: DiffuserPreview | null;
  counter_bridges?: RingContour | null;
  support_ribs?: SupportRibPreview[];
  rear_mm?: number;
  shelf_z?: number | null;
  connection_base?: ConnectionBasePreview | null;
};

export type HoleShape = "circle" | "rect";

export type MountingHole = {
  id: string;
  x: number;
  y: number;
  shape: HoleShape;
  width_mm: number;
  length_mm: number;
  depth_mm: number;
  corner_radius_mm: number;
  face: "back" | "body";
  letter_index: number;
  name?: string;
};

export type HoleTemplate = {
  id: string;
  name: string;
  shape: HoleShape;
  width_mm: number;
  length_mm: number;
  depth_mm: number;
  corner_radius_mm: number;
};

export type LetterOffset = {
  x: number;
  y: number;
};

export type LetterPartKind = "body" | "back" | "front" | "support";

export type SelectedLetterPart = {
  letterIndex: number;
  part: LetterPartKind;
};

export const LETTER_PART_LABELS: Record<LetterPartKind, string> = {
  body: "Corpo",
  back: "Fundo",
  front: "Face",
  support: "Nervura",
};

export type LetterStyleInfo = {
  id: string;
  name: string;
  subtitle: string;
  front_mount: string;
  rear_type: string;
  supports: number;
  backlit: boolean;
  available: boolean;
};

export type PreviewData = {
  text: string;
  font_id: string;
  height_mm: number;
  wall_mm: number;
  spacing_mm: number;
  input_mode: string;
  letter_style_id: string;
  letter_style?: LetterStyleInfo;
  wall_profile_id: string;
  frieze_count: number;
  frieze_advance_mm: number;
  frieze_spacing_mm: number;
  shelf_ratio?: number;
  shelf_step_mm?: number;
  depth_mm?: number;
  front_mm?: number;
  front_mount?: string;
  front_tolerance_mm?: number;
  snap_fit_tolerance_mm?: number;
  snap_fit_depth_mm?: number;
  diffuser_shell_mm?: number;
  diffuser_tolerance_mm?: number;
  base_enabled?: boolean;
  base_height_mm?: number;
  base_connector_width_mm?: number;
  base_position?: string;
  base_connector_tolerance_mm?: number;
  base_mode?: string;
  shadow_enabled?: boolean;
  shadow_offset_mm?: number;
  shadow_cover?: ShadowCoverPreview | null;
  shadow_depth_mm?: number | null;
  mounting_holes: Omit<MountingHole, "id">[];
  letters: PreviewLetter[];
  layout_width: number;
  layout_height: number;
  bounds: [number, number, number, number];
  unsupported: string[];
  letter_count: number;
};

export type FontInfo = {
  id: string;
  name: string;
  category: string;
  family: string;
  weight: number;
  preview_weight: number;
  description?: string;
};

export type ModelPresetUi = {
  show_base?: boolean;
  lock_base?: boolean;
  show_shadow?: boolean;
  show_holes?: boolean;
  show_plug?: boolean;
  show_letter_style?: boolean;
  mounting_label?: string;
  suggest_holes?: boolean;
};

export type ModelPresetInfo = {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  available: boolean;
  image?: string;
  mounting_system_id?: string;
  ui?: ModelPresetUi;
  patch: Record<string, unknown>;
};

export type MaterialPackInfo = {
  id: string;
  name: string;
  subtitle: string;
  available: boolean;
  body: string;
  face: string;
  notes: string;
  patch: Record<string, unknown>;
};

export type MountingSystemInfo = {
  id: string;
  name: string;
  subtitle?: string;
  available: boolean;
  note?: string;
  patch?: Record<string, unknown>;
  suggest_holes?: boolean;
};

export type WallProfileInfo = {
  id: string;
  name: string;
  subtitle: string;
  available: boolean;
};

export type PlugProfileInfo = {
  id: string;
  name: string;
  subtitle: string;
  prototype: boolean;
  diameter_mm: number;
  length_mm: number;
  neck_diameter_mm: number;
  neck_length_mm: number;
  tolerance_mm: number;
  locking_type: string;
  rotation: number;
  note: string;
};

export type ApiError = {
  message: string;
  suggestion?: string;
  letter?: string;
};

export type JobStatus = {
  job_id: string;
  status: "queued" | "generating" | "completed" | "failed" | string;
  stage: string;
  stage_label: string;
  progress: number;
  error: ApiError | null;
  result: {
    text: string;
    letter_count: number;
    part_count: number;
    zip_name: string;
    export_format?: "stl" | "3mf" | string;
    files: string[];
  } | null;
};

export type InputMode = "text" | "svg";

export type PanelId = "type" | "content" | "tune" | "export";

export const CREATOR_STEPS: { id: PanelId; step: number; label: string; short: string }[] = [
  { id: "type", step: 1, label: "Modelo", short: "Modelo" },
  { id: "content", step: 2, label: "Personalizar", short: "Personalizar" },
  { id: "tune", step: 3, label: "Ajustes finos", short: "Ajustes" },
  { id: "export", step: 4, label: "Exportar", short: "Exportar" },
];

export type CameraView =
  | "free"
  | "front"
  | "back"
  | "side"
  | "reset"
  | "left"
  | "right"
  | "plateFront"
  | "plateBack";

export type ViewerPersistState = {
  showInterior: boolean;
  showLed: boolean;
  showGrid: boolean;
  showPlane: boolean;
  showCrossSection: boolean;
  explodedView: boolean;
  cameraView: CameraView;
  activePanel: PanelId;
  holeToolActive: boolean;
  pendingHoleShape: HoleShape;
  pendingHoleWidth: number;
  pendingHoleLength: number;
  pendingHoleDepth: number;
  pendingHoleCornerRadius: number;
  pendingHoleName: string;
  selectedLetterIndices: number[];
  selectedParts: SelectedLetterPart[];
  partColors: Record<string, string>;
  partOffsets: Record<string, LetterOffset>;
  letterOffsets: Record<number, LetterOffset>;
};

export type ProjectConfig = {
  text: string;
  fontId: string;
  heightMm: number;
  depthMm: number;
  wallMm: number;
  frontMm: number;
  spacingMm: number;
  plugProfile: string;
  plugPosition: string;
  frontMount: string;
  frontToleranceMm: number;
  snapFitToleranceMm: number;
  snapFitDepthMm: number;
  plugDiameterMm: number | null;
  plugLengthMm: number | null;
  plugNeckDiameterMm: number | null;
  plugNeckLengthMm: number | null;
  inputMode: InputMode;
  svgContent: string | null;
  svgFileName: string | null;
  letterStyleId: string;
  wallProfileId: string;
  friezeCount: number;
  friezeAdvanceMm: number;
  friezeSpacingMm: number;
  shelfRatio: number;
  shelfStepMm: number;
  close45Base: boolean;
  inclinationMm: number;
  maxAngleDeg: number;
  mountingHoles: MountingHole[];
  baseEnabled: boolean;
  baseHeightMm: number;
  baseConnectorWidthMm: number;
  basePosition: "bottom" | "top";
  baseConnectorToleranceMm: number;
  baseMode: "snap" | "modular";
  shadowEnabled: boolean;
  shadowOffsetMm: number;
  diffuserShellMm: number;
  diffuserToleranceMm: number;
  minCavityMm: number;
  accentLit: boolean;
  mountingSystemId: string;
  materialPackId: string;
  modelPresetId: string | null;
  exportFormat: "stl" | "3mf";
};

export const DEFAULT_PROJECT: ProjectConfig = {
  text: "GUILI",
  fontId: "montserrat-bold",
  heightMm: 150,
  depthMm: 64,
  wallMm: 5.0,
  frontMm: 0.8,
  spacingMm: 5,
  plugProfile: "profile-a",
  plugPosition: "bottom-center",
  frontMount: "diffuser",
  frontToleranceMm: 0.25,
  snapFitToleranceMm: 0.25,
  snapFitDepthMm: 1.2,
  plugDiameterMm: null,
  plugLengthMm: null,
  plugNeckDiameterMm: null,
  plugNeckLengthMm: null,
  inputMode: "text",
  svgContent: null,
  svgFileName: null,
  letterStyleId: "printed-diffuser",
  wallProfileId: "shelf",
  friezeCount: 2,
  friezeAdvanceMm: 1.5,
  friezeSpacingMm: 2,
  shelfRatio: 0.598,
  shelfStepMm: 0.8,
  close45Base: true,
  inclinationMm: 0,
  maxAngleDeg: 45,
  mountingHoles: [],
  baseEnabled: true,
  baseHeightMm: 20,
  baseConnectorWidthMm: 15,
  basePosition: "bottom",
  baseConnectorToleranceMm: 0.3,
  baseMode: "modular",
  shadowEnabled: false,
  shadowOffsetMm: 3,
  diffuserShellMm: 0.8,
  diffuserToleranceMm: 0.15,
  minCavityMm: 8,
  accentLit: true,
  mountingSystemId: "desk-rail",
  materialPackId: "petg-diffuser",
  modelPresetId: "led-desk-rail",
  exportFormat: "stl",
};

export const DEPTH_PRESETS_MM = [40, 50, 64] as const;

export const FONT_CATEGORIES = [
  { id: "popular", name: "Popular" },
  { id: "bold", name: "Bold" },
  { id: "rounded", name: "Rounded" },
  { id: "serif", name: "Serif" },
  { id: "script", name: "Script" },
  { id: "display", name: "Display" },
] as const;

export const LETTER_STYLE_THUMBNAILS: Record<string, { face: string; body: string; back: string }> = {
  "snap-fit": { face: "#b8e986", body: "#c8c8c8", back: "#a0a0a0" },
  "press-fit": { face: "#b8e986", body: "#c0c0c0", back: "#989898" },
  "hollow-back": { face: "#b8e986", body: "#c8c8c8", back: "#a0a0a0" },
  "printed-back": { face: "#b8e986", body: "#c8c8c8", back: "#888888" },
  "double-support": { face: "#b8e986", body: "#c8c8c8", back: "#a0a0a0" },
  "single-support": { face: "#b8e986", body: "#c8c8c8", back: "#a0a0a0" },
  backlit: { face: "#b8e986", body: "#d0d0d0", back: "#666666" },
  "printed-face": { face: "#90c870", body: "#c8c8c8", back: "#a0a0a0" },
  "printed-diffuser": { face: "#9ee0ff", body: "#c8c8c8", back: "#a0a0a0" },
  "open-back": { face: "#b8e986", body: "#d0d0d0", back: "#444444" },
};
