"use client";
import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
}

// Shared, theme-matched markdown renderer for agent chat responses.
// Only used on assistant messages — user messages stay as plain text.
export function MarkdownMessage({ content }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Paragraphs — reset browser margins so bubbles stay tight
        p: ({ children }) => (
          <p style={{ margin: "0 0 0.55em", lineHeight: 1.65 }}>
            {children}
          </p>
        ),

        // Headings
        h1: ({ children }) => (
          <h1 style={{ fontSize: "1.15em", fontWeight: 800, margin: "0.75em 0 0.4em", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "0.25em", color: "#f5f5f5" }}>{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 style={{ fontSize: "1.05em", fontWeight: 700, margin: "0.7em 0 0.35em", color: "#eee" }}>{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 style={{ fontSize: "0.97em", fontWeight: 700, margin: "0.6em 0 0.3em", color: "#ddd" }}>{children}</h3>
        ),

        // Lists
        ul: ({ children }) => (
          <ul style={{ margin: "0.35em 0 0.55em 0", paddingLeft: "1.4em", listStyleType: "disc" }}>{children}</ul>
        ),
        ol: ({ children }) => (
          <ol style={{ margin: "0.35em 0 0.55em 0", paddingLeft: "1.4em", listStyleType: "decimal" }}>{children}</ol>
        ),
        li: ({ children }) => (
          <li style={{ margin: "0.2em 0", lineHeight: 1.6 }}>{children}</li>
        ),

        // Inline code
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        code: ({ node, className, children, ...props }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code
                className={className}
                style={{
                  display: "block",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  color: "#c9d1d9",
                  fontSize: "0.82em",
                  fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                }}
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 5,
                padding: "1px 6px",
                fontSize: "0.82em",
                fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                color: "#e6b17a",
              }}
              {...props}
            >
              {children}
            </code>
          );
        },

        // Code blocks
        pre: ({ children }) => (
          <pre
            style={{
              background: "rgba(0,0,0,0.45)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              padding: "0.75em 1em",
              overflowX: "auto",
              margin: "0.5em 0",
              fontSize: "0.82em",
              lineHeight: 1.6,
            }}
          >
            {children}
          </pre>
        ),

        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote
            style={{
              borderLeft: "3px solid rgba(255,140,0,0.45)",
              margin: "0.5em 0",
              paddingLeft: "0.85em",
              color: "rgba(255,255,255,0.55)",
              fontStyle: "italic",
            }}
          >
            {children}
          </blockquote>
        ),

        // Horizontal rule
        hr: () => <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.08)", margin: "0.65em 0" }} />,

        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#ff8c00", textDecoration: "none", borderBottom: "1px solid rgba(255,140,0,0.35)" }}
          >
            {children}
          </a>
        ),

        // Strong / em
        strong: ({ children }) => <strong style={{ fontWeight: 700, color: "#fff" }}>{children}</strong>,
        em: ({ children }) => <em style={{ fontStyle: "italic", color: "rgba(255,255,255,0.8)" }}>{children}</em>,

        // Tables (GFM)
        table: ({ children }) => (
          <div style={{ overflowX: "auto", margin: "0.6em 0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85em" }}>{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead style={{ background: "rgba(255,255,255,0.05)" }}>{children}</thead>,
        th: ({ children }) => (
          <th style={{ padding: "6px 10px", borderBottom: "1px solid rgba(255,255,255,0.12)", textAlign: "left", fontWeight: 700, color: "#ccc" }}>
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td style={{ padding: "5px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", color: "#bbb" }}>
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
