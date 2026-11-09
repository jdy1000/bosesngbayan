import { requireStaffPage } from "@/lib/auth/session";
import { PageHeader, Panel } from "@/components/studio/ui";
import { CategoryForm } from "../category-form";

export const metadata = { title: "New category" };

export default async function NewCategoryPage() {
  await requireStaffPage("taxonomy.manage");
  return (
    <>
      <PageHeader title="New category" breadcrumb={[{ label: "Site categories", href: "/admin/taxonomy" }]} />
      <Panel>
        <CategoryForm />
      </Panel>
    </>
  );
}
