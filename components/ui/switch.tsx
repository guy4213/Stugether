"use client";

import * as React from "react";
import { cn } from "cn";
import { Switch as SwitchPrimitive } from "radix-ui";

// Mockup toggle: 52×30, gradient when on, #C9D6EA when off. In RTL "on"
// moves the thumb to the left (the end), as drawn.
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[30px] w-[52px] shrink-0 items-center rounded-full p-[3px] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-[linear-gradient(90deg,#0d9488,#2563eb)] data-[state=unchecked]:bg-switch-off",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-6 rounded-full bg-white shadow-[0_2px_4px_rgba(15,27,51,.2)] transition-transform data-[state=checked]:-translate-x-[22px] data-[state=unchecked]:translate-x-0 ltr:data-[state=checked]:translate-x-[22px]"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
