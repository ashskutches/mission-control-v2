"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck, Lock, Unlock } from "lucide-react";
import { APP_CONFIG } from "@/app/lib/AppConfig";
import { canAccess } from "@/app/lib/access";
import { useRole } from "@/app/lib/useRole";
import { cn } from "@/app/lib/utils";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();

  const { role, user, adminConfigured, discordConfigured, loaded } = useRole();
  const isAdmin = role === "admin";

  // Admin-only entries are dropped from the list entirely rather than greyed out,
  // so the nav reads as a complete menu instead of a wall of locks. Until /api/auth/me
  // answers we render as a viewer — hide first, reveal after.
  // Filtered by the same canAccess the middleware gates with, so the nav can never
  // offer a page that immediately bounces. Until /api/auth/me answers we render as a
  // guest — hide first, reveal after.
  const navItems = useMemo(
    () => APP_CONFIG.navigation.filter((item) => canAccess(role ?? "guest", item.href)),
    [role],
  );

  const [pipelineBadge, setPipelineBadge] = useState<number>(0);   // inbox: new insights + pending approvals
  const [blockagesBadge, setBlockagesBadge] = useState<number>(0); // stuck agents → Blockages
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const [plRes, blockRes] = await Promise.all([
          fetch(`${BOT_URL}/admin/pipeline/summary`),
          fetch(`${BOT_URL}/admin/blockages?status=open&limit=200`),
        ]);
        if (plRes.ok) {
          const data = await plRes.json();
          setPipelineBadge(data.inbox_count ?? 0);
        }
        if (blockRes.ok) {
          const bData = await blockRes.json();
          const arr = Array.isArray(bData) ? bData : (bData.data ?? []);
          setBlockagesBadge(arr.length);
        }
      } catch { /* silent */ }
    };
    fetchSummary();
    intervalRef.current = setInterval(fetchSummary, 60_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Best-match active item — prefer longer href matches
  const activeId = (() => {
    if (pathname === "/") return "overview";
    const matches = navItems.filter((item: any) =>
      item.href && (pathname === item.href || pathname.startsWith(item.href + "/"))
    );
    if (!matches.length) return pathname.split("/")[1] ?? "overview";
    return matches.reduce((a: any, b: any) => b.href.length > a.href.length ? b : a).id;
  })();

  const navigate = (href: string) => { router.push(href); onClose?.(); };

  return (
    <aside className={cn("sidebar-bulma menu custom-scrollbar", isOpen && "is-active")} style={{ overflowY: "auto" }}>

      {/* Brand Header — wordmark lockup */}
      <div
        className="mb-6"
        style={{ cursor: "pointer" }}
        onClick={() => navigate("/")}
        role="link"
        aria-label="Go to overview"
      >
        {/* Wordmark image — full L&R logo */}
        <div style={{
          position: "relative",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1px solid rgba(233,141,32,0.18)",
          background: "rgba(233,141,32,0.04)",
          padding: "2px",
          boxShadow: "0 2px 12px rgba(233,141,32,0.1)",
          transition: "box-shadow 0.2s, border-color 0.2s",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(233,141,32,0.22)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(233,141,32,0.35)";
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(233,141,32,0.1)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(233,141,32,0.18)";
        }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/lrb-wordmark.png"
            alt="Leaps & Rebounds Mission Control"
            style={{ width: "100%", display: "block", borderRadius: "10px", objectFit: "cover" }}
          />
        </div>
        {/* Live indicator strip */}
        <div className="is-flex is-align-items-center is-justify-content-space-between" style={{ marginTop: "8px", padding: "0 2px" }}>
          <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(233,141,32,0.6)", fontFamily: "'Montserrat', sans-serif" }}>
            Ops Intelligence
          </span>
          <div className="is-flex is-align-items-center" style={{ gap: "5px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent-emerald)", display: "block", animation: "pulse-orange 2.5s ease-in-out infinite" }} />
            <span style={{ fontSize: "9px", fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.08em" }}>Live</span>
          </div>
        </div>
      </div>

      {/* ── Grouped nav list ─────────────────────────────────────────────── */}
      <ul className="menu-list">
        {navItems.map((item: any, idx: number) => {
          const isActive = activeId === item.id;
          const Icon = item.icon;
          const accent = item.color ?? "var(--accent-orange)";

          // ── Per-item badge logic ─────────────────────────────────────────────
          // Pipeline (id='pipeline'): unreviewed inbox count (new insights + pending approvals)
          const showPipelineBadge = item.id === "pipeline" && pipelineBadge > 0;
          // Blockages (id='system'): stuck agents from blockages table
          const showBlockagesBadge = item.id === "system" && blockagesBadge > 0;

          // Detect group change — show divider + label when group changes (core group is unlabeled)
          const prevItem = navItems[idx - 1] as any | undefined;
          const groupChanged = prevItem && prevItem.group !== item.group;
          const showGroupHeader = groupChanged && item.group !== "core";

          return (
            <React.Fragment key={item.id}>
              {showGroupHeader && (
                <li>
                  <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0.75rem 0.6rem 0.4rem" }} />
                  <span
                    className="is-uppercase has-text-weight-black"
                    style={{
                      fontSize: "9px",
                      letterSpacing: "0.12em",
                      color: "var(--text-muted)",
                      display: "block",
                      padding: "0 0.6rem 0.3rem",
                    }}
                  >
                    {item.group}
                  </span>
                </li>
              )}
              <li>
                <a
                  onClick={() => navigate(item.href)}
                  className={cn(isActive ? "is-active" : "has-text-grey-light", "is-flex is-align-items-center")}
                  style={{
                    gap: "0.75rem",
                    cursor: "pointer",
                    backgroundColor: isActive ? `${accent}18` : "transparent",
                    borderLeft: isActive ? `2px solid ${accent}` : "2px solid transparent",
                    paddingLeft: "0.6rem",
                    transition: "all 0.15s",
                  }}
                >
                  <Icon size={18} color={isActive ? accent : undefined} />
                  <span
                    className="is-uppercase has-text-weight-bold"
                    style={{ fontSize: "12px", color: isActive ? accent : undefined, flex: 1 }}
                  >
                    {item.label}
                  </span>
                   {/* Pipeline badge — inbox count */}
                  {showPipelineBadge && (
                    <span style={{
                      fontSize: 9, fontWeight: 900, lineHeight: 1,
                      color: "#fff", background: "#e98d20",
                      border: "1px solid rgba(233,141,32,0.5)",
                      borderRadius: 10, padding: "2px 6px",
                      animation: "pulse-badge 2s ease-in-out infinite",
                    }}>
                      {pipelineBadge}
                    </span>
                  )}
                  {/* Blockages badge — stuck agents from blockages table */}
                  {showBlockagesBadge && (
                    <span style={{
                      fontSize: 9, fontWeight: 900, lineHeight: 1,
                      color: "#fff", background: "#f43f5e",
                      border: "1px solid rgba(244,63,94,0.5)",
                      borderRadius: 10, padding: "2px 6px",
                      animation: "pulse-badge 2s ease-in-out infinite",
                    }}>
                      {blockagesBadge}
                    </span>
                  )}
                </a>
              </li>
            </React.Fragment>
          );
        })}
      </ul>

      {/* Footer */}
      <div style={{ marginTop: "auto", paddingTop: "2rem" }}>
        <div className="box p-4 mb-5" style={{ backgroundColor: "rgba(233,141,32,0.04) !important", border: "1px solid rgba(233,141,32,0.14) !important" }}>
          <div className="is-flex is-justify-content-between is-align-items-center mb-3">
            <span className="is-size-7 has-text-weight-black is-uppercase" style={{ fontSize: "9px", letterSpacing: "0.1em", color: "var(--text-secondary)" }}>Status Monitor</span>
            <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
              <span className="is-block" style={{ width: "6px", height: "6px", background: "var(--accent-emerald)", borderRadius: "50%", animation: "pulse-orange 2.5s ease-in-out infinite" }} />
              <span className="is-size-7 has-text-weight-black has-text-success is-uppercase" style={{ fontSize: "9px" }}>Active</span>
            </div>
          </div>
          <div className="is-flex is-align-items-center" style={{ gap: "0.75rem" }}>
            <div className="is-flex is-justify-content-center is-align-items-center"
              style={{ width: "32px", height: "32px", background: "rgba(233,141,32,0.08)", borderRadius: "8px", border: "1px solid rgba(233,141,32,0.2)", color: "var(--accent-orange)" }}>
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="is-size-7 has-text-weight-bold has-text-white is-uppercase" style={{ fontSize: "10px", fontFamily: "'Montserrat', sans-serif" }}>Units: 2 Deploy</div>
              <div style={{ fontSize: "9px", color: "var(--text-muted)" }}>Leaps &amp; Rebounds Ops</div>
            </div>
          </div>
        </div>
        {/* ── Who you are ────────────────────────────────────────────────────
            A break-glass password session has no Discord identity behind it, so it
            says so plainly rather than rendering a nameless avatar — knowing which
            kind of session you hold matters when access misbehaves. */}
        {loaded && role && (
          <div className="is-flex is-align-items-center px-4" style={{ gap: "0.6rem", padding: "0.5rem 0", marginBottom: "0.25rem" }}>
            {user?.avatarUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={user.avatarUrl}
                alt=""
                width={26}
                height={26}
                style={{ borderRadius: "50%", border: "1px solid rgba(233,141,32,0.28)", flexShrink: 0 }}
              />
            ) : (
              <div
                className="is-flex is-align-items-center is-justify-content-center"
                style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(233,141,32,0.1)", border: "1px solid rgba(233,141,32,0.25)",
                  fontSize: 10, fontWeight: 800, color: "var(--accent-orange)",
                }}
              >
                {user ? user.username.slice(0, 1).toUpperCase() : "?"}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div
                className="has-text-weight-bold has-text-white"
                style={{ fontSize: 11, fontFamily: "'Montserrat', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                title={user?.username ?? "Break-glass session"}
              >
                {user?.username ?? "Break-glass session"}
              </div>
              <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
                {role === "admin" ? "Admin" : role === "teammate" ? "Teammate" : "Guest"}
              </div>
            </div>
          </div>
        )}

        {/* ── Admin tier ─────────────────────────────────────────────────────
            Exit Admin drops to a viewer session but keeps you signed in — that is
            what separates it from Sign Out below. Both use a hard location change
            so server components re-render against the new cookie.

            When Discord login is live, a viewer is NOT offered a password prompt:
            admin comes from the Discord role, and pointing them at a form they
            cannot fill would be a dead end. The break-glass form is still at
            /admin by URL for the case where Discord itself is the problem. */}
        {loaded && (isAdmin ? (
          <button
            onClick={async () => { await fetch("/api/auth/admin", { method: "DELETE" }); window.location.href = "/"; }}
            className="button is-ghost is-fullwidth is-flex is-justify-content-start px-4"
            style={{ gap: "0.75rem", textDecoration: "none", color: "#22c55e" }}
            title="Return to the standard view — you stay signed in"
          >
            <Unlock size={16} />
            <span className="is-uppercase has-text-weight-bold" style={{ fontSize: "11px", flex: 1, textAlign: "left" }}>Admin On</span>
            <span style={{
              fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.08em",
              color: "var(--text-muted)",
            }}>Exit</span>
          </button>
        ) : role === "guest" ? (
          <div
            className="is-flex is-align-items-center px-4 has-text-grey-light"
            style={{ gap: "0.75rem", padding: "0.4rem 0", opacity: 0.55 }}
            title="Ask an admin for the Teammate role in Discord to unlock the full dashboard"
          >
            <Lock size={16} />
            <span className="is-uppercase has-text-weight-bold" style={{ fontSize: "10px", lineHeight: 1.4 }}>
              Guest · ask for Teammate
            </span>
          </div>
        ) : discordConfigured ? (
          <div
            className="is-flex is-align-items-center px-4 has-text-grey-light"
            style={{ gap: "0.75rem", padding: "0.4rem 0", opacity: 0.55 }}
            title="Admin is granted by the Admin role in Discord — ask an admin to assign it"
          >
            <Lock size={16} />
            <span className="is-uppercase has-text-weight-bold" style={{ fontSize: "10px", lineHeight: 1.4 }}>
              Admin via Discord role
            </span>
          </div>
        ) : adminConfigured ? (
          <button
            onClick={() => navigate("/admin")}
            className="button is-ghost is-fullwidth is-flex is-justify-content-start px-4 has-text-grey-light"
            style={{ gap: "0.75rem", textDecoration: "none" }}
            title="Unlock Profit, Costs, Agents and Quick Run"
          >
            <Lock size={16} />
            <span className="is-uppercase has-text-weight-bold" style={{ fontSize: "11px" }}>Admin Login</span>
          </button>
        ) : null)}

        <button
          onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}
          className="button is-ghost is-fullwidth is-flex is-justify-content-start px-4 has-text-danger-light"
          style={{ gap: "0.75rem", textDecoration: "none" }}
        >
          <LogOut size={16} />
          <span className="is-uppercase has-text-weight-bold" style={{ fontSize: "11px" }}>Sign Out</span>
        </button>
        {/* Brand watermark — new icon */}
        <div className="lrb-watermark" style={{ textAlign: "center", paddingTop: "1rem", paddingBottom: "0.25rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lrb-icon-v2.png" alt="" aria-hidden="true" style={{ width: 14, height: 14, objectFit: "contain", opacity: 0.28, filter: "saturate(0)" }} />
          Leaps &amp; Rebounds · Ops
        </div>
      </div>
    </aside>
  );
}
