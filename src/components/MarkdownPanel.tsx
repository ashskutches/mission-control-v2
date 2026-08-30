"use client";
import React, { useState } from "react";
import { Copy, Check } from "lucide-react";
import { MarkdownMessage } from "./MarkdownMessage";

/**
 * MarkdownPanel — agent output, rendered, with the raw markdown one click away.
 *
 * Agents write markdown: headings, bullets, tables, links. A `pre-wrap` block
 * shows the asterisks and pipes instead, which is readable only if you are
 * willing to parse it in your head. This is the same pairing the insights board
 * settled on — render for the eye, copy the markdown for the clipboard, because
 * the next place it goes is usually another markdown box (Discord, a doc, a
 * ticket) that will render it again.
 *
 * The copy row sits ABOVE the content rather than floating over it: an absolute
 * button lands on top of the first heading whenever the output opens with one.
 */
interface Props {
  content: string;
  /** Type scale / colour of the surrounding panel — headings and code stay themed. */
  style?: React.CSSProperties;
  /** Off where the surface already has its own copy control (JobsTab has one). */
  copy?: boolean;
  /** What lands on the clipboard, when that is not exactly what is on screen. */
  copyText?: string;
  title?: string;
}

export function MarkdownPanel({
  content,
  style,
  copy = true,
  copyText,
  title = "Copy as markdown",
}: Props) {
  const [copied, setCopied] = useState(false);

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText ?? content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard denied — the text is on screen and selectable */
    }
  };

  return (
    <div style={{ minWidth: 0 }}>
      {copy && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <button
            onClick={(e) => { e.stopPropagation(); doCopy(); }}
            title={title}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              background: copied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 6, padding: "3px 8px", cursor: "pointer",
              color: copied ? "#22c55e" : "#475569", fontSize: "10px", fontWeight: 700,
            }}
          >
            {copied ? <><Check size={9} /> Copied</> : <><Copy size={9} /> Copy</>}
          </button>
        </div>
      )}
      <div style={style}>
        <MarkdownMessage content={content} />
      </div>
    </div>
  );
}
