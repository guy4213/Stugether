import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Hardcoded dark gradient — the hero is always dark in the mockup regardless
// of the site's light/dark theme toggle, so it does not rely on .dark tokens.
export function HeroSection() {
  return (
    <section
      className="relative overflow-hidden bg-gradient-to-br from-[oklch(0.18_0.045_258)] via-[oklch(0.22_0.06_255)] to-[oklch(0.28_0.09_235)] text-white"
      dir="rtl"
    >
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 md:grid-cols-2 md:items-center">
        <div className="space-y-6">
          <h1 className="text-4xl leading-tight font-bold sm:text-5xl">
            סטודנטים
            <br />
            לומדים ביחד
          </h1>
          <p className="max-w-md text-white/70">
            מצאו מורים פרטיים, הצטרפו לקבוצות לימוד וגשו לקורסים מובנים — הכול במקום אחד.
          </p>

          {/* Decorative for now — no courses page/search endpoint exists yet. */}
          <form className="flex max-w-md items-center gap-2 rounded-full bg-white/10 p-1.5 backdrop-blur-sm">
            <SearchIcon className="ms-3 size-4 shrink-0 text-white/60" />
            <Input
              placeholder="חיפוש לפי נושא, מורה או מוסד..."
              className="h-9 border-0 bg-transparent text-white placeholder:text-white/50 focus-visible:ring-0"
            />
            <Button type="submit" size="sm" className="rounded-full">
              חיפוש
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
