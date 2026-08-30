"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Avatar } from "./ui/avatar";
import { ChannelBadge, OrderStatusBadge, PaymentStatusBadge } from "./ui/badge";
import { money, relativeTime } from "@/lib/format";
import { sellerReceives } from "@/lib/selectors";
import type { Customer, Order } from "@/lib/types";

export function OrderRow({ order, customer }: { order: Order; customer?: Customer }) {
  const name = customer?.name ?? "Customer";
  return (
    <Link
      href={`/orders/?id=${order.id}`}
      className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5 shadow-card transition-colors hover:bg-surface-hover"
    >
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[15px] font-semibold">{name}</p>
          <p className="tabular shrink-0 text-[15px] font-bold">{money(sellerReceives(order))}</p>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-text-secondary">
          <span className="tabular font-medium">{order.code}</span>
          <span aria-hidden>·</span>
          <ChannelBadge channel={order.channel} />
          <span aria-hidden>·</span>
          <span>{relativeTime(order.createdAt)}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-text-muted" />
    </Link>
  );
}
