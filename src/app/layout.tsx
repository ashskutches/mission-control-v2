"use client";
import { usePathname } from "next/navigation";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  return (
    <html lang="en">
      <body>
        <div className="layout">
          {!isLoginPage && <Sidebar />}
          <main className={isLoginPage ? "main-content-full" : "main-content"}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
