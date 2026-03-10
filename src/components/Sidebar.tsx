"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Activity, Users } from "lucide-react";
import { APP_CONFIG } from "@/app/lib/AppConfig";
import { cn } from "@/app/lib/utils";

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-[280px] bg-[var(--bg-darker)] border-r border-[var(--glass-border)] p-6 flex flex-col gap-10 z-50">
      {/* Brand Header */}
      <div className="flex items-center gap-4 group cursor-pointer">
        <div className="w-12 h-12 rounded-xl bg-[var(--accent-orange)] flex items-center justify-center font-black text-2xl shadow-[0_0_20px_rgba(255,140,0,0.3)] group-hover:shadow-[0_0_30px_rgba(255,140,0,0.5)] transition-all">
          GC
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            {APP_CONFIG.name}
          </h1>
          <p className="text-[10px] uppercase tracking-widest font-semibold text-[var(--text-muted)]">
            v{APP_CONFIG.version} · {APP_CONFIG.author}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2">
        {APP_CONFIG.navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative group",
                isActive
                  ? "bg-[rgba(255,140,0,0.1)] text-[var(--accent-orange)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-glow"
                  className="absolute inset-0 bg-gradient-to-r from-[rgba(255,140,0,0.05)] to-transparent rounded-xl pointer-events-none"
                />
              )}
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="font-semibold text-sm tracking-wide">{item.label}</span>

              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute left-0 w-1 h-6 bg-[var(--accent-orange)] rounded-full"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Status */}
      <div className="flex flex-col gap-6">
        <div className="glass-card p-4 flex flex-col gap-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] group-hover:text-[var(--accent-emerald)] transition-colors">
              Growth Mission
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[var(--accent-emerald)] rounded-full animate-pulse shadow-[0_0_8px_var(--accent-emerald)]" />
              <span className="text-[10px] font-bold text-[var(--accent-emerald)]">LIVE</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(0,255,136,0.1)] flex items-center justify-center text-[var(--accent-emerald)]">
              <Users size={16} />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text-primary)]">Agents: 1 Active</div>
              <div className="text-[10px] font-medium text-[var(--text-muted)]">Gravity Claw · Online</div>
            </div>
          </div>
        </div>

        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--accent-rose)] hover:bg-[rgba(255,60,92,0.05)] transition-all group font-semibold text-sm tracking-wide"
        >
          <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
          Logout
        </button>
      </div>
    </aside>
  );
}
