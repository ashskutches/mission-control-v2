"use client";
import React, { useEffect, useState, useCallback } from "react";
import {
  RefreshCw, MessageSquare, Inbox, AlertTriangle,
  ThumbsUp, ThumbsDown, Minus, Reply, Trash2, EyeOff,
  Loader, AlertCircle,
} from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FBComment {
  id: string;
  from: { name: string; id?: string };
  message: string;
  created_time: string;
  post_id?: string;
  sentiment: "positive" | "negative" | "neutral";
  flags: string[];
  can_reply?: boolean;
  can_hide?: boolean;
  can_delete?: boolean;
}

interface FBMessage {
  thread_id: string;
  sender: { name: string };
  snippet: string;
  timestamp: string;
  unread_count: number;
}

type Tab = "comments" | "messages" | "flagged";

// ── Sentiment helpers ──────────────────────────────────────────────────────────

const SENTIMENT_CONFIG = {
  positive: { color: "#22c55e", bg: "rgba(34,197,94,0.1)",  Icon: ThumbsUp,   label: "Positive" },
  negative: { color: "#f43f5e", bg: "rgba(244,63,94,0.1)",  Icon: ThumbsDown, label: "Negative" },
  neutral:  { color: "#94a3b8", bg: "rgba(148,163,184,0.1)",Icon: Minus,       label: "Neutral"  },
};

function SentimentBadge({ sentiment }: { sentiment: FBComment["sentiment"] }) {
  const cfg = SENTIMENT_CONFIG[sentiment];
  const Icon = cfg.Icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 7px", borderRadius: 4, fontSize: 9, fontWeight: 800,
      background: cfg.bg, color: cfg.color,
    }}>
      <Icon size={8} />
      {cfg.label.toUpperCase()}
    </span>
  );
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BOT_URL}/admin/facebook${path}`, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

// ── Comment card ──────────────────────────────────────────────────────────────

function CommentCard({ comment, onAction }: {
  comment: FBComment;
  onAction: (id: string, type: "reply" | "hide" | "delete", message?: string) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState<"reply" | "hide" | "delete" | null>(null);
  const cfg = SENTIMENT_CONFIG[comment.sentiment];

  const act = async (type: "reply" | "hide" | "delete", msg?: string) => {
    setBusy(type);
    try { await onAction(comment.id, type, msg); } finally { setBusy(null); }
    if (type === "reply") { setReplyText(""); setReplying(false); }
  };

  return (
    <div style={{
      background: "rgba(255,255,255,0.025)", borderRadius: 10, overflow: "hidden",
      border: comment.sentiment === "negative"
        ? "1px solid rgba(244,63,94,0.2)"
        : "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
          background: `${cfg.color}20`, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 11, fontWeight: 800, color: cfg.color,
        }}>
          {comment.from.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{comment.from.name}</div>
          <div style={{ fontSize: 10, color: "#475569" }}>
            {new Date(comment.created_time).toLocaleString()}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          {comment.flags.length > 0 && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
              background: "rgba(245,158,11,0.1)", color: "#f59e0b",
            }}>
              🚩 {comment.flags.join(", ")}
            </span>
          )}
          <SentimentBadge sentiment={comment.sentiment} />
        </div>
      </div>

      {/* Message */}
      <div style={{ padding: "0 14px 10px", fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>
        {comment.message}
      </div>

      {/* Actions */}
      <div style={{
        padding: "8px 14px", display: "flex", gap: 6, alignItems: "center",
        borderTop: "1px solid rgba(255,255,255,0.04)",
      }}>
        {comment.can_reply !== false && (
          <button
            onClick={() => setReplying(!replying)}
            style={actionBtn("#38bdf8")}
          >
            <Reply size={10} /> Reply
          </button>
        )}
        {comment.can_hide !== false && (
          <button
            disabled={busy === "hide"}
            onClick={() => act("hide")}
            style={actionBtn("#f59e0b")}
          >
            {busy === "hide" ? <Loader size={10} style={spinning} /> : <EyeOff size={10} />}
            Hide
          </button>
        )}
        {comment.can_delete !== false && (
          <button
            disabled={busy === "delete"}
            onClick={() => { if (confirm("Delete this comment?")) act("delete"); }}
            style={{ ...actionBtn("#f43f5e"), marginLeft: "auto" }}
          >
            {busy === "delete" ? <Loader size={10} style={spinning} /> : <Trash2 size={10} />}
            Delete
          </button>
        )}
      </div>

      {/* Reply box */}
      {replying && (
        <div style={{ padding: "0 14px 12px", display: "flex", gap: 8 }}>
          <input
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Type your reply…"
            style={{
              flex: 1, padding: "6px 10px", borderRadius: 6, fontSize: 12,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#e2e8f0", outline: "none",
            }}
            onKeyDown={e => e.key === "Enter" && replyText.trim() && act("reply", replyText)}
          />
          <button
            disabled={!replyText.trim() || busy === "reply"}
            onClick={() => replyText.trim() && act("reply", replyText)}
            style={actionBtn("#38bdf8")}
          >
            {busy === "reply" ? <Loader size={10} style={spinning} /> : "Send"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Style helpers ──────────────────────────────────────────────────────────────

function actionBtn(color: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer",
    background: `${color}15`, border: `1px solid ${color}40`, color,
  };
}

const spinning: React.CSSProperties = { animation: "spin 0.8s linear infinite" };

// ── Main component ────────────────────────────────────────────────────────────

export default function FacebookPageMonitor() {
  const [tab, setTab] = useState<Tab>("comments");
  const [comments, setComments]   = useState<FBComment[]>([]);
  const [messages, setMessages]   = useState<FBMessage[]>([]);
  const [flagged,  setFlagged]    = useState<FBComment[]>([]);
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState<string | null>(null);
  const [hours,    setHours]      = useState(24);

  const load = useCallback(async (activeTab = tab) => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "comments") {
        const d = await apiFetch(`/comments?hours=${hours}&limit=50`);
        setComments(Array.isArray(d.data) ? d.data : []);
      } else if (activeTab === "messages") {
        const d = await apiFetch("/messages?limit=20");
        setMessages(Array.isArray(d.data) ? d.data : []);
      } else {
        const d = await apiFetch(`/flagged?hours=${hours}&limit=100`);
        setFlagged(Array.isArray(d.data) ? d.data : []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tab, hours]);

  useEffect(() => { load(tab); }, [tab]); // eslint-disable-line

  const handleAction = async (
    id: string,
    type: "reply" | "hide" | "delete",
    message?: string
  ) => {
    if (type === "reply") {
      await apiFetch(`/comments/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
    } else if (type === "hide") {
      await apiFetch(`/comments/${id}/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_hidden: true }),
      });
    } else {
      await apiFetch(`/comments/${id}`, { method: "DELETE" });
    }
    // Refresh current list after action
    await load(tab);
  };

  const tabs: { id: Tab; label: string; Icon: any; count?: number }[] = [
    { id: "comments", label: "Comments",  Icon: MessageSquare, count: comments.length },
    { id: "messages", label: "DMs",       Icon: Inbox,         count: messages.length },
    { id: "flagged",  label: "Flagged",   Icon: AlertTriangle, count: flagged.length  },
  ];

  const sentimentStats = (items: FBComment[]) => ({
    positive: items.filter(c => c.sentiment === "positive").length,
    negative: items.filter(c => c.sentiment === "negative").length,
    neutral:  items.filter(c => c.sentiment === "neutral").length,
  });

  const currentList = tab === "comments" ? comments : tab === "flagged" ? flagged : [];
  const stats = sentimentStats(currentList);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 800, color: "#e2e8f0", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Facebook Page Monitor
          </h4>
          <p style={{ fontSize: 11, color: "#64748b", margin: 0, marginTop: 2 }}>
            Live engagement tracking with sentiment analysis
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {tab !== "messages" && (
            <select
              value={hours}
              onChange={e => setHours(Number(e.target.value))}
              style={{
                padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#94a3b8", cursor: "pointer",
              }}
            >
              {[6, 12, 24, 48, 72].map(h => <option key={h} value={h}>Last {h}h</option>)}
            </select>
          )}
          <button
            onClick={() => load(tab)}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 12px", borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#94a3b8", cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? <Loader size={11} style={spinning} /> : <RefreshCw size={11} />}
            Refresh
          </button>
        </div>
      </div>

      {/* Sentiment stats (only for tabs with comments) */}
      {tab !== "messages" && currentList.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          {(["positive", "negative", "neutral"] as const).map(s => {
            const cfg = SENTIMENT_CONFIG[s];
            const Icon = cfg.Icon;
            return (
              <div key={s} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 8,
                background: cfg.bg, border: `1px solid ${cfg.color}30`,
              }}>
                <Icon size={12} color={cfg.color} />
                <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>
                  {stats[s]} {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 1 }}>
        {tabs.map(t => {
          const Icon = t.Icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "7px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer",
                background: "transparent", border: "none",
                borderBottom: isActive ? "2px solid #f472b6" : "2px solid transparent",
                color: isActive ? "#f472b6" : "#64748b",
                marginBottom: -1,
              }}
            >
              <Icon size={12} />
              {t.label}
              {(t.count ?? 0) > 0 && (
                <span style={{
                  fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 10,
                  background: isActive ? "rgba(244,114,182,0.15)" : "rgba(255,255,255,0.06)",
                  color: isActive ? "#f472b6" : "#64748b",
                }}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: "flex", gap: 8, alignItems: "center",
          padding: "10px 14px", borderRadius: 8, marginBottom: 14,
          background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)",
          color: "#fca5a5", fontSize: 12,
        }}>
          <AlertCircle size={14} />
          {error.includes("503") || error.includes("configured")
            ? "Facebook not configured — set FB_PAGE_ACCESS_TOKEN and FB_PAGE_ID in Railway env vars."
            : error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#475569", fontSize: 12 }}>
          <Loader size={18} style={{ ...spinning, display: "inline-block", marginBottom: 8 }} />
          <div>Loading Facebook data…</div>
        </div>
      )}

      {/* Comments / Flagged */}
      {!loading && (tab === "comments" || tab === "flagged") && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {currentList.length === 0 && !error && (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#475569", fontSize: 12 }}>
              No {tab === "flagged" ? "flagged " : ""}comments in the last {hours}h.
            </div>
          )}
          {currentList.map(c => (
            <CommentCard key={c.id} comment={c} onAction={handleAction} />
          ))}
        </div>
      )}

      {/* DMs */}
      {!loading && tab === "messages" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.length === 0 && !error && (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#475569", fontSize: 12 }}>
              No unread messages in the Page inbox.
            </div>
          )}
          {messages.map(m => (
            <div key={m.thread_id} style={{
              padding: "12px 14px", borderRadius: 10,
              background: "rgba(255,255,255,0.025)",
              border: m.unread_count > 0
                ? "1px solid rgba(56,189,248,0.2)"
                : "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(56,189,248,0.15)", display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#38bdf8",
                }}>
                  {m.sender.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{m.sender.name}</span>
                    {m.unread_count > 0 && (
                      <span style={{
                        fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 10,
                        background: "rgba(56,189,248,0.15)", color: "#38bdf8",
                      }}>
                        {m.unread_count} unread
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.snippet}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: "#475569", flexShrink: 0 }}>
                  {new Date(m.timestamp).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
