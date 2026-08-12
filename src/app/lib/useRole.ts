"use client";
import { useEffect, useState } from "react";
import type { Role } from "./session";

export interface SessionUserView {
    id: string;
    username: string;
    avatar: string | null;
    /** Ready-made CDN URL, or null when they use a default Discord avatar. */
    avatarUrl: string | null;
}

export interface RoleState {
    role: Role | null;
    /** Null on a break-glass password session — there is no Discord identity behind it. */
    user: SessionUserView | null;
    /** False when ADMIN_PASSWORD is unset — don't offer a break-glass login that cannot work. */
    adminConfigured: boolean;
    /** False when the DISCORD_* vars are incomplete — don't offer a Discord button that 500s. */
    discordConfigured: boolean;
    /** Until this is true, treat the session as non-admin: hide first, reveal after. */
    loaded: boolean;
}

/**
 * Reads the current session from /api/auth/me.
 *
 * For hiding UI only. The gate is src/middleware.ts — if this hook were wrong, or
 * tampered with in the browser, the restricted routes still redirect.
 */
export function useRole(): RoleState {
    const [state, setState] = useState<RoleState>({
        role: null,
        user: null,
        adminConfigured: false,
        discordConfigured: false,
        loaded: false,
    });

    useEffect(() => {
        let cancelled = false;
        fetch("/api/auth/me")
            .then((r) => r.json())
            .then((d) => {
                if (cancelled) return;
                setState({
                    role: d.role ?? null,
                    user: d.user ?? null,
                    adminConfigured: Boolean(d.adminConfigured),
                    discordConfigured: Boolean(d.discordConfigured),
                    loaded: true,
                });
            })
            .catch(() => {
                // Network failure: stay non-admin rather than guessing upward.
                if (!cancelled) setState((s) => ({ ...s, loaded: true }));
            });
        return () => { cancelled = true; };
    }, []);

    return state;
}
