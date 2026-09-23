"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (state.ok === false && state.error) toast.error(state.error);
    if (state.ok === true) toast.success("הפרופיל עודכן בהצלחה");
  }, [state]);

  function handleInstitutionChange(newInstitutionId: string) {
    setInstitutionId(newInstitutionId);
    setFacultyId("");
    setDepartmentId("");
    startCatalogTransition(async () => {
      const { faculties: newFaculties, departments: newDepartments } =
        await getCatalogForInstitution(newInstitutionId);
      setFaculties(newFaculties);
      setDepartments(newDepartments);
    });
  }

  function handleFacultyChange(newFacultyId: string) {
    setFacultyId(newFacultyId);
    setDepartmentId("");
  }

  const departmentsForFaculty = departments.filter((d) => d.faculty_id === facultyId);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="institutionId" value={institutionId} />
      <input type="hidden" name="departmentId" value={departmentId} />
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="studyYear" value={studyYear} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">שם מלא</Label>
          <Input
            id="fullName"
            name="fullName"
            defaultValue={profile.full_name}
            required
            maxLength={120}
          />
          {state.fieldErrors?.fullName?.[0] && (
            <p className="text-xs text-destructive">{state.fieldErrors.fullName[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">אימייל</Label>
          <Input id="email" value={email} disabled readOnly />
          <p className="text-xs text-muted-foreground">לא ניתן לשנות את כתובת האימייל</p>
        </div>

        <div className="space-y-1.5">
          <Label>מוסד לימודים</Label>
          <Select value={institutionId} onValueChange={handleInstitutionChange}>
            <SelectTrigger className="w-full">
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

        <div className="space-y-1.5">
          <Label>פקולטה</Label>
          <Select
            value={facultyId}
            onValueChange={handleFacultyChange}
            disabled={!institutionId || isCatalogLoading}
          >
            <SelectTrigger className="w-full">
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

        <div className="space-y-1.5">
          <Label>מחלקה</Label>
          <Select value={departmentId} onValueChange={setDepartmentId} disabled={!facultyId}>
            <SelectTrigger className="w-full">
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

        <div className="space-y-1.5">
          <Label>עיר</Label>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="בחר/י עיר" />
            </SelectTrigger>
            <SelectContent>
              {ISRAELI_CITIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>שנת לימודים</Label>
          <Select value={studyYear} onValueChange={setStudyYear}>
            <SelectTrigger className="w-full">
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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="bio">אודות</Label>
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
          rows={4}
          placeholder="ספר/י קצת על עצמך..."
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "שומר..." : "שמור שינויים"}
        </Button>
      </div>
    </form>
  );
}
