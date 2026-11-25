import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const actionStyle = "border font-bold uppercase tracking-wider";
const outlineStyle = `${actionStyle} border-foreground/35 text-foreground hover:border-foreground hover:bg-foreground hover:text-background`;

const buttonVariants = cva(
  "group/button inline-flex items-center justify-center whitespace-normal transition-colors outline-none select-none cursor-pointer focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: outlineStyle,
        outline: outlineStyle,
        primary: `${actionStyle} border-[#d0a35e] bg-[#d0a35e] text-background hover:bg-transparent hover:text-[#e5bd7d]`,
        "accent-outline": `${actionStyle} border-[#d0a35e] text-[#e5bd7d] hover:bg-[#d0a35e] hover:text-background`,
        ghost:
          "border border-transparent font-bold uppercase tracking-wider text-foreground hover:bg-foreground/10 data-[state=open]:bg-foreground/10",
        destructive: `${actionStyle} border-destructive text-destructive hover:bg-destructive hover:text-background`,
        success: `${actionStyle} border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-background`,
        link: "text-foreground underline-offset-4 hover:underline",
        unstyled: "",
      },
      size: {
        default: "gap-2 px-6 py-3",
        xs: "gap-1 px-3 py-1.5 text-xs",
        sm: "gap-2 px-3 py-2 text-sm",
        lg: "gap-3 px-7 py-3 text-lg",
        icon: "size-10 p-0",
        "icon-xs": "size-6 p-0",
        "icon-sm": "size-8 p-0",
        "icon-lg": "size-12 p-0",
        bare: "gap-0 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  type,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      type={asChild ? type : (type ?? "button")}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
