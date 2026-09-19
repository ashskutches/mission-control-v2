#!/usr/bin/env node
/**
 * wrap-artifact.mjs — turn a Claude artifact into a standalone page we host.
 *
 *   node scripts/wrap-artifact.mjs <source.html> <slug>
 *
 * ## Why this exists
 *
 * Artifacts published to claude.ai are shareable only with people who hold a
 * seat in the same Claude organisation. There is no public link. Everyone on
 * this team who needed to read them had no way in, so the reports are exported
 * and served from our own domain instead.
 *
 * ## What it has to strip, and why
 *
 * A published artifact is the author's file wrapped at publish time in
 * `<!doctype html><head>…</head><body>`, and that injected head carries ~40KB of
 * minified `frame-runtime` bootstrap. That script talks to the claude.ai shell
 * over postMessage — theme sync, live edits, comments, the `window.claude.*`
 * capability bridge. Off-platform it has no parent to talk to. Keeping it would
 * ship dead weight that runs on every page load, so it goes.
 *
 * What it must NOT strip is the tiny CSS reset in that same head. `body{margin:0}`
 * is load-bearing for every one of these designs; drop it and each page picks up
 * the browser's default 8px body margin and the layout shifts. It is reproduced
 * below verbatim.
 *
 * Verified before exporting: none of these pages call `window.claude.*`, so none
 * of them needed the runtime for anything real. Two are interactive prototypes
 * whose behaviour is plain inline JS, and that still works.
 */

import { readFileSync, writeFileSync } from "node:fs";

const [src, slug] = process.argv.slice(2);
if (!src || !slug) {
  console.error("usage: node scripts/wrap-artifact.mjs <source.html> <slug>");
  process.exit(1);
}

const raw = readFileSync(src, "utf8");

// The publish-time wrapper. Everything after it is the author's own file.
const SPLIT = "</head><body>";
const at = raw.indexOf(SPLIT);
if (at === -1) {
  console.error(`${src}: no publish-time head found — is this an exported artifact?`);
  process.exit(1);
}
let body = raw.slice(at + SPLIT.length);
// Trailing </body></html> from the wrapper; we emit our own.
body = body.replace(/<\/body>\s*<\/html>\s*$/i, "").trim();

/**
 * The author's file opens with its own <title>, because the Artifact tool reads
 * the title out of the file rather than requiring it in a head the author does
 * not control. Lift it into our head and drop it from the body — a <title> in
 * <body> is invalid, and browsers only tolerate it.
 */
const titleMatch = body.match(/<title>([\s\S]*?)<\/title>/i);
const title = (titleMatch?.[1] ?? slug).trim();
if (titleMatch) body = body.replace(titleMatch[0], "").trim();

/** Verbatim from the artifact publish head. See the docblock. */
const RESET =
  ":root{color-scheme:light}" +
  "body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;" +
  "background:#faf9f5;color:#141413}" +
  "img{max-width:100%}" +
  "[hidden]:not([hidden=until-found]){display:none!important}";

const out = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<!--
  Not for search engines. This page is reachable by anyone holding the link and
  carries internal business analysis; robots.txt disallows /reports/ as well, but
  a meta directive is the one that stops indexing of a page that IS fetched.
-->
<meta name="robots" content="noindex, nofollow, noarchive">
<title>${title}</title>
<style>${RESET}</style>
</head>
<body>
${body}
<!--
  Appended, not prepended. These pages have their own sticky headers and hero
  sections; injecting anything above the fold moves somebody's layout. At the end
  it is findable and disturbs nothing.
-->
<footer style="font:12px -apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:28px 16px;border-top:1px solid rgba(0,0,0,.1);background:#faf9f5;color:#6b6b6b">
  <a href="/reports/claude" style="color:#6b6b6b">← All reports</a>
</footer>
</body>
</html>
`;

const dest = `public/reports/claude/${slug}.html`;
writeFileSync(dest, out);
console.log(`${slug.padEnd(28)} ${title.padEnd(34)} ${(out.length / 1024).toFixed(1)}KB → ${dest}`);
