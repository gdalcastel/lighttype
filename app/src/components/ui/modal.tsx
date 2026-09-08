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
  contentClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/30 backdrop-blur-[3px]" />
        <Dialog.Content
          className={cn(
            "fixed z-50 overflow-hidden border border-border bg-surface shadow-[0_24px_80px_rgba(34,34,34,0.18)]",
            /* Mobile: bottom sheet */
            "inset-x-0 bottom-0 top-auto max-h-[92dvh] w-full rounded-t-[24px] rounded-b-none",
            "pb-[max(0px,var(--safe-bottom))]",
            /* Desktop: centered dialog */
            "md:inset-auto md:top-1/2 md:left-1/2 md:bottom-auto md:w-[min(92vw,440px)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[24px] md:pb-0",
            className,
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-border md:hidden" aria-hidden />
          <div className={cn("p-5 sm:p-7", contentClassName)}>
            {title ? (
              <Dialog.Title className="text-[20px] font-medium tracking-tight sm:text-[22px]">
                {title}
              </Dialog.Title>
            ) : (
              <Dialog.Title className="sr-only">Dialog</Dialog.Title>
            )}
            {description ? (
              <Dialog.Description className="mt-2 text-[14px] leading-6 text-muted sm:text-[15px]">
                {description}
              </Dialog.Description>
            ) : (
              <Dialog.Description className="sr-only">Dialog</Dialog.Description>
            )}
            <div className="mt-5">{children}</div>
          </div>
          <Dialog.Close
            className="absolute top-3 right-3 z-10 flex size-10 items-center justify-center rounded-full text-muted hover:bg-background sm:top-4 sm:right-4 sm:size-9"
            aria-label="Fechar"
          >
            <X className="size-4" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
