import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div>
        <h2 className="text-[13px] font-medium tracking-wide text-muted uppercase">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-[13px] leading-5 text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
