import type { Metadata } from "next";
import { Rubik } from "next/font/google";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Rubik is the typeface of the StuGether Dashboard mockup (400–800).
const rubik = Rubik({
  variable: "--font-sans",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stugether",
  description: "חדרי למידה קבוצתיים עם עוזר AI",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* Radix reads direction from context, not from the html attribute. */}
        <DirectionProvider dir="rtl">
          <a
            href="#main-content"
            className="sr-only rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4 focus:z-50"
          >
            דילוג לתוכן הראשי
          </a>
          {children}
          <Toaster dir="rtl" position="bottom-left" />
        </DirectionProvider>
      </body>
    </html>
  );
}
