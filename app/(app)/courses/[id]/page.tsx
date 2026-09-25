import { createElement } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowRightIcon,
  BookOpenIcon,
  Building2Icon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  MonitorIcon,
  PenLineIcon,
  PlayIcon,
  RotateCcwIcon,
  TargetIcon,
  UsersIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/ui/progress-ring";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { EnrollButton } from "@/components/courses/enroll-button";
import { CreateRoomForm } from "@/components/courses/create-room-form";
import { AddTestForm } from "@/components/courses/add-test-form";
import { RosterList } from "@/components/courses/roster-list";
import { FavoriteButton } from "@/components/courses/favorite-button";
import { TopicStepper } from "@/components/courses/topic-stepper";
import { AvailabilityCard } from "@/components/courses/availability-card";
import { InviteToStudyButton } from "@/components/courses/invite-to-study-button";
import { EventRegisterButton } from "@/components/courses/event-register-button";
import { JoinRoomButton } from "@/components/rooms/join-room-button";
import { getCurrentUser } from "@/lib/auth/session";
import { getCourseDetailData, type CourseDetailData } from "@/lib/courses/detail-queries";
import { courseTheme } from "@/lib/ui/course-theme";
import {
  ACTIVITY_LABEL,
  EVENT_KIND_LABEL,
  MODE_LABEL,
  NEXT_EVENT_LABEL,
  durationLabel,
  yearLabel,
} from "@/lib/ui/labels";
import { shortDateHe, timeHe, weekdayHe, weekdayLetterHe } from "@/lib/ui/format";
import type { StudyActivity } from "@/lib/repositories/availability";

const TABS = [
  { id: "overview", label: "סקירה" },
  { id: "rooms", label: "חדרי לימוד" },
  { id: "materials", label: "חומרים" },
  { id: "partners", label: "שותפים" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const ACTIVITY_ICON: Record<StudyActivity, typeof BookOpenIcon> = {
  summaries: BookOpenIcon,
  exercises: PenLineIcon,
  review: RotateCcwIcon,
  exam_prep: TargetIcon,
};

// Course page per Course.dc.html ("עמוד קורס").
export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [{ id: courseId }, { tab }] = await Promise.all([params, searchParams]);
  const data = await getCourseDetailData(user.id, courseId);
  if (!data.course) notFound();

  const activeTab: TabId = TABS.some((t) => t.id === tab) ? (tab as TabId) : "overview";
  const course = data.course;
  const theme = courseTheme(course.name, course.id);
  const myRoom = data.myRoomsForCourse[0] ?? null;
  const openRoom = data.joinableOpenRooms[0] ?? null;
  const continueHref = myRoom ? `/rooms/${myRoom.id}` : "#available";
  const meta = [course.code, data.departmentName, yearLabel(course.year_level)]
    .filter(Boolean)
    .join(" · ");

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-5 px-4 pt-6 pb-10 sm:px-8 xl:px-12"
    >
      <Link
        href="/courses"
        className="flex items-center gap-1.5 self-start text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowRightIcon className="size-4" strokeWidth={2.2} aria-hidden />
        חזרה לקורסים
      </Link>

      {/* Banner */}
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(90deg,#0FB38F_0%,#1FA3B5_45%,#2F7CFF_100%)] text-white shadow-[0_22px_44px_-22px_rgba(37,99,235,.55)]">
        <span
          aria-hidden
          className="absolute -top-[200px] left-[260px] size-[360px] rounded-full bg-white/8"
        />
        <span
          aria-hidden
          className="absolute -bottom-[90px] -left-[30px] size-[200px] rotate-[20deg] rounded-[48px] bg-white/7"
        />
        <div className="relative flex flex-col gap-6 px-5 pt-7 pb-6 sm:px-9 sm:pt-8 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <div className="flex items-center gap-4 sm:gap-[22px]">
            <span
              aria-hidden
              className="hidden size-[88px] shrink-0 items-center justify-center rounded-[26px] border border-white/35 bg-white/20 sm:flex"
            >
              {createElement(theme.icon, { className: "size-10", strokeWidth: 2 })}
            </span>
            <div className="flex flex-col gap-1.5">
              <h1 className="text-[32px] leading-none font-extrabold tracking-[-0.8px] sm:text-[46px]">
                {course.name}
              </h1>
              {meta && <span className="text-[15px] text-white/90">{meta}</span>}
              <div className="flex flex-wrap gap-2 pt-1.5">
                <BannerChip icon={<UsersIcon />}>{data.studentCount} סטודנטים</BannerChip>
                {data.isEnrolled && (
                  <BannerChip
                    icon={<span className="size-[7px] rounded-full bg-[#A7F3D0]" />}
                  >
                    {data.availableNow.length} פנויים עכשיו
                  </BannerChip>
                )}
                {data.nextEvent?.due_at && (
                  <BannerChip icon={<CalendarDaysIcon />}>
                    {EVENT_KIND_LABEL[data.nextEvent.kind]} {weekdayLetterHe(data.nextEvent.due_at)}{" "}
                    {timeHe(data.nextEvent.due_at)}
                  </BannerChip>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5 sm:gap-7">
            {data.isEnrolled && (
              <ProgressRing
                value={data.progressPercent}
                size={120}
                stroke={11}
                from="#ffffff"
                to="#ffffff"
                track="rgba(255,255,255,.25)"
                label={`${data.progressPercent}% הושלמו`}
                className="hidden sm:block"
              >
                <span className="text-[32px] leading-none font-extrabold">
                  {data.progressPercent}%
                </span>
                <span className="text-xs text-white/85">הושלמו</span>
              </ProgressRing>
            )}
            <div className="flex grow flex-col gap-2.5 sm:grow-0">
              {data.isEnrolled ? (
                <Button asChild variant="white" size="xl" className="px-[26px] text-base">
                  <Link href={continueHref}>
                    <PlayIcon className="size-[18px] fill-current rtl:-scale-x-100" aria-hidden />
                    המשך ללמוד
                  </Link>
                </Button>
              ) : (
                <EnrollButton courseId={course.id} isEnrolled={false} />
              )}
              <div className="flex gap-2">
                {data.isEnrolled && (
                  <CreateRoomForm courseId={course.id} trigger="glass" className="grow" />
                )}
                <FavoriteButton
                  courseId={course.id}
                  initialIsFavorite={data.isFavorite}
                  variant="glass"
                />
              </div>
            </div>
          </div>
        </div>

        <TopicStepper
          courseId={course.id}
          topics={data.topics.topics}
          editable={data.isEnrolled}
        />
      </section>

      {/* Tabs */}
      <nav
        aria-label="אזורי הקורס"
        className="flex gap-7 overflow-x-auto border-b border-border px-1"
      >
        {TABS.map((t) => {
          const active = t.id === activeTab;
          if (t.id === "materials") {
            return (
              <span
                key={t.id}
                aria-disabled
                title="בקרוב"
                className="flex h-[46px] shrink-0 items-center gap-1.5 px-0.5 text-[15px] font-medium text-muted-foreground/60"
              >
                {t.label}
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">
                  בקרוב
                </span>
              </span>
            );
          }
          return (
            <Link
              key={t.id}
              href={t.id === "overview" ? `/courses/${course.id}` : `/courses/${course.id}?tab=${t.id}`}
              aria-current={active ? "page" : undefined}
              scroll={false}
              className={cn(
                "relative flex h-[46px] shrink-0 items-center px-0.5 text-[15px]",
                active
                  ? "font-bold text-primary-strong"
                  : "font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              {active && (
                <span className="absolute inset-x-0 -bottom-px h-[3px] rounded-sm bg-brand" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <div className="flex min-w-0 grow flex-col gap-5">
          {!data.isEnrolled ? (
            <NotEnrolled courseId={course.id} />
          ) : activeTab === "partners" ? (
            <RosterList classmates={data.classmates} />
          ) : activeTab === "rooms" ? (
            <RoomsTab data={data} />
          ) : (
            <Overview data={data} myRoomId={myRoom?.id ?? null} openRoom={openRoom} />
          )}
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[360px]">
          <NextEventCard data={data} />
          {data.isEnrolled && (
            <AvailabilityCard
              courseId={course.id}
              isAvailable={data.myAvailability !== null}
              expiresAt={data.myAvailability?.expires_at ?? null}
              topics={data.topics.topics.map((t) => ({ id: t.id, title: t.title }))}
              defaultTopicId={data.topics.current?.id ?? null}
            />
          )}
          <MembersCard data={data} />
        </aside>
      </div>
    </main>
  );
}

function BannerChip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex h-[30px] items-center gap-1.5 rounded-full bg-white/18 px-3 text-[13px] font-semibold [&_svg]:size-3.5">
      {icon}
      {children}
    </span>
  );
}

function NotEnrolled({ courseId }: { courseId: string }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[22px] border border-border bg-card p-6 sm:flex-row sm:items-center sm:px-7">
      <div className="grow">
        <h2 className="text-xl font-bold">הצטרפו לקורס כדי ללמוד יחד</h2>
        <p className="text-sm text-muted-foreground">
          אחרי ההרשמה תראו מי פנוי ללמוד עכשיו, תוכלו לפתוח חדרים ולעקוב אחרי הנושאים.
        </p>
      </div>
      <EnrollButton courseId={courseId} isEnrolled={false} />
    </div>
  );
}

function Overview({
  data,
  myRoomId,
  openRoom,
}: {
  data: CourseDetailData;
  myRoomId: string | null;
  openRoom: CourseDetailData["joinableOpenRooms"][number] | null;
}) {
  const course = data.course!;
  const available = data.availableNow.length;

  return (
    <>
      <div className="flex flex-col items-start gap-4 rounded-[22px] border border-border bg-card p-6 sm:flex-row sm:items-center sm:gap-[22px] sm:px-7">
        <span
          aria-hidden
          className="flex size-[72px] shrink-0 items-center justify-center rounded-[22px] bg-brand-soft text-primary"
        >
          <Building2Icon className="size-8" strokeWidth={1.8} />
        </span>
        <div className="flex grow flex-col gap-1">
          {myRoomId ? (
            <>
              <h2 className="text-xl font-bold">יש לך חדר פעיל בקורס</h2>
              <span className="text-sm text-muted-foreground">
                {data.myRoomsForCourse[0]?.name}
              </span>
            </>
          ) : openRoom ? (
            <>
              <h2 className="text-xl font-bold">חדר פתוח: {openRoom.name}</h2>
              <span className="text-sm text-muted-foreground">
                {openRoom.creator_name} · {openRoom.member_count}/4 משתתפים
              </span>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold">אין חדר פעיל כרגע</h2>
              <span className="text-sm text-muted-foreground">
                {available > 0
                  ? `${available} סטודנטים פנויים עכשיו — פתחו חדר והם יקבלו התראה`
                  : "פתחו חדר וחברי הקורס יקבלו התראה"}
              </span>
            </>
          )}
        </div>
        {myRoomId ? (
          <Button asChild variant="brand" size="xl">
            <Link href={`/rooms/${myRoomId}`}>כניסה לחדר</Link>
          </Button>
        ) : openRoom ? (
          <JoinRoomButton roomId={openRoom.room_id} variant="brand" size="xl">
            הצטרפות לחדר
          </JoinRoomButton>
        ) : (
          <CreateRoomForm
            courseId={course.id}
            trigger="brand"
            defaultTopic={data.topics.current?.title ?? ""}
          />
        )}
      </div>

      <section id="available" aria-labelledby="available-title" className="flex scroll-mt-24 flex-col gap-3.5">
        <div className="flex items-center gap-2.5">
          <h2 id="available-title" className="text-[22px] font-extrabold">
            זמינים ללמוד עכשיו
          </h2>
          <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-bold text-success-ink">
            {available} סטודנטים
          </span>
        </div>
        {available === 0 ? (
          <p className="rounded-[22px] border border-dashed border-switch-off bg-surface-2 p-6 text-sm text-muted-foreground">
            אף אחד לא סימן שהוא פנוי כרגע. סמנו שאתם פנויים כדי שחברי הקורס יוכלו להזמין אתכם.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.availableNow.map((a) => {
              const ActivityIcon = ACTIVITY_ICON[a.activity];
              return (
                <article
                  key={a.profile.id}
                  className="flex flex-col gap-4 rounded-[22px] border border-border bg-card p-[22px]"
                >
                  <div className="flex items-center gap-3.5">
                    <PersonAvatar
                      id={a.profile.id}
                      name={a.profile.full_name}
                      avatarPath={a.profile.avatar_url}
                      ring
                      online
                      className="size-14 text-[17px]"
                    />
                    <div className="flex grow flex-col">
                      <span className="text-[17px] font-bold">{a.profile.full_name}</span>
                      <span className="text-[13px] text-muted-foreground">
                        רוצה ללמוד:{" "}
                        <strong className="text-foreground">{a.topicTitle ?? "כללי"}</strong>
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MiniChip
                      className={
                        a.mode === "online"
                          ? "bg-primary-soft text-primary-strong"
                          : "bg-success-soft text-success-ink"
                      }
                      icon={a.mode === "online" ? <MonitorIcon /> : <MapPinIcon />}
                    >
                      {MODE_LABEL[a.mode]}
                    </MiniChip>
                    <MiniChip icon={<ClockIcon />}>{durationLabel(a.durationMinutes)}</MiniChip>
                    <MiniChip icon={<ActivityIcon />}>{ACTIVITY_LABEL[a.activity]}</MiniChip>
                  </div>
                  <InviteToStudyButton
                    courseId={course.id}
                    inviteeId={a.profile.id}
                    inviteeName={a.profile.full_name}
                    topicTitle={a.topicTitle}
                  />
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

function MiniChip({
  icon,
  children,
  className = "bg-muted text-ink-2",
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-[30px] items-center gap-1.5 rounded-[10px] px-[11px] text-[13px] font-semibold [&_svg]:size-3.5",
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

function RoomsTab({ data }: { data: CourseDetailData }) {
  const course = data.course!;
  return (
    <section className="flex flex-col gap-4 rounded-[22px] border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">חדרי לימוד</h2>
        <CreateRoomForm courseId={course.id} />
      </div>
      {data.myRoomsForCourse.length === 0 && data.joinableOpenRooms.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין חדרים פעילים בקורס כרגע.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {data.myRoomsForCourse.map((room) => (
            <li
              key={room.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{room.name}</p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {room.topic ?? "החדר שלך"}
                </p>
              </div>
              <Button asChild variant="solid" size="chip">
                <Link href={`/rooms/${room.id}`}>כניסה</Link>
              </Button>
            </li>
          ))}
          {data.joinableOpenRooms.map((room) => (
            <li
              key={room.room_id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{room.name}</p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {room.creator_name} · {room.member_count}/4 משתתפים
                </p>
              </div>
              <JoinRoomButton roomId={room.room_id} variant="outline-primary" size="chip" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function NextEventCard({ data }: { data: CourseDetailData }) {
  const course = data.course!;
  const event = data.nextEvent;
  const later = data.upcomingEvents.slice(1, 4);

  return (
    <div className="flex flex-col gap-3 rounded-[22px] border border-border bg-card px-[22px] py-5">
      <div className="flex items-center gap-4">
        {event?.due_at ? (
          <span className="flex w-16 shrink-0 flex-col items-center overflow-hidden rounded-2xl border border-border">
            <span className="flex h-[22px] w-full items-center justify-center bg-brand text-xs font-bold text-white">
              {weekdayHe(event.due_at)}
            </span>
            <span className="py-1 text-2xl font-extrabold">{timeHe(event.due_at)}</span>
          </span>
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-border text-muted-foreground">
            <CalendarDaysIcon className="size-6" aria-hidden />
          </span>
        )}
        <div className="flex min-w-0 grow flex-col gap-0.5">
          <span className="text-[13px] text-muted-foreground">
            {event ? NEXT_EVENT_LABEL[event.kind] : "אירועים בקורס"}
          </span>
          <span className="truncate text-[17px] font-bold">
            {event?.title ?? "אין אירועים קרובים"}
          </span>
          {event && event.registeredCount > 0 && (
            <span className="text-xs text-muted-foreground">{event.registeredCount} רשומים</span>
          )}
        </div>
        {event && data.isEnrolled && (
          <EventRegisterButton
            courseId={course.id}
            eventId={event.id}
            initialRegistered={event.isRegistered}
          />
        )}
        {data.isEnrolled && <AddTestForm courseId={course.id} />}
      </div>
      {later.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-divider pt-3">
          {later.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">
                <span className="font-semibold">{EVENT_KIND_LABEL[e.kind]}:</span> {e.title}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {e.due_at ? shortDateHe(e.due_at) : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MembersCard({ data }: { data: CourseDetailData }) {
  const course = data.course!;
  if (!data.isEnrolled) return null;

  return (
    <div className="flex flex-col gap-3 rounded-[22px] border border-border bg-card px-[22px] py-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-bold">חברי הקורס</h2>
        <span className="text-[13px] text-muted-foreground">{data.members.length}</span>
      </div>
      <ul className="flex flex-col gap-3">
        {data.members.slice(0, 8).map(({ profile, status }) => (
          <li key={profile.id} className="flex items-center gap-3">
            <PersonAvatar
              id={profile.id}
              name={profile.full_name}
              avatarPath={profile.avatar_url}
              className="size-[38px] text-[13px]"
            />
            <span className="grow truncate text-[15px] font-medium">{profile.full_name}</span>
            {status === "available" ? (
              <span className="flex items-center gap-[5px] text-xs font-semibold text-success-ink">
                <span className="size-[7px] rounded-full bg-success" aria-hidden />
                פנוי/ה
              </span>
            ) : status === "online" ? (
              <span className="text-xs font-semibold text-primary-strong">מחובר/ת</span>
            ) : (
              <span className="text-xs text-muted-foreground">לא מחובר/ת</span>
            )}
          </li>
        ))}
      </ul>
      {data.members.length > 8 && (
        <Link
          href={`/courses/${course.id}?tab=partners`}
          className="text-[13px] font-semibold text-primary"
        >
          לכל {data.members.length} חברי הקורס
        </Link>
      )}
      <EnrollButton courseId={course.id} isEnrolled variant="remove" />
    </div>
  );
}
