"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Plus,
  Send,
  Trash2,
  X,
  Bot,
  ChevronRight,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "http://localhost:3000";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Agent {
  id: string;
  name: string;
  emoji?: string;
  specialization?: string;
}

interface Conversation {
  id: string;
  agent_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getAgentColor(agentId: string, agents: Agent[]) {
  const palette = ["#22c55e", "#38bdf8", "#a855f7", "#ff8c00", "#f43f5e", "#06b6d4", "#f59e0b"];
  const idx = agents.findIndex((a) => a.id === agentId);
  return palette[idx % palette.length] ?? "#22c55e";
}

// ── Typing indicator ───────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "10px 14px", width: "fit-content" }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.35)", display: "block" }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

// ── New Chat Modal ──────────────────────────────────────────────────────────────
function NewChatModal({
  agents,
  onSelect,
  onClose,
}: {
  agents: Agent[];
  onSelect: (agent: Agent) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.specialization?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9000,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxHeight: "80vh",
          background: "rgba(10,10,12,0.95)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ color: "#fff", fontWeight: 800, fontSize: 16, margin: 0 }}>Start a New Chat</p>
            <p style={{ color: "#666", fontSize: 12, margin: 0, marginTop: 2 }}>Pick an agent to talk to</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#888", cursor: "pointer", padding: "6px 8px", display: "flex", alignItems: "center" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "0.75rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents…"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10,
              color: "#fff",
              fontSize: 14,
              padding: "8px 12px",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Agent List */}
        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#555" }}>
              <Bot size={28} style={{ opacity: 0.3, margin: "0 auto 8px" }} />
              <p style={{ margin: 0, fontSize: 13 }}>No agents found</p>
            </div>
          ) : (
            filtered.map((agent) => (
              <button
                key={agent.id}
                onClick={() => onSelect(agent)}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.875rem 1.5rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  textAlign: "left",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontSize: 28, flexShrink: 0 }}>{agent.emoji ?? "🤖"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "#fff", fontWeight: 700, fontSize: 14, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agent.name}</p>
                  {agent.specialization && (
                    <p style={{ color: "#666", fontSize: 12, margin: 0, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{agent.specialization}</p>
                  )}
                </div>
                <ChevronRight size={16} color="#444" />
              </button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Message Bubble ──────────────────────────────────────────────────────────────
function MessageBubble({ msg, agentColor, agentEmoji }: { msg: Message; agentColor: string; agentEmoji: string }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 8,
        marginBottom: 16,
      }}
    >
      {/* Avatar */}
      {!isUser && (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${agentColor}18`, border: `1px solid ${agentColor}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>
          {agentEmoji}
        </div>
      )}

      <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isUser ? "flex-end" : "flex-start", gap: 4 }}>
        <div
          style={{
            padding: "10px 14px",
            borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            background: isUser
              ? "linear-gradient(135deg, rgba(255,140,0,0.25), rgba(255,140,0,0.15))"
              : "rgba(255,255,255,0.05)",
            border: isUser ? "1px solid rgba(255,140,0,0.25)" : "1px solid rgba(255,255,255,0.07)",
            color: "#f0f0f0",
            fontSize: 14,
            lineHeight: 1.6,
            wordBreak: "break-word",
            whiteSpace: "pre-wrap",
          }}
        >
          {msg.content}
        </div>
        <span style={{ fontSize: 10, color: "#444", paddingInline: 4 }}>{formatTime(msg.created_at)}</span>
      </div>

      {isUser && (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,140,0,0.12)", border: "1px solid rgba(255,140,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--accent-orange)", fontSize: 14, fontWeight: 800 }}>
          Y
        </div>
      )}
    </motion.div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────
export default function AgentChat() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch list of agents ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const r = await fetch(`${BOT_URL}/admin/agents`);
        const data = await r.json();
        setAgents(Array.isArray(data) ? data : []);
      } catch {
        setAgents([]);
      }
    };
    fetchAgents();
  }, []);

  // ── Fetch conversations ───────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const r = await fetch(`${BOT_URL}/admin/chat/conversations`);
      const data = await r.json();
      setConversations(Array.isArray(data) ? data : []);
    } catch {
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // ── Fetch messages when conversation changes ──────────────────────────────
  const fetchMessages = useCallback(async (convoId: string) => {
    setLoadingMsgs(true);
    try {
      const r = await fetch(`${BOT_URL}/admin/chat/conversations/${convoId}/messages`);
      const data = await r.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (!activeConvoId) return;
    fetchMessages(activeConvoId);

    // Poll for new messages every 5 seconds (agent replies may take a moment)
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      if (!sending) fetchMessages(activeConvoId);
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeConvoId, fetchMessages, sending]);

  // ── Auto scroll to bottom ─────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // ── Start a new conversation ──────────────────────────────────────────────
  const handleNewConvo = async (agent: Agent) => {
    setShowNewChat(false);
    setError(null);
    try {
      const r = await fetch(`${BOT_URL}/admin/chat/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agent.id, title: `Chat with ${agent.name}` }),
      });
      if (!r.ok) throw new Error("Failed to create conversation");
      const convo: Conversation = await r.json();
      setConversations((prev) => [convo, ...prev]);
      setActiveConvoId(convo.id);
      setMessages([]);
    } catch (e: any) {
      setError(e.message ?? "Could not start conversation");
    }
  };

  // ── Send a message ────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activeConvoId || sending) return;

    setInput("");
    setSending(true);
    setError(null);

    // Optimistic user bubble
    const tempUserMsg: Message = {
      id: `temp-user-${Date.now()}`,
      conversation_id: activeConvoId,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const r = await fetch(`${BOT_URL}/admin/chat/conversations/${activeConvoId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Failed to send");
      }

      const { assistant } = await r.json();

      // Replace optimistic + add real assistant message
      await fetchMessages(activeConvoId);

      // Bubble conversation to top
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvoId ? { ...c, updated_at: new Date().toISOString() } : c))
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      );
    } catch (e: any) {
      setError(e.message ?? "Failed to send message");
      // Remove the optimistic bubble on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  // ── Delete conversation ───────────────────────────────────────────────────
  const handleDelete = async (convoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this conversation?")) return;
    try {
      await fetch(`${BOT_URL}/admin/chat/conversations/${convoId}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== convoId));
      if (activeConvoId === convoId) {
        setActiveConvoId(null);
        setMessages([]);
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to delete");
    }
  };

  // ── Derived helpers ───────────────────────────────────────────────────────
  const activeConvo = conversations.find((c) => c.id === activeConvoId);
  const activeAgent = activeConvo ? agents.find((a) => a.id === activeConvo.agent_id) : null;
  const agentColor = activeConvo ? getAgentColor(activeConvo.agent_id, agents) : "#22c55e";

  return (
    <div style={{ display: "flex", height: "calc(100vh - 180px)", gap: 0, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(10,10,12,0.6)" }}>

      {/* ── Conversation List (Left Panel) ────────────────────────────────── */}
      <div style={{ width: 300, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.3)" }}>

        {/* Header */}
        <div style={{ padding: "1.25rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <MessageSquare size={18} color="#22c55e" />
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.08em" }}>Chats</span>
          </div>
          <button
            id="new-chat-btn"
            onClick={() => setShowNewChat(true)}
            title="New Chat"
            style={{
              background: "rgba(34,197,94,0.1)",
              border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: 8,
              color: "#22c55e",
              cursor: "pointer",
              padding: "5px 7px",
              display: "flex",
              alignItems: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(34,197,94,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(34,197,94,0.1)"; }}
          >
            <Plus size={16} />
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {conversations.length === 0 ? (
            <div style={{ padding: "2rem 1rem", textAlign: "center" }}>
              <MessageSquare size={32} style={{ opacity: 0.15, marginBottom: 8, display: "block", margin: "0 auto 10px" }} />
              <p style={{ color: "#555", fontSize: 12, margin: 0 }}>No conversations yet</p>
              <button
                onClick={() => setShowNewChat(true)}
                style={{ marginTop: 12, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 8, color: "#22c55e", cursor: "pointer", padding: "6px 14px", fontSize: 12, fontWeight: 700 }}
              >
                Start one
              </button>
            </div>
          ) : (
            conversations.map((convo) => {
              const agent = agents.find((a) => a.id === convo.agent_id);
              const color = getAgentColor(convo.agent_id, agents);
              const isActive = convo.id === activeConvoId;
              return (
                <div
                  key={convo.id}
                  onClick={() => setActiveConvoId(convo.id)}
                  style={{
                    padding: "0.75rem 1rem",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    cursor: "pointer",
                    background: isActive ? `${color}12` : "transparent",
                    borderLeft: isActive ? `2px solid ${color}` : "2px solid transparent",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    transition: "background 0.15s",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{agent?.emoji ?? "🤖"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: isActive ? color : "#ccc", fontWeight: 700, fontSize: 13, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {convo.title ?? `Chat with ${agent?.name ?? convo.agent_id}`}
                    </p>
                    <p style={{ color: "#555", fontSize: 11, margin: 0, marginTop: 2 }}>{formatTime(convo.updated_at)}</p>
                  </div>
                  <button
                    id={`delete-convo-${convo.id}`}
                    onClick={(e) => handleDelete(convo.id, e)}
                    aria-label="Delete conversation"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#444", padding: 4, borderRadius: 4, display: "flex", transition: "color 0.15s", flexShrink: 0 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#ef4444"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#444"; }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Chat Window (Right Panel) ─────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {activeConvoId && activeConvo ? (
          <>
            {/* Agent Header */}
            <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 12, background: "rgba(0,0,0,0.2)", flexShrink: 0 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${agentColor}18`, border: `2px solid ${agentColor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                {activeAgent?.emoji ?? "🤖"}
              </div>
              <div>
                <Link
                  href={`/agents/${activeConvo.agent_id}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#fff", fontWeight: 800, fontSize: 15, textDecoration: "none", transition: "color 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = agentColor; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#fff"; }}
                >
                  {activeAgent?.name ?? activeConvo.agent_id}
                  <ExternalLink size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
                </Link>
                <p style={{ color: "#555", fontSize: 12, margin: 0, marginTop: 1 }}>{activeAgent?.specialization ?? "AI Agent"}</p>
              </div>
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e80", display: "inline-block" }} />
                <span style={{ color: "#22c55e", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Online</span>
              </div>
            </div>

            {/* Messages */}
            <div
              id="chat-messages-area"
              style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column" }}
              className="custom-scrollbar"
            >
              {loadingMsgs ? (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: "3rem", color: "#555" }}>
                  <TypingIndicator />
                </div>
              ) : messages.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.4 }}>
                  <span style={{ fontSize: 48 }}>{activeAgent?.emoji ?? "🤖"}</span>
                  <p style={{ color: "#ccc", fontWeight: 700, fontSize: 15, marginTop: 12, marginBottom: 4 }}>Say hello to {activeAgent?.name ?? "your agent"}</p>
                  <p style={{ color: "#555", fontSize: 13 }}>Type a message below to start chatting</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      msg={msg}
                      agentColor={agentColor}
                      agentEmoji={activeAgent?.emoji ?? "🤖"}
                    />
                  ))}
                </AnimatePresence>
              )}

              {/* Thinking indicator */}
              <AnimatePresence>
                {sending && (
                  <motion.div
                    key="thinking"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 8 }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${agentColor}18`, border: `1px solid ${agentColor}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>
                      {activeAgent?.emoji ?? "🤖"}
                    </div>
                    <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "18px 18px 18px 4px", overflow: "hidden" }}>
                      <TypingIndicator />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>

            {/* Error Banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{ padding: "0.625rem 1.5rem", display: "flex", alignItems: "center", gap: 8, background: "rgba(239,68,68,0.08)", borderTop: "1px solid rgba(239,68,68,0.2)" }}
                >
                  <AlertCircle size={14} color="#ef4444" />
                  <p style={{ color: "#ef4444", fontSize: 12, margin: 0, flex: 1 }}>{error}</p>
                  <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 2 }}><X size={13} /></button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Bar */}
            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 14, padding: "8px 8px 8px 14px", transition: "border-color 0.15s" }}>
                <textarea
                  id="chat-input"
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Message ${activeAgent?.name ?? "agent"}…`}
                  disabled={sending}
                  rows={1}
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#f0f0f0",
                    fontSize: 14,
                    resize: "none",
                    lineHeight: 1.5,
                    maxHeight: 140,
                    minHeight: 24,
                    fontFamily: "inherit",
                    padding: 0,
                  }}
                />
                <button
                  id="chat-send-btn"
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  aria-label="Send message"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    border: "none",
                    cursor: input.trim() && !sending ? "pointer" : "default",
                    background: input.trim() && !sending ? `linear-gradient(135deg, ${agentColor}, ${agentColor}bb)` : "rgba(255,255,255,0.06)",
                    color: input.trim() && !sending ? "#000" : "#444",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "all 0.2s",
                    boxShadow: input.trim() && !sending ? `0 4px 16px ${agentColor}40` : "none",
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
              <p style={{ color: "#444", fontSize: 11, margin: "6px 0 0 2px" }}>
                Enter to send · Shift+Enter for new line
              </p>
            </div>
          </>
        ) : (
          /* Empty state */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, opacity: 0.5 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquare size={32} color="#22c55e" />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#ccc", fontWeight: 800, fontSize: 18, margin: 0 }}>Your AI Inbox</p>
              <p style={{ color: "#555", fontSize: 14, margin: "6px 0 0" }}>Select a conversation or start a new one</p>
            </div>
            <button
              onClick={() => setShowNewChat(true)}
              style={{
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.25)",
                borderRadius: 10,
                color: "#22c55e",
                cursor: "pointer",
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(34,197,94,0.18)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(34,197,94,0.1)"; }}
            >
              <Plus size={16} />
              New Chat
            </button>
          </div>
        )}
      </div>

      {/* ── New Chat Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showNewChat && (
          <NewChatModal
            agents={agents}
            onSelect={handleNewConvo}
            onClose={() => setShowNewChat(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
