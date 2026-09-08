import type { LetterOffset, LetterPartKind, LetterStyleInfo, PreviewData, PreviewLetter } from "@/types";

export type LetterStylePreviewParams = {
  rearMm: number;
  showRear: boolean;
  frontMount: string;
  supports: number;
  backlit: boolean;
  fixedFace: boolean;
  removableFace: boolean;
};

/** Mirrors `ProductParams.rear_wall` in api/engine/product_geometry.py */
/** Distinct printable parts per letter for a style (body, face, back, supports). */
export function letterStylePartCount(
  style: LetterStyleInfo | undefined,
  depthMm: number,
  wallMm: number,
): number {
  const params = letterStylePreviewParams(style, depthMm, wallMm);
  let count = 1;
  if (params.removableFace) count += 1;
  if (params.showRear) count += 1;
  count += params.supports;
  return count;
}

export function letterStylePreviewParams(
  style: LetterStyleInfo | undefined,
  depthMm: number,
  wallMm: number,
): LetterStylePreviewParams {
  const rearType = style?.rear_type ?? "solid";
  let rearMm = Math.max(1.2, Math.min(wallMm, depthMm * 0.25));
  if (rearType === "none") rearMm = 0;
  else if (rearType === "thin") rearMm = Math.max(0.8, wallMm * 0.5);
  else if (rearType === "thick") rearMm = Math.max(2.5, wallMm * 1.8);

  const frontMount = style?.front_mount ?? "snap-fit";

  return {
    rearMm,
    showRear: rearMm > 0.5,
    frontMount,
    supports: style?.supports ?? 0,
    backlit: style?.backlit ?? false,
    fixedFace: frontMount === "fixed",
    removableFace:
      frontMount === "snap-fit" || frontMount === "press-fit" || frontMount === "diffuser",
  };
}

export function findLetterAtPoint(data: PreviewData, x: number, y: number): PreviewLetter | null {
  for (const letter of data.letters) {
    const [minx, miny, maxx, maxy] = letter.bounds;
    if (x >= minx && x <= maxx && y >= miny && y <= maxy) return letter;
  }
  return null;
}

export function partColorKey(letterIndex: number, part: LetterPartKind) {
  return `${letterIndex}:${part}`;
}

export function sameSelectedPart(
  a: { letterIndex: number; part: LetterPartKind },
  b: { letterIndex: number; part: LetterPartKind },
) {
  return a.letterIndex === b.letterIndex && a.part === b.part;
}

export function isPartSelected(
  parts: { letterIndex: number; part: LetterPartKind }[],
  target: { letterIndex: number; part: LetterPartKind },
) {
  return parts.some((p) => sameSelectedPart(p, target));
}

/** Cores saturadas para thumbnails do seletor de estilos (partes bem distinguíveis). */
export const THUMBNAIL_PART_COLORS: Record<LetterPartKind, string> = {
  body: "#6b7d94",
  front: "#3dadff",
  back: "#e07c32",
  support: "#9b6dd7",
};

export function thumbnailPartColors(data: PreviewData): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const letter of data.letters) {
    for (const part of ["body", "front", "back", "support"] as LetterPartKind[]) {
      colors[partColorKey(letter.index, part)] = THUMBNAIL_PART_COLORS[part];
    }
  }
  return colors;
}

export function defaultPartColor(part: LetterPartKind, styleParams: LetterStylePreviewParams): string {
  switch (part) {
    case "body":
      return "#c8c8c8";
    case "back":
      if (styleParams.backlit) return "#666666";
      if (styleParams.rearMm >= 2.2) return "#888888";
      return "#a0a0a0";
    case "front":
      return styleParams.fixedFace
        ? "#90c870"
        : styleParams.frontMount === "diffuser"
          ? "#9ee0ff"
          : "#b8e986";
    case "support":
      return "#b8b8b8";
  }
}

export function resolvePartColor(
  letterIndex: number,
  part: LetterPartKind,
  partColors: Record<string, string>,
  styleParams: LetterStylePreviewParams,
): string {
  return partColors[partColorKey(letterIndex, part)] ?? defaultPartColor(part, styleParams);
}

/**
 * Exploded Z offsets for letter parts.
 * Separates parts along +Z and lifts the stack so nothing goes below the build plate (z >= 0).
 */
export function explodePartZOffsets(
  styleParams: LetterStylePreviewParams,
  explodedFactor: number,
): { back: number; body: number; front: number; support: number } {
  const backSep = styleParams.showRear ? explodedFactor * 10 : 0;
  const frontSep = styleParams.removableFace
    ? explodedFactor * (styleParams.frontMount === "press-fit" ? 10 : 18)
    : 0;
  const lift = backSep;
  return {
    back: lift - backSep,
    body: lift,
    front: lift + frontSep,
    support: lift,
  };
}

export function partHandlePosition(
  letter: PreviewLetter,
  part: LetterPartKind,
  styleParams: LetterStylePreviewParams,
  depth: number,
  front: number,
  explodedFactor: number,
  partOffset?: LetterOffset,
): [number, number, number] {
  const [minx, miny, maxx, maxy] = letter.bounds;
  const dragX = (partOffset?.x ?? 0) * explodedFactor;
  const dragY = (partOffset?.y ?? 0) * explodedFactor;
  const side = maxx + 10 + dragX;
  const cy = (miny + maxy) / 2 + dragY;
  const zOff = explodePartZOffsets(styleParams, explodedFactor);
  let z = depth / 2 + zOff.body;
  if (part === "back") z = Math.max(styleParams.rearMm / 2, 1) + zOff.back;
  else if (part === "front") z = depth + front / 2 + zOff.front;
  else if (part === "support") z = styleParams.rearMm + (depth - styleParams.rearMm) / 2 + zOff.support;
  return [side, cy, z];
}

export function letterHandlePosition(
  letter: PreviewLetter,
  depth: number,
  offset?: LetterOffset,
): [number, number, number] {
  const [, miny, maxx, maxy] = letter.bounds;
  const ox = offset?.x ?? 0;
  const oy = offset?.y ?? 0;
  return [maxx + 10 + ox, (miny + maxy) / 2 + oy, depth / 2];
}

export const CURVE_SEGMENTS = 6;

/** Rear-only depth for counter bridges (island ↔ frame), keeping the front face open. */
export function backBridgeDepth(rearMm: number, wallMm: number): number {
  const rearBridge = rearMm > 0.5 ? rearMm : 0;
  return Math.max(rearBridge, wallMm, 1.2);
}
