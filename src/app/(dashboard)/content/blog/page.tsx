import { redirect } from "next/navigation";

/**
 * The Blog Library moved to /seo/blog — the blog is an organic-search asset, and the
 * SEO dashboard next door reads the same /admin/blog/* endpoints.
 *
 * This redirect stays rather than the route being deleted: /content/blog sat in the
 * Content tab strip for months, so it is in bookmarks and in agent-written links, and
 * turning those into 404s buys nothing.
 */
export default function ContentBlogRedirect() {
  redirect("/seo/blog");
}
