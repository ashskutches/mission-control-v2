"use client";
import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Reset scroll to top on page navigation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <main className="app-wrapper">
      {/* Mobile backdrop */}
      <div
        className={`sidebar-backdrop${isMobileMenuOpen ? " is-active" : ""}`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />

      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <section className="main-content custom-scrollbar">
        {/* Mobile nav */}
        <nav className="navbar is-hidden-tablet is-black" role="navigation" aria-label="main navigation">
          <div className="navbar-brand">
            <a className="navbar-item has-text-weight-black has-text-white" href="/">L&R OPS</a>
            <button
              role="button"
              className={`navbar-burger${isMobileMenuOpen ? " is-active" : ""}`}
              aria-label="menu"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
            </button>
          </div>
        </nav>

        <AnimatePresence mode="wait">
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>

        <footer className="py-6 mt-2 has-text-centered is-size-7 is-uppercase has-text-weight-bold px-4" style={{ letterSpacing: "0.1em" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", opacity: 0.35 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/lrb-trampoline-icon.png" alt="" aria-hidden="true" style={{ width: 14, height: 14, objectFit: "contain" }} />
            <span style={{ color: "var(--accent-orange)" }}>Leaps &amp; Rebounds</span>
            <span style={{ color: "var(--text-muted)" }}>·</span>
            <span style={{ color: "var(--text-muted)" }}>70% Less Joint Impact</span>
            <span style={{ color: "var(--text-muted)" }}>·</span>
            <span style={{ color: "var(--text-muted)" }}>Ops Intelligence © {new Date().getFullYear()}</span>
          </div>
        </footer>
      </section>
    </main>
  );
}
