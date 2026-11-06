import { z } from "zod";
import { getPublicPollById, getPublicPollBySlug } from "@/lib/cms/polls";
import { publicRead } from "@/lib/api/public";

/** GET /api/public/v1/polls/{id-or-slug}. One dynamic segment name is required by Next routing. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return publicRead("api_poll_failed", () => (z.uuid().safeParse(id).success ? getPublicPollById(id) : getPublicPollBySlug(id)));
}
