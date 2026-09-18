import { notFound } from "next/navigation";
import { RtlAudit } from "./rtl-audit";

// Manual RTL check for Radix-based components. Not available in production.
export default function RtlAuditPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <RtlAudit />;
}
