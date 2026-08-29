"use client";

import { Suspense, useState } from "react";
import { Bike, MapPin, Phone, Star } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ListSkeleton } from "@/components/ui/state";
import { Avatar } from "@/components/ui/avatar";
import { Badge, DeliveryBadge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/chart";
import { IconButton } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { customerOf, orderTotal } from "@/lib/selectors";
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

type Tab = "active" | "today" | "riders";

function DeliveriesScreen() {
  const { db } = useStore();
  const [tab, setTab] = useState<Tab>("active");

  const active = db.deliveries.filter((d) => d.status !== "delivered" && d.status !== "failed");
  const today = db.deliveries.filter((d) => isSameDay(d.assignedAt, new Date()));
  const deliveredToday = today.filter((d) => d.status === "delivered");
  const feesToday = deliveredToday.reduce((sum, d) => sum + d.fee, 0);

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
        <StatTile label="Fees today" unit="KES" value={money(feesToday, { compact: true, bare: true })} />
      </div>

      <Segmented
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "active", label: "On the way", count: active.length },
          { value: "today", label: "Today", count: today.length },
          { value: "riders", label: "Riders", count: db.riders.length },
        ]}
      />

      {tab === "riders" ? (
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
                      {order.code} · {money(orderTotal(order))}
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
