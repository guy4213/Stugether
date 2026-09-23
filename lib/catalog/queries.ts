"use server";

import { createClient } from "@/lib/supabase/server";
import { listFaculties, listDepartments } from "@/lib/repositories/catalog";

// Called directly from the (client) profile form when the Institution select
// changes, per React 19's support for calling exported "use server" functions
// outside of <form action>. Changing Faculty needs no round trip: the client
// already holds the full departments array (with faculty_id) from here and
// filters it in-memory.
export async function getCatalogForInstitution(institutionId: string) {
  const supabase = await createClient();
  const [faculties, departments] = await Promise.all([
    listFaculties(supabase, institutionId),
    listDepartments(supabase, institutionId),
  ]);
  return { faculties, departments };
}
