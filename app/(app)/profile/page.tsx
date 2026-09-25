import { createElement } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOutIcon, PlusIcon } from "lucide-react";
import { IconTile } from "@/components/ui/icon-tile";
import { ProfileCover } from "@/components/profile/profile-cover";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";
import { ProfileCompletion } from "@/components/profile/profile-completion";
import { getCurrentUser } from "@/lib/auth/session";
import { signOutAndRedirect } from "@/lib/auth/session-actions";
import { getProfileFormData } from "@/lib/profile/queries";
import { courseTheme } from "@/lib/ui/course-theme";

// "הגדרות פרופיל" per Profile.dc.html.
export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { profile, institutions, faculties, departments, activeCourses, stats } =
    await getProfileFormData(user.id);
  if (!profile) redirect("/login");

  const institutionName = institutions.find((i) => i.id === profile.institution_id)?.name;
  const departmentName = departments.find((d) => d.id === profile.department_id)?.name;

  const completion = [
    { label: "פרטים אישיים", done: !!profile.full_name, hint: "הוסיפו את השם המלא שלכם" },
    { label: "אודות", done: !!profile.bio, hint: "ספרו בכמה מילים מה אתם אוהבים ללמוד" },
    {
      label: "מוסד ומחלקה",
      done: !!profile.institution_id && !!profile.department_id && !!profile.study_year,
      hint: "בחרו מוסד, מחלקה ושנת לימודים כדי למצוא שותפים",
    },
    { label: "עיר", done: !!profile.city, hint: "הוסיפו עיר כדי להתאים שותפים קרובים" },
    { label: "הרשמה לקורס", done: activeCourses.length > 0, hint: "הירשמו לקורס ראשון" },
    {
      label: "תמונת פרופיל",
      done: !!profile.avatar_url,
      hint: "הוסיפו תמונת פרופיל כדי שהשותפים יזהו אתכם",
    },
  ];

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 pt-7 pb-10 sm:px-8 xl:px-12"
    >
      {/* Cover */}
      <section className="overflow-hidden rounded-[26px] border border-border bg-card shadow-card">
        <ProfileCover />
        <div className="relative flex flex-col gap-5 px-5 pb-6 sm:px-9 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:gap-[22px]">
            <div className="-mt-[66px]">
              <AvatarUploader
                userId={user.id}
                fullName={profile.full_name}
                avatarPath={profile.avatar_url}
              />
            </div>
            <div className="flex flex-col gap-1 pb-1.5">
              <h1 className="text-[30px] font-extrabold tracking-[-0.4px]">{profile.full_name}</h1>
              <span className="text-[15px] text-muted-foreground">
                {[
                  institutionName,
                  departmentName,
                  profile.study_year ? `שנה ${profile.study_year}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "השלימו את פרטי הלימודים שלכם"}
              </span>
            </div>
          </div>
          <dl className="flex gap-2.5 pb-1.5">
            <ProfileStat label="קורסים" value={stats.courses} />
            <ProfileStat label="שותפים" value={stats.partners} />
            <ProfileStat label="ימי רצף" value={stats.streak} warm />
          </dl>
        </div>
      </section>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <section className="flex min-w-0 grow flex-col gap-5 rounded-[22px] border border-border bg-card px-5 py-[26px] sm:px-7">
          <h2 className="text-xl font-bold">פרטים אישיים ולימודים</h2>
          <ProfileForm
            profile={profile}
            email={user.email ?? ""}
            institutions={institutions}
            initialFaculties={faculties}
            initialDepartments={departments}
          />
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[380px]">
          <ProfileCompletion items={completion} />

          <div className="flex flex-col gap-3.5 rounded-[22px] border border-border bg-card p-6">
            <h2 className="text-lg font-bold">הקורסים שלי</h2>
            {activeCourses.map((course) => {
              const theme = courseTheme(course.name, course.id);
              return (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="flex items-center gap-3 rounded-[14px] bg-surface-2 px-3 py-2.5 text-foreground hover:bg-primary-soft"
                >
                  <IconTile tone={theme.tone} className="size-10 rounded-xl [&_svg]:size-[18px]">
                    {createElement(theme.icon, { strokeWidth: 2.2 })}
                  </IconTile>
                  <span className="grow text-[15px] font-semibold">{course.name}</span>
                  {course.completed ? (
                    <span className="text-[13px] font-bold text-success-ink">הושלם</span>
                  ) : (
                    <span className="text-[13px] font-bold text-primary-strong">
                      {course.progress}%
                    </span>
                  )}
                </Link>
              );
            })}
            <Link
              href="/courses"
              className="flex h-11 items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-primary-line text-sm font-semibold text-primary-strong hover:bg-primary-soft"
            >
              <PlusIcon className="size-4" strokeWidth={2.4} aria-hidden />
              הוספת קורס
            </Link>
          </div>

          <form action={signOutAndRedirect}>
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-[15px] border border-danger-line bg-danger-soft text-[15px] font-semibold text-destructive hover:bg-[#ffeceb]"
            >
              <LogOutIcon className="size-[18px]" strokeWidth={2} aria-hidden />
              התנתקות
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}

function ProfileStat({ label, value, warm = false }: { label: string; value: number; warm?: boolean }) {
  return (
    <div
      className={`flex flex-col-reverse items-center rounded-2xl px-[18px] py-2.5 ${warm ? "bg-warning-soft text-warning-ink" : "bg-muted"}`}
    >
      <dt className={`text-xs ${warm ? "" : "text-muted-foreground"}`}>{label}</dt>
      <dd className="text-[22px] font-extrabold">{value}</dd>
    </div>
  );
}
