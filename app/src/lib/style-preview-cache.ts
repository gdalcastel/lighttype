import { fetchPreview } from "@/lib/api";
import type { LetterStyleInfo, PreviewData, ProjectConfig } from "@/types";

const cache = new Map<string, PreviewData>();

function cacheKey(config: ProjectConfig, styleId: string) {
  return [
    styleId,
    config.fontId,
    config.depthMm,
    config.wallMm,
    config.frontMm,
    config.wallProfileId,
  ].join(":");
}

export async function fetchLetterStylePreview(
  baseConfig: ProjectConfig,
  style: LetterStyleInfo,
): Promise<PreviewData> {
  const key = cacheKey(baseConfig, style.id);
  const cached = cache.get(key);
  if (cached) return cached;

  const data = await fetchPreview({
    ...baseConfig,
    text: "U",
    heightMm: 80,
    spacingMm: 0,
    letterStyleId: style.id,
    frontMount: style.front_mount,
    mountingHoles: [],
  });

  cache.set(key, data);
  return data;
}

export async function fetchAllLetterStylePreviews(
  baseConfig: ProjectConfig,
  styles: LetterStyleInfo[],
): Promise<Record<string, PreviewData>> {
  const entries = await Promise.all(
    styles.map(async (style) => [style.id, await fetchLetterStylePreview(baseConfig, style)] as const),
  );
  return Object.fromEntries(entries);
}
