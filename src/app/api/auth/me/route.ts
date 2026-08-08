import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, roleFromToken } from "@/app/lib/session";

/**
 * The current session's role, for UI that needs to hide things (the sidebar, the
 * Command Center tab strip). Purely cosmetic — src/middleware.ts is what actually
 * enforces access, so a client that lies to itself about this gains nothing.
 *
 * `adminConfigured` lets the UI avoid offering an admin login on a deployment
 * where ADMIN_PASSWORD was never set.
 */
export async function GET(req: NextRequest) {
    const secret = process.env.SESSION_SECRET ?? "";
    const role = await roleFromToken(req.cookies.get(COOKIE_NAME)?.value, secret);

    return NextResponse.json(
        { role, adminConfigured: Boolean(process.env.ADMIN_PASSWORD) },
        { headers: { "Cache-Control": "no-store" } },
    );
}
