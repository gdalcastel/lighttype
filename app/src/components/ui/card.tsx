import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("card-surface p-5", className)} {...props} />;
}

export function FontCard({
  selected,
  className,
  ...props
}: React.ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-[18px] border bg-surface px-4 py-4 text-left transition-all duration-200",
        selected
          ? "border-foreground/25 shadow-[0_0_0_1px_rgba(34,34,34,0.08)]"
          : "border-border hover:border-border-strong hover:shadow-[0_8px_20px_rgba(34,34,34,0.05)]",
        className,
      )}
      {...props}
    />
  );
}
