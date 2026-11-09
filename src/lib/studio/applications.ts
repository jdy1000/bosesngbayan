import { z } from "zod";
import { optionalText, requiredText } from "@/lib/studio/form";

/** Roles an applicant may request and an administrator may grant on approval. Never owner/administrator. */
export const APPLICATION_ROLES = ["writer", "moderator"] as const;
export type ApplicationRole = (typeof APPLICATION_ROLES)[number];

export const APPLICATION_STATUSES = ["pending", "approved", "rejected"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const applicationRoleSchema = z.enum(APPLICATION_ROLES, { message: "Choose Writer or Moderator." });

/** Public "Apply for newsroom access" form. `website` is a honeypot: humans never see or fill it. */
export const applicationSchema = z
  .object({
    full_name: requiredText(2, 120, "Name"),
    email: z.string().trim().toLowerCase().max(254, "Enter a valid email.").pipe(z.email("Enter a valid email.")),
    requested_role: applicationRoleSchema.default("writer"),
    organization: optionalText(160),
    portfolio_url: z.preprocess(
      (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
      z
        .url({ protocol: /^https$/, message: "The link must be a full https:// address." })
        .max(500, "The link is too long.")
        .nullable(),
    ),
    message: requiredText(20, 2000, "Message"),
    consent: z.literal("on", { error: "Please agree to the privacy notice." }),
    website: z.string().max(500).optional(),
  })
  .transform(({ website, ...rest }) => ({ ...rest, isBot: Boolean(website) }));

export type ApplicationInput = z.infer<typeof applicationSchema>;
