import { FilterForm, SELECT_CLASS } from "@/components/admin/filter-form";
import { UserActiveToggle } from "@/components/admin/user-active-toggle";
import { Pill } from "@/components/ui/pill";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { getAdminUsers, requireSuperAdmin } from "@/lib/admin/queries";
import { relativeTimeHe } from "@/lib/ui/format";

// "משתמשים" (SPEC §4.9): list, search, filter by institution/department,
// deactivate/activate.
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; institutionId?: string; departmentId?: string }>;
}) {
  const params = await searchParams;
  const filters = {
    search: params.q?.trim() || undefined,
    institutionId: params.institutionId || undefined,
    departmentId: params.departmentId || undefined,
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
                <PersonAvatar id={u.id} name={u.fullName} className="size-10" />
                <div className="flex min-w-0 grow basis-48 flex-col">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{u.fullName}</span>
                    {u.role === "super_admin" && <Pill tone="violet">אדמין</Pill>}
                    {!u.isActive && <Pill tone="rose">מושבת/ת</Pill>}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[u.institution, u.department, u.studyYear ? `שנה ${u.studyYear}` : null]
                      .filter(Boolean)
                      .join(" · ") || "לא השלים/ה פרופיל"}
                  </span>
                </div>
                <span className="w-28 text-xs text-muted-foreground">
                  {u.lastSeenAt ? `נראה/תה ${relativeTimeHe(u.lastSeenAt)}` : "לא התחבר/ה"}
                </span>
                {u.id !== admin?.userId && (
                  <UserActiveToggle userId={u.id} name={u.fullName} isActive={u.isActive} />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
