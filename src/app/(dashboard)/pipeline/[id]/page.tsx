import InsightDetail from "@/components/InsightDetail";

/**
 * /pipeline/<id> — one insight, and the conversation on it.
 *
 * This URL used to be a 1,016-line detail page, then a redirect to
 * `/pipeline?focus=<id>` once the board learned to expand a row in place. It is
 * a real page again, for a reason the board cannot cover: an insight now has a
 * conversation, and a conversation needs somewhere to live that is not a row.
 *
 * The links were always the point. Five places send people here and two of them
 * put the link in a person's hands — the Discord DM on human assignment, and now
 * `ask_human`, which DMs a teammate a question and this address to answer it at.
 * Those links have to land somewhere they can actually type — and, since two of
 * them say the words "mark complete", somewhere they can actually close what was
 * asked of them. See `components/InsightActions` for what that does and does not
 * include; the board is still where an insight is triaged, sorted and filtered.
 */
export default async function InsightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InsightDetail insightId={id} />;
}
