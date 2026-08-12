import React, { Suspense } from "react";
import { discordConfig } from "@/app/lib/discord";
import { LoginForm } from "./LoginForm";

/**
 * Server component: which sign-in paths exist is decided from the env here, so the
 * browser only ever learns "there is a break-glass option", never which secret backs it.
 *
 * force-dynamic because that decision is runtime configuration. Prerendered, this page
 * would bake in whichever DISCORD_* vars happened to exist at build time and keep
 * showing the wrong door until someone rebuilt.
 */
export const dynamic = "force-dynamic";

export default function LoginPage() {
    const discordConfigured = discordConfig() !== null;
    const passwordConfigured = Boolean(process.env.DASHBOARD_PASSWORD || process.env.ADMIN_PASSWORD);

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
                <LoginForm
                    discordConfigured={discordConfigured}
                    passwordConfigured={passwordConfigured}
                />
            </Suspense>
        </div>
    );
}
