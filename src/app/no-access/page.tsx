import React from "react";
import { ShieldAlert } from "lucide-react";

/**
 * The dead end for a successful Discord sign-in that carries no access.
 *
 * This is a separate page from /login on purpose. Bouncing these people back to the
 * login screen makes it look like their password was wrong, and they retry forever —
 * the problem is a missing Discord role, and only someone else can fix it.
 */

const MONO = "'Montserrat', sans-serif";

const REASONS: Record<string, { title: string; body: string }> = {
    // Reached by a signed-in guest who tried a page above their tier. They are not
    // rejected — they have a lobby — so this says what to ask for, and offers the way
    // back to the part of the dashboard they can actually use.
    need_role: {
        title: "That page needs the Teammate role",
        body: "You're signed in as a guest, which covers Content, Research, Agents, Quick Run and Chats. Ask an admin for the Teammate role in Discord to unlock Website, Marketing, SEO, Logistics, Orders, Support and the rest — or Admin for Profit, Costs, Insights, Social, Brand and Team.",
    },
    not_member: {
        title: "You're not in the server",
        body: "This dashboard is limited to members of the Leaps & Rebounds Discord. Ask an admin for an invite, then sign in again.",
    },
    no_role: {
        title: "No access role yet",
        body: "You're in the Discord, but you don't have a role that grants dashboard access. Ask an admin to give you the Teammate role — or Admin for Profit, Costs, Insights, Social, Brand and Team.",
    },
};

export default async function NoAccessPage({
    searchParams,
}: {
    searchParams: Promise<{ reason?: string }>;
}) {
    const { reason } = await searchParams;
    const copy = REASONS[reason ?? ""] ?? REASONS.need_role;

    return (
        <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            minHeight: "100vh", fontFamily: MONO,
            position: "relative", overflow: "hidden", background: "var(--bg-base)",
        }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/lrb-hero-banner.png"
                alt=""
                aria-hidden="true"
                style={{
                    position: "absolute", inset: 0, width: "100%", height: "100%",
                    objectFit: "cover", objectPosition: "center", opacity: 0.12, pointerEvents: "none",
                }}
            />
            <div style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse at center, transparent 0%, rgba(26,26,28,0.85) 100%)",
                pointerEvents: "none",
            }} />

            <div style={{
                width: "100%", maxWidth: 400, padding: "36px 40px 40px",
                background: "var(--bg-sidebar)", borderRadius: 20,
                border: "1px solid rgba(233,141,32,0.18)", textAlign: "center",
                boxShadow: "0 24px 64px rgba(0,0,0,0.55), 0 1px 0 rgba(233,141,32,0.12) inset",
                backdropFilter: "blur(20px)", position: "relative",
            }}>
                <div style={{
                    width: 48, height: 48, margin: "0 auto 18px",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(233,141,32,0.09)",
                    border: "1px solid rgba(233,141,32,0.28)",
                    borderRadius: 12, color: "var(--brand-orange, #e98d20)",
                }}>
                    <ShieldAlert size={24} />
                </div>

                <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10, color: "var(--text-primary)", fontFamily: MONO }}>
                    {copy.title}
                </h1>
                <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 26, lineHeight: 1.65, fontFamily: MONO }}>
                    {copy.body}
                </p>

                <a
                    href={reason === "need_role" ? "/" : "/login"}
                    style={{
                        display: "block", padding: "12px",
                        background: "var(--brand-orange, #e98d20)", color: "white",
                        borderRadius: 8, fontSize: 13, fontWeight: 700,
                        letterSpacing: "0.06em", textTransform: "uppercase",
                        textDecoration: "none", fontFamily: MONO,
                        boxShadow: "0 4px 16px rgba(233,141,32,0.35)",
                    }}
                >
                    {reason === "need_role" ? "Back to the dashboard" : "Try again"}
                </a>

                <p style={{ marginTop: 20, fontSize: 10, color: "var(--text-muted)", opacity: 0.7, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, fontFamily: MONO }}>
                    Roles are granted in Discord
                </p>
            </div>
        </div>
    );
}
