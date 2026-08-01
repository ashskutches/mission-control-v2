"use client";
import React from "react";
import BlogLibrary from "@/components/BlogLibrary";

export default function BlogPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: "#fff", margin: 0 }}>Blog Library</h2>
        <p style={{ fontSize: 12.5, color: "#64748b", margin: "5px 0 0", lineHeight: 1.55, maxWidth: 720 }}>
          Every article on the Shopify blogs, mirrored locally and audited for duplicate topics, thin
          posts and missing links. Read-only for now: sync pulls from Shopify, and nothing here edits
          or publishes an article.
        </p>
      </div>
      <BlogLibrary />
    </div>
  );
}
