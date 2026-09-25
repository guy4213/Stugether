import Link from "next/link";
import { redirect } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileCover } from "@/components/profile/profile-cover";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";
import { ProfileCompletion } from "@/components/profile/profile-completion";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfileFormData } from "@/lib/profile/queries";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { profile, institutions, faculties, departments, activeCourses } = await getProfileFormData(
    user.id,
  );
  if (!profile) redirect("/login");

  const institutionName = institutions.find((i) => i.id === profile.institution_id)?.name;
  const departmentName = departments.find((d) => d.id === profile.department_id)?.name;

  const completion = [
    { label: "פרטים אישיים", done: !!profile.full_name },
    { label: "תמונת פרופיל", done: !!profile.avatar_url },
    { label: "אודות", done: !!profile.bio },
    {
      label: "מוסד, מחלקה ושנת לימודים",
      done: !!profile.institution_id && !!profile.department_id && !!profile.study_year,
    },
    { label: "עיר", done: !!profile.city },
    { label: "הרשמה לקורס", done: activeCourses.length > 0 },
  ];

  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8 sm:px-8">
      <Card className="gap-0 overflow-visible border-0 py-0 shadow-sm ring-0">
        <ProfileCover />
        <div className="flex flex-col items-start gap-4 px-6 pb-6 sm:flex-row sm:items-end">
          <div className="-mt-12 sm:-mt-14">
            <AvatarUploader
              userId={user.id}
              fullName={profile.full_name}
              avatarPath={profile.avatar_url}
            />
          </div>
          <div className="pb-1">
            <h1 className="text-2xl font-bold">{profile.full_name}</h1>
            <p className="text-sm text-muted-foreground">
              {[
                institutionName,
                departmentName,
                profile.study_year ? `שנה ${profile.study_year}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "השלימו את פרטי הלימודים שלכם"}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-0 shadow-sm ring-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">פרטים אישיים ולימודים</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              profile={profile}
              email={user.email ?? ""}
              institutions={institutions}
              initialFaculties={faculties}
              initialDepartments={departments}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <ProfileCompletion items={completion} />

          <Card className="border-0 shadow-sm ring-0">
            <CardHeader>
              <CardTitle className="text-base font-semibold">הקורסים שלי</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {activeCourses.map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary hover:bg-primary/15"
                >
                  {course.name}
                </Link>
              ))}
              <Link
                href="/courses"
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-3 py-1 text-sm font-medium text-primary hover:bg-primary/5"
              >
                <PlusIcon className="size-3.5" />
                הוספת קורס
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
