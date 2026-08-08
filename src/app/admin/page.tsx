"use client";
import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck } from "lucide-react";

/**
 * Admin elevation. Reachable without a session (see PUBLIC_PATHS in middleware.ts),
 * so it doubles as a cold sign-in for an admin. Landing here with ?from=<path> means
 * the middleware bounced a viewer off a restricted route; we send them back to it on
 * success.
 */
function AdminContent() {
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const from = searchParams.get("from") || "/";

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (loading) return;

        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/admin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });

            if (res.ok) {
                router.push(from);
                router.refresh();
            } else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Invalid admin password");
                setLoading(false);
            }
        } catch {
            setError("An unexpected error occurred");
            setLoading(false);
        }
    }

    return (
        <div style={{
            width: "100%",
            maxWidth: 380,
            padding: "36px 40px 40px",
            background: "var(--bg-sidebar)",
            borderRadius: 20,
            border: "1px solid rgba(34,197,94,0.22)",
            textAlign: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 1px 0 rgba(34,197,94,0.12) inset",
            backdropFilter: "blur(20px)",
        }}>
            <div style={{
                width: 48, height: 48, margin: "0 auto 18px",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(34,197,94,0.09)",
                border: "1px solid rgba(34,197,94,0.28)",
                borderRadius: 12, color: "#22c55e",
            }}>
                <ShieldCheck size={24} />
            </div>

            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)", fontFamily: "'Montserrat', sans-serif" }}>Admin Access</h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 28, fontFamily: "'Montserrat', sans-serif" }}>
                Profit, Costs, Agents &amp; Quick Run · Enter the admin password
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <input
                    type="password"
                    placeholder="Admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    style={{
                        padding: "12px 16px",
                        background: "var(--bg-base)",
                        border: "1px solid rgba(34,197,94,0.22)",
                        borderRadius: 8,
                        color: "var(--text-primary)",
                        fontSize: 14,
                        outline: "none",
                        transition: "border-color 0.2s",
                        fontFamily: "'Montserrat', sans-serif",
                    }}
                />

                {error && (
                    <div style={{ color: "var(--brand-red)", fontSize: 12, fontWeight: 500 }}>
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !password}
                    style={{
                        padding: "12px",
                        background: loading ? "var(--bg-elevated)" : "#22c55e",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        cursor: loading ? "default" : "pointer",
                        transition: "opacity 0.2s, box-shadow 0.2s",
                        fontFamily: "'Montserrat', sans-serif",
                        boxShadow: loading ? "none" : "0 4px 16px rgba(34,197,94,0.3)",
                    }}
                >
                    {loading ? "Verifying..." : "Unlock Admin"}
                </button>
            </form>

            <button
                onClick={() => router.push("/")}
                style={{
                    marginTop: 22, background: "none", border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                    color: "var(--text-muted)", fontFamily: "'Montserrat', sans-serif",
                }}
            >
                ← Back to dashboard
            </button>
        </div>
    );
}

export default function AdminPage() {
    return (
        <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "'Montserrat', -apple-system, sans-serif",
            position: "relative",
            overflow: "hidden",
            background: "var(--bg-base)",
        }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/lrb-hero-banner.png"
                alt=""
                aria-hidden="true"
                style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    objectFit: "cover", objectPosition: "center",
                    opacity: 0.12,
                    pointerEvents: "none",
                }}
            />
            <div style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse at center, transparent 0%, rgba(26,26,28,0.85) 100%)",
                pointerEvents: "none",
            }} />
            <Suspense fallback={<div>Loading...</div>}>
                <AdminContent />
            </Suspense>
        </div>
    );
}
