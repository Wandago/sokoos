"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, MoreHorizontal, Plus, ScanLine, Wallet, Package } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import { needsReviewCount, unreadCount } from "@/lib/selectors";
import { allNav, primaryNav } from "@/lib/nav";
import { Sheet } from "./ui/sheet";
import { InstallPrompt } from "./install-prompt";
import { SokoMark } from "./soko-mark";

function useBadges() {
  const { db } = useStore();
  return {
    inbox: unreadCount(db),
    review: needsReviewCount(db),
    openOrders: db.orders.filter((o) => ["new", "confirmed", "packed"].includes(o.status)).length,
  };
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { db } = useStore();
  const badges = useBadges();
  const [quickOpen, setQuickOpen] = useState(false);

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
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
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
            className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-brand-ink hover:bg-brand-hover"
          >
            <Plus className="size-4" strokeWidth={2.5} />
            New
          </button>
        </div>
      </aside>

      {/* ---- Main column ------------------------------------------------ */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="pt-safe sticky top-0 z-30 border-b border-border-subtle bg-bg/85 backdrop-blur-lg lg:hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <SokoMark className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold leading-tight tracking-tight">
                {db.business.name}
              </p>
              <p className="truncate text-[11px] text-text-secondary">
                Till {db.business.tillNumber} · {db.business.location}
              </p>
            </div>
            <Link
              href="/payments"
              aria-label="Alerts"
              className="relative inline-flex size-10 items-center justify-center rounded-full border border-border-subtle bg-surface text-text-secondary hover:bg-surface-hover"
            >
              <Bell className="size-[18px]" />
              {badges.review > 0 && (
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger ring-2 ring-surface" />
              )}
            </Link>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>

      {/* ---- Mobile bottom navigation -----------------------------------
           A floating forest pill with a lime action key in the middle, so the
           three things a seller does all day are one thumb-reach apart. */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 px-4 pb-3 lg:hidden">
        <div className="mx-auto flex max-w-sm items-center justify-between gap-1 rounded-pill bg-panel px-3 py-2.5 shadow-float">
          {primaryNav.map((item) => (
            <NavTab
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={isActive(pathname, item.href)}
              count={item.badge ? badges[item.badge] : 0}
            />
          ))}
          <button
            onClick={() => setQuickOpen(true)}
            aria-label="Quick actions"
            className="mx-1 inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-brand-ink transition-transform active:scale-95"
          >
            <Plus className="size-6" strokeWidth={2.6} />
          </button>
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
}: {
  href: string;
  label: string;
  icon: typeof Bell;
  active: boolean;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-semibold transition-colors",
        active ? "bg-panel-raised text-brand" : "text-panel-muted hover:text-white",
      )}
    >
      <span className="relative">
        <Icon className="size-[21px]" strokeWidth={active ? 2.4 : 2} />
        {count > 0 && (
          <span className="tabular absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-brand px-1 text-[9px] font-bold leading-4 text-brand-ink">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </span>
      {label}
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
    tone: "bg-ai-soft text-ai-text",
  },
  {
    href: "/payments/?new=1",
    label: "Record a payment",
    description: "M-Pesa, cash or bank transfer",
    icon: Wallet,
    tone: "bg-success-soft text-success-text",
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
                "flex size-11 shrink-0 items-center justify-center rounded-xl",
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
