import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  title,
  description,
  step,
  children,
  className,
}: {
  title: string;
  description?: string;
  step?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div>
        {step ? (
          <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-accent">{step}</p>
        ) : null}
        <h2 className="text-[12px] font-medium tracking-wide text-muted uppercase sm:text-[13px]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-[13px] leading-5 text-muted sm:text-[13px]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
