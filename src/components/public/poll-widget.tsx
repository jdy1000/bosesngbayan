import { PollCard } from "@/components/public/poll-card";
import { currentVoterHash, getPollResults, type PublicPoll } from "@/lib/cms/polls";
import { formatDate } from "@/lib/format";
import { logServerError } from "@/lib/log";

/** Server wrapper: resolves this visitor's results (visibility enforced in SQL) for a PollCard. */
export async function PollWidget({ poll, variant = "full" }: { poll: PublicPoll; variant?: "hero" | "full" }) {
  let results;
  try {
    results = await getPollResults(poll.id, await currentVoterHash());
  } catch (error) {
    logServerError("poll_widget_results_failed", error);
    results = { visible: false, has_voted: false, is_open: false };
  }
  const closesLabel = poll.closes_at && results.is_open ? `Hanggang ${formatDate(poll.closes_at)}` : null;
  return (
    <PollCard
      poll={{
        id: poll.id,
        slug: poll.slug,
        question: poll.question,
        kind: poll.kind,
        max_choices: poll.max_choices,
        results_visibility: poll.results_visibility,
        closes_at: poll.closes_at,
        options: poll.options.map((o) => ({ id: o.id, label: o.label })),
      }}
      initialResults={results}
      variant={variant}
      closesLabel={closesLabel}
    />
  );
}
