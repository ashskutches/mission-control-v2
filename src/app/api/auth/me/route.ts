import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, sessionFromToken } from "@/app/lib/session";
import { avatarUrl, discordConfig } from "@/app/lib/discord";

/**
 * The current session, for UI that needs to hide things (the sidebar, the Command
 * Center tab strip) or show who you are. Purely cosmetic — src/middleware.ts is what
 * actually enforces access, so a client that lies to itself about this gains nothing.
 *
 * `adminConfigured` reports the break-glass password path, not Discord: it exists so
 * the sidebar does not offer a password prompt on a deployment where ADMIN_PASSWORD
 * was never set.
 */
export async function GET(req: NextRequest) {
    const secret = process.env.SESSION_SECRET ?? "";
    const session = await sessionFromToken(req.cookies.get(COOKIE_NAME)?.value, secret);

    return NextResponse.json(
        {
            role: session?.role ?? null,
            user: session?.user
                ? { ...session.user, avatarUrl: avatarUrl(session.user) }
                : null,
            adminConfigured: Boolean(process.env.ADMIN_PASSWORD),
            discordConfigured: discordConfig() !== null,
        },
        { headers: { "Cache-Control": "no-store" } },
    );
}
