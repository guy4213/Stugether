import { cn } from "cn";
import { getAvatarUrl } from "@/lib/storage";
import { initials, personTone } from "@/lib/ui/people";

// Initials avatar (photo when there is one), in the mockup's tinted style.
// `ring` draws the blue→teal gradient ring used for "you" and available users.
export function PersonAvatar({
  id,
  name,
  avatarPath,
  className,
  ring = false,
  online = false,
}: {
  id: string;
  name: string;
  avatarPath?: string | null;
  className?: string;
  ring?: boolean;
  online?: boolean;
}) {
  const face = (
    <span
      className={cn(
        "flex size-full items-center justify-center overflow-hidden rounded-full font-bold",
        personTone(id),
        ring && "border-2 border-white",
      )}
    >
      {avatarPath ? (
        // eslint-disable-next-line @next/next/no-img-element -- public storage URL, tiny avatar
        <img src={getAvatarUrl(avatarPath)} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );

  return (
    <span
      role="img"
      aria-label={name}
      className={cn(
        "relative inline-flex size-10 shrink-0 rounded-full text-sm",
        ring && "bg-brand-diag p-0.5",
        className,
      )}
    >
      {face}
      {online && (
        <span className="absolute bottom-0 left-0 size-[26%] min-h-2.5 min-w-2.5 rounded-full border-2 border-white bg-success" />
      )}
    </span>
  );
}
