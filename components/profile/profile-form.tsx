"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
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
import {
  HOBBIES,
  LEARNING_STYLES,
  LEARNING_STYLE_LABEL,
  MAX_HOBBIES,
  MAX_LEARNING_STYLES,
  STUDY_TIMES,
  STUDY_TIME_LABEL,
  SEMESTERS,
  SEMESTER_LABEL,
  STUDY_TRACKS,
  TRACK_LABEL,
} from "@/lib/constants/profile-options";
import { cn } from "cn";
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
  // The institution whose catalog the selects should show. A fetch that
  // resolves after the choice moved on (another pick, or "ביטול") is dropped.
  const catalogFor = useRef(profile.institution_id ?? "");
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
  const [track, setTrack] = useState<string>(profile.track ?? "");
  const [semester, setSemester] = useState(profile.semester ? String(profile.semester) : "");
  const [hobbies, setHobbies] = useState<string[]>(profile.hobbies ?? []);
  const [studyTimes, setStudyTimes] = useState<string[]>(profile.study_times ?? []);
  const [learningStyles, setLearningStyles] = useState<string[]>(profile.learning_styles ?? []);
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
    catalogFor.current = newInstitutionId;
    startCatalogTransition(async () => {
      try {
        const { faculties: newFaculties, departments: newDepartments } =
          await getCatalogForInstitution(newInstitutionId);
        if (catalogFor.current !== newInstitutionId) return;
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
    // Radix Select answers the form's reset event first, with the value it
    // mounted with — possibly an institution older than the saved one.
    catalogFor.current = profile.institution_id ?? "";
    setInstitutionId(profile.institution_id ?? "");
    setFacultyId(initialDepartments.find((d) => d.id === profile.department_id)?.faculty_id ?? "");
    setDepartmentId(profile.department_id ?? "");
    setCity(profile.city ?? "");
    setStudyYear(profile.study_year ? String(profile.study_year) : "");
    setBio(profile.bio ?? "");
    setTrack(profile.track ?? "");
    setSemester(profile.semester ? String(profile.semester) : "");
    setHobbies(profile.hobbies ?? []);
    setStudyTimes(profile.study_times ?? []);
    setLearningStyles(profile.learning_styles ?? []);
    setFaculties(initialFaculties);
    setDepartments(initialDepartments);
  }

  // SelectValue gets explicit text: Radix fills it only after hydration.
  const departmentsForFaculty = departments.filter((d) => d.faculty_id === facultyId);

  return (
    <form onSubmit={handleSubmit} onReset={resetFields} className="flex flex-col gap-5">
      <input type="hidden" name="institutionId" value={institutionId} />
      <input type="hidden" name="departmentId" value={departmentId} />
      <input type="hidden" name="city" value={city} />
      <input type="hidden" name="studyYear" value={studyYear} />
      <input type="hidden" name="track" value={track} />
      <input type="hidden" name="semester" value={semester} />
      <input type="hidden" name="hobbies" value={hobbies.join(",")} />
      <input type="hidden" name="studyTimes" value={studyTimes.join(",")} />
      <input type="hidden" name="learningStyles" value={learningStyles.join(",")} />

      <div className="grid grid-cols-1 gap-x-5 gap-y-[18px] sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName" className="text-sm font-semibold">
            שם מלא
          </Label>
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
          <Label htmlFor="email" className="text-sm font-semibold">
            אימייל
          </Label>
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
              <SelectValue placeholder="בחר/י מוסד לימודים">
                {institutions.find((i) => i.id === institutionId)?.name}
              </SelectValue>
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
              <SelectValue placeholder="בחר/י פקולטה">
                {faculties.find((f) => f.id === facultyId)?.name}
              </SelectValue>
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
          <Select
            value={departmentId}
            onValueChange={(v) => v && setDepartmentId(v)}
            disabled={!facultyId}
          >
            <SelectTrigger className="h-[50px] w-full rounded-[14px] border-[1.5px] border-border bg-white px-4 text-[15px] text-foreground shadow-none data-[size=default]:h-[50px]">
              <SelectValue placeholder="בחר/י מחלקה">
                {departments.find((d) => d.id === departmentId)?.name}
              </SelectValue>
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
              <SelectValue placeholder="בחר/י עיר">{city || undefined}</SelectValue>
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
              <SelectValue placeholder="בחר/י שנה">
                {studyYear ? `שנה ${studyYear}` : undefined}
              </SelectValue>
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

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-semibold">מסלול לימודים</Label>
          <Select value={track} onValueChange={(v) => v && setTrack(v)}>
            <SelectTrigger className="h-[50px] w-full rounded-[14px] border-[1.5px] border-border bg-white px-4 text-[15px] text-foreground shadow-none data-[size=default]:h-[50px]">
              <SelectValue placeholder="בחר/י מסלול">
                {track ? TRACK_LABEL[track as keyof typeof TRACK_LABEL] : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STUDY_TRACKS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TRACK_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-sm font-semibold">סמסטר נוכחי</Label>
          <Select value={semester} onValueChange={(v) => v && setSemester(v)}>
            <SelectTrigger className="h-[50px] w-full rounded-[14px] border-[1.5px] border-border bg-white px-4 text-[15px] text-foreground shadow-none data-[size=default]:h-[50px]">
              <SelectValue placeholder="בחר/י סמסטר">
                {semester ? SEMESTER_LABEL[Number(semester)] : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SEMESTERS.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {SEMESTER_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ChipGroup
        legend="תחביבים"
        options={HOBBIES.map((h) => ({ value: h, label: h }))}
        selected={hobbies}
        onChange={setHobbies}
        max={MAX_HOBBIES}
        hint="משפיע על אחוז ההתאמה עם סטודנטים אחרים"
      />

      <ChipGroup
        legend="זמנים מועדפים ללמידה"
        options={STUDY_TIMES.map((t) => ({ value: t, label: STUDY_TIME_LABEL[t] }))}
        selected={studyTimes}
        onChange={setStudyTimes}
      />

      <ChipGroup
        legend="דרכי למידה מועדפות"
        options={LEARNING_STYLES.map((l) => ({ value: l, label: LEARNING_STYLE_LABEL[l] }))}
        selected={learningStyles}
        onChange={setLearningStyles}
        max={MAX_LEARNING_STYLES}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="bio" className="text-sm font-semibold">
            אודות
          </Label>
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

// Toggle chips (hobbies style). `max` disables the rest once reached.
function ChipGroup({
  legend,
  options,
  selected,
  onChange,
  max,
  hint,
}: {
  legend: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  max?: number;
  hint?: string;
}) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <legend className="text-sm font-semibold">{legend}</legend>
        {(max || hint) && (
          <span className="text-xs text-muted-foreground">
            {[max ? `${selected.length}/${max}` : null, hint].filter(Boolean).join(" · ")}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(({ value, label }) => {
          const isSelected = selected.includes(value);
          const full = !isSelected && max !== undefined && selected.length >= max;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isSelected}
              disabled={full}
              onClick={() =>
                onChange(isSelected ? selected.filter((x) => x !== value) : [...selected, value])
              }
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors disabled:opacity-40",
                isSelected
                  ? "bg-success-soft font-semibold text-success-ink"
                  : "border border-border bg-white text-ink-2 hover:border-primary-line",
              )}
            >
              {isSelected && <CheckIcon className="size-3.5" strokeWidth={2.6} aria-hidden />}
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
