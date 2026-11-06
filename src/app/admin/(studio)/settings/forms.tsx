import { MediaPicker, type PickedMedia } from "@/components/studio/media-picker";
import { Field } from "@/components/studio/ui";
import type { SiteSettings } from "@/lib/settings/schema";

/** Field groups per settings key. Names map 1:1 to FORM_MAPPERS in src/lib/studio/settings.ts. */

function Text({ name, label, value, hint, max, type = "text", placeholder }: { name: string; label: string; value: string; hint?: string; max?: number; type?: string; placeholder?: string }) {
  return (
    <Field label={label} htmlFor={`s-${name}`} hint={hint}>
      <input id={`s-${name}`} name={name} type={type} defaultValue={value} maxLength={max} placeholder={placeholder} className="field" />
    </Field>
  );
}

function Area({ name, label, value, hint, max, rows = 3 }: { name: string; label: string; value: string; hint?: string; max?: number; rows?: number }) {
  return (
    <Field label={label} htmlFor={`s-${name}`} hint={hint}>
      <textarea id={`s-${name}`} name={name} defaultValue={value} maxLength={max} rows={rows} className="field" />
    </Field>
  );
}

function Check({ name, label, checked, hint }: { name: string; label: string; checked: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 h-4 w-4" />
      <span>
        <span className="font-semibold text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

function Color({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <Field label={label} htmlFor={`s-${name}`}>
      <input id={`s-${name}`} name={name} type="color" defaultValue={value} className="h-11 w-full cursor-pointer rounded-xl border border-line bg-white p-1" />
    </Field>
  );
}

export function GeneralFields({ s, logo, favicon, authors }: { s: SiteSettings["general"]; logo: PickedMedia | null; favicon: PickedMedia | null; authors: { id: string; display_name: string }[] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Text name="site_name" label="Pangalan ng site" value={s.site_name} max={80} />
      <Text name="tagline" label="Tagline" value={s.tagline} max={160} />
      <div className="md:col-span-2">
        <Area name="description" label="Paglalarawan" value={s.description} max={320} hint="Ginagamit din bilang default na meta description kung walang nakatakda sa SEO." />
      </div>
      <MediaPicker name="logo_media_id" label="Logo" defaultValue={logo} />
      <MediaPicker name="favicon_media_id" label="Favicon" defaultValue={favicon} />
      <div className="grid grid-cols-3 gap-3 md:col-span-2">
        <Color name="brand_primary" label="Primary (cobalt)" value={s.brand.primary} />
        <Color name="brand_navy" label="Navy" value={s.brand.navy} />
        <Color name="brand_accent" label="Accent (pula)" value={s.brand.accent} />
      </div>
      <p className="-mt-3 text-xs text-muted md:col-span-2">Siguraduhing mababasa ang puting teksto sa ibabaw ng mga kulay na ito (contrast na hindi bababa sa 4.5:1).</p>
      <Text name="header_cta_label" label="Header CTA — label" value={s.header_cta?.label ?? ""} max={40} hint="Iwanang blangko ang label at link para itago ang CTA." />
      <Text name="header_cta_href" label="Header CTA — link" value={s.header_cta?.href ?? ""} max={300} placeholder="/botohan" hint="Path na nagsisimula sa / o https:// URL." />
      <Field label="Wika" htmlFor="s-language">
        <select id="s-language" name="language" defaultValue={s.language} className="field">
          <option value="fil">Filipino</option>
          <option value="en">English</option>
        </select>
      </Field>
      <Field label="Timezone" htmlFor="s-timezone" hint="Nakapirmi sa Asia/Manila (UTC+8) ang lahat ng iskedyul at ulat.">
        <input id="s-timezone" value="Asia/Manila" readOnly disabled className="field opacity-70" />
      </Field>
      <Field label="Default na may-akda" htmlFor="s-default_author_id">
        <select id="s-default_author_id" name="default_author_id" defaultValue={s.default_author_id ?? ""} className="field">
          <option value="">— Wala —</option>
          {authors.map((a) => (
            <option key={a.id} value={a.id}>
              {a.display_name}
            </option>
          ))}
        </select>
      </Field>
      <Text name="copyright_text" label="Copyright" value={s.copyright_text} max={200} hint="Gamitin ang {year} para sa kasalukuyang taon." />
    </div>
  );
}

export function SocialFields({ s }: { s: SiteSettings["social"] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {(["facebook", "youtube", "tiktok", "x", "instagram"] as const).map((k) => (
        <Text key={k} name={k} label={k === "x" ? "X (Twitter)" : k[0]!.toUpperCase() + k.slice(1)} value={s[k]} max={500} type="url" placeholder="https://" />
      ))}
      <Text name="hashtag" label="Opisyal na hashtag" value={s.hashtag} max={60} placeholder="#BosesNgBayan" />
    </div>
  );
}

export function ContactFields({ s }: { s: SiteSettings["contact"] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Text name="email" label="Email" value={s.email} type="email" max={254} />
      <Text name="phone" label="Telepono" value={s.phone} max={40} />
      <div className="md:col-span-2">
        <Area name="address" label="Address" value={s.address} max={300} />
      </div>
    </div>
  );
}

export function FooterFields({ s }: { s: SiteSettings["footer"] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Text name="newsletter_title" label="Pamagat ng newsletter box" value={s.newsletter_title} max={80} />
      <Text name="newsletter_description" label="Paglalarawan ng newsletter box" value={s.newsletter_description} max={200} />
      <div className="md:col-span-2">
        <Check name="show_category_links" label="Ipakita ang mga link ng kategorya sa footer" checked={s.show_category_links} />
      </div>
      <p className="text-xs text-muted md:col-span-2">Ang mga link sa footer ay pinamamahalaan sa Navigation (footer_main, footer_legal).</p>
    </div>
  );
}

export function PublicationFields({ s }: { s: SiteSettings["publication"] }) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field label="Artikulo bawat pahina" htmlFor="s-articles_per_page" hint="6 hanggang 48.">
        <input id="s-articles_per_page" name="articles_per_page" type="number" min={6} max={48} defaultValue={s.articles_per_page} className="field" />
      </Field>
      <div className="flex flex-col justify-end gap-3">
        <Check name="show_reading_time" label="Ipakita ang tagal ng pagbasa" checked={s.show_reading_time} />
        <Check name="comments_enabled" label="Payagan ang komento sa mga artikulo" checked={s.comments_enabled} hint="Dumadaan pa rin sa moderation ang lahat ng komento." />
      </div>
    </div>
  );
}

export function CommunityFields({ s }: { s: SiteSettings["community"] }) {
  return (
    <div className="grid gap-5">
      <Check name="moderation_enabled" label="I-moderate muna bago ilathala" checked={s.moderation_enabled} hint="Inirerekomenda: huwag i-off. Kapag naka-off, agad na lalabas ang mga isinumite." />
      <Check name="submissions_enabled" label="Tumanggap ng mga isinumiteng pananaw sa Usap Bayan" checked={s.submissions_enabled} />
      <Area name="guidelines" label="Community guidelines" value={s.guidelines} max={2000} rows={6} />
    </div>
  );
}

export function NewsletterFields({ s }: { s: SiteSettings["newsletter"] }) {
  return (
    <div className="grid gap-5">
      <Check name="enabled" label="Ipakita ang newsletter sign-up sa site" checked={s.enabled} />
      <Area name="consent_text" label="Teksto ng pahintulot (consent)" value={s.consent_text} max={1000} rows={4} hint="Itinatala ang eksaktong tekstong ito kasama ng bawat subscription." />
    </div>
  );
}
