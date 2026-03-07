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
            maxWidth: 360,
            padding: 40,
            background: "var(--bg-sidebar)",
            borderRadius: 16,
            border: "1px solid var(--border)",
            textAlign: "center"
        }}>
            <div style={{
                width: 48,
                height: 48,
                background: "var(--brand-orange)",
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 18,
                color: "white",
                margin: "0 auto 20px"
            }}>GC</div>

            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>Mission Control</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 32 }}>Enter your password to access Gravity Claw</p>

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
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        color: "var(--text-primary)",
                        fontSize: 14,
                        outline: "none",
                        transition: "border-color 0.2s"
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
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: loading ? "default" : "pointer",
                        transition: "opacity 0.2s"
                    }}
                >
                    {loading ? "Verifying..." : "Access Dashboard"}
                </button>
            </form>
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
            background: "var(--bg-base)",
            fontFamily: "system-ui, sans-serif"
        }}>
            <Suspense fallback={<div>Loading...</div>}>
                <LoginContent />
            </Suspense>
        </div>
    );
}
