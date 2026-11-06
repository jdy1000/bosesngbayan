import { Moon, Sun } from "lucide-react";
import { setLocale, setTheme } from "@/lib/preferences";
import type { Locale } from "@/lib/i18n/config";
import type { Theme } from "@/lib/theme";

/** Light/dark toggle. A plain form, so it works before (and without) JavaScript. */
export function ThemeToggle({ theme, labels, className }: { theme: Theme; labels: { toDark: string; toLight: string }; className: string }) {
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = next === "dark" ? labels.toDark : labels.toLight;
  return (
    <form action={setTheme}>
      <button type="submit" name="theme" value={next} aria-label={label} title={label} className={className}>
        {next === "dark" ? <Moon className="size-[18px]" aria-hidden="true" /> : <Sun className="size-[18px]" aria-hidden="true" />}
      </button>
    </form>
  );
}

/** FIL | EN switch for the public site. Each option is a submit button; the current one is pressed. */
export function LanguageSwitch({ locale, labels }: { locale: Locale; labels: { label: string; fil: string; en: string } }) {
  const option = (value: Locale, short: string, name: string) => (
    <button
      type="submit"
      name="locale"
      value={value}
      aria-pressed={locale === value}
      aria-label={name}
      lang={value}
      className="h-8 rounded-full px-2.5 text-xs font-bold tracking-wide text-white/70 transition-colors hover:text-white aria-pressed:bg-white aria-pressed:text-navy-900"
    >
      {short}
    </button>
  );
  return (
    <form action={setLocale} role="group" aria-label={labels.label} className="flex items-center rounded-full border border-white/20 p-0.5">
      {option("fil", "FIL", labels.fil)}
      {option("en", "EN", labels.en)}
    </form>
  );
}
