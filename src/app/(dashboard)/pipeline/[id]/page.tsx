import { redirect } from "next/navigation";

/**
 * Redirect: /pipeline/<id> → /pipeline?focus=<id>
 *
 * This was a 1,016-line detail page. The insight it showed now expands in place
 * on the list, so the page has nothing left to render — but the URL cannot just
 * disappear. Five places link to it, and two of them have already sent the link
 * to a person: the Discord DM on human assignment (routes/pipeline.ts) and the
 * proactive scheduler's task nudges. Those DMs are sitting in inboxes.
 *
 * Deep links from Command Center and the research library come through here too.
 * The commerce section pages were the fourth source until that tree was removed.
 */
export default async function PipelineItemRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/pipeline?focus=${encodeURIComponent(id)}`);
}
