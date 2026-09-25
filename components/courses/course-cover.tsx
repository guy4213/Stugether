import { createElement } from "react";
import { cn } from "cn";
import { courseTheme } from "@/lib/ui/course-theme";

export function courseIcon(label: string) {
  return courseTheme(label).icon;
}

// The mockup shows a gradient cover per course with a frosted subject icon
// tile and two decorative circles (Discover.dc.html cards).
export function CourseCover({
  seed,
  label,
  className,
  children,
}: {
  seed: string;
  label: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const theme = courseTheme(label, seed);
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden text-white",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(120deg, ${theme.gradient[0]}, ${theme.gradient[1]})`,
      }}
    >
      <span
        aria-hidden
        className="absolute -top-[90px] -right-10 size-[180px] rounded-full bg-white/10"
      />
      <span
        aria-hidden
        className="absolute -bottom-[60px] left-5 size-[120px] rounded-full bg-white/8"
      />
      <span
        aria-hidden
        className="relative flex size-[68px] items-center justify-center rounded-[20px] border border-white/30 bg-white/18"
      >
        {createElement(theme.icon, { className: "size-8", strokeWidth: 2 })}
      </span>
      {children}
    </div>
  );
}
