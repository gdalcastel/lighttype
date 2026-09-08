"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-white hover:bg-accent-hover shadow-[0_1px_2px_rgba(229,72,77,0.25)] hover:shadow-[0_6px_16px_rgba(229,72,77,0.28)]",
        secondary:
          "bg-surface text-foreground border border-border hover:border-border-strong hover:bg-background",
        ghost: "bg-transparent text-foreground hover:bg-background",
        outline: "border border-border bg-transparent hover:bg-surface",
      },
      size: {
        sm: "h-9 px-4 text-sm rounded-full",
        md: "h-11 px-5 text-[15px] rounded-full",
        lg: "h-12 px-7 text-base rounded-full",
        xl: "h-14 px-8 text-base rounded-full",
        icon: "h-10 w-10 rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
