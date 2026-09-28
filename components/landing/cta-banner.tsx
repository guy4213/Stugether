import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

export function CtaBanner({ isAuthed }: { isAuthed: boolean }) {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 pt-20 md:px-10 xl:px-[120px] xl:pt-[110px]">
      <div className="relative flex flex-col items-start gap-8 overflow-hidden rounded-[28px] bg-landing-cta px-7 py-12 text-white shadow-[0_30px_60px_-30px_rgba(37,99,235,.7)] lg:h-[300px] lg:flex-row lg:items-center lg:justify-between lg:rounded-[36px] lg:px-[72px] lg:py-0">
        <span
          aria-hidden
          className="absolute -top-[170px] left-20 size-[380px] rounded-full bg-white/8"
        />
        <span
          aria-hidden
          className="absolute -bottom-[110px] left-[420px] size-[220px] rotate-[22deg] rounded-[52px] bg-white/7"
        />
        <div className="relative flex flex-col gap-3">
          <h2 className="text-[34px] leading-[1.05] font-extrabold tracking-[-1px] lg:text-[50px]">
            {isAuthed ? (
              "ממשיכים ללמוד ביחד?"
            ) : (
              <>
                מוכנים להתחיל
                <br />
                ללמוד ביחד?
              </>
            )}
          </h2>
          <p className="text-lg text-white/88">
            {isAuthed ? "החדרים והקורסים שלך מחכים בדשבורד." : "ההרשמה לוקחת פחות מדקה."}
          </p>
        </div>
        <div className="relative flex w-full flex-col gap-3 sm:w-[300px]">
          <Link
            href={isAuthed ? "/dashboard" : "/signup"}
            className="flex h-[60px] items-center justify-center gap-2.5 rounded-[18px] bg-white text-lg font-extrabold text-primary-strong shadow-[0_16px_30px_-14px_rgba(2,12,40,.6)] hover:bg-primary-soft"
          >
            {isAuthed ? "המשך ללמוד" : "הרשמה חינם"}
            <ArrowLeftIcon className="size-5" strokeWidth={2.4} aria-hidden />
          </Link>
          {!isAuthed && (
            <Link
              href="/login"
              className="flex h-[52px] items-center justify-center rounded-2xl border-[1.5px] border-white/50 text-base font-semibold text-white hover:bg-white/10"
            >
              כבר יש לי חשבון
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
