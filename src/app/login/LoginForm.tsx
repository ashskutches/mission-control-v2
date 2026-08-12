"use client";
import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Discord is the only advertised way in. The password form is still here but is
 * reachable only at /login?break-glass=1, and only renders when ADMIN_PASSWORD or
 * DASHBOARD_PASSWORD is actually set — see page.tsx, which reads the env server-side
 * so the browser is never told which fallbacks exist.
 */

const ERRORS: Record<string, string> = {
    denied: "Sign-in was cancelled.",
    state: "That sign-in link expired — please try again.",
    exchange: "Discord could not complete the sign-in. Try again.",
    identity: "Discord did not return your account details. Try again.",
    discord_unconfigured: "Discord login is not configured on this server.",
    server: "The server is misconfigured. Check SESSION_SECRET.",
};

const MONO = "'Montserrat', sans-serif";

export function LoginForm({
    discordConfigured,
    passwordConfigured,
}: {
    discordConfigured: boolean;
    passwordConfigured: boolean;
}) {
    const searchParams = useSearchParams();
    const router = useRouter();

    const from = searchParams.get("from") || "/";
    const breakGlass = searchParams.get("break-glass") === "1";
    const oauthError = searchParams.get("error");

    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const shownError = error || (oauthError ? ERRORS[oauthError] ?? "Sign-in failed." : "");

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
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Invalid password");
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
            border: "1px solid rgba(233,141,32,0.18)",
            textAlign: "center",
            boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 1px 0 rgba(233,141,32,0.12) inset",
            backdropFilter: "blur(20px)",
            position: "relative",
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

            <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)", fontFamily: MONO }}>
                Operations Hub
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 28, fontFamily: MONO }}>
                {breakGlass
                    ? "Break-glass access · Use only if Discord is down"
                    : "Internal Intelligence · Sign in with Discord"}
            </p>

            {shownError && (
                <div style={{
                    color: "var(--brand-red)", fontSize: 12, fontWeight: 500,
                    marginBottom: 18, lineHeight: 1.5,
                }}>
                    {shownError}
                </div>
            )}

            {!breakGlass && (discordConfigured ? (
                <a
                    href={`/api/auth/discord?from=${encodeURIComponent(from)}`}
                    style={{
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                        padding: "13px 12px",
                        background: "#5865F2",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        textDecoration: "none",
                        fontFamily: MONO,
                        boxShadow: "0 4px 16px rgba(88,101,242,0.35)",
                    }}
                >
                    <DiscordMark />
                    Sign in with Discord
                </a>
            ) : (
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, fontFamily: MONO }}>
                    Discord login is not configured on this server.
                    {passwordConfigured && <> Use the break-glass link below.</>}
                </div>
            ))}

            {!breakGlass && (
                <p style={{ marginTop: 18, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6, fontFamily: MONO }}>
                    Access is granted by your role in the Leaps &amp; Rebounds Discord.
                </p>
            )}

            {breakGlass && passwordConfigured && (
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
                            fontFamily: MONO,
                        }}
                    />

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
                            fontFamily: MONO,
                            boxShadow: loading ? "none" : "0 4px 16px rgba(233,141,32,0.35)",
                        }}
                    >
                        {loading ? "Verifying..." : "Access Dashboard"}
                    </button>
                </form>
            )}

            {breakGlass && !passwordConfigured && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, fontFamily: MONO }}>
                    No break-glass password is set on this server.
                </div>
            )}

            {/* The break-glass door. Deliberately quiet: it is a fallback, not a choice. */}
            {passwordConfigured && (
                <a
                    href={breakGlass
                        ? `/login?from=${encodeURIComponent(from)}`
                        : `/login?break-glass=1&from=${encodeURIComponent(from)}`}
                    style={{
                        display: "inline-block", marginTop: 22,
                        fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
                        color: "var(--text-muted)", textDecoration: "none", opacity: 0.65,
                        fontFamily: MONO,
                    }}
                >
                    {breakGlass ? "← Back to Discord sign-in" : "Use break-glass password"}
                </a>
            )}

            {/* Brand badge */}
            <div style={{ marginTop: 24, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(233,141,32,0.45)", fontFamily: MONO }}>70% Less Joint Impact</span>
                <span style={{ color: "rgba(255,255,255,0.1)", fontSize: 10 }}>·</span>
                <span style={{ fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,0.18)", fontFamily: MONO }}>Bungee · Not Springs</span>
            </div>
        </div>
    );
}

/** Discord's wordmark glyph — inlined so the login page pulls nothing off-origin. */
function DiscordMark() {
    return (
        <svg width="18" height="18" viewBox="0 0 127.14 96.36" fill="currentColor" aria-hidden="true">
            <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z" />
        </svg>
    );
}
