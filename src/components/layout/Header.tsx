"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchCurrentUser } from "@/lib/current-user";
import { User } from "@/types";
import ThemeToggle from "@/components/theme/ThemeToggle";
import s from "./Header.module.scss";

export default function Header({
  title,
  onMenuClick,
  menuOpen,
}: {
  title?: string;
  onMenuClick?: () => void;
  menuOpen?: boolean;
}) {
  const pathname = usePathname();
  const pageTitles: Record<string, string> = {
    dashboard: "Dashboard",
    analytics: "Analytics",
    products: "Products",
    leads: "Leads",
    prospects: "Prospects",
    patients: "Patients",
    sales: "Sales",
    users: "Users",
    expenses: "Expenses",
    "product-sales": "Product Sales",
    "website-orders": "Website Orders",
    "daily-report": "Daily Report",
    "work-log": "Work Log",
  };
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetchCurrentUser()
      .then(setUser)
      .catch(() => {});
  }, []);

  const roleCls = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN":
        return s.roleSuperAdmin;
      case "ADMIN":
        return s.roleAdmin;
      default:
        return s.roleTeamMember;
    }
  };

  return (
    <header className={s.header}>
      <div className={s.left}>
        {onMenuClick && (
          <button
            type="button"
            className={s.menuBtn}
            onClick={onMenuClick}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            aria-controls="dashboard-navigation"
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}
        <h1 className={s.title}>
          {title || pageTitles[pathname.split("/")[1]] || "Dashboard"}
        </h1>
      </div>
      <div className={s.right}>
        <ThemeToggle />
        {user && (
          <>
            <div className={s.userInfo}>
              <p className={s.username}>{user.username}</p>
              <span className={`${s.roleBadge} ${roleCls(user.role)}`}>
                {user.role.replace(/_/g, " ")}
              </span>
            </div>
            <div className={s.avatar}>
              <span>{user.username.charAt(0).toUpperCase()}</span>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
