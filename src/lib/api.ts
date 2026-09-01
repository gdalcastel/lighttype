import type { JobStatus, PreviewData, ProjectConfig } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

async function readJson<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { message?: string; suggestion?: string } }).error;
    const message = err?.message ?? "Something went wrong. Please try again.";
    const error = new Error(message) as Error & { suggestion?: string };
    error.suggestion = err?.suggestion;
    throw error;
  }
  return data as T;
}

export async function fetchFonts() {
  const res = await fetch(`${BASE}/fonts`);
  return readJson<{
    fonts: {
      id: string;
      name: string;
      category: string;
      family: string;
      weight: number;
      preview_weight: number;
    }[];
    categories: { id: string; name: string }[];
  }>(res);
}

export async function fetchPlugProfiles() {
  const res = await fetch(`${BASE}/plug-profiles`);
  return readJson<{
    profiles: {
      id: string;
      name: string;
      subtitle: string;
      prototype: boolean;
      diameter_mm: number;
      length_mm: number;
      neck_diameter_mm: number;
      neck_length_mm: number;
      note: string;
    }[];
  }>(res);
}

export async function fetchPreview(input: {
  text: string;
  font_id: string;
  height_mm: number;
  wall_mm: number;
  spacing_mm: number;
}): Promise<PreviewData> {
  const res = await fetch(`${BASE}/generate/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readJson<PreviewData>(res);
}

export function configToGenerateBody(config: ProjectConfig) {
  return {
    text: config.text,
    font_id: config.fontId,
    height_mm: config.heightMm,
    depth_mm: config.depthMm,
    wall_mm: config.wallMm,
    front_mm: config.frontMm,
    spacing_mm: config.spacingMm,
    plug_profile: config.plugProfile,
    plug_position: config.plugPosition,
    front_mount: config.frontMount,
    front_tolerance_mm: config.frontToleranceMm,
    snap_fit_tolerance_mm: config.snapFitToleranceMm,
    snap_fit_depth_mm: config.snapFitDepthMm,
    plug_diameter_mm: config.plugDiameterMm,
    plug_length_mm: config.plugLengthMm,
    plug_neck_diameter_mm: config.plugNeckDiameterMm,
    plug_neck_length_mm: config.plugNeckLengthMm,
  };
}

export async function startStlJob(config: ProjectConfig) {
  const res = await fetch(`${BASE}/generate/stl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(configToGenerateBody(config)),
  });
  return readJson<{ job_id: string; status: string }>(res);
}

export async function fetchJob(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${BASE}/generate/${jobId}`);
  return readJson<JobStatus>(res);
}

export function downloadUrl(jobId: string) {
  return `${BASE}/download/${jobId}`;
}

export async function saveProject(config: ProjectConfig) {
  const res = await fetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...configToGenerateBody(config), name: config.text }),
  });
  return readJson<{ id: string }>(res);
}
