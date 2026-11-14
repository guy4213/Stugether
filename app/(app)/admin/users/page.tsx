import { FilterForm, SELECT_CLASS } from "@/components/admin/filter-form";
import { UserActiveToggle } from "@/components/admin/user-active-toggle";
import { UserDetailsDialog } from "@/components/admin/user-details-dialog";
import { UserRoleToggle } from "@/components/admin/user-role-toggle";
import { Pill } from "@/components/ui/pill";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { getAdminUsers, requireSuperAdmin } from "@/lib/admin/queries";
import { relativeTimeHe } from "@/lib/ui/format";

// "משתמשים" (SPEC §4.9): list, search, filter by institution/department/role,
// deactivate/activate, grant/revoke Super Admin (CR 11.11.2026).
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    institutionId?: string;
    departmentId?: string;
    role?: string;
  }>;
}) {
  const params = await searchParams;
  const filters = {
    search: params.q?.trim() || undefined,
    institutionId: params.institutionId || undefined,
    departmentId: params.departmentId || undefined,
    role:
      params.role === "student" || params.role === "super_admin"
        ? (params.role as "student" | "super_admin")
        : undefined,
  };
  const [admin, data] = await Promise.all([requireSuperAdmin(), getAdminUsers(filters)]);

  return (
    <section className="flex flex-col gap-4">
      <FilterForm search={filters.search ?? ""} searchPlaceholder="חיפוש לפי שם">
        <select
          name="institutionId"
          defaultValue={filters.institutionId ?? ""}
          aria-label="מוסד"
          className={SELECT_CLASS}
        >
          <option value="">כל המוסדות</option>
          {data.institutions.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
        <select
          name="departmentId"
          defaultValue={filters.departmentId ?? ""}
          aria-label="מחלקה"
          className={SELECT_CLASS}
        >
          <option value="">כל המחלקות</option>
          {data.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          name="role"
          defaultValue={filters.role ?? ""}
          aria-label="תפקיד"
          className={SELECT_CLASS}
        >
          <option value="">כל התפקידים</option>
          <option value="student">סטודנטים</option>
          <option value="super_admin">אדמינים</option>
        </select>
      </FilterForm>

      <p className="text-sm text-muted-foreground">{data.users.length} משתמשים</p>

      <div className="overflow-hidden rounded-[22px] border border-border bg-white shadow-card">
        {data.users.length === 0 ? (
          <p className="px-6 py-12 text-center text-muted-foreground">לא נמצאו משתמשים</p>
        ) : (
          <ul>
            {data.users.map((u, i) => (
              <li
                key={u.id}
                className={
                  i > 0
                    ? "flex flex-wrap items-center gap-3 border-t border-divider px-5 py-3.5"
                    : "flex flex-wrap items-center gap-3 px-5 py-3.5"
                }
              >
                <UserDetailsDialog userId={u.id} name={u.fullName}>
                  <PersonAvatar
                    id={u.id}
                    name={u.fullName}
                    avatarPath={u.avatarPath}
                    className="size-10"
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className="truncate">{u.fullName}</span>
                      {u.role === "super_admin" && <Pill tone="violet">אדמין</Pill>}
                      {!u.isActive && <Pill tone="rose">מושבת/ת</Pill>}
                    </span>
                    {u.email && (
                      <span dir="ltr" className="max-w-full self-start truncate text-xs text-ink-2">
                        {u.email}
                      </span>
                    )}
                    <span className="truncate text-xs text-muted-foreground">
                      {[u.institution, u.department, u.studyYear ? `שנה ${u.studyYear}` : null]
                        .filter(Boolean)
                        .join(" · ") || "לא השלים/ה פרופיל"}
                    </span>
                  </span>
                </UserDetailsDialog>
                <span className="w-28 text-xs text-muted-foreground">
                  {u.lastSeenAt ? `נראה/תה ${relativeTimeHe(u.lastSeenAt)}` : "לא התחבר/ה"}
                </span>
                {u.id !== admin?.userId && (
                  <div className="flex items-center gap-2">
                    <UserRoleToggle
                      userId={u.id}
                      name={u.fullName}
                      isSuperAdmin={u.role === "super_admin"}
                    />
                    <UserActiveToggle userId={u.id} name={u.fullName} isActive={u.isActive} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
