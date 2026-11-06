import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { getHomepage } from "@/lib/cms/homepage";
import { getLocale } from "@/lib/i18n/server";
import { getSiteSettings } from "@/lib/cms/site";
import { RenderBlocks } from "@/components/public/blocks/render-blocks";

export const metadata: Metadata = { title: "Draft homepage preview", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Draft preview: session client (RLS: homepage.manage) reads the draft; rendered with the public renderer. No page-view tracking. */
export default async function HomepageDraftPreview() {
  const ctx = await requireStaffPage("homepage.manage");
  const [homepage, settings] = await Promise.all([getHomepage("draft", ctx.supabase, await getLocale()), getSiteSettings()]);
  const { brand } = settings.general;
  const brandVars = `:root{--brand-primary:${brand.primary};--brand-navy:${brand.navy};--brand-accent:${brand.accent};}`;

  return (
    <>
      <style>{brandVars}</style>
      <div role="status" className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-navy px-4 py-2.5 text-sm text-white shadow-lg">
        <p>
          <strong className="tracking-wide">DRAFT PREVIEW</strong> — not visible to the public yet.
        </p>
        <Link href="/admin/homepage" className="font-semibold text-white underline-offset-4 hover:underline">
          ← Back to Homepage Builder
        </Link>
      </div>
      {homepage && homepage.invalidSections.length > 0 && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-accent-700">
          <p className="font-semibold">{homepage.invalidSections.length} section(s) hidden because of invalid settings:</p>
          <ul className="mt-1 list-disc pl-5">
            {homepage.invalidSections.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/homepage#section-${s.id}`} className="underline">
                  {s.id.slice(0, 8)}
                </Link>
                : {s.issues.join("; ")}
              </li>
            ))}
          </ul>
        </div>
      )}
      <main id="main">
        {!homepage ? (
          <p className="container-site py-20 text-center text-ink-soft">No draft homepage. Create one in the Homepage Builder first.</p>
        ) : homepage.blocks.length === 0 ? (
          <p className="container-site py-20 text-center text-ink-soft">The draft has no enabled sections.</p>
        ) : (
          <RenderBlocks blocks={homepage.blocks} />
        )}
      </main>
    </>
  );
}
