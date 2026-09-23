"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Department } from "@/lib/repositories/catalog";

const ALL_DEPARTMENTS = "all";

export function CoursesFilterBar({ departments }: { departments: Department[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== ALL_DEPARTMENTS) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="חיפוש קורס לפי שם או קוד..."
          className="ps-9"
          onChange={(e) => updateParam("q", e.target.value)}
        />
      </div>
      <Select
        value={searchParams.get("departmentId") ?? ALL_DEPARTMENTS}
        onValueChange={(value) => updateParam("departmentId", value)}
      >
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue placeholder="כל המחלקות" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_DEPARTMENTS}>כל המחלקות</SelectItem>
          {departments.map((dept) => (
            <SelectItem key={dept.id} value={dept.id}>
              {dept.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
