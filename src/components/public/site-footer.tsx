import Link from "next/link";
import { Logo } from "@/components/public/logo";
import { NewsletterForm } from "@/components/public/newsletter-form";
import type { CategorySummary, NavItem } from "@/lib/cms/site";
import type { SiteSettings } from "@/lib/settings/schema";

const SOCIAL_LABELS = {
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  instagram: "Instagram",
} as const;

function FooterLinks({ title, items }: { title: string; items: { key: string; label: string; href: string; external?: boolean }[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h2 className="mb-4 text-sm font-bold uppercase tracking-[0.08em] text-white">{title}</h2>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="text-[0.95rem] text-white/75 transition-colors hover:text-white"
              {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SiteFooter({
  settings,
  logoUrl,
  mainLinks,
  legalLinks,
  categories,
}: {
  settings: SiteSettings;
  logoUrl: string | null;
  mainLinks: NavItem[];
  legalLinks: NavItem[];
  categories: CategorySummary[];
}) {
  const { general, social, footer, newsletter } = settings;
  const socials = (Object.keys(SOCIAL_LABELS) as (keyof typeof SOCIAL_LABELS)[])
    .filter((k) => social[k])
    .map((k) => ({ key: k, label: SOCIAL_LABELS[k], href: social[k], external: true }));
  const categoryLinks = footer.show_category_links
    ? categories.slice(0, 8).map((c) => ({ key: c.id, label: c.name, href: `/paksa/${c.slug}` }))
    : [];
  const copyright = general.copyright_text.replace("{year}", String(new Date().getFullYear()));

  return (
    <footer className="bg-navy text-white">
      <div className="container-site grid gap-12 py-14 md:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_0.8fr_1.4fr] lg:py-16">
        <div className="max-w-sm">
          <Link href="/" aria-label={`${general.site_name} — Bahay`} className="inline-block">
            <Logo siteName={general.site_name} logoUrl={logoUrl} inverted />
          </Link>
          {general.description && <p className="mt-5 text-[0.95rem] leading-relaxed text-white/75">{general.description}</p>}
          {socials.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Social media">
              {socials.map((s) => (
                <li key={s.key}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-10 items-center rounded-full border border-white/20 px-4 text-sm font-semibold text-white/90 transition-colors hover:border-white/50 hover:text-white"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {social.hashtag && <p className="mt-4 text-sm font-semibold text-white/60">{social.hashtag}</p>}
        </div>

        <FooterLinks
          title="Boses ng Bayan"
          items={mainLinks.map((i) => ({ key: i.id, label: i.label, href: i.href, external: i.openInNewTab }))}
        />
        <FooterLinks title="Mga Paksa" items={categoryLinks} />

        {newsletter.enabled && (
          <div>
            <h2 className="font-serif text-2xl font-semibold text-white">{footer.newsletter_title}</h2>
            {footer.newsletter_description && <p className="mt-2 text-[0.95rem] text-white/75">{footer.newsletter_description}</p>}
            <div className="mt-5">
              <NewsletterForm consentText={newsletter.consent_text} source="footer" tone="dark" />
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-white/10">
        <div className="container-site flex flex-col gap-3 py-6 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <p>{copyright}</p>
          {legalLinks.length > 0 && (
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {legalLinks.map((l) => (
                <li key={l.id}>
                  <Link href={l.href} className="hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </footer>
  );
}
