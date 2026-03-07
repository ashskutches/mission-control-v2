import { NextResponse } from "next/server";

export async function POST() {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("gc_session", "", {
        httpOnly: true,
        maxAge: 0,   // expire immediately
        path: "/",
    });
    return res;
}
