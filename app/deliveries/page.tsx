"use client";

import { Suspense, useState } from "react";
import { Bike, HandCoins, MapPin, Phone, Star, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ListSkeleton } from "@/components/ui/state";
import { Avatar } from "@/components/ui/avatar";
import { Badge, DeliveryBadge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/chart";
import { IconButton } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  awaitingPayment,
  customerOf,
  feesPaidDirectToRiders,
  riderFloat,
  riderFloatByRider,
  sellerReceives,
  settlementOf,
} from "@/lib/selectors";
import type { DeliverySettlement } from "@/lib/types";
import { isSameDay, money, relativeTime } from "@/lib/format";
import Link from "next/link";

export default function DeliveriesPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hydrated>
        <DeliveriesScreen />
      </Hydrated>
    </Suspense>
  );
}

type Tab = "active" | "today" | "riders" | "float";

/**
 * How each trip is settled.
 *
 * The default arrangement in Nairobi is that the boda is independent: the
 * customer pays the seller for the goods and the rider for the ride, and the
 * two never mix. Labelling that on every delivery keeps the seller's books
 * honest, because a fee they never touched is not their money either way.
 */
const settlementMeta: Record<
  DeliverySettlement,
  { label: string; short: string; tone: "neutral" | "delivery" | "pending" | "success" }
> = {
  customer_pays_rider: {
    label: "Customer pays the rider",
    short: "Paid at the door",
    tone: "neutral",
  },
  business_pays_rider: {
    label: "You charge and you pay the rider",
    short: "You settle",
    tone: "delivery",
  },
  rider_collects: {
    label: "The rider collects for you",
    short: "Rider collects",
    tone: "pending",
  },
  free: { label: "Free delivery, you cover it", short: "On you", tone: "success" },
};

function DeliveriesScreen() {
  const { db } = useStore();
  const [tab, setTab] = useState<Tab>("active");

  const active = db.deliveries.filter(
    (d) => d.status !== "delivered" && d.status !== "failed" && d.status !== "returned",
  );
  const today = db.deliveries.filter((d) => isSameDay(d.assignedAt, new Date()));
  const deliveredToday = today.filter((d) => d.status === "delivered");
  // Only fees the seller is actually settling. The rest are between the
  // customer and the rider, and counting them would be counting other
  // people's money.
  const feesToday = deliveredToday
    .filter((d) => (d.settlement ?? "business_pays_rider") === "business_pays_rider")
    .reduce((sum, d) => sum + d.fee, 0);
  const float = riderFloat(db);
  const waiting = awaitingPayment(db);
  const passedThrough = feesPaidDirectToRiders(db);

  const list = tab === "active" ? active : today;

  return (
    <>
      <PageHeader
        title="Deliveries"
        subtitle="Who is carrying what, and where it is right now."
      />

      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <StatTile label="On the way" value={String(active.length)} sub="right now" tone="delivery" />
        <StatTile label="Delivered" value={String(deliveredToday.length)} sub="today" />
        {float > 0 ? (
          <StatTile
            label="Held"
            unit="KES"
            value={money(float, { compact: true, bare: true })}
            sub="by riders"
            tone="danger"
          />
        ) : (
          <StatTile label="You pay" unit="KES" value={money(feesToday, { compact: true, bare: true })} sub="in fees today" />
        )}
      </div>

      {/* The rider is at the door and cannot hand over until the seller sees
          the money. It is the one moment in the whole flow where the app has
          to be answered immediately, so it sits above everything else. */}
      {waiting.length > 0 && tab !== "riders" && tab !== "float" && (
        <div className="mb-4 space-y-2.5">
          {waiting.map((delivery) => {
            const order = db.orders.find((o) => o.id === delivery.orderId);
            const rider = db.riders.find((r) => r.id === delivery.riderId);
            if (!order) return null;
            return (
              <AtTheDoor
                key={delivery.id}
                deliveryId={delivery.id}
                riderName={rider?.name ?? "Your rider"}
                customerName={customerOf(db, order)?.name ?? "the customer"}
                amount={sellerReceives(order)}
                address={delivery.address}
              />
            );
          })}
        </div>
      )}

      {passedThrough > 0 && (
        <p className="mb-4 rounded-2xl bg-surface-sunken px-4 py-3 text-[12px] leading-relaxed text-text-secondary">
          Your customers paid riders {money(passedThrough)} directly in the last 30 days. That is
          never in your books — but it is what they paid on top of your prices, which is worth
          knowing before you raise them.
        </p>
      )}

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "active", label: "On the way", count: active.length },
          { value: "today", label: "Today", count: today.length },
          ...(float > 0 ? [{ value: "float" as const, label: "Rider float", count: riderFloatByRider(db).length }] : []),
          { value: "riders", label: "Riders", count: db.riders.length },
        ]}
      />

      {tab === "float" ? (
        <RiderFloat />
      ) : tab === "riders" ? (
        <div className="space-y-2.5">
          {db.riders.map((rider) => (
            <div
              key={rider.id}
              className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5 shadow-card"
            >
              <Avatar name={rider.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[15px] font-semibold">{rider.name}</p>
                  <span className="tabular flex shrink-0 items-center gap-1 text-[12px] font-semibold">
                    <Star className="size-3.5 fill-pending text-pending" />
                    {rider.rating.toFixed(1)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[12px] text-text-secondary">
                  {rider.vehicle === "boda" ? "Boda" : rider.vehicle === "car" ? "Car" : "Van"} ·{" "}
                  {rider.zones.slice(0, 3).join(", ")}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge tone={rider.status === "available" ? "success" : "delivery"} dot>
                    {rider.status === "available" ? "Available" : "On delivery"}
                  </Badge>
                  <Badge>{rider.deliveriesToday} today</Badge>
                </div>
              </div>
              <IconButton label={`Call ${rider.name}`}>
                <Phone className="size-[18px]" />
              </IconButton>
            </div>
          ))}
        </div>
      ) : list.length ? (
        <div className="space-y-2.5">
          {list.map((delivery) => {
            const order = db.orders.find((o) => o.id === delivery.orderId);
            const rider = db.riders.find((r) => r.id === delivery.riderId);
            const customer = order ? customerOf(db, order) : undefined;
            if (!order) return null;
            const settlement = delivery.settlement ?? settlementOf(order);
            return (
              <Link
                key={delivery.id}
                href={`/orders/?id=${order.id}`}
                className="block rounded-card border border-border-subtle bg-surface p-3.5 shadow-card transition-colors hover:bg-surface-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{customer?.name}</p>
                    <p className="tabular mt-0.5 text-[12px] text-text-secondary">
                      {order.code} · {money(sellerReceives(order))}
                    </p>
                  </div>
                  <DeliveryBadge status={delivery.status} />
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" />
                    {delivery.address}
                  </span>
                  {rider && (
                    <span className="flex items-center gap-1.5">
                      <Bike className="size-3.5" />
                      {rider.name}
                    </span>
                  )}
                  <span className="ml-auto">
                    {delivery.status === "delivered" && delivery.deliveredAt
                      ? `Delivered ${relativeTime(delivery.deliveredAt)}`
                      : `Assigned ${relativeTime(delivery.assignedAt)}`}
                  </span>
                </div>

                {/* Whose money the fee is. Stated on every trip, because it
                    decides whether it belongs in the books at all. */}
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Badge tone={settlementMeta[settlement].tone}>
                    {settlementMeta[settlement].short} · {money(delivery.fee)}
                  </Badge>
                  {settlement === "customer_pays_rider" && (
                    <span className="text-[11px] text-text-muted">Not your money either way</span>
                  )}
                  {delivery.cashCollected && !delivery.remittedAt && (
                    <Badge tone="danger">
                      {rider?.name?.split(" ")[0] ?? "Rider"} holds {money(delivery.cashCollected)}
                    </Badge>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Bike className="size-6" />}
          title="Nothing on the road"
          body="Assign a rider from an order and it will appear here."
        />
      )}
    </>
  );
}

/**
 * The handover moment.
 *
 * The rider is standing with the customer. The seller checks their phone for
 * the M-Pesa message, confirms, and only then does the rider hand the goods
 * over. Every delivery in Kenya turns on this thirty seconds, and it is the
 * one thing the app should make impossible to fumble.
 */
function AtTheDoor({
  deliveryId,
  riderName,
  customerName,
  amount,
  address,
}: {
  deliveryId: string;
  riderName: string;
  customerName: string;
  amount: number;
  address: string;
}) {
  const { confirmDeliveryPayment } = useStore();
  const toast = useToast();

  return (
    <div className="rounded-card bg-panel p-4 text-panel-text shadow-float ring-1 ring-white/5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink">
          <HandCoins className="size-5" strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-panel-muted">
            At the door
          </p>
          <p className="mt-0.5 text-[15px] font-bold leading-snug">
            {riderName} is with {customerName}
          </p>
          <p className="tabular mt-1 text-[13px] text-panel-muted">
            Expecting {money(amount)} · {address}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-panel-muted">
        Check that the payment has landed before you tell the rider to hand over.
      </p>
      <Button
        full
        className="mt-3"
        onClick={() => {
          confirmDeliveryPayment(deliveryId);
          toast("Confirmed. Tell the rider to hand it over.");
        }}
      >
        I have seen the payment
      </Button>
    </div>
  );
}

/**
 * Money the seller owns that is in someone else's pocket. Nothing else in the
 * app shows it, because the order reads as paid — which is exactly how it goes
 * missing.
 */
function RiderFloat() {
  const { db, remitRiderCash } = useStore();
  const toast = useToast();
  const holders = riderFloatByRider(db);
  const outstanding = db.deliveries.filter((d) => d.cashCollected && !d.remittedAt);

  return (
    <>
      <div className="mb-5 flex gap-3 rounded-2xl bg-pending-soft p-4">
        <Wallet className="size-5 shrink-0 text-pending-text" />
        <p className="text-[13px] leading-relaxed text-pending-text">
          These riders collected on your behalf and have not handed the money over yet. The orders
          read as paid, so nothing else in the app will tell you this money is missing.
        </p>
      </div>

      <div className="space-y-2.5">
        {holders.map(({ rider, amount, trips }) => (
          <div
            key={rider?.id ?? amount}
            className="rounded-card border border-border-subtle bg-surface p-3.5 shadow-card"
          >
            <div className="flex items-center gap-3">
              <Avatar name={rider?.name ?? "Rider"} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{rider?.name ?? "Rider"}</p>
                <p className="text-[12px] text-text-secondary">
                  {trips} {trips === 1 ? "trip" : "trips"} · {rider?.phone}
                </p>
              </div>
              <p className="tabular shrink-0 text-[17px] font-extrabold">{money(amount)}</p>
            </div>

            <div className="mt-3 space-y-2">
              {outstanding
                .filter((d) => d.riderId === rider?.id)
                .map((delivery) => {
                  const order = db.orders.find((o) => o.id === delivery.orderId);
                  return (
                    <div
                      key={delivery.id}
                      className="flex items-center gap-2.5 rounded-xl bg-surface-sunken px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold">
                          {order?.code} · {order ? customerOf(db, order)?.name : ""}
                        </p>
                        <p className="text-[11px] text-text-muted">
                          Collected {delivery.deliveredAt ? relativeTime(delivery.deliveredAt) : ""}
                        </p>
                      </div>
                      <p className="tabular shrink-0 text-[13px] font-bold">
                        {money(delivery.cashCollected ?? 0)}
                      </p>
                      <button
                        onClick={() => {
                          remitRiderCash(delivery.id);
                          toast(`${money(delivery.cashCollected ?? 0)} received. Books are square.`);
                        }}
                        className="shrink-0 rounded-full bg-brand px-3 py-1.5 text-[11px] font-bold text-brand-ink transition-opacity hover:opacity-90"
                      >
                        Received
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 px-1 text-[12px] leading-relaxed text-text-muted">
        Marking it received records the money arriving. It is not a new sale — the sale was already
        counted when the order was delivered.
      </p>
    </>
  );
}
