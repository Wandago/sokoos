"use client";

import { Suspense, useMemo, useState } from "react";
import {
  Bike,
  Check,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { Segmented } from "@/components/ui/segmented";
import { SearchInput, Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ListSkeleton } from "@/components/ui/state";
import { LoadMore } from "@/components/ui/load-more";
import { OrderRow } from "@/components/order-row";
import { Sheet } from "@/components/ui/sheet";
import { Button, IconButton } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import {
  Badge,
  ChannelBadge,
  OrderStatusBadge,
  PaymentStatusBadge,
  orderStatusLabel,
} from "@/components/ui/badge";
import { Divider } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useQuery } from "@/lib/use-query";
import { customerOf, orderSubtotal, orderTotal, riderOf } from "@/lib/selectors";
import { channelLabel, clockTime, fullDate, money } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Channel, OrderItem, OrderStatus } from "@/lib/types";

export default function OrdersPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hydrated>
        <OrdersScreen />
      </Hydrated>
    </Suspense>
  );
}

type Filter = "all" | "open" | "out_for_delivery" | "delivered" | "unpaid";

function OrdersScreen() {
  const { db } = useStore();
  const { get, set } = useQuery();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(30);

  const openOrder = db.orders.find((o) => o.id === get("id"));
  const creating = get("new") === "1";

  const counts = useMemo(
    () => ({
      all: db.orders.length,
      open: db.orders.filter((o) => ["new", "confirmed", "packed"].includes(o.status)).length,
      out_for_delivery: db.orders.filter((o) => o.status === "out_for_delivery").length,
      delivered: db.orders.filter((o) => o.status === "delivered").length,
      unpaid: db.orders.filter((o) => o.paymentStatus === "unpaid" || o.paymentStatus === "cod")
        .length,
    }),
    [db.orders],
  );

  const orders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return db.orders.filter((order) => {
      if (filter === "open" && !["new", "confirmed", "packed"].includes(order.status)) return false;
      if (filter === "out_for_delivery" && order.status !== "out_for_delivery") return false;
      if (filter === "delivered" && order.status !== "delivered") return false;
      if (filter === "unpaid" && !["unpaid", "cod"].includes(order.paymentStatus)) return false;
      if (!query) return true;
      const customer = customerOf(db, order);
      return (
        order.code.toLowerCase().includes(query) ||
        (customer?.name.toLowerCase().includes(query) ?? false) ||
        order.items.some((it) => it.name.toLowerCase().includes(query))
      );
    });
  }, [db, filter, search]);

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle={`${counts.open} open · ${counts.out_for_delivery} on the way · ${counts.delivered} delivered`}
        action={
          <Button size="sm" onClick={() => set("new", "1")}>
            <Plus className="size-4" strokeWidth={2.5} />
            New
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <SearchInput
          placeholder="Search order, customer or product"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisible(30);
          }}
        />
        <Segmented
          value={filter}
          onChange={(next) => {
            setFilter(next);
            setVisible(30);
          }}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "open", label: "Open", count: counts.open },
            { value: "out_for_delivery", label: "On the way", count: counts.out_for_delivery },
            { value: "unpaid", label: "Unpaid", count: counts.unpaid },
            { value: "delivered", label: "Delivered", count: counts.delivered },
          ]}
        />
      </div>

      {orders.length ? (
        <>
          <div className="space-y-2.5">
            {orders.slice(0, visible).map((order) => (
              <OrderRow key={order.id} order={order} customer={customerOf(db, order)} />
            ))}
          </div>
          <LoadMore
            total={orders.length}
            visible={visible}
            onMore={() => setVisible((v) => v + 30)}
          />
        </>
      ) : (
        <EmptyState
          icon={<Package className="size-6" />}
          title="Nothing here"
          body={
            search
              ? "No order matches that search."
              : "No orders in this view yet. Create one from a conversation."
          }
          action={
            <Button size="sm" onClick={() => set("new", "1")}>
              New order
            </Button>
          }
        />
      )}

      {openOrder && <OrderDetail orderId={openOrder.id} onClose={() => set("id", null)} />}
      <NewOrderSheet open={creating} onClose={() => set("new", null)} />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Order detail — the whole lifecycle for one sale in a single sheet.
 * ------------------------------------------------------------------ */

const nextStep: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  new: { status: "confirmed", label: "Confirm order" },
  confirmed: { status: "packed", label: "Mark as packed" },
  packed: { status: "out_for_delivery", label: "Send out for delivery" },
  out_for_delivery: { status: "delivered", label: "Mark as delivered" },
};

function OrderDetail({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { db, setOrderStatus, assignRider, recordPayment } = useStore();
  const toast = useToast();
  const [assigning, setAssigning] = useState(false);

  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return null;
  const customer = customerOf(db, order);
  const rider = riderOf(db, order);
  const step = nextStep[order.status];
  const paid = db.payments
    .filter((p) => p.orderId === order.id && p.state === "received")
    .reduce((sum, p) => sum + p.amount, 0);
  const balance = orderTotal(order) - paid;

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Order ${order.code}`}
      description={`${fullDate(order.createdAt)} at ${clockTime(order.createdAt)} · ${channelLabel[order.channel]}`}
      size="lg"
      footer={
        <div className="flex gap-2.5">
          {balance > 0 && order.status !== "cancelled" && (
            <Button
              variant="secondary"
              full
              onClick={() => {
                recordPayment({
                  orderId: order.id,
                  customerId: order.customerId,
                  customerName: customer?.name ?? "Customer",
                  method: "mpesa",
                  amount: balance,
                  reference: "",
                });
                toast("Payment received.");
              }}
            >
              <Wallet className="size-4" />
              Mark paid
            </Button>
          )}
          {step && (
            <Button
              full
              onClick={() => {
                setOrderStatus(order.id, step.status);
                toast(
                  step.status === "delivered"
                    ? "Delivered. It's in your ledger."
                    : `${orderStatusLabel(step.status)}.`,
                );
              }}
            >
              <Check className="size-4" strokeWidth={2.5} />
              {step.label}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
          <ChannelBadge channel={order.channel} />
        </div>

        {/* Customer */}
        <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5">
          <Avatar name={customer?.name ?? "Customer"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">{customer?.name}</p>
            <p className="truncate text-[12px] text-text-secondary">{customer?.phone}</p>
          </div>
          <IconButton label="Call customer">
            <Phone className="size-[18px]" />
          </IconButton>
          <IconButton label="Message customer">
            <MessageCircle className="size-[18px]" />
          </IconButton>
        </div>

        {/* Items */}
        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">
            Items
          </p>
          <div className="rounded-2xl border border-border-subtle bg-surface">
            {order.items.map((item, i) => (
              <div key={item.productId + i}>
                {i > 0 && <Divider />}
                <div className="flex items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{item.name}</p>
                    <p className="tabular text-[12px] text-text-secondary">
                      {item.qty} × {money(item.price)}
                    </p>
                  </div>
                  <p className="tabular shrink-0 text-[14px] font-semibold">
                    {money(item.price * item.qty)}
                  </p>
                </div>
              </div>
            ))}
            <Divider />
            <div className="space-y-2 p-3.5 text-[13px]">
              <Line label="Subtotal" value={money(orderSubtotal(order))} />
              <Line label="Delivery" value={money(order.deliveryFee)} />
              <Divider className="my-1" />
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold">Total</span>
                <span className="tabular text-[17px] font-extrabold">{money(orderTotal(order))}</span>
              </div>
              {paid > 0 && (
                <>
                  <Line label="Paid" value={`− ${money(paid)}`} />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Balance due</span>
                    <span
                      className={cn(
                        "tabular text-[15px] font-bold",
                        balance > 0 ? "text-danger" : "text-success",
                      )}
                    >
                      {balance > 0 ? money(balance) : "Settled"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Delivery */}
        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">
            Delivery
          </p>
          <div className="rounded-2xl border border-border-subtle bg-surface p-3.5">
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-text-muted" />
              <p className="text-[14px]">{order.address}</p>
            </div>
            <Divider className="my-3" />
            {rider ? (
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-delivery-soft text-delivery-text">
                  <Bike className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">{rider.name}</p>
                  <p className="truncate text-[12px] text-text-secondary">
                    {rider.vehicle === "boda" ? "Boda" : rider.vehicle === "car" ? "Car" : "Van"} ·{" "}
                    {rider.phone}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setAssigning(true)}>
                  Change
                </Button>
              </div>
            ) : (
              <Button variant="secondary" full onClick={() => setAssigning(true)}>
                <Bike className="size-4" />
                Assign a rider
              </Button>
            )}
          </div>
        </div>

        {order.note && (
          <div className="rounded-2xl bg-surface-sunken p-3.5 text-[13px] leading-relaxed text-text-secondary">
            {order.note}
          </div>
        )}
      </div>

      <Sheet
        open={assigning}
        onClose={() => setAssigning(false)}
        title="Assign a rider"
        description="Trusted riders who cover this area appear first."
      >
        <div className="space-y-2 pb-6">
          {[...db.riders]
            .sort((a, b) => {
              const area = order.address.split(",")[0];
              return (
                Number(b.zones.includes(area)) - Number(a.zones.includes(area)) ||
                b.rating - a.rating
              );
            })
            .map((r) => {
              const covers = r.zones.includes(order.address.split(",")[0]);
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    assignRider(order.id, r.id);
                    setAssigning(false);
                    toast(`${r.name.split(" ")[0]} is on the way.`);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5 text-left transition-colors hover:bg-surface-hover"
                >
                  <Avatar name={r.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{r.name}</p>
                    <p className="truncate text-[12px] text-text-secondary">
                      ★ {r.rating.toFixed(1)} · {r.deliveriesToday} today · {r.zones.slice(0, 2).join(", ")}
                    </p>
                  </div>
                  {covers && <Badge tone="delivery">Covers area</Badge>}
                </button>
              );
            })}
        </div>
      </Sheet>
    </Sheet>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-text-secondary">
      <span>{label}</span>
      <span className="tabular font-medium text-text">{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * New order
 * ------------------------------------------------------------------ */

function NewOrderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, createOrder } = useStore();
  const toast = useToast();
  const { set } = useQuery();

  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [deliveryFee, setDeliveryFee] = useState(String(db.business.defaultDeliveryFee));
  const [address, setAddress] = useState("");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [note, setNote] = useState("");

  const customer = db.customers.find((c) => c.id === customerId);
  const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const total = subtotal + (Number(deliveryFee) || 0);
  const valid = customerId && items.length > 0 && address.trim();

  const reset = () => {
    setCustomerId("");
    setItems([]);
    setDeliveryFee(String(db.business.defaultDeliveryFee));
    setAddress("");
    setNote("");
  };

  const addItem = (productId: string) => {
    const product = db.products.find((p) => p.id === productId);
    if (!product) return;
    setItems((prev) => {
      const existing = prev.find((it) => it.productId === productId);
      if (existing) {
        return prev.map((it) =>
          it.productId === productId ? { ...it, qty: it.qty + 1 } : it,
        );
      }
      return [...prev, { productId, name: product.name, qty: 1, price: product.price }];
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New order"
      description="Turn a conversation into a sale."
      size="lg"
      footer={
        <Button
          full
          size="lg"
          disabled={!valid}
          onClick={() => {
            const order = createOrder({
              customerId,
              items,
              deliveryFee: Number(deliveryFee) || 0,
              address,
              channel,
              note: note.trim() || undefined,
            });
            reset();
            onClose();
            toast(`Order ${order.code} created.`);
            set("id", order.id);
          }}
        >
          {items.length ? `Create order · ${money(total)}` : "Create order"}
        </Button>
      }
    >
      <div className="space-y-4 pb-4">
        <Field label="Customer">
          <Select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              const next = db.customers.find((c) => c.id === e.target.value);
              if (next) {
                setAddress(`${next.location}, Nairobi`);
                setChannel(next.channel);
              }
            }}
          >
            <option value="">Choose a customer</option>
            {db.customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.phone}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-text-secondary">Items</p>
          {items.length > 0 && (
            <div className="mb-2 space-y-2">
              {items.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-medium">{item.name}</p>
                    <p className="tabular text-[12px] text-text-secondary">{money(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      aria-label="Decrease"
                      className="size-8 rounded-lg border border-border text-[15px] font-bold"
                      onClick={() =>
                        setItems((prev) =>
                          prev
                            .map((it) =>
                              it.productId === item.productId ? { ...it, qty: it.qty - 1 } : it,
                            )
                            .filter((it) => it.qty > 0),
                        )
                      }
                    >
                      −
                    </button>
                    <span className="tabular w-7 text-center text-[14px] font-semibold">
                      {item.qty}
                    </span>
                    <button
                      aria-label="Increase"
                      className="size-8 rounded-lg border border-border text-[15px] font-bold"
                      onClick={() => addItem(item.productId)}
                    >
                      +
                    </button>
                  </div>
                  <IconButton
                    label="Remove"
                    className="size-8"
                    onClick={() =>
                      setItems((prev) => prev.filter((it) => it.productId !== item.productId))
                    }
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              ))}
            </div>
          )}
          <Select value="" onChange={(e) => addItem(e.target.value)}>
            <option value="">Add a product…</option>
            {db.products
              .filter((p) => p.active)
              .map((p) => (
                <option key={p.id} value={p.id} disabled={p.stock === 0}>
                  {p.name} — {money(p.price)}
                  {p.stock === 0 ? " (out of stock)" : ""}
                </option>
              ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Delivery fee">
            <Input
              prefix="KES"
              inputMode="numeric"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label="Channel">
            <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              {Object.entries(channelLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Delivery location">
          <Input
            placeholder="e.g. Kilimani, Nairobi"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Field>

        <Field label="Note" hint="Anything the rider or your future self should know.">
          <Textarea
            placeholder="Call before delivery, gate 4…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        {items.length > 0 && (
          <div className="rounded-2xl bg-surface-sunken p-3.5">
            <div className="flex items-center justify-between text-[13px] text-text-secondary">
              <span>Subtotal</span>
              <span className="tabular font-medium text-text">{money(subtotal)}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[13px] text-text-secondary">
              <span>Delivery</span>
              <span className="tabular font-medium text-text">
                {money(Number(deliveryFee) || 0)}
              </span>
            </div>
            <Divider className="my-2.5" />
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold">Total</span>
              <span className="tabular text-[17px] font-extrabold">{money(total)}</span>
            </div>
          </div>
        )}

        {customer && (
          <p className="text-[12px] text-text-muted">
            {customer.name} has ordered from you before — their details are already filled in.
          </p>
        )}
      </div>
    </Sheet>
  );
}
