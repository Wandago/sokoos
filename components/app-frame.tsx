"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, MoreHorizontal, Package, Plus, ScanLine, Search, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import { needsReviewCount, unreadCount } from "@/lib/selectors";
import { allNav, primaryNav } from "@/lib/nav";
import { Sheet } from "./ui/sheet";
import { Avatar } from "./ui/avatar";
import { InstallPrompt } from "./install-prompt";
import { SokoMark } from "./soko-mark";
import { SyncStatus } from "./sync-status";

function useBadges() {
  const { db } = useStore();
  return {
    inbox: unreadCount(db),
    review: needsReviewCount(db),
    openOrders: db.orders.filter((o) => ["new", "confirmed", "packed"].includes(o.status)).length,
  };
}

/** Screens that own the whole viewport: no header, nav or content sheet. */
const bareRoutes = ["/welcome", "/landing", "/ads", "/login", "/signup", "/store"];

/** The operator console brings its own shell for every screen beneath it. */
const bareTrees = ["/admin"];

function isBare(pathname: string) {
  // Exact match, not a prefix: /storefront is an app screen and must not be
  // caught by the /store storefront route.
  const path = pathname.replace(/\/+$/, "") || "/";
  if (bareRoutes.includes(path)) return true;
  return bareTrees.some((tree) => path === tree || path.startsWith(`${tree}/`));
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

/** Which walkthrough step, if any, a nav destination stands in for. */
function tourIdFor(href: string): string | undefined {
  if (href === "/pos") return "tour-till";
  if (href === "/orders") return "tour-orders";
  if (href === "/settings") return "tour-settings";
  return undefined;
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { db } = useStore();
  const badges = useBadges();
  const [quickOpen, setQuickOpen] = useState(false);

  if (isBare(pathname)) return <>{children}</>;

  return (
    <div className="min-h-dvh bg-bg lg:flex">
      {/* ---- Desktop sidebar ------------------------------------------- */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border-subtle bg-surface lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <SokoMark className="size-9" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold tracking-tight">SokoOS</p>
            <p className="truncate text-[11px] text-text-secondary">{db.business.name}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {allNav.map((item) => {
            const active = isActive(pathname, item.href);
            const count = item.badge ? badges[item.badge] : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={tourIdFor(item.href)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-panel text-brand"
                    : "text-text-secondary hover:bg-surface-hover hover:text-text",
                )}
              >
                <item.icon className="size-[18px]" strokeWidth={active ? 2.4 : 2} />
                <span className="flex-1">{item.label}</span>
                {count > 0 && (
                  <span className="tabular rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-brand-ink">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border-subtle p-3">
          <button
            onClick={() => setQuickOpen(true)}
            data-tour="tour-add"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-brand-ink hover:bg-brand-hover"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            New
          </button>
        </div>
      </aside>

      {/* ---- Main column ------------------------------------------------ */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Forest header. The content sheet below rounds up over it, which is
            what gives the app its depth on a phone. */}
        <header className="pt-safe relative bg-panel px-4 pb-9 lg:hidden">
          <div className="flex items-center gap-2.5 pt-3">
            <SokoMark className="size-10 shrink-0" />
            <Link
              href="/orders"
              className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-white/10 px-3.5 text-panel-muted transition-colors hover:bg-white/15"
            >
              <Search className="size-4 shrink-0" />
              <span className="truncate text-[13px] font-medium">Search orders</span>
            </Link>
            <Link
              href="/payments"
              aria-label="Alerts"
              className="relative inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/15"
            >
              <Bell className="size-[18px]" />
              {badges.review > 0 && (
                <span className="absolute right-2 top-2 size-2 rounded-full bg-brand ring-2 ring-panel" />
              )}
            </Link>
            <Link
              href="/settings"
              aria-label="Settings"
              data-tour="tour-settings"
              className="shrink-0"
            >
              <Avatar name={db.business.owner} className="size-10 ring-2 ring-white/20" />
            </Link>
          </div>
          {/* Renders nothing — and starts nothing — on a device that has never
              signed in, which is the ordinary case. */}
          <SyncStatus tone="panel" className="mt-2.5" />
        </header>

        <main className="content-sheet relative -mt-6 min-h-[60vh] flex-1 bg-bg px-4 pb-32 pt-5 lg:mt-0 lg:rounded-none lg:px-8 lg:pb-12 lg:pt-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>

      {/* ---- Mobile bottom navigation -----------------------------------
           A floating forest pill. The active tab expands into a lime label
           pill; the rest stay icon-only, so the bar never crowds. */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 px-4 pb-3 lg:hidden">
        <div className="mx-auto flex max-w-sm items-center gap-1 rounded-pill bg-panel p-2 shadow-float">
          {primaryNav.map((item) => (
            <NavTab
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isActive(pathname, item.href)}
              count={item.badge ? badges[item.badge] : 0}
              tourId={tourIdFor(item.href)}
            />
          ))}
          <NavTab
            href="/more"
            label="More"
            icon={MoreHorizontal}
            active={
              isActive(pathname, "/more") ||
              !["/", "/orders", "/inbox"].some((h) => isActive(pathname, h))
            }
            count={0}
          />
          <button
            onClick={() => setQuickOpen(true)}
            aria-label="Quick actions"
            data-tour="tour-add"
            className="ml-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink transition-transform active:scale-95"
          >
            <Plus className="size-[22px]" strokeWidth={2.6} />
          </button>
        </div>
      </nav>

      <QuickActions open={quickOpen} onClose={() => setQuickOpen(false)} />
      <InstallPrompt />
    </div>
  );
}

function NavTab({
  href,
  label,
  icon: Icon,
  active,
  count,
  tourId,
}: {
  href: string;
  label: string;
  icon: typeof Bell;
  active: boolean;
  count: number;
  tourId?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      data-tour={tourId}
      className={cn(
        "relative flex h-11 items-center justify-center gap-2 rounded-full text-[12px] font-bold transition-[background-color,color,flex] duration-200",
        active
          ? "flex-1 bg-brand px-3 text-brand-ink"
          : "w-11 shrink-0 text-panel-muted hover:text-white",
      )}
    >
      <span className="relative shrink-0">
        <Icon className="size-[20px]" strokeWidth={active ? 2.5 : 2} />
        {count > 0 && !active && (
          <span className="tabular absolute -right-2 -top-1.5 min-w-4 rounded-full bg-brand px-1 text-[9px] font-bold leading-4 text-brand-ink">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </span>
      {active && <span className="truncate">{label}</span>}
    </Link>
  );
}

const quickActions = [
  {
    href: "/orders/?new=1",
    label: "New order",
    description: "Turn a conversation into a sale",
    icon: Package,
    tone: "bg-brand text-brand-ink",
  },
  {
    href: "/capture/?new=1",
    label: "Scan a receipt",
    description: "Receipt, M-Pesa message or statement",
    icon: ScanLine,
    tone: "bg-panel text-brand",
  },
  {
    href: "/payments/?new=1",
    label: "Record a payment",
    description: "M-Pesa, cash or bank transfer",
    icon: Wallet,
    tone: "bg-badge-4-bg text-badge-4-fg",
  },
];

function QuickActions({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Quick actions">
      <div className="space-y-2 pb-6">
        {quickActions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            onClick={onClose}
            className="flex items-center gap-3.5 rounded-2xl border border-border-subtle bg-surface p-3.5 transition-colors hover:bg-surface-hover"
          >
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-2xl",
                action.tone,
              )}
            >
              <action.icon className="size-5" strokeWidth={2.2} />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold">{action.label}</span>
              <span className="block text-[13px] text-text-secondary">{action.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </Sheet>
  );
}
