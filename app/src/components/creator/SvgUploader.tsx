"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

export function SvgUploader({
  fileName,
  onLoad,
  className,
}: {
  fileName: string | null;
  onLoad: (content: string, name: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onLoad(reader.result, file.name);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed border-border bg-background px-4 py-8 transition hover:border-border-strong hover:bg-surface"
      >
        <Upload className="size-6 text-muted" />
        <span className="text-[13px] font-medium">Carregar SVG</span>
        <span className="text-[11px] text-muted">path, polygon ou rect</span>
      </button>
      {fileName ? (
        <p className="truncate text-[11px] text-muted">{fileName}</p>
      ) : null}
    </div>
  );
}

export function InputModeTabs({
  mode,
  onMode,
  textContent,
  svgContent,
  fileName,
  onSvgLoad,
}: {
  mode: "text" | "svg";
  onMode: (mode: "text" | "svg") => void;
  textContent: React.ReactNode;
  svgContent: React.ReactNode;
  fileName: string | null;
  onSvgLoad: (content: string, name: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-full bg-background p-1">
        {(
          [
            ["text", "Digitar Texto"],
            ["svg", "Carregar SVG"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onMode(id)}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-[12px] font-medium transition",
              mode === id ? "bg-foreground text-white" : "text-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "text" ? textContent : (
        <div className="space-y-3">
          <SvgUploader fileName={fileName} onLoad={onSvgLoad} />
          {svgContent}
        </div>
      )}
    </div>
  );
}
