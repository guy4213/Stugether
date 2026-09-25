import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
        // Brand CTA from the mockups: blue→teal pill. The teal end is darker
        // than --secondary so white text keeps >=4.5:1 across the gradient.
        gradient:
          "rounded-full bg-linear-to-l from-primary to-[oklch(0.55_0.11_180)] text-white shadow-sm hover:opacity-90",
        // StuGether Dashboard mockup buttons (rounded rectangles, 12–16px).
        brand:
          "rounded-[14px] bg-brand font-bold text-white shadow-glow-teal hover:brightness-105 active:brightness-95",
        solid: "rounded-xl bg-primary font-semibold text-white hover:bg-primary-strong",
        soft: "rounded-xl bg-primary-soft font-semibold text-primary-strong hover:bg-primary-tint",
        "outline-primary":
          "rounded-xl border-[1.5px] border-primary bg-white font-semibold text-primary hover:bg-primary-soft",
        quiet:
          "rounded-xl border-border bg-white font-medium text-foreground hover:bg-surface-2",
        glass:
          "rounded-[13px] border-white/40 bg-white/14 font-semibold text-white hover:bg-white/22",
        white:
          "rounded-[15px] bg-white font-bold text-primary-strong shadow-[0_10px_20px_-10px_rgba(15,27,51,.4)] hover:bg-primary-soft",
        danger:
          "rounded-[15px] border-danger-line bg-danger-soft font-semibold text-destructive hover:bg-[#ffeceb]",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pe-1.5 has-data-[icon=inline-start]:ps-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pe-2 has-data-[icon=inline-start]:ps-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        // Mockup sizes: 38 / 44 / 50 / 56px tall.
        chip: "h-[38px] gap-1.5 px-3.5 text-[13px]",
        md: "h-11 gap-2 px-4 text-[15px]",
        xl: "h-[50px] gap-2 px-6 text-[15px] [&_svg:not([class*='size-'])]:size-[18px]",
        cta: "h-14 gap-2.5 px-6 text-[17px] [&_svg:not([class*='size-'])]:size-5",
        "icon-md": "size-11 [&_svg:not([class*='size-'])]:size-[18px]",
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
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
