"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LockIcon, CheckIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProfile, type ProfileFormState } from "@/lib/profile/actions";
import { getCatalogForInstitution } from "@/lib/catalog/queries";
import { ISRAELI_CITIES } from "@/lib/constants/cities";
import type { Institution, Faculty, Department } from "@/lib/repositories/catalog";
import type { Profile } from "@/lib/repositories/profiles";

const STUDY_YEARS = Array.from({ length: 10 }, (_, i) => i + 1);
const BIO_MAX_LENGTH = 1000;

const initialState: ProfileFormState = { ok: true };

export function ProfileForm({
  profile,
  email,
  institutions,
  initialFaculties,
  initialDepartments,
}: {
  profile: Profile;
  email: string;
  institutions: Institution[];
  initialFaculties: Faculty[];
  initialDepartments: Department[];
}) {
  const [state, formAction, isSubmitting] = useActionState(updateProfile, initialState);
  const [isCatalogLoading, startCatalogTransition] = useTransition();
  const [, startSaveTransition] = useTransition();

  const [institutionId, setInstitutionId] = useState(profile.institution_id ?? "");
  // Derived once from the profile's already-persisted department_id — only
  // institution_id/department_id are stored, faculty is a UI-only filter
  // (see lib/repositories/profiles.ts).
  const [facultyId, setFacultyId] = useState(() => {
    if (!profile.department_id) return "";
    const current = initialDepartments.find((d) => d.id === profile.department_id);
    return current?.faculty_id ?? "";
  });
  const [departmentId, setDepartmentId] = useState(profile.department_id ?? "");
  const [city, setCity] = useState(profile.city ?? "");
  const [studyYear, setStudyYear] = useState(profile.study_year ? String(profile.study_year) : "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [faculties, setFaculties] = useState(initialFaculties);
  const [departments, setDepartments] = useState(initialDepartments);

  // useActionState hands back the same initialState object until an action
  // completes — a ref-based "first render" guard breaks under StrictMode's
  // double-run effects, so compare identity instead.
  useEffect(() => {
    if (state === initialState) return;
    if (state.ok === false && state.error) toast.error(state.error);
    if (state.ok === true) toast.success("הפרופיל עודכן בהצלחה");
  }, [state]);

  // Submitting via onSubmit (not <form action>) opts out of React 19's
  // automatic form reset after an action, which made the Radix selects fire
  // onValueChange("") — clearing the saved values on screen and sending
  // getCatalogForInstitution("") (a Postgres uuid error).
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startSaveTransition(() => formAction(formData));
  }

  function handleInstitutionChange(newInstitutionId: string) {
    if (!newInstitutionId || newInstitutionId === institutionId) return;
    setInstitutionId(newInstitutionId);
    setFacultyId("");
    setDepartmentId("");
    startCatalogTransition(async () => {
      try {
        const { faculties: newFaculties, departments: newDepartments } =
          await getCatalogForInstitution(newInstitutionId);
        setFaculties(newFaculties);
        setDepartments(newDepartments);
      } catch {
        toast.error("טעינת הפקולטות נכשלה. נסו שוב");
      }
    });
  }

  function handleFacultyChange(newFacultyId: string) {
    if (!newFacultyId || newFacultyId === facultyId) return;
    setFacultyId(newFacultyId);
    setDepartmentId("");
  }

  // "ביטול": back to the saved values (the native reset handles fullName).
  function resetFields() {
    setInstitutionId(profile.institution_id ?? "");
    setFacultyId(
      initialDepartments.find((d) => d.id === profile.department_id)?.faculty_id ?? "",
    );
    setDepartmentId(profile.department_id ?? "");
    setCity(profile.city ?? "");
    setStudyYear(profile.study_year ? String(profile.study_year) : "");
    setBio(profile.bio ?? "");
    setFaculties(initialFaculties);
    setDepartments(initialDepartments);
  }

  const departmentsForFaculty = departments.filter((d) => d.faculty_id === facultyId);

  return (
    <form onSubmit={handleSubmit} onReset={resetFields} className="flex flex-col gap-5">
      <input type="hidden" name="institutionId" value={institutionId} />
      <input type="hidden" name="departmentId" value={departmentId} />
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="studyYear" value={studyYear} />

      <div className="grid grid-cols-1 gap-x-5 gap-y-[18px] sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName" className="text-sm font-semibold">שם מלא</Label>
          <Input
            id="fullName"
            name="fullName"
            defaultValue={profile.full_name}
            required
            maxLength={120}
            className="h-[50px] w-full rounded-[14px] border-[1.5px] border-border bg-white px-4 text-[15px] text-foreground shadow-none"
          />
          {state.fieldErrors?.fullName?.[0] && (
            <p className="text-xs text-destructive">{state.fieldErrors.fullName[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email" className="text-sm font-semibold">אימייל</Label>
          <span className="flex h-[50px] items-center gap-2.5 rounded-[14px] bg-muted px-4 text-muted-foreground">
            <LockIcon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            <input
              id="email"
              value={email}
              disabled
              readOnly
              dir="ltr"
              className="min-w-0 grow border-0 bg-transparent text-right text-[15px] text-muted-foreground"
            />
          </span>
          <p className="text-xs text-muted-foreground">לא ניתן לשנות את כתובת האימייל</p>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-semibold">מוסד לימודים</Label>
          <Select value={institutionId} onValueChange={handleInstitutionChange}>
            <SelectTrigger className="h-[50px] w-full rounded-[14px] border-[1.5px] border-border bg-white px-4 text-[15px] text-foreground shadow-none data-[size=default]:h-[50px]">
              <SelectValue placeholder="בחר/י מוסד לימודים" />
            </SelectTrigger>
            <SelectContent>
              {institutions.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  {inst.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-semibold">פקולטה</Label>
          <Select
            value={facultyId}
            onValueChange={handleFacultyChange}
            disabled={!institutionId || isCatalogLoading}
          >
            <SelectTrigger className="h-[50px] w-full rounded-[14px] border-[1.5px] border-border bg-white px-4 text-[15px] text-foreground shadow-none data-[size=default]:h-[50px]">
              <SelectValue placeholder="בחר/י פקולטה" />
            </SelectTrigger>
            <SelectContent>
              {faculties.map((fac) => (
                <SelectItem key={fac.id} value={fac.id}>
                  {fac.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-semibold">מחלקה</Label>
          <Select value={departmentId} onValueChange={(v) => v && setDepartmentId(v)} disabled={!facultyId}>
            <SelectTrigger className="h-[50px] w-full rounded-[14px] border-[1.5px] border-border bg-white px-4 text-[15px] text-foreground shadow-none data-[size=default]:h-[50px]">
              <SelectValue placeholder="בחר/י מחלקה" />
            </SelectTrigger>
            <SelectContent>
              {departmentsForFaculty.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-semibold">עיר</Label>
          <Select value={city} onValueChange={(v) => v && setCity(v)}>
            <SelectTrigger className="h-[50px] w-full rounded-[14px] border-[1.5px] border-border bg-white px-4 text-[15px] text-foreground shadow-none data-[size=default]:h-[50px]">
              <SelectValue placeholder="בחר/י עיר" />
            </SelectTrigger>
            <SelectContent>
              {ISRAELI_CITIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-semibold">שנת לימודים</Label>
          <Select value={studyYear} onValueChange={(v) => v && setStudyYear(v)}>
            <SelectTrigger className="h-[50px] w-full rounded-[14px] border-[1.5px] border-border bg-white px-4 text-[15px] text-foreground shadow-none data-[size=default]:h-[50px]">
              <SelectValue placeholder="בחר/י שנה" />
            </SelectTrigger>
            <SelectContent>
              {STUDY_YEARS.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  שנה {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="bio" className="text-sm font-semibold">אודות</Label>
          <span className="text-xs text-muted-foreground">
            {bio.length}/{BIO_MAX_LENGTH}
          </span>
        </div>
        <Textarea
          id="bio"
          name="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={BIO_MAX_LENGTH}
          rows={3}
          placeholder="ספר/י קצת על עצמך..."
          className="min-h-24 resize-y rounded-[14px] border-[1.5px] border-border bg-white px-4 py-3.5 text-[15px] leading-normal shadow-none"
        />
      </div>

      <div className="flex items-center gap-2.5 border-t border-divider pt-5">
        <Button
          type="submit"
          variant="brand"
          size="xl"
          className="rounded-[15px] px-7 text-base"
          disabled={isSubmitting}
        >
          <CheckIcon strokeWidth={2.6} />
          {isSubmitting ? "שומר..." : "שמירת שינויים"}
        </Button>
        <Button type="reset" variant="quiet" size="xl" className="rounded-[15px] px-[22px]">
          ביטול
        </Button>
      </div>
    </form>
  );
}
