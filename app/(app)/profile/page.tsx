import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileCover } from "@/components/profile/profile-cover";
import { AvatarUploader } from "@/components/profile/avatar-uploader";
import { ProfileForm } from "@/components/profile/profile-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfileFormData } from "@/lib/profile/queries";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { profile, institutions, faculties, departments } = await getProfileFormData(user.id);
  if (!profile) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-xl font-semibold">הגדרות פרופיל</h1>

      <Card className="overflow-visible py-0">
        <ProfileCover />
        <AvatarUploader
          userId={user.id}
          fullName={profile.full_name}
          avatarPath={profile.avatar_url}
        />
        <CardContent className="pt-6 pb-6">
          <ProfileForm
            profile={profile}
            email={user.email ?? ""}
            institutions={institutions}
            initialFaculties={faculties}
            initialDepartments={departments}
          />
        </CardContent>
      </Card>
    </main>
  );
}
