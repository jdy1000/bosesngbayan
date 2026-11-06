import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { loadPickedMedia, loadSettings } from "@/lib/studio/settings";
import { formatDateTime } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/studio/action-form";
import { Notice, PageHeader, Panel } from "@/components/studio/ui";
import { saveSettings } from "./actions";
import { CommunityFields, ContactFields, FooterFields, GeneralFields, NewsletterFields, PublicationFields, SocialFields } from "./forms";

export const metadata: Metadata = { title: "Site Settings" };

const TABS = [
  { key: "general", label: "Pangkalahatan", description: "Pangalan, brand, logo at header CTA." },
  { key: "social", label: "Social", description: "Mga opisyal na social media link (https:// lamang)." },
  { key: "contact", label: "Contact", description: "Pampublikong contact information." },
  { key: "footer", label: "Footer", description: "Newsletter box at mga kategorya sa footer." },
  { key: "publication", label: "Publication", description: "Mga default sa paglalathala." },
  { key: "community", label: "Komunidad", description: "Moderation at Usap Bayan submissions." },
  { key: "newsletter", label: "Newsletter", description: "Sign-up at consent text." },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ctx = await requireStaffPage("settings.manage");
  const { tab: rawTab } = await searchParams;
  const tab = TABS.find((t) => t.key === rawTab) ?? TABS[0];
  const { settings, updatedAt } = await loadSettings(ctx);

  return (
    <>
      <PageHeader
        title="Site Settings"
        description={
          <>
            Mga pampublikong setting ng site. Ang global SEO ay nasa <Link href="/admin/seo" className="font-semibold text-brand hover:underline">SEO at Redirects</Link>.
          </>
        }
      />
      <div className="mb-5">
        <Notice>
          Hindi dito inilalagay ang mga secret (API key, password, SMTP o service-role key). Nasa environment variables ng deployment ang mga iyon, at lahat ng nandito ay nababasa ng publiko.
        </Notice>
      </div>
      <nav aria-label="Mga seksyon ng settings" className="mb-5 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/settings?tab=${t.key}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${t.key === tab.key ? "border-brand text-brand" : "border-transparent text-ink-soft hover:text-ink"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Panel title={tab.label} description={<>{tab.description}{updatedAt[tab.key] && <> · Huling binago {formatDateTime(updatedAt[tab.key])}</>}</>}>
        <ActionForm action={saveSettings} key={tab.key}>
          <input type="hidden" name="key" value={tab.key} />
          <TabFields tab={tab.key} ctx={ctx} settings={settings} />
          <div className="mt-6 border-t border-line pt-4">
            <SubmitButton>I-save ang {tab.label}</SubmitButton>
          </div>
        </ActionForm>
      </Panel>
    </>
  );
}

async function TabFields({ tab, ctx, settings }: { tab: TabKey; ctx: Awaited<ReturnType<typeof requireStaffPage>>; settings: Awaited<ReturnType<typeof loadSettings>>["settings"] }) {
  switch (tab) {
    case "general": {
      const g = settings.general;
      const [media, authorsRes] = await Promise.all([
        loadPickedMedia(ctx, [g.logo_media_id, g.favicon_media_id]),
        ctx.supabase.from("profiles").select("id, display_name").eq("is_active", true).order("display_name"),
      ]);
      if (authorsRes.error) throw authorsRes.error;
      return (
        <GeneralFields
          s={g}
          logo={(g.logo_media_id && media.get(g.logo_media_id)) || null}
          favicon={(g.favicon_media_id && media.get(g.favicon_media_id)) || null}
          authors={authorsRes.data ?? []}
        />
      );
    }
    case "social":
      return <SocialFields s={settings.social} />;
    case "contact":
      return <ContactFields s={settings.contact} />;
    case "footer":
      return <FooterFields s={settings.footer} />;
    case "publication":
      return <PublicationFields s={settings.publication} />;
    case "community":
      return <CommunityFields s={settings.community} />;
    case "newsletter":
      return <NewsletterFields s={settings.newsletter} />;
  }
}
