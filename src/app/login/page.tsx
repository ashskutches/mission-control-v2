"use client";
import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginContent() {
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
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password }),
            });

            if (res.ok) {
                router.push(from);
                router.refresh();
            } else {
                const data = await res.json();
                setError(data.error || "Invalid password");
                setLoading(false);
            }
        } catch (err) {
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
            border: "1px solid rgba(233,141,32,0.18)",
            textAlign: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 1px 0 rgba(233,141,32,0.12) inset",
            backdropFilter: "blur(20px)",
        }}>
            {/* Wordmark logo */}
            <div style={{ marginBottom: 24 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/lrb-wordmark.png"
                    alt="Leaps & Rebounds Mission Control"
                    style={{ width: "100%", borderRadius: 10, border: "1px solid rgba(233,141,32,0.15)" }}
                />
            </div>

            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)", fontFamily: "'Montserrat', sans-serif" }}>Operations Hub</h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 28, fontFamily: "'Montserrat', sans-serif" }}>Internal Intelligence · Enter your access code</p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    style={{
                        padding: "12px 16px",
                        background: "var(--bg-base)",
                        border: "1px solid rgba(233,141,32,0.2)",
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
                        background: loading ? "var(--bg-elevated)" : "var(--brand-orange)",
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
                        boxShadow: loading ? "none" : "0 4px 16px rgba(233,141,32,0.35)",
                    }}
                >
                    {loading ? "Verifying..." : "Access Dashboard"}
                </button>
            </form>

            {/* Brand badge */}
            <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(233,141,32,0.45)", fontFamily: "'Montserrat', sans-serif" }}>70% Less Joint Impact</span>
                <span style={{ color: "rgba(255,255,255,0.1)", fontSize: 10 }}>·</span>
                <span style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.18)", fontFamily: "'Montserrat', sans-serif" }}>Bungee · Not Springs</span>
            </div>
        </div>
    );
}

export default function LoginPage() {
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
            {/* Hero banner background */}
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
            {/* Dark vignette overlay */}
            <div style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse at center, transparent 0%, rgba(26,26,28,0.85) 100%)",
                pointerEvents: "none",
            }} />
            <Suspense fallback={<div>Loading...</div>}>
                <LoginContent />
            </Suspense>
        </div>
    );
}

