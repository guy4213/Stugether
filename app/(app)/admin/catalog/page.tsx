import { CatalogManager } from "@/components/admin/catalog-manager";
import { getAdminCatalog } from "@/lib/admin/queries";

// "קטלוג" (SPEC §4.9): only a super_admin creates courses.
export default async function AdminCatalogPage() {
  const catalog = await getAdminCatalog();
  return (
    <CatalogManager
      institutions={catalog.institutions}
      departments={catalog.departments}
      courses={catalog.courses}
    />
  );
}
