// "תנאי שימוש · פרטיות" stay plain text until those pages exist.
export function SiteFooter() {
  return (
    <footer className="mx-auto mt-auto flex w-full max-w-[1440px] flex-col items-center gap-2 px-5 pt-16 pb-10 text-sm text-muted-foreground sm:flex-row sm:justify-between md:px-10 xl:px-[120px]">
      <span className="text-lg font-extrabold text-primary-strong">StuGether</span>
      <span>© {new Date().getFullYear()} StuGether · תנאי שימוש · פרטיות</span>
    </footer>
  );
}
