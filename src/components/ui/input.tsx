import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-[14px] border border-border bg-surface px-4 text-[16px] text-foreground placeholder:text-muted-soft transition-colors duration-150",
        "hover:border-border-strong focus:border-foreground/30 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
        className,
      )}
      {...props}
    />
  );
}
