import type { LetterOffset, PreviewLetter } from "@/types";

function glyphBounds(letter: PreviewLetter): [number, number, number, number] {
  return letter.glyph_bounds ?? letter.bounds;
}

function letterLeft(letter: PreviewLetter, offsetX: number) {
  return glyphBounds(letter)[0] + offsetX;
}

function letterRight(letter: PreviewLetter, offsetX: number) {
  return glyphBounds(letter)[2] + offsetX;
}

/** Snap horizontal offset so adjacent letters align with spacing between glyph bodies. */
export function snapLetterX(
  letters: PreviewLetter[],
  index: number,
  spacingMm: number,
  proposedX: number,
  offsets: Record<number, LetterOffset>,
  threshold = 4,
): number {
  const letter = letters.find((l) => l.index === index);
  if (!letter) return proposedX;

  const sorted = [...letters].sort((a, b) => a.index - b.index);
  const pos = sorted.findIndex((l) => l.index === index);
  if (pos < 0) return proposedX;

  let bestX = proposedX;
  let bestDist = threshold + 1;

  const prev = pos > 0 ? sorted[pos - 1] : null;
  const next = pos < sorted.length - 1 ? sorted[pos + 1] : null;

  if (prev) {
    const prevOff = offsets[prev.index] ?? { x: 0, y: 0 };
    const targetX = letterRight(prev, prevOff.x) + spacingMm - glyphBounds(letter)[0];
    const dist = Math.abs(proposedX - targetX);
    if (dist <= threshold && dist < bestDist) {
      bestX = targetX;
      bestDist = dist;
    }
  }

  if (next) {
    const nextOff = offsets[next.index] ?? { x: 0, y: 0 };
    const targetX = letterLeft(next, nextOff.x) - spacingMm - glyphBounds(letter)[2];
    const dist = Math.abs(proposedX - targetX);
    if (dist <= threshold && dist < bestDist) {
      bestX = targetX;
      bestDist = dist;
    }
  }

  return bestX;
}

/** Default side-by-side offsets (all zero when layout comes from API). */
export function computeDefaultLetterOffsets(letters: PreviewLetter[]): Record<number, LetterOffset> {
  const offsets: Record<number, LetterOffset> = {};
  for (const letter of letters) {
    offsets[letter.index] = { x: 0, y: 0 };
  }
  return offsets;
}
