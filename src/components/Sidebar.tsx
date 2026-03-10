"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Activity, Users, ShieldCheck } from "lucide-react";
import { APP_CONFIG } from "@/app/lib/AppConfig";
import { cn } from "@/app/lib/utils";

interface SidebarProps {
  activeTab: string;
  onTabChange: (id: string) => void;
  isOpen?: boolean;
}

export default function Sidebar({ activeTab, onTabChange, isOpen }: SidebarProps) {
  return (
    <aside className={cn(
      "sidebar-container fixed left-0 top-0 h-screen w-[280px] bg-[var(--bg-darker)] border-r border-[var(--glass-border)] p-6 flex flex-col gap-10 z-[100]",
      isOpen && "mobile-open"
    )}>
      {/* Brand Header */}
      <div
        className="flex items-center gap-4 group cursor-pointer"
        onClick={() => onTabChange("overview")}
      >
        <div className="w-12 h-12 rounded-xl bg-[var(--accent-orange)] flex items-center justify-center font-black text-2xl shadow-[0_0_20px_rgba(255,140,0,0.3)] group-hover:shadow-[0_0_30px_rgba(255,140,0,0.5)] transition-all">
          GC
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)] leading-tight">
            {APP_CONFIG.name}
          </h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] uppercase tracking-widest font-black text-[var(--text-muted)]">
              V{APP_CONFIG.version}
            </span>
            <span className="w-1 h-1 rounded-full bg-[var(--text-muted)]/30" />
            <span className="text-[9px] uppercase tracking-widest font-black text-[var(--accent-orange)]">
              STABLE
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-1.5">
        {APP_CONFIG.navigation.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative group overflow-hidden",
                isActive
                  ? "text-[var(--accent-orange)] font-bold bg-[rgba(255,140,0,0.05)] shadow-[inset_0_0_20px_rgba(255,140,0,0.02)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[rgba(255,255,255,0.02)]"
              )}
            >
              <div className={cn(
                "relative z-10 transition-transform duration-300",
                isActive ? "scale-110" : "group-hover:scale-105"
              )}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              </div>

              <span className="relative z-10 text-[13px] tracking-wide uppercase font-black">
                {item.label}
              </span>

              {isActive && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-[var(--accent-orange)] rounded-r-full shadow-[0_0_15px_var(--accent-orange)]"
                  initial={false}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Status Card */}
      <div className="flex flex-col gap-6">
        <div className="glass-card p-4 flex flex-col gap-3 border-[rgba(255,255,255,0.02)] relative group overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--text-dim)]">Status Monitor</span>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--accent-emerald)] rounded-full animate-pulse shadow-[0_0_8px_var(--accent-emerald)]" />
              <span className="text-[9px] font-black text-[var(--accent-emerald)] uppercase">Active</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[rgba(0,255,136,0.05)] border border-[rgba(0,255,136,0.1)] flex items-center justify-center text-[var(--accent-emerald)]">
              <ShieldCheck size={16} />
            </div>
            <div>
              <div className="text-[11px] font-black text-[var(--text-primary)] uppercase tracking-tight">Units: 2 Deploy</div>
              <div className="text-[9px] font-bold text-[var(--text-muted)]">Gravity Claw · Antigravity</div>
            </div>
          </div>
        </div>

        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-[var(--accent-rose)] hover:bg-[rgba(255,60,92,0.05)] transition-all group font-black text-[11px] uppercase tracking-widest"
        >
          <LogOut size={16} className="group-hover:rotate-12 transition-transform" />
          Terminate Session
        </button>
      </div>
    </aside>
  );
}
