import { z } from "zod";
import { listPublicPolls } from "@/lib/cms/polls";
import { publicRead, queryObject } from "@/lib/api/public";

const query = z.object({ filter: z.enum(["active", "past", "all"]).default("all") });

/** Poll definitions only; results go through /polls/[id]/vote (GET) so visibility rules apply. */
export function GET(request: Request) {
  return publicRead("api_polls_failed", () => listPublicPolls(query.parse(queryObject(request)).filter));
}
