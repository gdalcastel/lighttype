import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("text-[18px] font-semibold tracking-[-0.03em] text-foreground", className)}>
      LightType
    </Link>
  );
}

export function Header({
  action,
}: {
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 md:px-8">
        <Logo />
        <nav className="flex items-center gap-2">
          {action}
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
        <p className="text-[15px] font-medium tracking-tight">LightType</p>
        <p className="text-[13px] text-muted">Type it. Light it. Print it.</p>
      </div>
    </footer>
  );
}
