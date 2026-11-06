import { UnsubscribeForm } from "@/app/(site)/newsletter/unsubscribe/unsubscribe-form";
import { buildMetadata } from "@/lib/seo";
import { getI18n } from "@/lib/i18n/server";

type Props = { searchParams: Promise<{ token?: string }> };

export async function generateMetadata() {
  const { t } = await getI18n();
  return buildMetadata({ title: t.newsletter.unsubscribe.metaTitle, path: "/newsletter/unsubscribe", noindex: true });
}

/** Token comes from the unsubscribe link in newsletter emails. A click only shows the form (no GET side effects). */
export default async function UnsubscribePage({ searchParams }: Props) {
  const [{ token }, { t }] = await Promise.all([searchParams, getI18n()]);
  const u = t.newsletter.unsubscribe;
  const valid = typeof token === "string" && /^[0-9a-f-]{36}$/i.test(token);
  return (
    <div className="container-site max-w-lg py-16">
      <h1 className="text-3xl font-semibold text-ink">{u.heading}</h1>
      {valid ? (
        <UnsubscribeForm token={token} />
      ) : (
        <p className="mt-4 text-ink-soft">{u.invalidLink}</p>
      )}
    </div>
  );
}
