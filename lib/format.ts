import type { Channel } from "./types";

const kes = new Intl.NumberFormat("en-KE", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

/** KES 48,500 — the product always shows the currency, never a bare number. */
export function money(
  amount: number,
  opts?: { compact?: boolean; sign?: boolean; bare?: boolean },
) {
  const abs = Math.abs(amount);
  const sign = opts?.sign ? (amount < 0 ? "−" : "+") : amount < 0 ? "−" : "";
  const unit = opts?.bare ? "" : "KES ";
  if (opts?.compact && abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}${unit}${m >= 100 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (opts?.compact && abs >= 10_000) {
    const k = abs / 1000;
    return `${sign}${unit}${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `${sign}${unit}${kes.format(Math.round(abs))}`;
}

/** Bare number with thousands separators, for tables that show KES in a header. */
export function num(value: number) {
  return kes.format(Math.round(value));
}

export function initials(name: string) {
  // Social handles ("@bella.ke") need stripping before they read as initials.
  const parts = name
    .replace(/[^\p{L}\p{N}\s._-]/gu, "")
    .split(/[\s._-]+/)
    .filter(Boolean);
  return (
    parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

export function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return "Today";
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" });
}

export function clockTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-KE", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function fullDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isSameDay(iso: string, date: Date) {
  return new Date(iso).toDateString() === date.toDateString();
}

export const channelLabel: Record<Channel, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  call: "Phone call",
  referral: "Referral",
  "walk-in": "Walk-in",
};

/** Brand-neutral channel tints — recognisable without cloning platform logos,
 * and legible on both the light and dark surfaces. The label always sits
 * beside the dot, so identity is never carried by colour alone. */
export const channelTint: Record<Channel, string> = {
  instagram: "#e04b7a",
  tiktok: "#22b8cf",
  whatsapp: "#2ec27e",
  facebook: "#4c8bf5",
  call: "#8b96a5",
  referral: "#a78bfa",
  "walk-in": "#b08968",
};

export function pct(value: number, digits = 0) {
  return `${value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}
