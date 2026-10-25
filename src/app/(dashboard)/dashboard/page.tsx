"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { fetchCurrentUser } from "@/lib/current-user";
import { User, Lead } from "@/types";
import s from "./dashboard.module.scss";

type Stats = {
  totalProducts: number;
  activeProducts: number;
  totalLeads: number;
  newLeads: number;
  totalUsers: number;
};
type Section<T> = { data: T | null; error: boolean };
type Reminders = { overdue: number; dueToday: number; upcoming: number };
type Permission =
  | "canManageProducts"
  | "canManageLeads"
  | "canManageSales"
  | "canManageWebsiteOrders"
  | "canManageUsers"
  | "canManageExpenses"
  | "canManageProspects";
const actions: {
  label: string;
  description: string;
  href: string;
  permission?: Permission;
  icon: string;
}[] = [
  {
    label: "Manage leads",
    description: "Follow up and move orders forward",
    href: "/leads",
    permission: "canManageLeads",
    icon: "leads",
  },
  {
    label: "Products & stock",
    description: "Keep your inventory up to date",
    href: "/products",
    permission: "canManageProducts",
    icon: "box",
  },
  {
    label: "Website orders",
    description: "Review and approve incoming orders",
    href: "/website-orders",
    permission: "canManageWebsiteOrders",
    icon: "bag",
  },
  {
    label: "Record a sale",
    description: "Manage clinic sales and payments",
    href: "/sales",
    permission: "canManageSales",
    icon: "chart",
  },
  {
    label: "Prospects",
    description: "Work through your calling list",
    href: "/prospects",
    permission: "canManageProspects",
    icon: "leads",
  },
  {
    label: "Expenses",
    description: "Track your business spending",
    href: "/expenses",
    permission: "canManageExpenses",
    icon: "chart",
  },
  {
    label: "Manage users",
    description: "Manage team access and permissions",
    href: "/users",
    permission: "canManageUsers",
    icon: "team",
  },
  {
    label: "My work log",
    description: "Capture what you worked on today",
    href: "/work-log",
    icon: "check",
  },
];
const empty = <T,>(): Section<T> => ({ data: null, error: false });
const number = (value: number) => value.toLocaleString("en-IN");

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState(empty<Stats>);
  const [leads, setLeads] = useState(empty<Lead[]>);
  const [reminders, setReminders] = useState(empty<Reminders>);
  const [stock, setStock] = useState(empty<number>);
  const [orders, setOrders] = useState(empty<number>);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const allowed = (permission: Permission) =>
    !!user &&
    (user.role === "SUPER_ADMIN" ||
      (permission !== "canManageUsers" && user[permission]));

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setFatal(false);
      try {
        const me = await fetchCurrentUser();
        if (!active) return;
        setUser(me);
        if (me.role !== "SUPER_ADMIN" && !me.canViewDashboard) return;
        const can = (permission: Permission) =>
          me.role === "SUPER_ADMIN" || me[permission];
        async function get<R, T>(
          url: string,
          select: (data: R) => T,
          set: (value: Section<T>) => void,
        ) {
          try {
            const response = await api.get<R>(url);
            if (active) set({ data: select(response.data), error: false });
          } catch {
            if (active) set({ data: null, error: true });
          }
        }
        await Promise.all([
          get("/dashboard/stats", (data: Stats) => data, setStats),
          ...(can("canManageLeads")
            ? [
                get(
                  "/leads?limit=5",
                  (data: { data: Lead[] }) => data.data,
                  setLeads,
                ),
                get(
                  "/leads/stats",
                  (data: { reminders: Reminders }) => data.reminders,
                  setReminders,
                ),
              ]
            : []),
          ...(can("canManageProducts")
            ? [
                get(
                  "/products?lowStock=true&limit=1",
                  (data: { meta: { total: number } }) => data.meta.total,
                  setStock,
                ),
              ]
            : []),
          ...(can("canManageWebsiteOrders")
            ? [
                get(
                  "/website-orders?status=PENDING&limit=1",
                  (data: { total: number }) => data.total,
                  setOrders,
                ),
              ]
            : []),
        ]);
        if (active) setUpdatedAt(new Date());
      } catch {
        if (active) setFatal(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [refresh]);

  const retry = () => setRefresh((value) => value + 1);
  if (!loading && fatal)
    return (
      <div className={s.page}>
        <div className={s.empty}>
          <Icon name="leads" />
          <h2>We couldn’t load your dashboard</h2>
          <p>Please check your connection and try again.</p>
          <button className={s.button} onClick={retry}>
            Try again
          </button>
        </div>
      </div>
    );
  if (user && user.role !== "SUPER_ADMIN" && !user.canViewDashboard)
    return (
      <div className={s.page}>
        <div className={s.empty}>
          <h2>Dashboard access is restricted</h2>
          <p>
            Your team administrator can update your access. You can still open
            your work log.
          </p>
          <Link prefetch={false} className={s.button} href="/work-log">
            Open my work log
          </Link>
        </div>
      </div>
    );
  if (loading && !user)
    return (
      <div className={s.page} role="status" aria-label="Loading dashboard">
        <div className={s.skeletonBanner} />
        <div className={s.statsGrid}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={s.skeletonCard} />
          ))}
        </div>
        <span className={s.srOnly}>Loading your dashboard…</span>
      </div>
    );

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const metrics = stats.data
    ? [
        {
          label: "Total products",
          value: stats.data.totalProducts,
          detail: `${number(stats.data.activeProducts)} active in your catalogue`,
          icon: "box",
        },
        {
          label: "Active products",
          value: stats.data.activeProducts,
          detail: "Available in your inventory",
          icon: "check",
        },
        {
          label: "Total leads",
          value: stats.data.totalLeads,
          detail: "Across your customer pipeline",
          icon: "leads",
        },
        {
          label: "New leads",
          value: stats.data.newLeads,
          detail: "Ready for a first conversation",
          icon: "spark",
        },
        {
          label: "Team members",
          value: stats.data.totalUsers,
          detail: "Registered team accounts",
          icon: "team",
        },
      ]
    : [];
  const hasAttention =
    allowed("canManageLeads") ||
    allowed("canManageProducts") ||
    allowed("canManageWebsiteOrders");
  const failed =
    stats.error ||
    leads.error ||
    reminders.error ||
    stock.error ||
    orders.error;

  return (
    <div className={s.page} aria-busy={loading}>
      <section className={s.banner}>
        <div>
          <div className={s.eyebrow}>
            <span className={s.brandDot} /> YOUR WORKSPACE
          </div>
          <h2>
            {greeting}, {user?.username || "there"}
            <span className={s.headingDot}>.</span>
          </h2>
          <p>Here’s what’s happening at Nav Healing Herbs.</p>
          <div className={s.bannerMeta}>
            <span>
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span className={s.rolePill}>
              {user?.role.replaceAll("_", " ").toLowerCase()}
            </span>
          </div>
        </div>
        <div className={s.bannerActions}>
          <Link prefetch={false} className={s.button} href="/work-log">
            <Icon name="plus" /> Log today’s work
          </Link>
          <button className={s.refresh} onClick={retry} disabled={loading}>
            <Icon name="refresh" />
            {loading ? "Refreshing…" : "Refresh overview"}
          </button>
        </div>
      </section>
      {failed && (
        <div className={s.notice} role="alert">
          <span>
            Some information couldn’t be loaded. The rest of your dashboard is
            available.
          </span>
          <button onClick={retry} disabled={loading}>
            Try again
          </button>
        </div>
      )}
      <section aria-label="Business overview" className={s.statsGrid}>
        {loading && !stats.data
          ? [1, 2, 3, 4, 5].map((i) => (
              <div className={s.skeletonCard} key={i} />
            ))
          : metrics.map((metric) => (
              <div className={s.statCard} key={metric.label}>
                <div className={s.statTop}>
                  <span>{metric.label}</span>
                  <Icon name={metric.icon} />
                </div>
                <strong>{number(metric.value)}</strong>
                <p>{metric.detail}</p>
              </div>
            ))}
      </section>
      {hasAttention && (
        <section aria-labelledby="attention-title">
          <div className={s.sectionHeading}>
            <div>
              <div className={s.eyebrow}>YOUR NEXT STEPS</div>
              <h3 id="attention-title">Needs attention</h3>
            </div>
            <span className={s.sectionHint}>
              A little focus goes a long way.
            </span>
          </div>
          <div className={s.attentionGrid}>
            {allowed("canManageLeads") && (
              <>
                <Attention
                  label="Overdue follow-ups"
                  value={reminders.data?.overdue}
                  error={reminders.error}
                  loading={loading}
                  href="/leads?reminderStatus=overdue"
                  note="Reconnect with customers waiting to hear from you"
                  icon="clock"
                  urgent
                />
                <Attention
                  label="Follow-ups today"
                  value={reminders.data?.dueToday}
                  error={reminders.error}
                  loading={loading}
                  href="/leads?reminderStatus=today"
                  note="Keep today’s conversations moving"
                  icon="leads"
                />
              </>
            )}
            {allowed("canManageWebsiteOrders") && (
              <Attention
                label="Pending orders"
                value={orders.data ?? undefined}
                error={orders.error}
                loading={loading}
                href="/website-orders?status=PENDING"
                note="Review orders awaiting your approval"
                icon="bag"
              />
            )}
            {allowed("canManageProducts") && (
              <Attention
                label="Low-stock products"
                value={stock.data ?? undefined}
                error={stock.error}
                loading={loading}
                href="/products?lowStock=true"
                note="Review items at or below their reorder level"
                icon="box"
                urgent
              />
            )}
          </div>
        </section>
      )}
      <div className={s.bottomGrid}>
        <section className={s.panel} aria-labelledby="recent-title">
          <div className={s.panelHeader}>
            <div>
              <div className={s.eyebrow}>CUSTOMER PIPELINE</div>
              <h3 id="recent-title">Recent leads</h3>
            </div>
            {allowed("canManageLeads") && (
              <Link prefetch={false} className={s.textLink} href="/leads">
                View all <span aria-hidden="true">↗</span>
              </Link>
            )}
          </div>
          {!allowed("canManageLeads") ? (
            <Empty
              title="Lead access is restricted"
              text="Your administrator can give you access to customer leads."
            />
          ) : leads.error ? (
            <Empty
              title="Leads couldn’t be loaded"
              text="Refresh the overview to try again."
            />
          ) : loading && !leads.data ? (
            <p className={s.loadingText} role="status">
              Loading recent leads…
            </p>
          ) : !leads.data?.length ? (
            <Empty
              title="Your next connection starts here"
              text="New customer leads will appear here as they come in."
            />
          ) : (
            <div className={s.leadList}>
              {leads.data.map((lead) => (
                <Link prefetch={false} key={lead.id} className={s.leadRow} href={`/leads?leadId=${lead.id}`}>
                  <span className={s.leadAvatar} aria-hidden="true">
                    {lead.name.charAt(0).toUpperCase()}
                  </span>
                  <div className={s.leadDetails}>
                    <strong>{lead.name}</strong>
                    <span>
                      {lead.items?.length || 0} product
                      {lead.items?.length === 1 ? "" : "s"} ·{" "}
                      {new Date(lead.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <span
                    className={`${s.badge} ${lead.status === "NEW" ? s.badgeNew : lead.status === "CONVERTED" ? s.badgeConverted : ""}`}
                  >
                    {lead.status.replaceAll("_", " ").toLowerCase()}
                  </span>
                  <span className={s.rowArrow} aria-hidden="true">
                    ↗
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className={s.panel} aria-labelledby="actions-title">
          <div className={s.panelHeader}>
            <div>
              <div className={s.eyebrow}>MAKE IT HAPPEN</div>
              <h3 id="actions-title">Quick actions</h3>
            </div>
          </div>
          <div className={s.actionList}>
            {actions
              .filter((a) => !a.permission || allowed(a.permission))
              .map((action) => (
                <Link
                  prefetch={false}
                  href={action.href}
                  className={s.actionItem}
                  key={action.href}
                >
                  <span className={s.actionIcon}>
                    <Icon name={action.icon} />
                  </span>
                  <div>
                    <strong>{action.label}</strong>
                    <span>{action.description}</span>
                  </div>
                  <span className={s.rowArrow} aria-hidden="true">
                    ↗
                  </span>
                </Link>
              ))}
          </div>
        </section>
      </div>
      <footer className={s.statusBar}>
        <span>
          <span className={s.brandDot} /> Nav Healing Herbs{" "}
          <span className={s.footerDivider}>/</span> Team workspace
        </span>
        <span role="status">
          {loading
            ? "Updating overview…"
            : updatedAt
              ? `${failed ? "Last checked" : "Updated"} ${updatedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
              : "Overview unavailable"}
        </span>
      </footer>
    </div>
  );
}

function Attention({
  label,
  value,
  error,
  loading,
  href,
  note,
  icon,
  urgent,
}: {
  label: string;
  value?: number;
  error: boolean;
  loading: boolean;
  href: string;
  note: string;
  icon: string;
  urgent?: boolean;
}) {
  return (
    <Link
      prefetch={false}
      className={`${s.attentionCard} ${urgent && value ? s.urgent : ""}`}
      href={href}
    >
      <div className={s.attentionTop}>
        <span className={s.actionIcon}>
          <Icon name={icon} />
        </span>
        <span className={s.rowArrow} aria-hidden="true">
          ↗
        </span>
      </div>
      <strong className={s.attentionValue}>
        {error
          ? "—"
          : value === undefined
            ? loading
              ? "…"
              : "—"
            : number(value)}
      </strong>
      <h4>{label}</h4>
      <p>
        {error
          ? "Unavailable. Refresh to try again."
          : value === 0
            ? "All clear for now."
            : note}
      </p>
    </Link>
  );
}
function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className={s.empty}>
      <Icon name="leads" />
      <h4>{title}</h4>
      <p>{text}</p>
    </div>
  );
}
function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    box: "M12 3 3 7.5 12 12l9-4.5L12 3ZM3 7.5v9l9 4.5 9-4.5v-9M12 12v9M7.5 5.25l9 4.5",
    leads:
      "M8 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3M8 3h8v4H8V3Zm0 9h8m-8 4h5",
    chart: "M4 3v17h17M8 15v-4m5 4V7m5 8v-6",
    bag: "M5 7h14l2 14H3L5 7Zm3 0V6a4 4 0 0 1 8 0v1",
    team: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8 .13a4 4 0 0 1 0 7.75",
    check: "m5 12 4 4L19 6",
    plus: "M12 5v14M5 12h14",
    clock: "M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    refresh:
      "M20 7v5h-5M4 17v-5h5M6.1 6a8 8 0 0 1 13.2 3M4.7 15A8 8 0 0 0 17.9 18",
    spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
  };
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.box} />
    </svg>
  );
}
