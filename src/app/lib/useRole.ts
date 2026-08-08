"use client";
import { useEffect, useState } from "react";
import type { Role } from "./session";

export interface RoleState {
    role: Role | null;
    /** False when ADMIN_PASSWORD is unset — don't offer an admin login that cannot work. */
    adminConfigured: boolean;
    /** Until this is true, treat the session as non-admin: hide first, reveal after. */
    loaded: boolean;
}

/**
 * Reads the current session role from /api/auth/me.
 *
 * For hiding UI only. The gate is src/middleware.ts — if this hook were wrong, or
 * tampered with in the browser, the restricted routes still redirect.
 */
export function useRole(): RoleState {
    const [state, setState] = useState<RoleState>({
        role: null,
        adminConfigured: false,
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
                    adminConfigured: Boolean(d.adminConfigured),
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
