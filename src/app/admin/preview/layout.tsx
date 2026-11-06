import { I18nProvider } from "@/components/public/i18n-provider";
import { getI18n } from "@/lib/i18n/server";

/** Previews render public components, which read the site language from this provider. */
export default async function PreviewLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getI18n();
  return (
    <I18nProvider locale={locale} messages={t}>
      {children}
    </I18nProvider>
  );
}
