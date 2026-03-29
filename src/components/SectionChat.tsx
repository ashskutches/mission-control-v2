"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MarkdownMessage } from "./MarkdownMessage";
import { MessageSquare, Send, ChevronDown, ChevronUp, AlertCircle, X } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3001";

interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Metric {
  label: string;
  value: string;
  sub?: string | null;
}

interface Insight {
  id: string;
  type: string;
  title: string;
  estimated_monthly_value?: number | null;
  status: string;
}

interface SectionChatProps {
  sectionId: string;
  sectionName: string;
  agentId: string;
  agentName: string;
  agentEmoji?: string;
  agentColor?: string;
  metrics?: Metric[];
  insights?: Insight[];
}

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

/**
 * Builds a context primer injected into the first message so the agent
 * knows exactly who they are, what section they own, and what's on screen.
 */
function buildContextPrimer(
  sectionId: string, sectionName: string, agentName: string,
  metrics: Metric[], insights: Insight[],
): string {
  const metricLines = metrics.length > 0
    ? metrics.map(m => `  - ${m.label}: ${m.value}${m.sub ? ` (${m.sub})` : ""}`).join("\n")
    : "  (No metrics yet — run analysis to populate)";

  const insightLines = insights.slice(0, 6).length > 0
    ? insights.slice(0, 6).map(i =>
        `  - [${i.type.replace("_", " ").toUpperCase()}] "${i.title}"${i.estimated_monthly_value ? ` (+$${i.estimated_monthly_value.toLocaleString()}/mo)` : ""} [${i.status}]`
      ).join("\n")
    : "  (No insights yet)";

  return (
    `[SECTION CONTEXT — do not repeat this to the user]\n` +
    `You are ${agentName}, Lead Agent for the ${sectionName} section at Leaps & Rebounds.\n` +
    `This chat is embedded on the ${sectionName} dashboard. The user can see the ${sectionName} metrics and insights on this page.\n\n` +
    `Current ${sectionName} Dashboard Metrics:\n${metricLines}\n\n` +
    `Recent Insights you have filed (visible to user on this page):\n${insightLines}\n\n` +
    `Behave as the domain expert who owns this area of the business. You know why you filed those insights, ` +
    `what the data shows, and what you recommend. Answer questions naturally — you have full context.` +
    `\n\n---\nUser message: `
  );
}

export default function SectionChat({
  sectionId, sectionName, agentId, agentName,
  agentEmoji = "🤖", agentColor = "#38bdf8",
  metrics = [], insights = [],
}: SectionChatProps) {
  const [open, setOpen] = useState(false);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFirstMessage, setIsFirstMessage] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesRef = useRef<Message[]>([]);

  // Create or load conversation when chat opens
  useEffect(() => {
    if (!open || !agentId || convoId) return;
    (async () => {
      try {
        // Look for an existing section-specific conversation
        const r = await fetch(`${BOT_URL}/admin/chat/conversations?agent_id=${agentId}`);
        const convos = await r.json();
        const sectionConvo = Array.isArray(convos)
          ? convos.find((c: any) => c.title?.includes(`[${sectionId}]`))
          : null;

        let cid: string;
        if (sectionConvo) {
          cid = sectionConvo.id;
          setIsFirstMessage(false); // existing convo — agent already has context
        } else {
          const cr = await fetch(`${BOT_URL}/admin/chat/conversations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agent_id: agentId,
              title: `[${sectionId}] ${sectionName} Dashboard Chat`,
            }),
          });
          const convo = await cr.json();
          cid = convo.id;
          setIsFirstMessage(true);
        }
        setConvoId(cid);
      } catch (e: any) {
        setError(`Could not open chat: ${e.message}`);
      }
    })();
  }, [open, agentId, convoId, sectionId, sectionName]);

  const fetchMessages = useCallback(async (cid: string) => {
    try {
      const r = await fetch(`${BOT_URL}/admin/chat/conversations/${cid}/messages`);
      const data: Message[] = await r.json();
      const incoming = Array.isArray(data) ? data : [];
      const lastNew = incoming[incoming.length - 1]?.id;
      const lastCur = messagesRef.current[messagesRef.current.length - 1]?.id;
      if (lastNew !== lastCur || incoming.length !== messagesRef.current.length) {
        messagesRef.current = incoming;
        setMessages(incoming);
      }
    } catch { /* silent */ }
  }, []);

  // Start polling when we have a conversation
  useEffect(() => {
    if (!convoId) return;
    fetchMessages(convoId);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (!sending) fetchMessages(convoId);
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [convoId, fetchMessages, sending]);


  const handleSend = async () => {
    const text = input.trim();
    if (!text || !convoId || sending) return;
    setInput("");
    setSending(true);
    setError(null);

    // On the first message in a new section chat, prepend the context primer
    const finalContent = isFirstMessage
      ? buildContextPrimer(sectionId, sectionName, agentName, metrics, insights) + text
      : text;

    // Optimistic bubble — always show the raw user text, not the primed version
    const tempId = `tmp-${Date.now()}`;
    setMessages(prev => [...prev, {
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
      setIsFirstMessage(false);
      await fetchMessages(convoId);
    } catch (e: any) {
      const msg = e?.name === "TimeoutError" ? "Agent timed out — try again" : e.message;
      setError(msg);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const displayMessages = messages.filter(m => {
    // Hide the context primer from the message history
    if (m.role === "user" && m.content.startsWith("[SECTION CONTEXT")) return false;
    return true;
  });

  return (
    <div style={{ marginTop: "2rem", borderTop: `1px solid ${agentColor}20` }}>
      {/* Toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", background: "transparent", border: "none", cursor: "pointer",
          padding: "0.875rem 0", display: "flex", alignItems: "center", gap: "0.65rem",
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
          <p style={{ margin: 0, fontSize: "10px", color: "#475569" }}>
            {sectionName} lead · knows this page's data
          </p>
        </div>
        <MessageSquare size={13} color={agentColor} />
        {open
          ? <ChevronUp size={14} color="#475569" />
          : <ChevronDown size={14} color="#475569" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 420, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            style={{
              overflow: "hidden", borderRadius: 14, border: `1px solid ${agentColor}20`,
              background: "rgba(0,0,0,0.3)", display: "flex", flexDirection: "column",
            }}
          >
            {/* Messages */}
            <div
              style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "1rem", minWidth: 0 }}
              className="custom-scrollbar"
            >
              {displayMessages.length === 0 && !sending ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.4, gap: 6 }}>
                  <span style={{ fontSize: 32 }}>{agentEmoji}</span>
                  <p style={{ color: "#ccc", fontSize: "12px", margin: 0, textAlign: "center" }}>
                    Ask {agentName} about the {sectionName} data on this page.
                  </p>
                  <p style={{ color: "#475569", fontSize: "10px", margin: 0, textAlign: "center" }}>
                    They have full context about the metrics and insights above.
                  </p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {displayMessages.map(msg => {
                    const isUser = msg.role === "user";
                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
                        style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: 7, alignItems: "flex-end", marginBottom: 10 }}
                      >
                        {!isUser && (
                          <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${agentColor}18`, border: `1px solid ${agentColor}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 12 }}>
                            {agentEmoji}
                          </div>
                        )}
                        <div style={{
                          maxWidth: "78%", minWidth: 0, padding: "8px 12px",
                          borderRadius: isUser ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                          background: isUser ? `linear-gradient(135deg, ${agentColor}28, ${agentColor}18)` : "rgba(255,255,255,0.05)",
                          border: isUser ? `1px solid ${agentColor}30` : "1px solid rgba(255,255,255,0.07)",
                          color: "#eee", fontSize: "0.82rem", lineHeight: 1.55,
                          wordBreak: "break-word", overflowWrap: "anywhere",
                          whiteSpace: isUser ? "pre-wrap" : undefined,
                        }}>
                          {isUser ? msg.content : <MarkdownMessage content={msg.content} />}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}

              {/* Typing indicator */}
              <AnimatePresence>
                {sending && (
                  <motion.div
                    key="typing" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ display: "flex", alignItems: "flex-end", gap: 7, marginBottom: 8 }}
                  >
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${agentColor}18`, border: `1px solid ${agentColor}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                      {agentEmoji}
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "14px 14px 14px 4px" }}>
                      <TypingIndicator color={agentColor} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ padding: "5px 1rem", display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.07)", borderTop: "1px solid rgba(239,68,68,0.15)", flexShrink: 0 }}>
                  <AlertCircle size={11} color="#ef4444" />
                  <p style={{ color: "#ef4444", fontSize: "11px", margin: 0, flex: 1 }}>{error}</p>
                  <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><X size={11} /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <div style={{ padding: "0.75rem 1rem", borderTop: `1px solid ${agentColor}15`, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "rgba(255,255,255,0.04)", border: `1px solid ${agentColor}20`, borderRadius: 11, padding: "6px 6px 6px 11px" }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px";
                  }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={`Ask ${agentName} about ${sectionName}…`}
                  disabled={sending}
                  rows={1}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    color: "#f0f0f0", fontSize: "0.82rem", resize: "none", lineHeight: 1.5,
                    maxHeight: 100, minHeight: 20, fontFamily: "inherit", padding: 0,
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  aria-label="Send"
                  style={{
                    width: 30, height: 30, borderRadius: 8, border: "none",
                    background: input.trim() && !sending ? `linear-gradient(135deg, ${agentColor}, ${agentColor}cc)` : "rgba(255,255,255,0.06)",
                    color: input.trim() && !sending ? "#000" : "#444",
                    cursor: input.trim() && !sending ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, transition: "all 0.2s",
                  }}
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
