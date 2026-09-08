"use client";

import { useEffect, useState } from "react";
import { CircleDot, MousePointer2, SquareMousePointer } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ViewerTool = "select" | "hole";

export function ViewerToolToggle({
  tool,
  onChange,
  holeEnabled = true,
  className,
}: {
  tool: ViewerTool;
  onChange: (tool: ViewerTool) => void;
  /** Quando false, a opção de furo fica desabilitada (ex.: modelo sem furos). */
  holeEnabled?: boolean;
  className?: string;
}) {
  const [shiftHeld, setShiftHeld] = useState(false);

  useEffect(() => {
    const sync = (event: KeyboardEvent) => {
      setShiftHeld(event.shiftKey);
    };
    const clear = () => setShiftHeld(false);
    window.addEventListener("keydown", sync);
    window.addEventListener("keyup", sync);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", sync);
      window.removeEventListener("keyup", sync);
      window.removeEventListener("blur", clear);
    };
  }, []);

  const multiSelectActive = tool === "select" && shiftHeld;

  return (
    <div
      className={cn(
        "pointer-events-auto flex flex-col items-center gap-0.5 rounded-full border border-white/10 bg-[#2a2c30]/90 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur",
        className,
      )}
      role="toolbar"
      aria-label="Ferramenta do preview"
    >
      <ToolButton
        label={
          multiSelectActive
            ? "Multi-seleção (Shift)"
            : "Seleção · Shift+clique para várias"
        }
        active={tool === "select"}
        emphasized={multiSelectActive}
        onClick={() => onChange("select")}
        icon={multiSelectActive ? SquareMousePointer : MousePointer2}
      />
      <ToolButton
        label="Furo"
        active={tool === "hole"}
        disabled={!holeEnabled}
        onClick={() => onChange("hole")}
        icon={CircleDot}
      />
    </div>
  );
}

function ToolButton({
  label,
  active,
  emphasized,
  disabled,
  onClick,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  emphasized?: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: typeof MousePointer2;
}) {
  return (
    <Tooltip content={label} side="left">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full transition sm:size-8",
          disabled && "cursor-not-allowed opacity-35",
          !disabled && emphasized && "bg-accent text-white",
          !disabled && !emphasized && active && "bg-white/15 text-white",
          !disabled && !emphasized && !active && "text-white/55 hover:bg-white/10 hover:text-white",
        )}
      >
        <Icon className="size-3.5" strokeWidth={active || emphasized ? 2 : 1.75} />
      </button>
    </Tooltip>
  );
}
