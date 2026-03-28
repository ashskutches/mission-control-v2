"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { MarkdownMessage } from "./MarkdownMessage";
import { motion, AnimatePresence } from "framer-motion";
import { Send, AlertCircle, X } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  agent_id: string;
  title: string | null;
  updated_at: string;
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "10px 14px", width: "fit-content" }}>
      {[0, 1, 2].map((i) => (
        <motion.span key={i}
          style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.3)", display: "block" }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

interface Props {
  agentId: string;
  agentName: string;
  agentEmoji?: string;
  agentColor?: string;
}

export function AgentDetailChat({ agentId, agentName, agentEmoji = "🤖", agentColor = "#22c55e" }: Props) {
  const [convoId, setConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booting, setBooting] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgCountRef = useRef<number>(0);
  const messagesRef = useRef<Message[]>([]);

  const isNearBottom = () => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  };
  const scrollToBottom = (force = false) => {
    if (force || isNearBottom()) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // On mount: find or create a conversation for this agent
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BOT_URL}/admin/chat/conversations?agent_id=${agentId}`);
        const convos: Conversation[] = await r.json();
        let cid: string;
        if (convos.length > 0) {
          cid = convos[0]!.id;
        } else {
          const cr = await fetch(`${BOT_URL}/admin/chat/conversations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agent_id: agentId, title: `Chat with ${agentName}` }),
          });
          const convo: Conversation = await cr.json();
          cid = convo.id;
        }
        setConvoId(cid);
      } catch (e: any) {
        setError(`Could not open chat: ${e.message}`);
      } finally {
        setBooting(false);
      }
    })();
  }, [agentId, agentName]);

  const fetchMessages = useCallback(async (cid: string, silent = false) => {
    try {
      const r = await fetch(`${BOT_URL}/admin/chat/conversations/${cid}/messages`);
      const data: Message[] = await r.json();
      const incoming = Array.isArray(data) ? data : [];
      const current = messagesRef.current;
      const lastIncomingId = incoming[incoming.length - 1]?.id;
      const lastCurrentId = current[current.length - 1]?.id;
      if (lastIncomingId !== lastCurrentId || incoming.length !== current.length) {
        messagesRef.current = incoming;
        setMessages(incoming);
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    if (!convoId) return;
    messagesRef.current = [];
    fetchMessages(convoId);
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => { if (!sending) fetchMessages(convoId, true); }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [convoId, fetchMessages, sending]);

  useEffect(() => {
    const newCount = messages.length;
    const hadNew = newCount > msgCountRef.current;
    msgCountRef.current = newCount;
    scrollToBottom(hadNew);
  }, [messages]);
  useEffect(() => { if (sending) scrollToBottom(true); }, [sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !convoId || sending) return;
    setInput("");
    setSending(true);
    setError(null);

    const tempId = `tmp-${Date.now()}`;
    setMessages(prev => [...prev, { id: tempId, conversation_id: convoId, role: "user", content: text, created_at: new Date().toISOString() }]);

    try {
      const r = await fetch(`${BOT_URL}/admin/chat/conversations/${convoId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(e.error ?? "Send failed");
      }
      await fetchMessages(convoId);
    } catch (e: any) {
      setError(e.message);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  if (booting) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 13 }}>
      <TypingIndicator />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "rgba(0,0,0,0.25)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden", minWidth: 0 }}>
      {/* Header */}
      <div style={{ padding: "0.875rem 1.25rem", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${agentColor}18`, border: `2px solid ${agentColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
          {agentEmoji}
        </div>
        <div>
          <p style={{ color: "#fff", fontWeight: 800, fontSize: 14, margin: 0 }}>{agentName}</p>
          <p style={{ color: "#555", fontSize: 11, margin: 0 }}>Direct chat</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e80" }} />
          <span style={{ color: "#22c55e", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Live</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "1rem 1.25rem", minWidth: 0 }} className="custom-scrollbar">
        {messages.length === 0 && !sending ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.35, gap: 8 }}>
            <span style={{ fontSize: 40 }}>{agentEmoji}</span>
            <p style={{ color: "#ccc", fontWeight: 700, fontSize: 13, margin: 0 }}>Say hello to {agentName}</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map(msg => {
              const isUser = msg.role === "user";
              return (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
                  style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: 8, alignItems: "flex-end", marginBottom: 12 }}>
                  {!isUser && (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${agentColor}18`, border: `1px solid ${agentColor}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>
                      {agentEmoji}
                    </div>
                  )}
                  <div style={{
                    maxWidth: "75%", minWidth: 0, padding: "9px 13px", borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: isUser ? "linear-gradient(135deg, rgba(255,140,0,0.22), rgba(255,140,0,0.14))" : "rgba(255,255,255,0.05)",
                    border: isUser ? "1px solid rgba(255,140,0,0.22)" : "1px solid rgba(255,255,255,0.07)",
                    color: "#eee", fontSize: 13, lineHeight: 1.6, wordBreak: "break-word", overflowWrap: "anywhere",
                    whiteSpace: isUser ? "pre-wrap" : undefined,
                  }}>
                    {isUser ? msg.content : <MarkdownMessage content={msg.content} />}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        <AnimatePresence>
          {sending && (
            <motion.div key="typing" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${agentColor}18`, border: `1px solid ${agentColor}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                {agentEmoji}
              </div>
              <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px 16px 16px 4px" }}>
                <TypingIndicator />
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
            style={{ padding: "6px 1.25rem", display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.07)", borderTop: "1px solid rgba(239,68,68,0.18)" }}>
            <AlertCircle size={12} color="#ef4444" />
            <p style={{ color: "#ef4444", fontSize: 11, margin: 0, flex: 1 }}>{error}</p>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444" }}><X size={12} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div style={{ padding: "0.875rem 1.25rem", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 12, padding: "7px 7px 7px 12px" }}>
          <textarea id="agent-detail-chat-input" ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Message ${agentName}…`}
            disabled={sending}
            rows={1}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#f0f0f0", fontSize: 13, resize: "none", lineHeight: 1.5, maxHeight: 120, minHeight: 22, fontFamily: "inherit", padding: 0 }}
          />
          <button id="agent-detail-send-btn" onClick={handleSend} disabled={!input.trim() || sending} aria-label="Send"
            style={{
              width: 32, height: 32, borderRadius: 9, border: "none",
              background: input.trim() && !sending ? `linear-gradient(135deg, ${agentColor}, ${agentColor}bb)` : "rgba(255,255,255,0.05)",
              color: input.trim() && !sending ? "#000" : "#444",
              cursor: input.trim() && !sending ? "pointer" : "default",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s",
            }}>
            <Send size={14} />
          </button>
        </div>
        <p style={{ color: "#444", fontSize: 10, margin: "5px 0 0 2px" }}>Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}
