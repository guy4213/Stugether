"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

// One wizard screen: a friendly question, the answers, and the continue
// button. Mounted fresh per step (keyed), so it moves focus to its heading —
// screen readers announce the new question — unless the step focuses an
// input itself.
export function StepFrame({
  title,
  subtitle,
  focusHeading = true,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  focusHeading?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusHeading) headingRef.current?.focus({ preventScroll: true });
  }, [focusHeading]);

  return (
    <div className={footer ? "flex flex-col" : "flex flex-col pb-5 sm:pb-8"}>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-[26px] leading-tight font-extrabold tracking-[-0.3px] outline-none sm:text-[30px]"
      >
        {title}
      </h1>
      {subtitle && <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>}
      <div className="mt-6 flex flex-col gap-3">{children}</div>
      {footer && (
        // Sticky on small screens: long lists (courses) keep the button in reach.
        <div className="sticky bottom-0 -mx-5 mt-6 rounded-b-[28px] bg-card/95 px-5 pt-3 pb-5 backdrop-blur sm:-mx-8 sm:px-8 sm:pb-8">
          {footer}
        </div>
      )}
    </div>
  );
}

export function ContinueButton({
  children = "המשך",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="brand" size="cta" className="w-full rounded-[16px]" {...props}>
      {children}
    </Button>
  );
}
