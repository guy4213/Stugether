import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { DirectionProvider } from "@/components/ui/direction";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const heebo = Heebo({
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
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {/* Radix reads direction from context, not from the html attribute. */}
        <DirectionProvider dir="rtl">
          {children}
          <Toaster dir="rtl" position="bottom-left" />
        </DirectionProvider>
      </body>
    </html>
  );
}
