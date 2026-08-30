import type { AdminDatabase, Merchant, Plan } from "./types";
import { planLabel } from "./types";

const ACTIVE: Merchant["status"][] = ["active", "trial", "past_due"];

export function platformStats(db: AdminDatabase) {
  const live = db.merchants.filter((m) => ACTIVE.includes(m.status));
  const gmv = live.reduce((sum, m) => sum + m.gmv30d, 0);
  const gmvPrev = live.reduce((sum, m) => sum + m.gmvPrev30d, 0);
  const orders = live.reduce((sum, m) => sum + m.orders30d, 0);
  const mrr = db.merchants.reduce((sum, m) => sum + m.mrr, 0);
  const paying = db.merchants.filter((m) => m.mrr > 0).length;

  const dayAgo = Date.now() - 86400000;
  const activeToday = db.merchants.filter((m) => +new Date(m.lastActiveAt) >= dayAgo).length;

  const monthAgo = Date.now() - 30 * 86400000;
  const newThisMonth = db.merchants.filter((m) => +new Date(m.joinedAt) >= monthAgo).length;
  const churned = db.merchants.filter((m) => m.status === "churned").length;

  return {
    merchants: db.merchants.length,
    live: live.length,
    activeToday,
    newThisMonth,
    churned,
    churnRate: db.merchants.length ? (churned / db.merchants.length) * 100 : 0,
    gmv,
    gmvDelta: gmvPrev > 0 ? ((gmv - gmvPrev) / gmvPrev) * 100 : 0,
    orders,
    mrr,
    paying,
    /** What SokoOS keeps per shilling transacted, as a percentage. */
    takeRate: gmv > 0 ? (mrr / gmv) * 100 : 0,
    arpu: paying ? Math.round(mrr / paying) : 0,
  };
}

export function planMix(db: AdminDatabase) {
  const plans: Plan[] = ["starter", "growth", "scale"];
  return plans.map((plan) => {
    const merchants = db.merchants.filter((m) => m.plan === plan);
    return {
      plan,
      label: planLabel[plan],
      count: merchants.length,
      mrr: merchants.reduce((sum, m) => sum + m.mrr, 0),
    };
  });
}

/** Sign-ups per week for the last `weeks` weeks. */
export function signupSeries(db: AdminDatabase, weeks = 10) {
  const points: { label: string; value: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    points.push({
      label: start.toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
      value: db.merchants.filter((m) => {
        const at = +new Date(m.joinedAt);
        return at >= +start && at <= +end;
      }).length,
    });
  }
  return points;
}

export function regionBreakdown(db: AdminDatabase) {
  const totals = new Map<string, { gmv: number; merchants: number }>();
  db.merchants.forEach((m) => {
    const current = totals.get(m.region) ?? { gmv: 0, merchants: 0 };
    totals.set(m.region, { gmv: current.gmv + m.gmv30d, merchants: current.merchants + 1 });
  });
  return [...totals.entries()]
    .map(([region, v]) => ({ region, ...v }))
    .sort((a, b) => b.gmv - a.gmv);
}

export function topMerchants(db: AdminDatabase, limit = 6) {
  return [...db.merchants].sort((a, b) => b.gmv30d - a.gmv30d).slice(0, limit);
}

export function merchantById(db: AdminDatabase, id: string) {
  return db.merchants.find((m) => m.id === id);
}

export function queueCounts(db: AdminDatabase) {
  return {
    reports: db.reports.filter((r) => r.status === "open" || r.status === "reviewing").length,
    tickets: db.tickets.filter((t) => t.status !== "solved").length,
    breached: db.tickets.filter((t) => t.status !== "solved" && t.slaHours < 0).length,
    pastDue: db.merchants.filter((m) => m.status === "past_due").length,
  };
}
