import { UnsubscribeForm } from "@/app/(site)/newsletter/unsubscribe/unsubscribe-form";
import { buildMetadata } from "@/lib/seo";

type Props = { searchParams: Promise<{ token?: string }> };

export function generateMetadata() {
  return buildMetadata({ title: "Mag-unsubscribe", path: "/newsletter/unsubscribe", noindex: true });
}

/** Token comes from the unsubscribe link in newsletter emails. A click only shows the form (no GET side effects). */
export default async function UnsubscribePage({ searchParams }: Props) {
  const { token } = await searchParams;
  const valid = typeof token === "string" && /^[0-9a-f-]{36}$/i.test(token);
  return (
    <div className="container-site max-w-lg py-16">
      <h1 className="font-serif text-3xl font-bold text-navy">Mag-unsubscribe sa newsletter</h1>
      {valid ? (
        <UnsubscribeForm token={token} />
      ) : (
        <p className="mt-4 text-ink-soft">Hindi wasto o kulang ang unsubscribe link. Gamitin ang link mula sa iyong email.</p>
      )}
    </div>
  );
}
