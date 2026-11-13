import { z } from "zod";
import type { Messages } from "@/lib/i18n/messages";

/** Tip line (ADR-024). Statuses mirror the check constraint on public.tips. */
export const TIP_STATUSES = ["new", "reviewing", "verified", "dismissed"] as const;
export type TipStatus = (typeof TIP_STATUSES)[number];
export const MAX_EVIDENCE_LINKS = 5;

const optional = (max: number) => z.string().trim().max(max).default("");

/**
 * Body of POST /api/public/v1/tips. `evidence` is the textarea as typed: one https link per line.
 * `hp` is a honeypot: humans never see or fill it. It is not called `website`, which password managers
 * may fill: a filled honeypot drops the tip while the sender sees the normal thank-you.
 */
export const tipSchema = (m: Messages["tips"]["api"]) =>
  z.object({
    subject: z.string().trim().min(5, m.subjectTooShort).max(200),
    details: z.string().trim().min(30, m.detailsTooShort).max(8000),
    agency: optional(200),
    location: optional(120),
    evidence: z
      .string()
      .max(3000, m.invalidLinks)
      .default("")
      .transform((v) => v.split(/\s+/).filter(Boolean))
      .pipe(
        z
          .array(
            z
              .url({ protocol: /^https$/, message: m.invalidLinks })
              .max(500, m.invalidLinks)
              // The rule submit_tip() applies: a literal lowercase https:// (z.url also accepts "HTTPS:" and "https:host").
              .regex(/^https:\/\/[^\s\u0000]+$/, m.invalidLinks),
          )
          .max(MAX_EVIDENCE_LINKS, m.invalidLinks),
      ),
    contactName: optional(120),
    contact: optional(200),
    agree: z.literal(true, { error: m.agreeRequired }),
    hp: z.string().max(500).optional(),
  });

export type TipInput = z.infer<ReturnType<typeof tipSchema>>;
