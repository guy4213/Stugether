"use client";

import { useState, useTransition } from "react";
import { PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { SELECT_CLASS } from "@/components/admin/filter-form";
import {
  createCourseAction,
  createDepartmentAction,
  createInstitutionAction,
  updateCatalogItemAction,
  type AdminActionResult,
} from "@/lib/admin/actions";
import type { Course, Department, Institution } from "@/lib/repositories/catalog";

type Kind = "institution" | "department" | "course";

// Catalog CRUD (SPEC §4.9, §6 #3-4): add / rename / deactivate institutions,
// departments and courses. Manual entry only — no CSV import in phase 1.
// Deactivation hides an item from students; nothing is ever deleted.
export function CatalogManager({
  institutions,
  departments,
  courses,
}: {
  institutions: Institution[];
  departments: Department[];
  courses: Course[];
}) {
  const [pending, startTransition] = useTransition();
  const [institutionId, setInstitutionId] = useState(institutions[0]?.id ?? "");

  const instDepartments = departments.filter((d) => d.institution_id === institutionId);
  const instCourses = courses.filter((c) => c.institution_id === institutionId);
  const departmentName = new Map(departments.map((d) => [d.id, d.name]));

  function run(action: () => Promise<AdminActionResult>, success: string, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "הפעולה נכשלה");
        return;
      }
      toast.success(success);
      after?.();
    });
  }

  function rename(kind: Kind, id: string, current: string) {
    const name = prompt("שם חדש", current)?.trim();
    if (!name || name === current) return;
    run(() => updateCatalogItemAction(kind, id, { name }), "השם עודכן");
  }

  function toggle(kind: Kind, id: string, isActive: boolean) {
    run(
      () => updateCatalogItemAction(kind, id, { isActive: !isActive }),
      isActive ? "הפריט הושבת" : "הפריט הופעל",
    );
  }

  const rowActions = (kind: Kind, id: string, name: string, isActive: boolean) => (
    <span className="flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={pending}
        aria-label={`שינוי שם: ${name}`}
        onClick={() => rename(kind, id, name)}
      >
        <PencilIcon />
      </Button>
      <Button
        variant={isActive ? "quiet" : "outline-primary"}
        size="xs"
        className="h-7 px-2.5"
        disabled={pending}
        onClick={() => toggle(kind, id, isActive)}
      >
        {isActive ? "השבתה" : "הפעלה"}
      </Button>
    </span>
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
      {/* Institutions */}
      <Card title="מוסדות">
        <ul className="flex flex-col">
          {institutions.map((inst) => (
            <li
              key={inst.id}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2 py-2",
                inst.id === institutionId && "bg-primary-soft",
              )}
            >
              <button
                type="button"
                onClick={() => setInstitutionId(inst.id)}
                aria-pressed={inst.id === institutionId}
                className="flex min-w-0 grow flex-col items-start text-start"
              >
                <span className={cn("truncate font-semibold", !inst.is_active && "line-through")}>
                  {inst.name}
                </span>
                {inst.city && <span className="text-xs text-muted-foreground">{inst.city}</span>}
              </button>
              {rowActions("institution", inst.id, inst.name, inst.is_active)}
            </li>
          ))}
        </ul>
        <CreateForm
          fields={[
            { name: "name", placeholder: "שם מוסד" },
            { name: "city", placeholder: "עיר (לא חובה)", optional: true },
          ]}
          pending={pending}
          onSubmit={(v, reset) =>
            run(() => createInstitutionAction({ name: v.name, city: v.city }), "המוסד נוסף", reset)
          }
        />
      </Card>

      <div className="flex flex-col gap-5">
        {!institutionId ? (
          <p className="text-muted-foreground">הוסיפו מוסד כדי להתחיל.</p>
        ) : (
          <>
            <Card title="מחלקות">
              {instDepartments.length === 0 ? (
                <p className="text-sm text-muted-foreground">אין מחלקות במוסד הזה</p>
              ) : (
                <ul className="grid gap-1 sm:grid-cols-2">
                  {instDepartments.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
                      <span className={cn("min-w-0 grow truncate", !d.is_active && "line-through")}>
                        {d.name}
                      </span>
                      {rowActions("department", d.id, d.name, d.is_active)}
                    </li>
                  ))}
                </ul>
              )}
              <CreateForm
                fields={[{ name: "name", placeholder: "שם מחלקה" }]}
                pending={pending}
                onSubmit={(v, reset) =>
                  run(
                    () => createDepartmentAction({ institutionId, name: v.name }),
                    "המחלקה נוספה",
                    reset,
                  )
                }
              />
            </Card>

            <Card title="קורסים">
              {instCourses.length === 0 ? (
                <p className="text-sm text-muted-foreground">אין קורסים במוסד הזה</p>
              ) : (
                <ul className="flex flex-col">
                  {instCourses.map((c, i) => (
                    <li
                      key={c.id}
                      className={cn(
                        "flex flex-wrap items-center gap-2 px-2 py-2",
                        i > 0 && "border-t border-divider",
                      )}
                    >
                      <div className="flex min-w-0 grow basis-52 flex-col">
                        <span
                          className={cn("truncate font-semibold", !c.is_active && "line-through")}
                        >
                          {c.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {[
                            c.code,
                            c.department_id ? departmentName.get(c.department_id) : null,
                            c.year_level ? `שנה ${c.year_level}` : null,
                            c.semester ? `סמסטר ${c.semester}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                      {!c.is_active && <Pill tone="neutral">מושבת</Pill>}
                      {rowActions("course", c.id, c.name, c.is_active)}
                    </li>
                  ))}
                </ul>
              )}
              <CourseCreateForm
                departments={instDepartments.filter((d) => d.is_active)}
                pending={pending}
                onSubmit={(v, reset) =>
                  run(() => createCourseAction({ institutionId, ...v }), "הקורס נוסף", reset)
                }
              />
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-[22px] border border-border bg-white p-5 shadow-card">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function CreateForm({
  fields,
  pending,
  onSubmit,
}: {
  fields: { name: string; placeholder: string; optional?: boolean }[];
  pending: boolean;
  onSubmit: (values: Record<string, string>, reset: () => void) => void;
}) {
  return (
    <form
      className="flex flex-wrap gap-2 border-t border-divider pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        const values = Object.fromEntries(
          fields.map((f) => [f.name, String(data.get(f.name) ?? "").trim()]),
        );
        onSubmit(values, () => form.reset());
      }}
    >
      {fields.map((f) => (
        <Input
          key={f.name}
          name={f.name}
          placeholder={f.placeholder}
          aria-label={f.placeholder}
          required={!f.optional}
          maxLength={200}
          className="h-10 min-w-40 flex-1"
        />
      ))}
      <Button type="submit" variant="soft" size="chip" disabled={pending}>
        <PlusIcon />
        הוספה
      </Button>
    </form>
  );
}

function CourseCreateForm({
  departments,
  pending,
  onSubmit,
}: {
  departments: Department[];
  pending: boolean;
  onSubmit: (
    values: {
      name: string;
      code: string;
      departmentId: string | null;
      yearLevel: number | null;
      semester: string;
    },
    reset: () => void,
  ) => void;
}) {
  return (
    <form
      className="grid gap-2 border-t border-divider pt-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const data = new FormData(form);
        const year = Number(data.get("yearLevel"));
        onSubmit(
          {
            name: String(data.get("name") ?? "").trim(),
            code: String(data.get("code") ?? "").trim(),
            departmentId: String(data.get("departmentId") ?? "") || null,
            yearLevel: Number.isInteger(year) && year > 0 ? year : null,
            semester: String(data.get("semester") ?? "").trim(),
          },
          () => form.reset(),
        );
      }}
    >
      <Input name="name" placeholder="שם הקורס" aria-label="שם הקורס" required maxLength={200} />
      <Input name="code" placeholder="קוד (לא חובה)" aria-label="קוד קורס" maxLength={50} />
      <select name="departmentId" aria-label="מחלקה" className={SELECT_CLASS} defaultValue="">
        <option value="">ללא מחלקה</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <select name="yearLevel" aria-label="שנת לימוד" className={SELECT_CLASS} defaultValue="">
        <option value="">שנת לימוד</option>
        {[1, 2, 3, 4].map((y) => (
          <option key={y} value={y}>
            שנה {y}
          </option>
        ))}
      </select>
      <Input name="semester" placeholder="סמסטר (א׳/ב׳/קיץ)" aria-label="סמסטר" maxLength={20} />
      <Button type="submit" variant="soft" size="md" disabled={pending}>
        <PlusIcon />
        הוספת קורס
      </Button>
    </form>
  );
}
