"use client";

import { explodePartZOffsets, letterStylePreviewParams, type LetterStylePreviewParams } from "@/lib/letter-utils";
import {
  PREVIEW_SIDE_PANEL_CLASS,
  PREVIEW_SIDE_PANEL_HEIGHT,
  PREVIEW_SIDE_PANEL_WIDTH,
} from "@/lib/preview-side-rail";
import { cn } from "@/lib/utils";
import type { PreviewData } from "@/types";

function faceHeight(style: LetterStylePreviewParams, wallMm: number) {
  return style.fixedFace ? wallMm * 0.6 : 1.5;
}

export function CrossSectionView({
  data,
  letterStyle,
  depthMm,
  wallMm,
  explodedFactor = 0,
  className,
}: {
  data: PreviewData | null;
  letterStyle?: PreviewData["letter_style"];
  depthMm: number;
  wallMm: number;
  explodedFactor?: number;
  className?: string;
}) {
  if (!data || data.letters.length === 0) return null;

  const letter = data.letters[0];
  const [minx, , maxx] = letter.bounds;
  const cx = (minx + maxx) / 2;
  const sliceW = 40;
  const style = letterStylePreviewParams(letterStyle ?? data.letter_style, depthMm, wallMm);
  const rearH = style.showRear ? style.rearMm : 0;
  const faceH = faceHeight(style, wallMm);
  const zOff = explodePartZOffsets(style, explodedFactor);
  const exploded = explodedFactor > 0.01;
  const rearY = zOff.back;
  const bodyTop = rearH + zOff.body;
  const bodyBottom = depthMm + zOff.body;
  const cavityH = bodyBottom - bodyTop - wallMm * 0.25;
  const faceY = style.fixedFace
    ? depthMm - faceH - wallMm * 0.4 + zOff.front
    : depthMm - faceH + zOff.front;
  const faceColor = style.fixedFace ? "#90c870" : "#b8e986";
  const rearColor = style.backlit ? "#666666" : style.rearMm >= 2.2 ? "#888888" : "#a0a0a0";
  const extraTop = Math.max(0, -zOff.back);
  const extraBottom = Math.max(0, zOff.front);
  const sliceH = depthMm + 8 + extraTop + extraBottom;
  const viewTop = -4 - extraTop;
  const labelBottomY = depthMm + 5 + extraBottom;

  const wallLeft = cx - 14;
  const wallRight = cx + 14;
  const bodyH = Math.max(bodyBottom - bodyTop, 2);

  return (
    <div
      className={cn(className, "shrink-0")}
      style={{ width: PREVIEW_SIDE_PANEL_WIDTH, height: PREVIEW_SIDE_PANEL_HEIGHT }}
      aria-label="Seção transversal"
    >
      <div className={cn(PREVIEW_SIDE_PANEL_CLASS, "flex h-full flex-col p-2")}>
        <p className="mb-1 shrink-0 text-center text-[9px] font-medium uppercase tracking-wider text-white/50">
          Seção{exploded ? " · desmontada" : ""}
        </p>
        <svg
          viewBox={`${cx - sliceW / 2} ${viewTop} ${sliceW} ${sliceH}`}
          className="min-h-0 w-full flex-1"
          preserveAspectRatio="xMidYMid meet"
        >
          <text x={cx} y={viewTop + 3} textAnchor="middle" fontSize={3} fill="#888">
            FRENTE
          </text>

          {exploded ? (
            <>
              <rect
                x={wallLeft}
                y={bodyTop}
                width={wallMm}
                height={bodyH}
                fill="#c8c8c8"
                stroke="#666"
                strokeWidth={0.4}
              />
              <rect
                x={wallRight - wallMm}
                y={bodyTop}
                width={wallMm}
                height={bodyH}
                fill="#c8c8c8"
                stroke="#666"
                strokeWidth={0.4}
              />
            </>
          ) : (
            <>
              {style.showRear ? (
                <rect
                  x={wallLeft}
                  y={rearY}
                  width={28}
                  height={rearH}
                  fill={rearColor}
                  stroke="#666"
                  strokeWidth={0.3}
                />
              ) : null}
              <rect
                x={wallLeft}
                y={bodyTop}
                width={wallMm}
                height={bodyH}
                fill="#c8c8c8"
                stroke="#666"
                strokeWidth={0.4}
              />
              <rect
                x={wallRight - wallMm}
                y={bodyTop}
                width={wallMm}
                height={bodyH}
                fill="#c8c8c8"
                stroke="#666"
                strokeWidth={0.4}
              />
            </>
          )}

          <rect
            x={wallLeft + wallMm}
            y={bodyTop + wallMm * 0.25}
            width={28 - wallMm * 2}
            height={Math.max(cavityH, 2)}
            fill="#fff8f1"
            stroke="#aaa"
            strokeWidth={0.3}
          />

          {style.fixedFace || style.removableFace ? (
            <rect
              x={wallLeft}
              y={faceY}
              width={28}
              height={style.fixedFace ? faceH + wallMm * 0.4 : faceH}
              fill={faceColor}
              stroke="#666"
              strokeWidth={0.3}
              opacity={style.removableFace && exploded ? 0.95 : 1}
            />
          ) : null}

          {exploded ? (
            style.showRear ? (
              <rect
                x={wallLeft}
                y={rearY}
                width={28}
                height={rearH}
                fill={rearColor}
                stroke="#666"
                strokeWidth={0.3}
                opacity={style.backlit ? 0.85 : 1}
              />
            ) : (
              <line
                x1={wallLeft}
                y1={0.5}
                x2={wallRight}
                y2={0.5}
                stroke="#999"
                strokeWidth={0.5}
                strokeDasharray="2 1.5"
              />
            )
          ) : null}

          {exploded && style.showRear ? (
            <line
              x1={wallLeft - 1}
              y1={rearY + rearH + 1.5}
              x2={wallRight + 1}
              y2={rearY + rearH + 1.5}
              stroke="#999"
              strokeWidth={0.35}
              strokeDasharray="1.5 1"
            />
          ) : null}

          {exploded && style.removableFace ? (
            <line
              x1={wallLeft - 1}
              y1={faceY - 1.5}
              x2={wallRight + 1}
              y2={faceY - 1.5}
              stroke="#999"
              strokeWidth={0.35}
              strokeDasharray="1.5 1"
            />
          ) : null}

          {style.supports === 1 ? (
            <rect
              x={cx - 1.2}
              y={bodyTop + 1}
              width={2.4}
              height={Math.max(cavityH - 2, 2)}
              fill="#b8b8b8"
              stroke="#888"
              strokeWidth={0.2}
            />
          ) : null}
          {style.supports >= 2 ? (
            <>
              <rect
                x={cx - 7}
                y={bodyTop + 1}
                width={2.4}
                height={Math.max(cavityH - 2, 2)}
                fill="#b8b8b8"
                stroke="#888"
                strokeWidth={0.2}
              />
              <rect
                x={cx + 4.6}
                y={bodyTop + 1}
                width={2.4}
                height={Math.max(cavityH - 2, 2)}
                fill="#b8b8b8"
                stroke="#888"
                strokeWidth={0.2}
              />
            </>
          ) : null}

          <text x={cx} y={labelBottomY} textAnchor="middle" fontSize={3} fill="#888">
            FUNDO
          </text>
        </svg>
      </div>
    </div>
  );
}
