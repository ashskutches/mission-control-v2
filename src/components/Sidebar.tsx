"use client";
import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck, ChevronDown, ChevronRight, Film } from "lucide-react";
import { APP_CONFIG, SQUADS } from "@/app/lib/AppConfig";
import { cn } from "@/app/lib/utils";

const BOT_URL = process.env.NEXT_PUBLIC_BOT_URL ?? "http://localhost:3000";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Track which squads are collapsed (default: all expanded)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // Live open-request badge
  const [openRequests, setOpenRequests] = useState<{ open: number; critical: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await fetch(`${BOT_URL}/admin/insights/summary`);
        if (!res.ok) return;
        const data = await res.json();
        setOpenRequests({ open: data.openCount ?? 0, critical: data.criticalCount ?? 0 });
      } catch { /* silent — sidebar badge is non-critical */ }
    };
    fetchSummary();
    intervalRef.current = setInterval(fetchSummary, 60_000); // refresh every 60s
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const getActiveId = () => {
    if (pathname === "/") return "overview";
    const matches = APP_CONFIG.navigation.filter((item: any) =>
      item.href && (pathname === item.href || pathname.startsWith(item.href + "/"))
    );
    if (matches.length === 0) return pathname.split("/")[1] ?? "overview";
    const best = matches.reduce((a: any, b: any) =>
      b.href.length > a.href.length ? b : a
    );
    return best.id;
  };
  const activeId = getActiveId();

  const navigate = (href: string) => {
    router.push(href);
    onClose?.();
  };

  const toggleSquad = (squadId: string) =>
    setCollapsed(prev => ({ ...prev, [squadId]: !prev[squadId] }));

  const renderNavItem = (item: any, indented = false) => {
    const isActive = activeId === item.id;
    const Icon = item.icon;
    const accent = item.color ?? "var(--accent-orange)";

    // Badge for the Requests nav item
    const showBadge = item.id === "system" && openRequests && openRequests.open > 0;
    const isCritical = showBadge && openRequests!.critical > 0;

    return (
      <li key={item.id}>
        <a
          onClick={() => navigate(item.href)}
          className={cn(isActive ? "is-active" : "has-text-grey-light", "is-flex is-align-items-center")}
          style={{
            gap: "0.75rem",
            cursor: "pointer",
            backgroundColor: isActive ? `${accent}18` : "transparent",
            borderLeft: isActive ? `2px solid ${accent}` : "2px solid transparent",
            paddingLeft: indented ? "1.4rem" : "0.6rem",
            transition: "all 0.15s",
          }}
        >
          <Icon size={indented ? 15 : 18} color={isActive ? accent : undefined} />
          <span
            className="is-uppercase has-text-weight-bold"
            style={{ fontSize: indented ? "11px" : "12px", color: isActive ? accent : undefined, flex: 1 }}
          >
            {item.label}
          </span>
          {showBadge && (
            <span style={{
              fontSize: 9, fontWeight: 900, lineHeight: 1,
              color: isCritical ? "#fff" : "#f43f5e",
              background: isCritical ? "#f43f5e" : "rgba(244,63,94,0.15)",
              border: "1px solid rgba(244,63,94,0.4)",
              borderRadius: 10, padding: "2px 6px",
              animation: isCritical ? "pulse-badge 2s ease-in-out infinite" : undefined,
            }}>
              {openRequests!.open}
            </span>
          )}
        </a>
      </li>
    );
  };

  return (
    <aside className={cn("sidebar-bulma menu custom-scrollbar", isOpen && "is-active")} style={{ overflowY: "auto" }}>

      {/* Brand Header */}
      <div
        className="mb-6 is-flex is-align-items-center"
        style={{ cursor: "pointer", gap: "1rem" }}
        onClick={() => navigate("/")}
      >
        <div
          className="is-flex is-justify-content-center is-align-items-center has-text-weight-black is-size-4"
          style={{
            width: "48px", height: "48px", borderRadius: "12px",
            backgroundColor: "var(--accent-orange)", boxShadow: "0 0 20px rgba(255,140,0,0.3)",
          }}
        >
          GC
        </div>
        <div>
          <h2 className="is-size-5 has-text-weight-bold has-text-white is-marginless">
            {APP_CONFIG.name}
          </h2>
          <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
            <span className="is-size-7 has-text-weight-bold has-text-grey-light is-uppercase" style={{ fontSize: "9px" }}>
              V{APP_CONFIG.version}
            </span>
            <span className="tag is-rounded has-text-weight-bold" style={{ fontSize: "8px", height: "1.5em", backgroundColor: "rgba(255,140,0,0.1)", color: "var(--accent-orange)" }}>
              STABLE
            </span>
          </div>
        </div>
      </div>

      {/* Core group */}
      {(() => {
        const coreItems = APP_CONFIG.navigation.filter((i: any) => i.group === "core");
        return (
          <div style={{ marginBottom: "0.5rem" }}>
            <ul className="menu-list">{coreItems.map((item: any) => renderNavItem(item))}</ul>
          </div>
        );
      })()}

      {/* Content group */}
      {(() => {
        const contentItem = APP_CONFIG.navigation.find((i: any) => i.group === "content" && !i.squad);
        return contentItem ? (
          <div style={{ marginBottom: "0.5rem" }}>
            <p className="menu-label has-text-grey-light is-uppercase mt-4" style={{ letterSpacing: "0.1em", fontSize: "9px" }}>
              Content
            </p>
            <ul className="menu-list">{renderNavItem(contentItem)}</ul>
          </div>
        ) : null;
      })()}

      {/* Commerce group — squad structure */}
      {(() => {
        const storeItem = APP_CONFIG.navigation.find((i: any) => i.group === "commerce" && !i.squad);
        return (
          <div style={{ marginBottom: "0.5rem" }}>
            <p className="menu-label has-text-grey-light is-uppercase mt-4" style={{ letterSpacing: "0.1em", fontSize: "9px" }}>
              Commerce
            </p>
            <ul className="menu-list">
              {/* Store overview */}
              {storeItem && renderNavItem(storeItem)}

              {/* Squads */}
              {SQUADS.map(squad => {
                const items = APP_CONFIG.navigation.filter((i: any) => i.group === "commerce" && i.squad === squad.id);
                if (items.length === 0) return null;
                const isCollapsed = collapsed[squad.id] ?? false;
                const SquadIcon = squad.icon;
                // Is any item in this squad active?
                const squadActive = items.some((i: any) => activeId === i.id);

                return (
                  <li key={squad.id}>
                    {/* Squad header — clickable to collapse */}
                    <a
                      onClick={() => toggleSquad(squad.id)}
                      className="is-flex is-align-items-center"
                      style={{
                        gap: "0.6rem",
                        cursor: "pointer",
                        padding: "0.35rem 0.6rem",
                        borderLeft: squadActive ? `2px solid ${squad.color}60` : "2px solid transparent",
                        background: squadActive ? `${squad.color}08` : "transparent",
                        transition: "all 0.15s",
                        marginTop: "0.25rem",
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        background: `${squad.color}20`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <SquadIcon size={10} style={{ color: squad.color }} />
                      </div>
                      <span
                        className="is-uppercase has-text-weight-black"
                        style={{ fontSize: "9px", letterSpacing: "0.08em", color: squad.color, flex: 1 }}
                      >
                        {squad.label}
                      </span>
                      {isCollapsed
                        ? <ChevronRight size={10} style={{ color: squad.color, opacity: 0.6 }} />
                        : <ChevronDown size={10} style={{ color: squad.color, opacity: 0.6 }} />
                      }
                    </a>

                    {/* Agent sub-items */}
                    {!isCollapsed && (
                      <ul className="menu-list" style={{ marginLeft: 0 }}>
                        {items.map((item: any) => renderNavItem(item, true))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}

      {/* Command group */}
      {(() => {
        const commandItems = APP_CONFIG.navigation.filter((i: any) => i.group === "command");
        return (
          <div>
            <p className="menu-label has-text-grey-light is-uppercase mt-4" style={{ letterSpacing: "0.1em", fontSize: "9px" }}>
              Command
            </p>
            <ul className="menu-list">{commandItems.map((item: any) => renderNavItem(item))}</ul>
          </div>
        );
      })()}

      {/* Footer */}
      <div style={{ marginTop: "auto", paddingTop: "2rem" }}>
        <div className="box p-4 mb-5" style={{ backgroundColor: "rgba(255,255,255,0.02) !important" }}>
          <div className="is-flex is-justify-content-between is-align-items-center mb-3">
            <span className="is-size-7 has-text-weight-black is-uppercase has-text-grey" style={{ fontSize: "9px", letterSpacing: "0.1em" }}>Status Monitor</span>
            <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
              <span className="is-block" style={{ width: "6px", height: "6px", background: "var(--accent-emerald)", borderRadius: "50%" }} />
              <span className="is-size-7 has-text-weight-black has-text-success is-uppercase" style={{ fontSize: "9px" }}>Active</span>
            </div>
          </div>
          <div className="is-flex is-align-items-center" style={{ gap: "0.75rem" }}>
            <div className="is-flex is-justify-content-center is-align-items-center"
              style={{ width: "32px", height: "32px", background: "rgba(0,255,136,0.05)", borderRadius: "8px", border: "1px solid rgba(0,255,136,0.1)", color: "var(--accent-emerald)" }}>
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="is-size-7 has-text-weight-bold has-text-white is-uppercase" style={{ fontSize: "10px" }}>Units: 2 Deploy</div>
              <div className="is-size-7 has-text-grey" style={{ fontSize: "9px" }}>Gravity Claw · Antigravity</div>
            </div>
          </div>
        </div>
        <button
          onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}
          className="button is-ghost is-fullwidth is-flex is-justify-content-start px-4 has-text-danger-light"
          style={{ gap: "0.75rem", textDecoration: "none" }}
        >
          <LogOut size={16} />
          <span className="is-uppercase has-text-weight-bold" style={{ fontSize: "11px" }}>Terminate Session</span>
        </button>
      </div>
    </aside>
  );
}
