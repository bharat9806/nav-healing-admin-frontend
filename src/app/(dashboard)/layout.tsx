"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import s from "./layout.module.scss";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const navigation = navigationRef.current;
    const update = () => {
      if (window.innerWidth >= 1024 && sidebarOpen) setSidebarOpen(false);
      if (navigation)
        navigation.inert = window.innerWidth < 1024 && !sidebarOpen;
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [sidebarOpen]);
  useEffect(() => {
    if (!sidebarOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const nav = navigationRef.current;
    nav?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
      if (event.key === "Tab") {
        const items = nav?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        );
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [sidebarOpen]);

  return (
    <div className={s.shell}>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close navigation"
          className={s.backdrop}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        id="dashboard-navigation"
        ref={navigationRef}
        className={`${s.sidebarWrap} ${sidebarOpen ? s.sidebarOpen : ""}`}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      <div className={s.content}>
        <Header
          menuOpen={sidebarOpen}
          onMenuClick={() => setSidebarOpen((o) => !o)}
        />
        <main className={s.main}>{children}</main>
      </div>
    </div>
  );
}
