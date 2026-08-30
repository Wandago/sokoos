import { cn } from "@/lib/cn";
import { channelLabel, channelTint } from "@/lib/format";
import type {
  Channel,
  DeliveryStatus,
  OrderStatus,
  PaymentState,
  PaymentStatus,
} from "@/lib/types";

type Tone = "neutral" | "brand" | "success" | "pending" | "danger" | "delivery" | "ai";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-text-secondary border-border-subtle",
  brand: "bg-brand-soft text-brand-soft-text border-transparent",
  success: "bg-success-soft text-success-text border-transparent",
  pending: "bg-pending-soft text-pending-text border-transparent",
  danger: "bg-danger-soft text-danger-text border-transparent",
  delivery: "bg-delivery-soft text-delivery-text border-transparent",
  ai: "bg-ai-soft text-ai-text border-transparent",
};

const dots: Record<Tone, string> = {
  neutral: "bg-text-muted",
  brand: "bg-brand",
  success: "bg-success",
  pending: "bg-pending",
  danger: "bg-danger",
  delivery: "bg-delivery",
  ai: "bg-ai",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", dots[tone])} />}
      {children}
    </span>
  );
}

/* ---- Order lifecycle ------------------------------------------------- */

const orderStatusMap: Record<OrderStatus, { label: string; tone: Tone }> = {
  new: { label: "New", tone: "brand" },
  confirmed: { label: "Confirmed", tone: "neutral" },
  packed: { label: "Packed", tone: "neutral" },
  out_for_delivery: { label: "Out for delivery", tone: "delivery" },
  delivered: { label: "Delivered", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, tone } = orderStatusMap[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

export const orderStatusLabel = (status: OrderStatus) => orderStatusMap[status].label;

/* ---- Money states ---------------------------------------------------- */

const paymentStatusMap: Record<PaymentStatus, { label: string; tone: Tone }> = {
  paid: { label: "Paid", tone: "success" },
  partial: { label: "Part paid", tone: "pending" },
  unpaid: { label: "Unpaid", tone: "danger" },
  cod: { label: "Cash on delivery", tone: "pending" },
  refunded: { label: "Refunded", tone: "neutral" },
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { label, tone } = paymentStatusMap[status];
  return <Badge tone={tone}>{label}</Badge>;
}

export const paymentStatusLabel = (status: PaymentStatus) => paymentStatusMap[status].label;

const paymentStateMap: Record<PaymentState, { label: string; tone: Tone }> = {
  received: { label: "Received", tone: "success" },
  pending: { label: "Pending", tone: "pending" },
  failed: { label: "Failed", tone: "danger" },
  review: { label: "Needs review", tone: "ai" },
};

export function PaymentStateBadge({ state }: { state: PaymentState }) {
  const { label, tone } = paymentStateMap[state];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

/* ---- Delivery -------------------------------------------------------- */

const deliveryMap: Record<DeliveryStatus, { label: string; tone: Tone }> = {
  assigned: { label: "Assigned", tone: "neutral" },
  picked: { label: "Picked up", tone: "delivery" },
  in_transit: { label: "On the way", tone: "delivery" },
  awaiting_payment: { label: "Waiting for payment", tone: "pending" },
  delivered: { label: "Delivered", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
  returned: { label: "Returned", tone: "neutral" },
};

export function DeliveryBadge({ status }: { status: DeliveryStatus }) {
  const { label, tone } = deliveryMap[status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

/* ---- Where the sale came from ---------------------------------------- */

export function ChannelBadge({ channel, className }: { channel: Channel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium text-text-secondary",
        className,
      )}
    >
      <span className="size-1.5 rounded-full" style={{ background: channelTint[channel] }} />
      {channelLabel[channel]}
    </span>
  );
}

/** AI confidence, shown as a number and a bar — never as a bare claim. */
export function ConfidenceMeter({ value, className }: { value: number; className?: string }) {
  const percent = Math.round(value * 100);
  const tone = percent >= 90 ? "bg-success" : percent >= 75 ? "bg-pending" : "bg-danger";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-surface-sunken">
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${percent}%` }} />
      </span>
      <span className="tabular text-[11px] font-semibold text-text-secondary">{percent}%</span>
    </span>
  );
}
