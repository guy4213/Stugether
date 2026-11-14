import Link from "next/link";
import { PersonAvatar } from "@/components/ui/person-avatar";
import { BlockButton } from "@/components/blocks/block-button";
import type { BlockedPerson } from "@/lib/blocks/queries";

// "משתמשים חסומים" on my profile — the place to lift a block, since a blocked
// student is hidden everywhere else. Shown only when there is someone.
export function BlockedUsersCard({ people }: { people: BlockedPerson[] }) {
  if (people.length === 0) return null;
  return (
    <section
      aria-labelledby="blocked-users"
      className="flex flex-col gap-3 rounded-[22px] border border-border bg-card p-6"
    >
      <h2 id="blocked-users" className="text-lg font-bold">
        משתמשים חסומים
      </h2>
      <p className="text-sm text-muted-foreground">
        אי אפשר לשלוח לכם הודעות או בקשת חברות, ואתם לא מופיעים זה לזה ברשימות.
      </p>
      <ul className="flex flex-col gap-2">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-[14px] bg-surface-2 px-3 py-2">
            <PersonAvatar id={p.id} name={p.name} avatarPath={p.avatarPath} className="size-9" />
            <Link
              href={`/students/${p.id}`}
              className="min-w-0 grow truncate text-[15px] font-semibold hover:underline"
            >
              {p.name}
            </Link>
            <BlockButton studentId={p.id} studentName={p.name} blocked className="h-9" />
          </li>
        ))}
      </ul>
    </section>
  );
}
