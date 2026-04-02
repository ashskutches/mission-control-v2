"use client";
/**
 * ChatBox — Canonical chat primitive for Mission Control
 * ───────────────────────────────────────────────────────
 * Two modes:
 *   "fill"   — fills 100% of whatever container you give it (no self-imposed height).
 *              The PARENT is responsible for setting height/overflow.
 *              Use for: AgentDetailChat-style side panels, full-page layouts.
 *
 *   "inline" — self-contained collapsible panel that expands to a fixed height.
 *              Renders a toggle header then animates open/closed.
 *              Does NOT affect the surrounding page layout.
 *              Use for: embedded section pages, north-star, blockages page.
 *
 * All chat logic (conversation create/load, polling, send, optimistic messages) lives
 * here exactly once. SectionChat and AgentDetailChat are now thin wrappers around this.
 */

import React, {
  useState, useEffect, useRef, useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MarkdownMessage } from "./MarkdownMessage";
import {
  Send, AlertCircle, X, MessageSquare, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";
import Link from "next/link";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";
const POLL_INTERVAL = 5_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChatContextPrimer {
  /** Section ID (e.g. "email", "seo") for section-specific context injection */
  sectionId: string;
  sectionName: string;
  metrics?: { label: string; value: string; sub?: string | null }[];
  insights?: { id: string; type: string; title: string; estimated_monthly_value?: number | null; status: string }[];
}

export interface ChatBoxProps {
  agentId: string;
  agentName: string;
  agentEmoji?: string;
  agentColor?: string;

  /**
   * "fill"   — takes 100% of parent height/width, no self-sizing.
   * "inline" — collapsible panel, renders its own toggle header.
   */
  mode: "fill" | "inline";

  /** inline mode: expanded height in px. Default: 420 */
  inlineHeight?: number;

  /** Optional context primer — injected into the first user message (hidden from display) */
  context?: ChatContextPrimer;

  /** Show the agent header bar (name + live dot). Default: true for fill, false for inline */
  showHeader?: boolean;

  /** Show "Enter to send" hint. Default: true for fill, false for inline */
  showHint?: boolean;

  /** Show a link to the full /chats view after the agent name. Default: false */
  showChatLink?: boolean;

  /** Unique key for the conversation title so section chats are separated per section */
  conversationKey?: string;
}

interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypingIndicator({ color }: { color: string }) {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "8px 12px", width: "fit-content" }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "block" }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

function MessageBubble({
  msg, agentColor, agentEmoji, hideContextPrimer,
}: {
  msg: Message;
  agentColor: string;
  agentEmoji: string;
  hideContextPrimer?: boolean;
}) {
  const isUser = msg.role === "user";
  // hide context primer lines from display
  if (hideContextPrimer && isUser && msg.content.startsWith("[SECTION CONTEXT")) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 8,
        marginBottom: 12,
      }}
    >
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: `${agentColor}18`, border: `1px solid ${agentColor}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, fontSize: 14,
        }}>
          {agentEmoji}
        </div>
      )}
      <div style={{
        maxWidth: "76%", minWidth: 0,
        padding: "9px 13px",
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        background: isUser
          ? `linear-gradient(135deg, ${agentColor}28, ${agentColor}18)`
          : "rgba(255,255,255,0.05)",
        border: isUser ? `1px solid ${agentColor}30` : "1px solid rgba(255,255,255,0.07)",
        color: "#eee", fontSize: 13, lineHeight: 1.6,
        wordBreak: "break-word", overflowWrap: "anywhere",
        whiteSpace: isUser ? "pre-wrap" : undefined,
      }}>
        {isUser ? msg.content : <MarkdownMessage content={msg.content} />}
      </div>
    </motion.div>
  );
}

// ── Core chat logic hook ──────────────────────────────────────────────────────

function useChatEngine(agentId: string, agentName: string, context?: ChatContextPrimer, conversationKey?: string) {
  const [convoId, setConvoId]         = useState<string | null>(null);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState("");
  const [sending, setSending]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [booting, setBooting]         = useState(true);
  const [isFirstMsg, setIsFirstMsg]   = useState(true);

  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef       = useRef<HTMLTextAreaElement>(null);
  const pollRef           = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesRef       = useRef<Message[]>([]);

  // ── Load or create conversation ─────────────────────────────────────────────
  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${BOT_URL}/admin/chat/conversations?agent_id=${agentId}`);
        if (!r.ok) throw new Error(`Fetch conversations: ${r.status}`);
        const convos: any[] = await r.json();

        // If there's a key (section chat), find the matching conversation
        const titleTag = conversationKey ? `[${conversationKey}]` : null;
        const matched = titleTag
          ? convos.find((c) => c.title?.includes(titleTag))
          : null;

        let cid: string;
        if (matched) {
          cid = matched.id;
          if (!cancelled) setIsFirstMsg(false);
        } else if (!conversationKey && convos.length > 0) {
          // For agent direct chats — reuse the most recent existing conversation
          cid = convos[0]!.id;
          if (!cancelled) setIsFirstMsg(false);
        } else {
          const title = titleTag
            ? `${titleTag} ${agentName} Chat`
            : `Chat with ${agentName}`;
          const cr = await fetch(`${BOT_URL}/admin/chat/conversations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agent_id: agentId, title }),
          });
          if (!cr.ok) throw new Error(`Create conversation: ${cr.status}`);
          const convo = await cr.json();
          cid = convo.id;
          if (!cancelled) setIsFirstMsg(true);
        }
        if (!cancelled) setConvoId(cid);
      } catch (e: any) {
        if (!cancelled) setError(`Could not open chat: ${e.message}`);
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [agentId, agentName, conversationKey]);

  // ── Fetch messages ──────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (cid: string) => {
    try {
      const r = await fetch(`${BOT_URL}/admin/chat/conversations/${cid}/messages`);
      if (!r.ok) return;
      const data: Message[] = await r.json();
      const incoming = Array.isArray(data) ? data : [];
      const lastNew = incoming[incoming.length - 1]?.id;
      const lastCur = messagesRef.current[messagesRef.current.length - 1]?.id;
      if (lastNew !== lastCur || incoming.length !== messagesRef.current.length) {
        messagesRef.current = incoming;
        setMessages(incoming);
      }
    } catch { /* silent — polling */ }
  }, []);

  // ── Start polling when convoId is set ──────────────────────────────────────
  useEffect(() => {
    if (!convoId) return;
    messagesRef.current = [];
    fetchMessages(convoId);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (!sending) fetchMessages(convoId);
    }, POLL_INTERVAL);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [convoId, fetchMessages, sending]);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // ── Build context primer ────────────────────────────────────────────────────
  function buildPrimer(ctx: ChatContextPrimer, userText: string): string {
    const metrics = ctx.metrics ?? [];
    const insights = ctx.insights ?? [];
    const metricLines = metrics.length > 0
      ? metrics.map((m) => `  - ${m.label}: ${m.value}${m.sub ? ` (${m.sub})` : ""}`).join("\n")
      : "  (No metrics yet)";
    const insightLines = insights.slice(0, 6).length > 0
      ? insights.slice(0, 6).map((i) =>
          `  - [${i.type.toUpperCase()}] "${i.title}"${i.estimated_monthly_value ? ` (+$${i.estimated_monthly_value.toLocaleString()}/mo)` : ""} [${i.status}]`
        ).join("\n")
      : "  (No insights yet)";

    return (
      `[SECTION CONTEXT — do not repeat this to the user]\n` +
      `You are ${agentName}, Lead Agent for the ${ctx.sectionName} section.\n` +
      `This chat is on the ${ctx.sectionName} dashboard. The user can see the metrics and insights on this page.\n\n` +
      `Current Dashboard Metrics:\n${metricLines}\n\n` +
      `Recent Insights:\n${insightLines}\n\n` +
      `Behave as the domain expert. Answer naturally — you have full context.\n\n---\nUser message: ${userText}`
    );
  }

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || !convoId || sending) return;

    setInput("");
    setSending(true);
    setError(null);

    const finalContent = (isFirstMsg && context)
      ? buildPrimer(context, text)
      : text;

    const tempId = `tmp-${Date.now()}`;
    // Show raw user text (not the primed version)
    setMessages((prev) => [...prev, {
      id: tempId, conversation_id: convoId,
      role: "user", content: text, created_at: new Date().toISOString(),
    }]);

    try {
      const r = await fetch(`${BOT_URL}/admin/chat/conversations/${convoId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: finalContent }),
        signal: AbortSignal.timeout(120_000),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Send failed");
      setIsFirstMsg(false);
      await fetchMessages(convoId);
    } catch (e: any) {
      const msg = e?.name === "TimeoutError" ? "Agent timed out — try again" : e.message;
      setError(msg);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  return {
    convoId, messages, input, sending, error, booting, isFirstMsg,
    messagesEndRef, scrollContainerRef, textareaRef,
    setError, handleSend, handleKeyDown, handleInputChange,
  };
}

// ── Shared input bar ──────────────────────────────────────────────────────────

function InputBar({
  agentName, agentColor, input, sending, showHint,
  handleSend, handleKeyDown, handleInputChange, textareaRef,
  compact = false,
}: {
  agentName: string;
  agentColor: string;
  input: string;
  sending: boolean;
  showHint: boolean;
  handleSend: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  compact?: boolean;
}) {
  const canSend = input.trim() && !sending;
  return (
    <div style={{
      padding: compact ? "0.625rem 0.875rem" : "0.875rem 1.25rem",
      borderTop: "1px solid rgba(255,255,255,0.06)",
      flexShrink: 0,
      background: "rgba(0,0,0,0.1)",
    }}>
      <div style={{
        display: "flex", gap: 8, alignItems: "flex-end",
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${canSend ? agentColor + "40" : "rgba(255,255,255,0.09)"}`,
        borderRadius: compact ? 10 : 12,
        padding: compact ? "6px 6px 6px 10px" : "7px 7px 7px 12px",
        transition: "border-color 0.2s",
      }}>
        <textarea
          ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${agentName}…`}
          disabled={sending}
          rows={1}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            color: "#f0f0f0", fontSize: compact ? 13 : 13.5,
            resize: "none", lineHeight: 1.5,
            maxHeight: 120, minHeight: compact ? 20 : 22,
            fontFamily: "inherit", padding: 0,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          style={{
            width: compact ? 28 : 32, height: compact ? 28 : 32,
            borderRadius: compact ? 7 : 9, border: "none",
            background: canSend
              ? `linear-gradient(135deg, ${agentColor}, ${agentColor}bb)`
              : "rgba(255,255,255,0.05)",
            color: canSend ? "#000" : "#444",
            cursor: canSend ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0, transition: "all 0.2s",
            boxShadow: canSend ? `0 2px 12px ${agentColor}40` : "none",
          }}
        >
          <Send size={compact ? 12 : 14} />
        </button>
      </div>
      {showHint && (
        <p style={{ color: "#444", fontSize: 10, margin: "5px 0 0 2px" }}>
          Enter to send · Shift+Enter for newline
        </p>
      )}
    </div>
  );
}

// ── Shared message area ───────────────────────────────────────────────────────

function MessageArea({
  messages, sending, agentColor, agentEmoji, agentName,
  messagesEndRef, scrollContainerRef,
  compact = false,
}: {
  messages: Message[];
  sending: boolean;
  agentColor: string;
  agentEmoji: string;
  agentName: string;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  compact?: boolean;
}) {
  return (
    <div
      ref={scrollContainerRef as React.RefObject<HTMLDivElement>}
      className="custom-scrollbar"
      style={{
        flex: 1,
        overflowY: "auto", overflowX: "hidden",
        padding: compact ? "0.75rem" : "1rem 1.25rem",
        minWidth: 0, minHeight: 0, // critical — lets flex child shrink
      }}
    >
      {messages.length === 0 && !sending ? (
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", height: "100%", opacity: 0.35, gap: 8,
        }}>
          <span style={{ fontSize: compact ? 28 : 36 }}>{agentEmoji}</span>
          <p style={{ color: "#ccc", fontSize: compact ? 11 : 12, margin: 0, textAlign: "center" }}>
            Message {agentName}
          </p>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              agentColor={agentColor}
              agentEmoji={agentEmoji}
              hideContextPrimer
            />
          ))}
        </AnimatePresence>
      )}

      {/* Typing indicator */}
      <AnimatePresence>
        {sending && (
          <motion.div
            key="typing"
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 8 }}
          >
            <div style={{
              width: compact ? 24 : 28, height: compact ? 24 : 28, borderRadius: "50%",
              background: `${agentColor}18`, border: `1px solid ${agentColor}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: compact ? 12 : 14,
            }}>
              {agentEmoji}
            </div>
            <div style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "16px 16px 16px 4px",
            }}>
              <TypingIndicator color={agentColor} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={messagesEndRef as React.RefObject<HTMLDivElement>} />
    </div>
  );
}

function ErrorBanner({ error, onDismiss }: { error: string; onDismiss: () => void }) {
  return (
    <AnimatePresence>
      <motion.div
        key="err"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{
          padding: "5px 1rem", display: "flex", alignItems: "center", gap: 6,
          background: "rgba(239,68,68,0.07)", borderTop: "1px solid rgba(239,68,68,0.18)",
          flexShrink: 0,
        }}
      >
        <AlertCircle size={12} color="#ef4444" />
        <p style={{ color: "#ef4444", fontSize: 11, margin: 0, flex: 1 }}>{error}</p>
        <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}>
          <X size={12} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

// ── ChatBox ───────────────────────────────────────────────────────────────────

export default function ChatBox({
  agentId, agentName, agentEmoji = "🤖", agentColor = "#38bdf8",
  mode, inlineHeight = 420, context, showChatLink = false,
  showHeader, showHint,
  conversationKey,
}: ChatBoxProps) {
  const [inlineOpen, setInlineOpen] = useState(false);

  // Resolve defaults by mode
  const resolvedShowHeader = showHeader ?? (mode === "fill");
  const resolvedShowHint   = showHint   ?? (mode === "fill");
  const compact            = mode === "inline";

  // The key passed into the conversation engine — use the sectionId from context or the explicit key
  const convoKey = conversationKey ?? context?.sectionId;

  const engine = useChatEngine(
    agentId, agentName, context, convoKey
  );

  // ── INLINE mode: collapsible panel ─────────────────────────────────────────
  if (mode === "inline") {
    return (
      <div style={{ marginTop: "2rem", borderTop: `1px solid ${agentColor}20` }}>
        {/* Toggle header */}
        <button
          onClick={() => setInlineOpen((o) => !o)}
          style={{
            width: "100%", background: "transparent", border: "none",
            cursor: "pointer", padding: "0.875rem 0",
            display: "flex", alignItems: "center", gap: "0.65rem",
          }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: `${agentColor}18`, border: `1px solid ${agentColor}35`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
          }}>
            {agentEmoji}
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: "0.85rem", color: "#e2e8f0" }}>
              Chat with {agentName}
            </p>
            {context && (
              <p style={{ margin: 0, fontSize: "10px", color: "#475569" }}>
                {context.sectionName} lead · knows this page&apos;s data
              </p>
            )}
          </div>
          <MessageSquare size={13} color={agentColor} />
          {inlineOpen
            ? <ChevronUp size={14} color="#475569" />
            : <ChevronDown size={14} color="#475569" />}
        </button>

        <AnimatePresence>
          {inlineOpen && (
            <motion.div
              key="inline-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: inlineHeight, opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              style={{
                // Critically: use defined height + hidden overflow so it never bleeds
                overflow: "hidden",
                borderRadius: 14,
                border: `1px solid ${agentColor}20`,
                background: "rgba(0,0,0,0.3)",
                // Use flex column so children size correctly inside the fixed height
                display: "flex",
                flexDirection: "column",
              }}
            >
              {engine.booting ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <TypingIndicator color={agentColor} />
                </div>
              ) : (
                <>
                  <MessageArea
                    messages={engine.messages}
                    sending={engine.sending}
                    agentColor={agentColor}
                    agentEmoji={agentEmoji}
                    agentName={agentName}
                    messagesEndRef={engine.messagesEndRef}
                    scrollContainerRef={engine.scrollContainerRef}
                    compact
                  />
                  {engine.error && <ErrorBanner error={engine.error} onDismiss={() => engine.setError(null)} />}
                  <InputBar
                    agentName={agentName}
                    agentColor={agentColor}
                    input={engine.input}
                    sending={engine.sending}
                    showHint={false}
                    handleSend={engine.handleSend}
                    handleKeyDown={engine.handleKeyDown}
                    handleInputChange={engine.handleInputChange}
                    textareaRef={engine.textareaRef}
                    compact
                  />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ── FILL mode: fills 100% of parent container ───────────────────────────────
  return (
    <div style={{
      // Takes all available space — parent MUST have a defined height/overflow
      display: "flex",
      flexDirection: "column",
      height: "100%",
      minHeight: 0, // allows flex shrink
      background: "rgba(0,0,0,0.25)",
      borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.07)",
      overflow: "hidden",
    }}>
      {/* Header */}
      {resolvedShowHeader && (
        <div style={{
          padding: "0.875rem 1.25rem",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 10,
          flexShrink: 0,
          background: "rgba(0,0,0,0.15)",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: `${agentColor}18`, border: `2px solid ${agentColor}40`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>
            {agentEmoji}
          </div>
          <div>
            {showChatLink && engine.convoId ? (
              <Link
                href={`/chats?conversation=${engine.convoId}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  color: "#fff", fontWeight: 800, fontSize: 14,
                  textDecoration: "none", transition: "color 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = agentColor; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
              >
                {agentName}
                <ExternalLink size={11} style={{ opacity: 0.5 }} />
              </Link>
            ) : (
              <p style={{ color: "#fff", fontWeight: 800, fontSize: 14, margin: 0 }}>{agentName}</p>
            )}
            <p style={{ color: "#555", fontSize: 11, margin: 0 }}>
              {engine.booting ? "Connecting…" : "Direct chat"}
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e80" }} />
            <span style={{ color: "#22c55e", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Live</span>
          </div>
        </div>
      )}

      {/* Body */}
      {engine.booting ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TypingIndicator color={agentColor} />
        </div>
      ) : (
        <>
          <MessageArea
            messages={engine.messages}
            sending={engine.sending}
            agentColor={agentColor}
            agentEmoji={agentEmoji}
            agentName={agentName}
            messagesEndRef={engine.messagesEndRef}
            scrollContainerRef={engine.scrollContainerRef}
          />
          {engine.error && <ErrorBanner error={engine.error} onDismiss={() => engine.setError(null)} />}
          <InputBar
            agentName={agentName}
            agentColor={agentColor}
            input={engine.input}
            sending={engine.sending}
            showHint={resolvedShowHint}
            handleSend={engine.handleSend}
            handleKeyDown={engine.handleKeyDown}
            handleInputChange={engine.handleInputChange}
            textareaRef={engine.textareaRef}
          />
        </>
      )}
    </div>
  );
}
