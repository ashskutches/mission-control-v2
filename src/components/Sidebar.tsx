"use client";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { APP_CONFIG } from "@/app/lib/AppConfig";
import { cn } from "@/app/lib/utils";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const getActiveId = () => {
    if (pathname === "/") return "overview";
    const segment = pathname.split("/")[1];
    return segment ?? "overview";
  };
  const activeId = getActiveId();

  const navigate = (href: string) => {
    router.push(href);
    onClose?.();
  };

  return (
    <aside className={cn(
      "sidebar-bulma menu custom-scrollbar",
      isOpen && "is-active"
    )} style={{ overflowY: "auto" }}>

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

      {/* Grouped Navigation */}
      {(["core", "domains", "command"] as const).map((group) => {
        const groupItems = APP_CONFIG.navigation.filter((item: any) => item.group === group);
        const groupLabel = group === "core" ? null : group === "domains" ? "Business" : "Command";
        return (
          <div key={group} style={{ marginBottom: group === "domains" ? "0.5rem" : undefined }}>
            {groupLabel && (
              <p className="menu-label has-text-grey-light is-uppercase mt-4" style={{ letterSpacing: "0.1em", fontSize: "9px" }}>
                {groupLabel}
              </p>
            )}
            <ul className="menu-list">
              {groupItems.map((item: any) => {
                const isActive = activeId === item.id;
                const Icon = item.icon;
                const accent = item.color ?? "var(--accent-orange)";
                return (
                  <li key={item.id}>
                    <a
                      onClick={() => navigate(item.href)}
                      className={cn(isActive ? "is-active" : "has-text-grey-light", "is-flex is-align-items-center")}
                      style={{
                        gap: "0.75rem", cursor: "pointer",
                        backgroundColor: isActive ? `${accent}18` : "transparent",
                        borderLeft: isActive ? `2px solid ${accent}` : "2px solid transparent",
                        paddingLeft: "0.6rem", transition: "all 0.15s",
                      }}
                    >
                      <Icon size={18} color={isActive ? accent : undefined} />
                      <span className="is-uppercase has-text-weight-bold" style={{ fontSize: "12px", color: isActive ? accent : undefined }}>
                        {item.label}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}


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
