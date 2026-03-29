"use client";
import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const pathname = usePathname();

  // Reset scroll on every page navigation — prevents bleed from pages
  // that use their own inner scroll containers (chats, commerce sections)
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "instant" });
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

      <section ref={mainRef} className="main-content custom-scrollbar" style={{ overflowY: "auto", height: "100vh", position: "relative" }}>
        {/* Mobile nav */}
        <nav className="navbar is-hidden-tablet is-black" role="navigation" aria-label="main navigation">
          <div className="navbar-brand">
            <a className="navbar-item has-text-weight-black has-text-white" href="/">GC COMMAND</a>
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
            style={{ minHeight: "calc(100vh - 60px)" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>

        <footer className="py-6 mt-2 has-text-centered has-text-grey-light is-size-7 is-uppercase has-text-weight-bold px-4" style={{ letterSpacing: "0.1em" }}>
          Mission Control · Strategic Intelligence Asset © {new Date().getFullYear()}
        </footer>
      </section>
    </main>
  );
}
