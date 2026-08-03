"use client";
/**
 * SEO → Blog
 *
 * Moved here from /content/blog. The blog is an organic-search asset before it is a
 * content asset: everything it is judged on — impressions, position, topic overlap,
 * thin posts — is measured in Search Console, and the SEO dashboard next door reads
 * the same /admin/blog/* endpoints. /content/blog now redirects here.
 */
import React from "react";
import BlogLibrary from "@/components/BlogLibrary";

export default function BlogPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>Blog Library</h2>
        <p style={{ fontSize: 12.5, color: "#64748b", margin: "5px 0 0", lineHeight: 1.55, maxWidth: 720 }}>
          Every article on the Shopify blogs, mirrored locally and audited for duplicate topics, thin
          posts and missing links, then joined to what search and analytics say each one earns —
          with ranked fixes for the posts we have and gap analysis for the ones we don&apos;t. Two
          things here change anything: sync pulls from Shopify, and publishing an approved draft
          creates an article. Existing posts are edited in Shopify, not here, and every
          recommendation is a proposal carrying the risk of acting on it.
        </p>
      </div>
      <BlogLibrary />
    </div>
  );
}
