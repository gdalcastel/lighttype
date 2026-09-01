export type Ring = number[][];

export type PreviewLetter = {
  char: string;
  index: number;
  x: number;
  width: number;
  height: number;
  bounds: [number, number, number, number];
  outer: Ring[];
  holes: Ring[];
  inner: Ring[];
  inner_holes: Ring[];
  has_cavity: boolean;
};

export type PreviewData = {
  text: string;
  font_id: string;
  height_mm: number;
  wall_mm: number;
  spacing_mm: number;
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
    files: string[];
  } | null;
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
};

export const DEFAULT_PROJECT: ProjectConfig = {
  text: "GUILI",
  fontId: "montserrat-bold",
  heightMm: 100,
  depthMm: 25,
  wallMm: 2,
  frontMm: 1.5,
  spacingMm: 8,
  plugProfile: "profile-a",
  plugPosition: "bottom-center",
  frontMount: "snap-fit",
  frontToleranceMm: 0.25,
  snapFitToleranceMm: 0.25,
  snapFitDepthMm: 1.2,
  plugDiameterMm: null,
  plugLengthMm: null,
  plugNeckDiameterMm: null,
  plugNeckLengthMm: null,
};

export const FONT_CATEGORIES = [
  { id: "popular", name: "Popular" },
  { id: "bold", name: "Bold" },
  { id: "rounded", name: "Rounded" },
  { id: "serif", name: "Serif" },
  { id: "script", name: "Script" },
  { id: "display", name: "Display" },
] as const;
