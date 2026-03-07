"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", icon: "⊞", label: "Command Center" },
  { href: "/productivity", icon: "⚡", label: "Productivity" },
  { href: "/tasks", icon: "✅", label: "Tasks" },
  { href: "/content", icon: "▶️", label: "Content Intel" },
  { href: "/brain", icon: "🧠", label: "Second Brain" },
  { href: "/connections", icon: "🔌", label: "Connections" },
  { href: "/settings", icon: "⚙️", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">GC</div>
        <div>
          <div className="sidebar-title">Mission Control</div>
          <div className="sidebar-subtitle">v1.0 · Gravity Claw</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(n => (
          <Link
            key={n.href}
            href={n.href}
            className={`nav-item ${pathname === n.href ? "active" : ""}`}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="agent-status" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-green)" }}>
            <span className="status-dot" />
            Agent Online
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
            Claude Sonnet · Local
          </div>
        </div>

        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="nav-item"
          style={{ borderLeft: 'none', color: 'var(--brand-red)', opacity: 0.7 }}
        >
          <span className="nav-icon">⏻</span>
          Logout
        </button>
      </div>
    </aside>
  );
}
