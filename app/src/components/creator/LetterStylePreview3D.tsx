"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { thumbnailPartColors } from "@/lib/letter-utils";
import type { LetterStyleInfo, PreviewData } from "@/types";

const LetterScene = dynamic(() => import("@/components/preview/LetterScene").then((m) => m.LetterScene), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#e4e9ef]" />,
});

function noop() {
  /* thumbnail scene is read-only */
}

export function LetterStylePreview3D({
  data,
  style,
  depthMm,
  frontMm,
  wallMm,
}: {
  data: PreviewData;
  style: LetterStyleInfo;
  depthMm: number;
  frontMm: number;
  wallMm: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const partColors = thumbnailPartColors(data);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "48px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="relative h-[96px] w-full overflow-hidden rounded-md bg-[#eef2f6]">
      {visible ? (
        <LetterScene
          data={data}
          depthMm={depthMm}
          frontMm={frontMm}
          wallMm={wallMm}
          showInterior
          showLed={style.backlit}
          showGrid={false}
          showPlane={false}
          explodedFactor={0}
          wallProfileId="flat"
          mountingHoles={[]}
          holeToolActive={false}
          selectedLetterIndices={[]}
          selectedParts={[]}
          partColors={partColors}
          partOffsets={{}}
          letterOffsets={{}}
          onSelectLetter={noop}
          onDragLetter={noop}
          cameraView="side"
          pixelRatio={1}
          letterStyle={style}
          thumbnailMode
        />
      ) : (
        <div className="h-full w-full animate-pulse bg-[#e4e9ef]" />
      )}
    </div>
  );
}
