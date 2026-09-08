import type {
  JobStatus,
  LetterStyleInfo,
  MaterialPackInfo,
  ModelPresetInfo,
  MountingSystemInfo,
  PreviewData,
  ProjectConfig,
  WallProfileInfo,
} from "@/types";

import { isNativeApp } from "@/lib/native";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

/** Em localhost (ou app nativo em debug) o checkout é pulado e o download STL é direto. */
export function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  if (isNativeApp()) {
    // App Capacitor falando com API local / LAN — trata como ambiente de desenvolvimento.
    const api = process.env.NEXT_PUBLIC_API_URL ?? "";
    return /127\.0\.0\.1|localhost|192\.168\.|10\./.test(api) || !api;
  }
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

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
      description?: string;
    }[];
    categories: { id: string; name: string }[];
  }>(res);
}

export async function fetchLetterStyles() {
  const res = await fetch(`${BASE}/letter-styles`);
  return readJson<{ styles: LetterStyleInfo[] }>(res);
}

export async function fetchWallProfiles() {
  const res = await fetch(`${BASE}/wall-profiles`);
  return readJson<{ profiles: WallProfileInfo[] }>(res);
}

export async function fetchModelPresets() {
  const res = await fetch(`${BASE}/model-presets`);
  return readJson<{ presets: ModelPresetInfo[] }>(res);
}

export async function fetchMaterialPacks() {
  const res = await fetch(`${BASE}/material-packs`);
  return readJson<{ packs: MaterialPackInfo[] }>(res);
}

export async function fetchMountingSystems() {
  const res = await fetch(`${BASE}/mounting-systems`);
  return readJson<{ systems: MountingSystemInfo[] }>(res);
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
    mounting_systems: { id: string; name: string; available: boolean }[];
  }>(res);
}

export function configToPreviewBody(config: ProjectConfig) {
  return {
    text: config.text,
    font_id: config.fontId,
    height_mm: config.heightMm,
    depth_mm: config.depthMm,
    wall_mm: config.wallMm,
    front_mm: config.frontMm,
    spacing_mm: config.spacingMm,
    input_mode: config.inputMode,
    svg_content: config.svgContent,
    letter_style_id: config.letterStyleId,
    front_mount: config.frontMount,
    front_tolerance_mm: config.frontToleranceMm,
    snap_fit_tolerance_mm: config.snapFitToleranceMm,
    snap_fit_depth_mm: config.snapFitDepthMm,
    wall_profile_id: config.wallProfileId,
    frieze_count: config.friezeCount,
    frieze_advance_mm: config.friezeAdvanceMm,
    frieze_spacing_mm: config.friezeSpacingMm,
    shelf_ratio: config.shelfRatio,
    shelf_step_mm: config.shelfStepMm,
    base_enabled: config.baseEnabled,
    base_height_mm: config.baseHeightMm,
    base_connector_width_mm: config.baseConnectorWidthMm,
    base_position: config.basePosition,
    base_connector_tolerance_mm: config.baseConnectorToleranceMm,
    base_mode: config.baseMode,
    shadow_enabled: config.shadowEnabled,
    shadow_offset_mm: config.shadowOffsetMm,
    diffuser_shell_mm: config.diffuserShellMm,
    diffuser_tolerance_mm: config.diffuserToleranceMm,
    min_cavity_mm: config.minCavityMm,
    accent_lit: config.accentLit,
    mounting_system_id: config.mountingSystemId,
    material_pack_id: config.materialPackId,
    model_preset_id: config.modelPresetId,
    mounting_holes: config.mountingHoles.map(
      ({ x, y, shape, width_mm, length_mm, depth_mm, corner_radius_mm, face, letter_index, name }) => ({
        x,
        y,
        shape,
        width_mm,
        length_mm,
        depth_mm,
        corner_radius_mm,
        face,
        letter_index,
        name: name?.trim() || undefined,
      }),
    ),
  };
}

export function configToGenerateBody(config: ProjectConfig, options?: { letterIndices?: number[] }) {
  return {
    ...configToPreviewBody(config),
    depth_mm: config.depthMm,
    front_mm: config.frontMm,
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
    close_45_base: config.close45Base,
    inclination_mm: config.inclinationMm,
    max_angle_deg: config.maxAngleDeg,
    letter_indices: options?.letterIndices ?? null,
    export_format: config.exportFormat ?? "stl",
  };
}

export async function fetchPreview(config: ProjectConfig): Promise<PreviewData> {
  const res = await fetch(`${BASE}/generate/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(configToPreviewBody(config)),
  });
  return readJson<PreviewData>(res);
}

export async function sendVerificationCode(email: string) {
  const res = await fetch(`${BASE}/checkout/send-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return readJson<{ ok: boolean; message: string; dev_code?: string }>(res);
}

export async function verifyCheckoutCode(email: string, code: string) {
  const res = await fetch(`${BASE}/checkout/verify-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });
  return readJson<{ session_id: string; price_cents: number; currency: string }>(res);
}

export async function checkoutPay(sessionId: string) {
  const res = await fetch(`${BASE}/checkout/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  return readJson<{ download_token: string; paid: boolean }>(res);
}

export async function startStlJob(
  config: ProjectConfig,
  options?: { letterIndices?: number[]; checkoutToken?: string },
) {
  const res = await fetch(`${BASE}/generate/stl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...configToGenerateBody(config, options),
      checkout_token: options?.checkoutToken,
    }),
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

export async function fetchBambuConnectCapabilities() {
  const res = await fetch(`${BASE}/bambu-connect/capabilities`);
  return readJson<{
    available: boolean;
    scheme: string;
    version: string;
    host_path_configured: boolean;
    export_dir: string;
    docs_url: string;
    install_url: string;
  }>(res);
}

export async function openJobInBambuConnect(jobId: string) {
  const res = await fetch(`${BASE}/download/${jobId}/bambu-connect`, {
    method: "POST",
  });
  return readJson<{
    url: string;
    path: string;
    name: string;
    filename: string;
    docs_url: string;
    install_url: string;
  }>(res);
}

export async function saveProject(config: ProjectConfig) {
  const res = await fetch(`${BASE}/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...configToGenerateBody(config), name: config.text }),
  });
  return readJson<{ id: string }>(res);
}
