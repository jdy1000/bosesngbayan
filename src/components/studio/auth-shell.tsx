import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/public/logo";
import { formatDateline } from "@/lib/format";
// CC0 (Wikimedia Commons, "Jeepney in Metro Manila 2025 01"); no attribution required.
import street from "@/components/studio/auth-street.jpg";

/**
 * Frame for the signed-out Studio screens. `split` (sign-in) puts the photo panel beside the form in two equal
 * halves, as in the Newsmaker console. `plain` (new password, apply) is one centred column without the photo.
 */
export function AuthShell({ children, variant = "split" }: { children: React.ReactNode; variant?: "split" | "plain" }) {
  const split = variant === "split";
  return (
    <main className={`grid min-h-dvh bg-paper ${split ? "lg:grid-cols-2" : ""}`}>
      {split && (
        <section
          aria-label="Boses ng Bayan Studio"
          className="relative isolate flex min-h-52 flex-col justify-between overflow-hidden bg-navy px-5 py-6 text-white sm:px-10 lg:min-h-dvh lg:px-12 lg:py-10"
        >
          <Image
            src={street}
            alt=""
            fill
            priority
            placeholder="blur"
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="-z-20 object-cover object-[80%_60%]"
          />
          {/* Scrim so the white type stays readable over any part of the photo. */}
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-navy-900/95 via-navy-900/45 to-navy-900/30" />

          <div className="flex items-center gap-3">
            <Logo siteName="Boses ng Bayan" inverted size="sm" />
            <span className="text-[0.95rem] font-semibold text-white/85">Studio</span>
          </div>

          <div className="max-w-xl">
            <p className="text-sm font-medium text-white/80">{formatDateline()} · Manila</p>
            <p className="mt-3 text-[1.75rem] font-semibold leading-[1.08] tracking-[-0.02em] text-balance sm:text-[2.25rem] lg:text-[2.75rem]">
              Every story starts here.
            </p>
            <p className="mt-4 hidden max-w-md text-[1.05rem] leading-relaxed text-white/85 lg:block">
              Write, review and publish Boses ng Bayan stories, from first draft to the homepage.
            </p>
          </div>
        </section>
      )}

      <div className="flex flex-col px-5 py-6 sm:px-10 lg:px-12 lg:py-8">
        {/* Plain link: a full page load so <html lang> switches from Studio (en) to the site language. Absolute, because Studio can sit on its own origin (ADR-020). */}
        <a
          href={process.env.NEXT_PUBLIC_SITE_URL || "/"}
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-medium text-ink-soft transition-colors hover:text-brand"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to Boses ng Bayan
        </a>

        <div className="flex flex-1 items-center py-8">
          <div className={`mx-auto w-full ${split ? "max-w-[390px]" : "max-w-[520px]"}`}>
            {/* In the split layout the photo panel already names the site, so this copy is decorative and shows only beside it. */}
            <div aria-hidden={split || undefined} className={split ? "mb-7 hidden lg:block" : "mb-7"}>
              <Logo siteName="Boses ng Bayan" size="sm" />
            </div>
            {children}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-xs text-muted">
          <span>© {new Date().getFullYear()} Boses ng Bayan</span>
          <span>Newsroom staff only</span>
        </div>
      </div>
    </main>
  );
}
