import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { PageHeader } from "@/components/studio/ui";
import { getPageForEdit } from "@/lib/studio/pages";
import { PageEditor } from "../_components/page-editor";

export const metadata: Metadata = { title: "I-edit ang pahina" };

export default async function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaffPage("pages.manage");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getPageForEdit(ctx, id);
  if (!data) notFound();
  return (
    <>
      <PageHeader title={data.page.title} breadcrumb={[{ label: "Mga Pahina", href: "/admin/pages" }]} />
      {/* Remount after a status change / restore so the form reflects the server's latest version. */}
      <PageEditor key={data.page.updated_at} data={data} />
    </>
  );
}
