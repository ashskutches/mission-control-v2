"use client";

import { useState, useEffect, useCallback } from "react";

interface FormField {
  name: string;
  label: string;
  type: string;
  placeholder: string;
  required: boolean;
}

const FIELD_CONFIGS: Record<string, FormField> = {
  email: {
    name: "email",
    label: "Email Address",
    type: "email",
    placeholder: "you@example.com",
    required: true,
  },
  phone: {
    name: "phone",
    label: "Phone Number",
    type: "tel",
    placeholder: "+1 (555) 000-0000",
    required: true,
  },
  address: {
    name: "address",
    label: "Mailing Address",
    type: "text",
    placeholder: "123 Main St, City, State, ZIP",
    required: true,
  },
  payment: {
    name: "payment",
    label: "Card Number",
    type: "text",
    placeholder: "•••• •••• •••• ••••",
    required: true,
  },
};

type PageState = "loading" | "form" | "submitted" | "error";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL || "";

export default function VoiceFormPage() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [token, setToken] = useState<string>("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (!t) {
      setPageState("error");
      setError("Invalid link — no token found.");
      return;
    }

    // Decode the token (non-verified on client — server will verify on submit)
    try {
      const parts = t.split(".");
      if (parts.length !== 3) throw new Error("Bad token format");
      const payload = JSON.parse(atob(parts[1]!));
      const fieldList: string[] = payload.fields ?? [];
      const mapped = fieldList
        .map(f => FIELD_CONFIGS[f])
        .filter(Boolean) as FormField[];

      if (mapped.length === 0) {
        setPageState("error");
        setError("No fields to collect.");
        return;
      }

      setToken(t);
      setFields(mapped);
      setValues(Object.fromEntries(mapped.map(f => [f.name, ""])));
      setPageState("form");
    } catch {
      setPageState("error");
      setError("This link appears to be invalid or expired.");
    }
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${BOT_URL}/voice/webhook/form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, formData: values }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Submission failed");
      }

      setPageState("submitted");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [token, values]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0a0f 0%, #111827 50%, #0a0a0f 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1.5rem",
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      {/* Google Font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>

      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 20,
        padding: "2rem",
        boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
      }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 26, marginBottom: 12,
          }}>🎙️</div>
          <h1 style={{ color: "#fff", fontSize: 20, fontWeight: 700, margin: 0 }}>
            Your Agent Is Waiting
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 6 }}>
            Fill this out to continue your call
          </p>
        </div>

        {/* States */}
        {pageState === "loading" && (
          <p style={{ color: "rgba(255,255,255,0.5)", textAlign: "center" }}>Loading…</p>
        )}

        {pageState === "error" && (
          <div style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 12, padding: "1rem", textAlign: "center",
          }}>
            <p style={{ color: "#f87171", fontSize: 14 }}>⚠️ {error}</p>
          </div>
        )}

        {pageState === "submitted" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: "#4ade80", fontSize: 20, fontWeight: 700, margin: 0 }}>All set!</h2>
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, marginTop: 8 }}>
              Your agent received your info. You can go back to your call now!
            </p>
          </div>
        )}

        {pageState === "form" && (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {fields.map(field => (
              <div key={field.name}>
                <label style={{
                  display: "block", fontSize: 12, fontWeight: 600,
                  color: "rgba(255,255,255,0.6)", marginBottom: 6, letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}>
                  {field.label}
                </label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  required={field.required}
                  value={values[field.name] ?? ""}
                  onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10,
                    padding: "0.75rem 1rem",
                    fontSize: 15,
                    color: "#fff",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={e => (e.target.style.borderColor = "rgba(99,102,241,0.7)")}
                  onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                />
              </div>
            ))}

            {error && (
              <p style={{ color: "#f87171", fontSize: 12, margin: 0 }}>⚠️ {error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "0.875rem",
                background: submitting
                  ? "rgba(99,102,241,0.4)"
                  : "linear-gradient(135deg, #6366f1, #8b5cf6)",
                border: "none",
                borderRadius: 12,
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: submitting ? "not-allowed" : "pointer",
                marginTop: 4,
                transition: "opacity 0.2s, transform 0.1s",
                transform: submitting ? "scale(0.98)" : "scale(1)",
              }}
            >
              {submitting ? "Sending…" : "Send to Agent →"}
            </button>

            <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 11, textAlign: "center", margin: 0 }}>
              🔒 Secure · This link expires in 30 minutes
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
