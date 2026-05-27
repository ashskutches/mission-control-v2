"use client";
import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { APP_CONFIG } from "@/app/lib/AppConfig";
import { cn } from "@/app/lib/utils";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router   = useRouter();

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
    const matches = APP_CONFIG.navigation.filter((item: any) =>
      item.href && (pathname === item.href || pathname.startsWith(item.href + "/"))
    );
    if (!matches.length) return pathname.split("/")[1] ?? "overview";
    return matches.reduce((a: any, b: any) => b.href.length > a.href.length ? b : a).id;
  })();

  const navigate = (href: string) => { router.push(href); onClose?.(); };

  return (
    <aside className={cn("sidebar-bulma menu custom-scrollbar", isOpen && "is-active")} style={{ overflowY: "auto" }}>

      {/* Brand Header */}
      <div
        className="mb-6 is-flex is-align-items-center"
        style={{ cursor: "pointer", gap: "1rem" }}
        onClick={() => navigate("/")}
      >
        {/* Trampoline brand icon */}
        <div style={{ position: "relative", width: "48px", height: "48px", flexShrink: 0 }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "12px",
            background: "linear-gradient(135deg, rgba(233,141,32,0.15) 0%, rgba(201,120,24,0.08) 100%)",
            boxShadow: "0 4px 16px rgba(233,141,32,0.25), 0 1px 0 rgba(255,255,255,0.08) inset",
            border: "1px solid rgba(233,141,32,0.3)",
            overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/lrb-trampoline-icon.png"
              alt="Leaps & Rebounds"
              className="lrb-bounce"
              style={{ width: "40px", height: "40px", objectFit: "contain", filter: "brightness(1.1)" }}
            />
          </div>
          {/* Pulse indicator */}
          <span style={{
            position: "absolute", bottom: -2, right: -2,
            width: 10, height: 10, borderRadius: "50%",
            background: "var(--accent-emerald)",
            border: "2px solid var(--bg-sidebar)",
            animation: "pulse-orange 2.5s ease-in-out infinite",
          }} />
        </div>
        <div>
          <h2 className="is-size-5 has-text-weight-bold has-text-white is-marginless" style={{ fontFamily: "'Montserrat', sans-serif", letterSpacing: "-0.01em" }}>
            {APP_CONFIG.name}
          </h2>
          <div className="is-flex is-align-items-center" style={{ gap: "0.4rem", marginTop: "2px" }}>
            <span className="tag is-rounded has-text-weight-bold" style={{ fontSize: "7px", height: "1.4em", backgroundColor: "rgba(233,141,32,0.12)", color: "var(--accent-orange)", border: "1px solid rgba(233,141,32,0.25)", padding: "0 5px" }}>
              70% LESS IMPACT
            </span>
            <span className="tag is-rounded has-text-weight-bold" style={{ fontSize: "7px", height: "1.4em", backgroundColor: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)", padding: "0 5px" }}>
              LIVE
            </span>
          </div>
        </div>
      </div>

      {/* ── Grouped nav list ─────────────────────────────────────────────── */}
      <ul className="menu-list">
        {APP_CONFIG.navigation.map((item: any, idx: number) => {
          const isActive = activeId === item.id;
          const Icon = item.icon;
          const accent = item.color ?? "var(--accent-orange)";

          // ── Per-item badge logic ─────────────────────────────────────────────
          // Pipeline (id='pipeline'): unreviewed inbox count (new insights + pending approvals)
          const showPipelineBadge = item.id === "pipeline" && pipelineBadge > 0;
          // Blockages (id='system'): stuck agents from blockages table
          const showBlockagesBadge = item.id === "system" && blockagesBadge > 0;

          // Detect group change — show divider + label when group changes (core group is unlabeled)
          const prevItem = APP_CONFIG.navigation[idx - 1] as any | undefined;
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
        <button
          onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}
          className="button is-ghost is-fullwidth is-flex is-justify-content-start px-4 has-text-danger-light"
          style={{ gap: "0.75rem", textDecoration: "none" }}
        >
          <LogOut size={16} />
          <span className="is-uppercase has-text-weight-bold" style={{ fontSize: "11px" }}>Sign Out</span>
        </button>
        {/* Brand watermark */}
        <div className="lrb-watermark" style={{ textAlign: "center", paddingTop: "1rem", paddingBottom: "0.25rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/lrb-trampoline-icon.png" alt="" aria-hidden="true" style={{ width: 12, height: 12, objectFit: "contain", opacity: 0.25 }} />
          Leaps &amp; Rebounds
        </div>
      </div>
    </aside>
  );
}
