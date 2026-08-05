import { redirect } from "next/navigation";

/**
 * Backorders moved to /orders/backorders.
 *
 * /customer was a second order surface sitting next to /orders — two sidebar entries,
 * both order-shaped, and for a while both literally labelled "Orders". They are now one
 * section: /orders is the exception queue, /orders/backorders is the narrower slice that
 * has its own SMS script.
 *
 * The redirect stays rather than the route being deleted, matching /content/blog →
 * /seo/blog: /customer sat in the sidebar for months, so it is in bookmarks and in
 * agent-written links, and turning those into 404s buys nothing.
 */
export default function CustomerBackordersRedirect() {
  redirect("/orders/backorders");
}
