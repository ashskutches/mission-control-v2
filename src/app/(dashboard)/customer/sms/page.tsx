"use client";
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Phone, MessageSquare, CheckCircle2, AlertCircle, Loader2, RotateCcw } from "lucide-react";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

interface SendResult {
  sid:    string;
  status: string;
  to:     string;
  from:   string;
}

const PRESET_MESSAGES = [
  {
    label: "Backorder Follow-Up",
    body:  "Hi! Your recent order is currently on backorder. Would you like to switch to a different variant, or are you happy to keep waiting? Reply here and we'll help! 😊",
  },
  {
    label: "Stock Update",
    body:  "Great news! Your backordered item is now back in stock. Reply YES to confirm your current order, or let us know if you'd like to make any changes.",
  },
  {
    label: "Cancellation Offer",
    body:  "Hi! We wanted to check in on your backordered order. Would you like to: (A) Keep waiting, (B) Switch variants, or (C) Cancel for a full refund. Just reply with A, B, or C!",
  },
];

export default function SmsTestPage() {
  const [to,      setTo]      = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState<SendResult | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [history, setHistory] = useState<Array<{ to: string; message: string; result: SendResult; at: Date }>>([]);

  const handleSend = async () => {
    if (!to.trim() || !message.trim()) return;
    setSending(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${BOT_URL}/admin/customer/sms/test`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ to: to.trim(), message: message.trim() }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);

      setResult(json as SendResult);
      setHistory(prev => [{ to: to.trim(), message: message.trim(), result: json, at: new Date() }, ...prev.slice(0, 9)]);
    } catch (err: any) {
      setError(err.message ?? "Unknown error");
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setTo("");
    setMessage("");
    setResult(null);
    setError(null);
  };

  const charCount   = message.length;
  const smsSegments = Math.ceil(charCount / 160) || 1;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem", alignItems: "flex-start" }}>

      {/* Left: Composer */}
      <div>
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "1.5rem", marginBottom: "1rem",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem" }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <MessageSquare size={16} color="#a78bfa" />
            </div>
            <div>
              <h2 style={{ fontWeight: 800, fontSize: 15, color: "#f1f5f9", margin: 0 }}>SMS Composer</h2>
              <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Send a real Twilio message to any number</p>
            </div>
          </div>

          {/* Phone input */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "0.4rem" }}>
              Recipient Phone Number
            </label>
            <div style={{ position: "relative" }}>
              <Phone size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
              <input
                id="sms-test-phone"
                type="tel"
                placeholder="4848372899 or +14848372899"
                value={to}
                onChange={e => setTo(e.target.value)}
                style={{
                  width: "100%", padding: "0.6rem 0.9rem 0.6rem 2.25rem",
                  borderRadius: 8, background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0",
                  fontSize: 14, fontFamily: "inherit", boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>
            <p style={{ fontSize: 11, color: "#475569", marginTop: "0.25rem" }}>
              US: enter 10 digits (<code style={{color:"#94a3b8"}}>4848372899</code>) or full E.164 (<code style={{color:"#94a3b8"}}>+14848372899</code>). Do <strong>not</strong> use <code style={{color:"#f87171"}}>+4848372899</code> — that routes to Poland 🇵🇱
            </p>
          </div>

          {/* Message input */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Message
              </label>
              <span style={{ fontSize: 10, color: charCount > 320 ? "#f87171" : "#475569", fontWeight: 700 }}>
                {charCount} chars · {smsSegments} segment{smsSegments !== 1 ? "s" : ""}
              </span>
            </div>
            <textarea
              id="sms-test-message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              placeholder="Type your message here…"
              style={{
                width: "100%", borderRadius: 8, padding: "0.7rem 0.9rem",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#e2e8f0", fontSize: 14, resize: "vertical",
                fontFamily: "inherit", lineHeight: 1.6, boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {/* Send button */}
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              id="sms-test-send"
              onClick={handleSend}
              disabled={sending || !to.trim() || !message.trim()}
              style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                padding: "0.7rem 1.5rem", borderRadius: 10, cursor: sending || !to.trim() || !message.trim() ? "not-allowed" : "pointer",
                background: sending || !to.trim() || !message.trim()
                  ? "rgba(255,255,255,0.05)"
                  : "linear-gradient(135deg, rgba(167,139,250,0.3), rgba(6,182,212,0.2))",
                border: "1px solid rgba(167,139,250,0.3)",
                color: sending || !to.trim() || !message.trim() ? "#475569" : "#a78bfa",
                fontSize: 14, fontWeight: 800, transition: "all 0.2s",
                opacity: sending ? 0.8 : 1,
              }}
            >
              {sending ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} />}
              {sending ? "Sending via Twilio…" : "Send SMS"}
            </button>
            {(to || message || result || error) && (
              <button
                onClick={handleReset}
                style={{
                  padding: "0.7rem 1rem", borderRadius: 10, cursor: "pointer",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                  color: "#64748b", display: "flex", alignItems: "center", gap: "0.35rem",
                  fontSize: 12, fontWeight: 700, transition: "all 0.15s",
                }}
              >
                <RotateCcw size={13} />
                Clear
              </button>
            )}
          </div>

          {/* Result / error */}
          <AnimatePresence>
            {result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  marginTop: "1rem", padding: "0.85rem 1rem", borderRadius: 10,
                  background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.25)",
                  color: "#06b6d4",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 800, fontSize: 13, marginBottom: "0.4rem" }}>
                  <CheckCircle2 size={15} />
                  Message sent successfully
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.7 }}>
                  <div><span style={{ color: "#64748b" }}>SID:</span> <code style={{ color: "#a78bfa", fontSize: 10 }}>{result.sid}</code></div>
                  <div><span style={{ color: "#64748b" }}>Status:</span> {result.status}</div>
                  <div><span style={{ color: "#64748b" }}>To:</span> {result.to}</div>
                  <div><span style={{ color: "#64748b" }}>From:</span> {result.from}</div>
                </div>
              </motion.div>
            )}
            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                style={{
                  marginTop: "1rem", padding: "0.85rem 1rem", borderRadius: 10,
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
                  color: "#f87171", display: "flex", alignItems: "flex-start", gap: "0.5rem",
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13, marginBottom: "0.25rem" }}>Send failed</div>
                  <div style={{ fontSize: 12 }}>{error}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right: Presets + History */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* Preset messages */}
        <div style={{
          background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "1.25rem",
        }}>
          <h3 style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.85rem" }}>
            Template Presets
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {PRESET_MESSAGES.map((preset, i) => (
              <button
                key={i}
                onClick={() => setMessage(preset.body)}
                style={{
                  textAlign: "left", padding: "0.65rem 0.85rem", borderRadius: 8, cursor: "pointer",
                  background: message === preset.body ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.03)",
                  border: `1px solid ${message === preset.body ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.06)"}`,
                  color: message === preset.body ? "#a78bfa" : "#94a3b8",
                  transition: "all 0.15s",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.25rem" }}>
                  {preset.label}
                </div>
                <div style={{ fontSize: 11, lineHeight: 1.5, color: "#64748b", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                  {preset.body}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Send history */}
        {history.length > 0 && (
          <div style={{
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 14, padding: "1.25rem",
          }}>
            <h3 style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 0.85rem" }}>
              Recent Sends
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  padding: "0.6rem 0.85rem", borderRadius: 8,
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4" }}>{h.result.to}</span>
                    <span style={{ fontSize: 10, color: "#475569" }}>{h.at.toLocaleTimeString()}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                    {h.message}
                  </div>
                  <div style={{ fontSize: 10, color: "#475569", marginTop: "0.2rem" }}>
                    SID: {h.result.sid.slice(0, 20)}…
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info box */}
        <div style={{
          padding: "0.85rem 1rem", borderRadius: 10,
          background: "rgba(251,146,60,0.05)", border: "1px solid rgba(251,146,60,0.15)",
          fontSize: 11, color: "#94a3b8", lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 800, color: "#fb923c", marginBottom: "0.25rem", textTransform: "uppercase", fontSize: 10, letterSpacing: "0.08em" }}>
            ⚠ Live Twilio
          </div>
          This tab sends <strong>real SMS messages</strong> via Twilio. Use only for testing with your own number or team numbers.
          The Backorders tab is mocked and safe to click freely.
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:focus, textarea:focus { border-color: rgba(167,139,250,0.4) !important; box-shadow: 0 0 0 3px rgba(167,139,250,0.08); }
      `}</style>
    </div>
  );
}
