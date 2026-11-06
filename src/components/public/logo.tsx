import Image from "next/image";

/**
 * Boses ng Bayan wordmark recreated from the reference: stacked "BOSES" / "ng BAYAN" in heavy
 * cobalt type, the O of BOSES drawn as a speech bubble, "ng" reversed out of a red tile.
 * When Studio → Settings has a logo image, that image is used instead.
 */
export function Logo({
  siteName,
  logoUrl,
  size = "md",
  inverted = false,
}: {
  siteName: string;
  logoUrl?: string | null;
  size?: "sm" | "md" | "lg";
  inverted?: boolean;
}) {
  const scale = size === "lg" ? "text-[2.6rem]" : size === "sm" ? "text-[1.45rem]" : "text-[1.9rem] sm:text-[2.1rem]";
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={siteName}
        width={size === "lg" ? 220 : 170}
        height={size === "lg" ? 80 : 60}
        className="h-auto w-auto max-h-14 object-contain"
        priority
      />
    );
  }
  const blue = inverted ? "text-white" : "text-brand";
  return (
    <span className={`inline-flex flex-col font-sans font-extrabold uppercase leading-[0.86] tracking-[-0.03em] ${scale}`}>
      <span className="sr-only">{siteName}</span>
      <span aria-hidden="true" className={`flex items-center ${blue}`}>
        B
        <svg viewBox="0 0 40 40" className="mx-[0.02em] h-[0.86em] w-[0.86em]" fill="none">
          <path
            d="M20 3C10.1 3 3 9.9 3 18.3c0 4.6 2.1 8.6 5.6 11.4L7 37l8.2-4.1c1.5.4 3.1.6 4.8.6 9.9 0 17-6.9 17-15.2S29.9 3 20 3Z"
            fill="currentColor"
          />
          <circle cx="13" cy="18.5" r="2.6" fill={inverted ? "var(--color-navy)" : "#fff"} />
          <circle cx="20" cy="18.5" r="2.6" fill={inverted ? "var(--color-navy)" : "#fff"} />
          <circle cx="27" cy="18.5" r="2.6" fill={inverted ? "var(--color-navy)" : "#fff"} />
        </svg>
        SES
      </span>
      <span aria-hidden="true" className="flex items-end gap-[0.08em]">
        <span className="mb-[0.06em] rounded-[3px] bg-accent px-[0.12em] pb-[0.08em] text-[0.62em] lowercase leading-none tracking-normal text-white">
          ng
        </span>
        <span className={blue}>BAYAN</span>
      </span>
    </span>
  );
}
