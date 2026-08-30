import { ArrowUpRight, Bell, Nfc, Plus, Search } from "lucide-react";
import { SokoMark } from "./soko-mark";

/**
 * A miniature of the real dashboard, drawn in the same tokens as the app. It
 * is a picture, not the product — but every colour and radius comes from the
 * same place, so the landing page can never drift from what ships.
 */
export function PhoneMock({ className }: { className?: string }) {
  return (
    <div
      className={
        "relative w-[268px] shrink-0 rounded-[42px] bg-forest-950 p-2.5 text-left shadow-overlay ring-1 ring-white/10 " +
        (className ?? "")
      }
    >
      <div className="overflow-hidden rounded-[34px] bg-[#F1F3EF]">
        {/* Forest header */}
        <div className="relative bg-forest-900 px-3.5 pb-8 pt-3">
          <div className="mx-auto mb-3 h-1 w-16 rounded-full bg-white/20" />
          <div className="flex items-center gap-1.5">
            <SokoMark className="size-7" />
            <span className="flex h-7 flex-1 items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-[9px] text-forest-200">
              <Search className="size-2.5" />
              Search orders
            </span>
            <span className="flex size-7 items-center justify-center rounded-full bg-white/10 text-white">
              <Bell className="size-3" />
            </span>
          </div>
        </div>

        {/* Content sheet */}
        <div className="-mt-5 rounded-t-[22px] bg-[#F1F3EF] px-3.5 pb-4 pt-4">
          <p className="text-[9px] font-medium text-[#5B665A]">Good evening,</p>
          <p className="text-[15px] font-extrabold leading-tight tracking-[-0.03em] text-[#121913]">
            Louis Wandago
          </p>

          {/* Balance card */}
          <div className="relative mt-3 overflow-hidden rounded-[18px] bg-forest-900 p-3.5 text-white">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-10 -right-6 size-32 rounded-full opacity-40 blur-2xl"
              style={{ background: "radial-gradient(circle, var(--lime-500), transparent 70%)" }}
            />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-[8px] font-semibold text-forest-200">Balance, last 30 days</p>
                <p className="tabular mt-1 text-[19px] font-extrabold leading-none tracking-[-0.03em]">
                  KES 490,677
                </p>
                <span className="tabular mt-2 inline-flex items-center gap-0.5 rounded-full bg-brand px-1.5 py-0.5 text-[7px] font-bold text-brand-ink">
                  <ArrowUpRight className="size-2" />
                  +6.0% this month
                </span>
              </div>
              <Nfc className="size-3.5 rotate-90 text-forest-200" />
            </div>
            <div className="relative mt-4 flex items-end justify-between">
              <p className="text-[9px] font-semibold">Zawadi Collection</p>
              <span className="rounded-full bg-brand px-1.5 py-0.5 text-[6px] font-extrabold uppercase tracking-[0.08em] text-brand-ink">
                M-Pesa
              </span>
            </div>
          </div>

          {/* Metric pair */}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="rounded-[14px] bg-brand p-2.5 text-brand-ink">
              <p className="text-[8px] font-bold">Earning</p>
              <p className="tabular mt-1 text-[13px] font-extrabold leading-none">KES 54.5K</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-brand-ink/15">
                <div className="h-full w-[78%] rounded-full bg-brand-ink" />
              </div>
            </div>
            <div className="rounded-[14px] bg-forest-900 p-2.5 text-white">
              <p className="text-[8px] font-bold">Spending</p>
              <p className="tabular mt-1 text-[13px] font-extrabold leading-none">KES 41.8K</p>
              <div className="mt-2 flex h-4 items-end gap-0.5">
                {[8, 5, 11, 7, 13, 9, 16].map((h, i) => (
                  <span
                    key={i}
                    className={
                      i === 6 ? "flex-1 rounded-sm bg-brand" : "flex-1 rounded-sm bg-white/20"
                    }
                    style={{ height: h }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Recent order row */}
          <div className="mt-2.5 flex items-center gap-2 rounded-[14px] bg-white p-2.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-brand text-[8px] font-bold text-brand-ink">
              KM
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[9px] font-semibold text-[#121913]">Kevin Mutua</p>
              <p className="text-[7px] text-[#5B665A]">#11056 · Facebook</p>
            </div>
            <p className="tabular text-[9px] font-bold text-[#121913]">KES 6,900</p>
          </div>
        </div>

        {/* Floating nav */}
        <div className="px-3.5 pb-3.5">
          <div className="flex items-center gap-1 rounded-full bg-forest-900 p-1.5">
            <span className="flex h-7 flex-1 items-center justify-center gap-1 rounded-full bg-brand px-2 text-[8px] font-bold text-brand-ink">
              Home
            </span>
            <span className="size-7 rounded-full" />
            <span className="size-7 rounded-full" />
            <span className="flex size-7 items-center justify-center rounded-full bg-brand text-brand-ink">
              <Plus className="size-3.5" strokeWidth={2.6} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
