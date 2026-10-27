"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRightIcon, Building2Icon, GraduationCapIcon, LayersIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { SegmentedBar } from "@/components/ui/segmented-bar";
import { NameStep } from "@/components/onboarding/steps/name-step";
import { ChoiceStep } from "@/components/onboarding/steps/choice-step";
import { DegreeStep } from "@/components/onboarding/steps/degree-step";
import {
  CoursesStep,
  MAX_ONBOARDING_COURSES,
  recommendedCourses,
} from "@/components/onboarding/steps/courses-step";
import {
  HobbiesStep,
  LearningStylesStep,
  StudyTimesStep,
} from "@/components/onboarding/steps/preference-steps";
import { PhotoStep } from "@/components/onboarding/steps/photo-step";
import { DoneStep } from "@/components/onboarding/steps/done-step";
import { getCatalogForInstitution, getDepartmentCourses } from "@/lib/catalog/queries";
import type { DepartmentCourse } from "@/lib/catalog/queries";
import { completeOnboarding } from "@/lib/onboarding/actions";
import type { OnboardingData } from "@/lib/onboarding/queries";
import type { Department, Faculty } from "@/lib/repositories/catalog";
import type { LearningStyle, StudyTime, StudyTrack } from "@/lib/constants/profile-options";

// The signup wizard (SPEC §4.1, CR 27.10.2026): one question per screen, in
// the order a student thinks about it. Single-choice screens move on by
// themselves; nothing is saved until "סיום ההרשמה" (complete_onboarding, one
// transaction) except the photo, which uploads on pick. A draft in
// sessionStorage survives a refresh.

type StepId =
  | "name"
  | "institution"
  | "faculty"
  | "department"
  | "degree"
  | "courses"
  | "hobbies"
  | "times"
  | "styles"
  | "photo"
  | "done";

const FLOW: StepId[] = [
  "name",
  "institution",
  "faculty",
  "department",
  "degree",
  "courses",
  "hobbies",
  "times",
  "styles",
  "photo",
  "done",
];

interface Answers {
  fullName: string;
  institutionId: string;
  facultyId: string;
  departmentId: string;
  studyYear: number | null;
  semester: number | null;
  track: StudyTrack | null;
  courseIds: string[];
  hobbies: string[];
  studyTimes: StudyTime[];
  learningStyles: LearningStyle[];
}

interface Draft {
  v: 1;
  step: StepId;
  answers: Answers;
  faculties: Faculty[];
  departments: Department[];
  courses: DepartmentCourse[] | null;
  /** department:year:semester the course picks were last pre-filled for. */
  preselectedFor: string;
}

const draftKey = (userId: string) => `stugether:onboarding:${userId}`;

function readDraft(userId: string, institutionIds: string[]): Draft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(userId));
    const draft = raw ? (JSON.parse(raw) as Draft) : null;
    if (draft?.v !== 1 || !FLOW.includes(draft.step) || draft.step === "done") return null;
    // An institution that is gone since: start over.
    const inst = draft.answers.institutionId;
    if (inst && !institutionIds.includes(inst)) return null;
    return draft;
  } catch {
    return null;
  }
}

// Long enough to see the tile light up before the screen moves on.
const AUTO_ADVANCE_MS = 170;

export function OnboardingWizard({
  userId,
  demo,
  data,
}: {
  userId: string;
  demo: boolean;
  data: OnboardingData;
}) {
  const router = useRouter();
  // Client-only component (see onboarding-client.tsx): sessionStorage is safe here.
  const [draft] = useState(() =>
    readDraft(
      userId,
      data.institutions.map((i) => i.id),
    ),
  );
  const [step, setStep] = useState<StepId>(draft?.step ?? "name");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [answers, setAnswers] = useState<Answers>(
    draft?.answers ?? {
      fullName: data.suggestedName,
      institutionId: "",
      facultyId: "",
      departmentId: "",
      studyYear: null,
      semester: null,
      track: null,
      courseIds: [],
      hobbies: [],
      studyTimes: [],
      learningStyles: [],
    },
  );
  const [faculties, setFaculties] = useState<Faculty[]>(draft?.faculties ?? []);
  const [departments, setDepartments] = useState<Department[]>(draft?.departments ?? []);
  const [courses, setCourses] = useState<DepartmentCourse[] | null>(draft?.courses ?? null);
  const [preselectedFor, setPreselectedFor] = useState(draft?.preselectedFor ?? "");
  const [pendingInstitution, setPendingInstitution] = useState<string | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [enrolled, setEnrolled] = useState(0);
  const [isFinishing, startFinish] = useTransition();
  const coursesRequest = useRef<Promise<DepartmentCourse[] | null> | null>(null);

  useEffect(() => {
    try {
      if (step === "done") {
        sessionStorage.removeItem(draftKey(userId));
        return;
      }
      const next: Draft = {
        v: 1,
        step,
        answers,
        faculties,
        departments,
        courses,
        preselectedFor,
      };
      sessionStorage.setItem(draftKey(userId), JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode): the wizard just won't survive a refresh.
    }
  }, [userId, step, answers, faculties, departments, courses, preselectedFor]);

  // One faculty (or none) = nothing to ask: its departments are listed directly.
  const hasFacultyStep = faculties.length > 1;
  const flow = FLOW.filter((s) => s !== "faculty" || hasFacultyStep);
  const index = flow.indexOf(step);
  const questions = flow.length - 1; // "done" is not a question

  const patch = (p: Partial<Answers>) => setAnswers((a) => ({ ...a, ...p }));

  function go(next: StepId, dir: "forward" | "back" = "forward") {
    setDirection(dir);
    setStep(next);
    window.scrollTo({ top: 0 });
  }
  const goSoon = (next: StepId) => setTimeout(() => go(next), AUTO_ADVANCE_MS);

  function back() {
    if (index > 0) go(flow[index - 1], "back");
  }

  async function chooseInstitution(id: string) {
    if (id === answers.institutionId && departments.length > 0) {
      goSoon(hasFacultyStep ? "faculty" : "department");
      return;
    }
    setPendingInstitution(id);
    try {
      const catalog = await getCatalogForInstitution(id);
      patch({
        institutionId: id,
        facultyId: catalog.faculties.length === 1 ? catalog.faculties[0].id : "",
        departmentId: "",
        courseIds: [],
      });
      setFaculties(catalog.faculties);
      setDepartments(catalog.departments);
      setCourses(null);
      coursesRequest.current = null;
      setPreselectedFor("");
      go(catalog.faculties.length > 1 ? "faculty" : "department");
    } catch {
      toast.error("הטעינה נכשלה. נסו שוב");
    } finally {
      setPendingInstitution(null);
    }
  }

  function chooseFaculty(id: string) {
    if (id !== answers.facultyId) patch({ facultyId: id, departmentId: "", courseIds: [] });
    goSoon("department");
  }

  // Starts loading the department's courses right away; the degree screen in
  // between usually covers the round trip.
  function requestCourses(departmentId: string) {
    setCourses(null);
    const request = getDepartmentCourses(answers.institutionId, departmentId).catch(() => null);
    coursesRequest.current = request;
    void request.then((list) => {
      if (coursesRequest.current !== request) return;
      if (list) setCourses(list);
      else coursesRequest.current = null; // retried from the degree screen
    });
    return request;
  }

  function chooseDepartment(id: string) {
    if (id !== answers.departmentId || (!courses && !coursesRequest.current)) {
      patch({ departmentId: id, courseIds: [] });
      setPreselectedFor("");
      requestCourses(id);
    }
    goSoon("degree");
  }

  async function continueFromDegree() {
    let list = courses;
    if (!list) {
      setLoadingCourses(true);
      list = await (coursesRequest.current ?? requestCourses(answers.departmentId));
      setLoadingCourses(false);
      if (!list) {
        toast.error("טעינת הקורסים נכשלה. נסו שוב");
        return;
      }
    }
    // Pre-fill this semester's courses once per department/year/semester; going
    // back and forth keeps what the student changed.
    const key = `${answers.departmentId}:${answers.studyYear}:${answers.semester}`;
    if (preselectedFor !== key) {
      patch({
        courseIds: recommendedCourses(list, answers.studyYear, answers.semester)
          .slice(0, MAX_ONBOARDING_COURSES)
          .map((c) => c.id),
      });
      setPreselectedFor(key);
    }
    go("courses");
  }

  function finish() {
    startFinish(async () => {
      if (demo) {
        setEnrolled(answers.courseIds.length);
        go("done");
        return;
      }
      // facultyId is UI-only (department implies it); the schema drops it.
      const result = await completeOnboarding(answers);
      if (!result.ok) {
        toast.error(result.error);
        if (result.alreadyOnboarded) router.push("/dashboard");
        return;
      }
      setEnrolled(result.enrolled);
      go("done");
    });
  }

  const institution = data.institutions.find((i) => i.id === answers.institutionId);
  const department = departments.find((d) => d.id === answers.departmentId);
  const departmentOptions = hasFacultyStep
    ? departments.filter((d) => d.faculty_id === answers.facultyId)
    : departments;
  const facultyName = (id: string | null) => faculties.find((f) => f.id === id)?.name;

  function renderStep() {
    switch (step) {
      case "name":
        return (
          <NameStep
            value={answers.fullName}
            onChange={(fullName) => patch({ fullName })}
            onContinue={() => {
              patch({ fullName: answers.fullName.trim() });
              go("institution");
            }}
          />
        );
      case "institution":
        return (
          <ChoiceStep
            title={`נעים מאוד, ${firstName(answers.fullName)}! איפה את/ה לומד/ת?`}
            icon={Building2Icon}
            options={data.institutions.map((i) => ({ id: i.id, label: i.name, hint: i.city }))}
            selectedId={answers.institutionId}
            pendingId={pendingInstitution}
            onSelect={chooseInstitution}
            searchPlaceholder="חיפוש מוסד לימודים"
          />
        );
      case "faculty":
        return (
          <ChoiceStep
            title="באיזו פקולטה?"
            subtitle={institution?.name}
            icon={LayersIcon}
            options={faculties.map((f) => ({ id: f.id, label: f.name }))}
            selectedId={answers.facultyId}
            onSelect={chooseFaculty}
            searchPlaceholder="חיפוש פקולטה"
          />
        );
      case "department":
        return (
          <ChoiceStep
            title="ומה התואר שלך?"
            subtitle={facultyName(answers.facultyId) ?? institution?.name}
            icon={GraduationCapIcon}
            options={departmentOptions.map((d) => ({
              id: d.id,
              label: d.name,
              hint: hasFacultyStep ? null : facultyName(d.faculty_id),
            }))}
            selectedId={answers.departmentId}
            onSelect={chooseDepartment}
            searchPlaceholder="חיפוש מחלקה"
          />
        );
      case "degree":
        return (
          <DegreeStep
            year={answers.studyYear}
            semester={answers.semester}
            track={answers.track}
            onChange={(p) =>
              patch({
                ...(p.year !== undefined && { studyYear: p.year }),
                ...(p.semester !== undefined && { semester: p.semester }),
                ...(p.track !== undefined && { track: p.track }),
              })
            }
            onContinue={continueFromDegree}
            pending={loadingCourses}
          />
        );
      case "courses":
        return (
          <CoursesStep
            courses={courses}
            year={answers.studyYear}
            semester={answers.semester}
            selected={answers.courseIds}
            onChange={(courseIds) => patch({ courseIds })}
            onContinue={() => go("hobbies")}
          />
        );
      case "hobbies":
        return (
          <HobbiesStep
            selected={answers.hobbies}
            onChange={(hobbies) => patch({ hobbies })}
            onContinue={() => go("times")}
          />
        );
      case "times":
        return (
          <StudyTimesStep
            selected={answers.studyTimes}
            onChange={(studyTimes) => patch({ studyTimes })}
            onContinue={() => go("styles")}
          />
        );
      case "styles":
        return (
          <LearningStylesStep
            selected={answers.learningStyles}
            onChange={(learningStyles) => patch({ learningStyles })}
            onContinue={() => go("photo")}
          />
        );
      case "photo":
        return (
          <PhotoStep
            userId={userId}
            fullName={answers.fullName}
            avatarPath={data.avatarPath}
            onFinish={finish}
            pending={isFinishing}
          />
        );
      case "done":
        return (
          <DoneStep
            firstName={firstName(answers.fullName)}
            summary={[
              institution?.name,
              department?.name,
              enrolled === 1 ? "קורס אחד" : `${enrolled} קורסים`,
            ].filter((s): s is string => !!s)}
            demo={demo}
            onContinue={() => router.push("/dashboard")}
          />
        );
    }
  }

  const done = step === "done";

  return (
    // overflow-x-clip, not hidden: a hidden box can still be scrolled sideways by
    // focus/scrollIntoView while a step slides in.
    <div className="relative flex min-h-dvh flex-col overflow-x-clip bg-brand-soft">
      <div
        aria-hidden
        className="pointer-events-none absolute -start-32 -top-32 size-[28rem] rounded-full bg-[#2563eb] opacity-[0.12] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -end-24 bottom-0 size-96 rounded-full bg-[#0d9488] opacity-[0.12] blur-3xl"
      />

      <header className="relative mx-auto flex w-full max-w-xl items-center gap-3 px-4 pt-6 sm:pt-10">
        <Button
          variant="quiet"
          size="icon-md"
          className={cn("shrink-0 rounded-full", (index <= 0 || done) && "invisible")}
          onClick={back}
          aria-label="חזרה לשאלה הקודמת"
          disabled={index <= 0 || done || isFinishing}
        >
          <ArrowRightIcon strokeWidth={2.2} />
        </Button>
        <div className="flex min-w-0 grow flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-gradient-brand text-lg font-extrabold">StuGether</span>
            <span className="text-xs font-semibold text-muted-foreground">
              {done ? "סיימנו!" : `${index + 1} מתוך ${questions}`}
            </span>
          </div>
          <SegmentedBar
            total={questions}
            filled={done ? questions : index + 1}
            label="התקדמות בהרשמה"
          />
        </div>
      </header>

      <main
        id="main-content"
        className="relative mx-auto flex w-full max-w-xl grow flex-col px-4 pt-5 pb-8"
      >
        <div className="rounded-[28px] border border-border/60 bg-card px-5 pt-7 shadow-card sm:px-8 sm:pt-9">
          <div
            key={step}
            className={cn(
              "animate-in duration-300 ease-out fade-in motion-reduce:animate-none",
              direction === "forward" ? "slide-in-from-end-8" : "slide-in-from-start-8",
            )}
          >
            {renderStep()}
          </div>
        </div>
      </main>
    </div>
  );
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}
