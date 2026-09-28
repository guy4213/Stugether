import { ContentSkeleton } from "@/components/app/page-skeleton";

// Inside the admin layout (heading + tabs stay), so only the tab content pulses.
export default function Loading() {
  return <ContentSkeleton />;
}
