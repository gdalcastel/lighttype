"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-[24px] border border-border bg-surface p-7 shadow-[0_24px_80px_rgba(34,34,34,0.18)]",
            className,
          )}
        >
          {title ? (
            <Dialog.Title className="text-[22px] font-medium tracking-tight">{title}</Dialog.Title>
          ) : (
            <Dialog.Title className="sr-only">Dialog</Dialog.Title>
          )}
          {description ? (
            <Dialog.Description className="mt-2 text-[15px] leading-6 text-muted">
              {description}
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">Dialog</Dialog.Description>
          )}
          <div className="mt-5">{children}</div>
          <Dialog.Close
            className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full text-muted hover:bg-background"
            aria-label="Close"
          >
            <X className="size-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
