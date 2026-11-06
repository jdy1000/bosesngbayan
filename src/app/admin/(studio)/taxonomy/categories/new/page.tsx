import { requireStaffPage } from "@/lib/auth/session";
import { PageHeader, Panel } from "@/components/studio/ui";
import { CategoryForm } from "../category-form";

export const metadata = { title: "Bagong kategorya" };

export default async function NewCategoryPage() {
  await requireStaffPage("taxonomy.manage");
  return (
    <>
      <PageHeader title="Bagong kategorya" breadcrumb={[{ label: "Kategorya at Tag", href: "/admin/taxonomy" }]} />
      <Panel>
        <CategoryForm />
      </Panel>
    </>
  );
}
