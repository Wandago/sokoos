"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  Activity,
  BarChart3,
  Flag,
  LifeBuoy,
  LogOut,
  Search,
  ShieldAlert,
  Store,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { SokoMark } from "@/components/soko-mark";
import { useToast } from "@/components/ui/toast";
import { signOutAdmin, useAdmin, useAdminSession } from "@/lib/admin/store";
import { queueCounts } from "@/lib/admin/selectors";

/**
 * The operator console is a different product from the seller app: desktop
 * first, denser, and far more sober. Same tokens, much less lime — here the
 * colour means "something needs you", not "this is our brand".
 */
const nav = [
  { href: "/admin", label: "Overview", icon: BarChart3, badge: null },
  { href: "/admin/merchants", label: "Merchants", icon: Users, badge: "pastDue" },
  { href: "/admin/revenue", label: "Revenue", icon: Activity, badge: null },
  { href: "/admin/storefronts", label: "Moderation", icon: ShieldAlert, badge: "reports" },
  { href: "/admin/support", label: "Support", icon: LifeBuoy, badge: "tickets" },
  { href: "/admin/system", label: "System", icon: Flag, badge: null },
] as const;

export function AdminFrame({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { db, ready } = useAdmin();
  const signedIn = useAdminSession();
  const counts = queueCounts(db);
  const toast = useToast();

  // Navigation state, not authorization: this only decides what the console
  // renders, never what data exists. See the note on the sign-in screen.
  useEffect(() => {
    if (ready && !signedIn) router.replace("/admin/login");
  }, [ready, signedIn, router]);

  if (ready && !signedIn) {
    return <div className="min-h-dvh bg-[#F4F5F3]" />;
  }

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" || pathname === "/admin/" : pathname.startsWith(href);

  return (
    <div className="min-h-dvh bg-[#F4F5F3] text-forest-950 lg:flex">
      {/* Sidebar */}
      <aside className="sticky top-0 z-30 flex h-auto shrink-0 flex-col bg-forest-950 lg:h-dvh lg:w-60">
        <div className="flex items-center gap-2.5 px-4 py-4 lg:px-5">
          <SokoMark className="size-8" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-extrabold tracking-tight text-white">SokoOS</p>
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-brand">
              Operator
            </p>
          </div>
        </div>

        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:pb-4">
          {nav.map((item) => {
            const active = isActive(item.href);
            const count = item.badge ? counts[item.badge as keyof typeof counts] : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors lg:py-2.5",
                  active
                    ? "bg-white/10 text-brand"
                    : "text-forest-200 hover:bg-white/5 hover:text-white",
                )}
              >
                <item.icon className="size-[17px]" strokeWidth={active ? 2.4 : 2} />
                <span className="whitespace-nowrap lg:flex-1">{item.label}</span>
                {ready && count > 0 && (
                  <span className="tabular rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-brand-ink">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden border-t border-white/10 p-3 lg:block">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold text-forest-200 hover:bg-white/5 hover:text-white"
          >
            <Store className="size-[17px]" />
            Seller app
          </Link>
          <button
            onClick={() => {
              signOutAdmin();
              router.push("/admin/login");
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold text-forest-200 hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-[17px]" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-[#E2E5DF] bg-[#F4F5F3]/90 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 lg:px-8">
            <button
              type="button"
              onClick={() => toast("Search across the console is coming soon.", "info")}
              className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-[#E2E5DF] bg-white px-3.5 text-left text-[13px] text-[#6B756A] lg:max-w-md"
            >
              <Search className="size-3.5 shrink-0" />
              <span className="truncate">Search merchants, tickets, reports</span>
            </button>
            <EnvironmentBadge />
            <span className="flex size-9 items-center justify-center rounded-full bg-forest-950 text-[11px] font-bold text-brand">
              LW
            </span>
          </div>
        </header>

        <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1400px]">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.035em]">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-1 text-[13px] leading-relaxed text-[#6B756A]">{subtitle}</p>
                )}
              </div>
              {actions}
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * Operators run several environments and act differently in each. Saying which
 * one you are looking at is a safety feature, not decoration.
 */
function EnvironmentBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E5DF] bg-white px-2.5 py-1.5 text-[11px] font-bold">
      <span className="size-1.5 rounded-full bg-brand" />
      Demo data
    </span>
  );
}

/* ---- Shared console pieces ------------------------------------------ */

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("rounded-2xl border border-[#E2E5DF] bg-white", className)}
    >
      {children}
    </div>
  );
}

export function PanelHead({
  title,
  note,
  action,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDEFEB] px-4 py-3">
      <div>
        <h2 className="text-[14px] font-bold tracking-tight">{title}</h2>
        {note && <p className="mt-0.5 text-[12px] text-[#6B756A]">{note}</p>}
      </div>
      {action}
    </div>
  );
}

/** A dense metric. No icon badge — this console is read, not browsed. */
export function Metric({
  label,
  value,
  sub,
  delta,
  invert,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  invert?: boolean;
  className?: string;
}) {
  const flat = delta !== undefined && Math.abs(delta) < 0.05;
  const up = (delta ?? 0) >= 0;
  const good = invert ? !up : up;
  return (
    <div className={cn("rounded-2xl border border-[#E2E5DF] bg-white p-4", className)}>
      <p className="text-[12px] font-semibold text-[#6B756A]">{label}</p>
      <p className="tabular mt-1.5 truncate text-[24px] font-extrabold tracking-[-0.03em]">
        {value}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {delta !== undefined && (
          <span
            className={cn(
              "tabular rounded-full px-1.5 py-0.5 text-[10px] font-bold",
              flat
                ? "bg-[#F1F2EF] text-[#6B756A]"
                : good
                  ? "bg-success-soft text-success-text"
                  : "bg-danger-soft text-danger-text",
            )}
          >
            {flat ? "flat" : `${up ? "+" : "−"}${Math.abs(delta).toFixed(1)}%`}
          </span>
        )}
        {sub && <span className="text-[11px] text-[#8A948A]">{sub}</span>}
      </div>
    </div>
  );
}
