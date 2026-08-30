"use client";

import { Suspense, useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  CircleAlert,
  MapPin,
  Play,
  Plus,
  Wallet,
} from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { EmptyState, ListSkeleton } from "@/components/ui/state";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useQuery } from "@/lib/use-query";
import {
  bookingsOn,
  capacityOn,
  costService,
  openSlots,
  staffLoadOn,
  unpaidDeposits,
} from "@/lib/services";
import { goodsTotal } from "@/lib/selectors";
import { clockTime, money } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { BookingState, Order } from "@/lib/types";

export default function BookingsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hydrated>
        <BookingsScreen />
      </Hydrated>
    </Suspense>
  );
}

const stateMeta: Record<
  BookingState,
  { label: string; tone: "neutral" | "brand" | "success" | "pending" | "danger" | "delivery" }
> = {
  enquiry: { label: "Enquiry", tone: "brand" },
  booked: { label: "Booked", tone: "neutral" },
  in_progress: { label: "Happening now", tone: "delivery" },
  done: { label: "Done", tone: "success" },
  no_show: { label: "No-show", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The diary.
 *
 * A goods business asks what is left on the shelf; a service business asks what
 * is left in the day. The two are not the same question and do not deserve the
 * same screen: stock keeps, an unbooked Tuesday does not. So this leads with
 * hours — how many the team is on for, how many are spoken for, and what the
 * empty ones would have earned.
 */
function BookingsScreen() {
  const { db } = useStore();
  const { get, set } = useQuery();
  const [offset, setOffset] = useState(0);

  const day = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [offset]);

  const todays = bookingsOn(db, day);
  const capacity = capacityOn(db, day);
  const load = staffLoadOn(db, day);
  const owed = unpaidDeposits(db);
  const open = db.orders.find((o) => o.id === get("id") && o.booking);
  const booking = get("new") === "1";

  // Nobody is in — say so, and offer the next day somebody is.
  const closed = capacity.available === 0;
  const nextOpen = useMemo(() => {
    if (!closed) return null;
    for (let ahead = 1; ahead <= 7; ahead++) {
      const candidate = new Date(day);
      candidate.setDate(candidate.getDate() + ahead);
      if (capacityOn(db, candidate).available > 0) return ahead;
    }
    return null;
  }, [closed, day, db]);

  const label =
    offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : offset === -1 ? "Yesterday" : dayNames[day.getDay()];

  return (
    <>
      <PageHeader
        title="Diary"
        subtitle="What is booked, who is doing it, and how much of the day is still free."
        action={
          <Button size="sm" onClick={() => set("new", "1")}>
            <Plus className="size-4" />
            Book
          </Button>
        }
      />

      {/* The day picker. */}
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => setOffset((o) => o - 1)}
          aria-label="Previous day"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-hover"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="flex-1 rounded-2xl bg-surface-sunken px-4 py-2.5 text-center">
          <p className="text-[14px] font-bold">{label}</p>
          <p className="text-[11px] text-text-secondary">
            {day.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <button
          onClick={() => setOffset((o) => o + 1)}
          aria-label="Next day"
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-hover"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {closed ? (
        <Card className="mb-5">
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <CalendarDays className="size-7 text-text-muted" />
            <p className="text-[15px] font-semibold">Nobody is working {label.toLowerCase()}</p>
            <p className="max-w-xs text-[13px] leading-relaxed text-text-secondary">
              A closed day is not an empty diary — there are no hours to sell. Working days are set
              per person in the team.
            </p>
            {nextOpen && (
              <Button variant="secondary" size="sm" onClick={() => setOffset((o) => o + nextOpen)}>
                Jump to the next open day
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <CapacityPanel capacity={capacity} />
      )}

      {owed.length > 0 && offset >= 0 && (
        <div className="mb-5 flex gap-3 rounded-2xl bg-pending-soft p-3.5">
          <Wallet className="size-5 shrink-0 text-pending-text" />
          <p className="text-[13px] leading-relaxed text-pending-text">
            {owed.length} {owed.length === 1 ? "slot is" : "slots are"} held without the deposit
            that was meant to hold {owed.length === 1 ? "it" : "them"} —{" "}
            {money(owed.reduce((sum, o) => sum + (o.booking?.deposit ?? 0), 0))} in total. A no-show
            then costs you the whole slot.
          </p>
        </div>
      )}

      {todays.length ? (
        <>
          <SectionTitle>{todays.length} in the diary</SectionTitle>
          <div className="space-y-2.5">
            {todays.map((order) => (
              <BookingRow key={order.id} order={order} onOpen={() => set("id", order.id)} />
            ))}
          </div>
        </>
      ) : (
        !closed && (
          <EmptyState
            icon={<CalendarDays className="size-6" />}
            title={`Nothing booked ${label.toLowerCase()}`}
            body={`${capacity.available.toFixed(0)} hours are open and earning nothing. An empty day cannot be sold back later.`}
            action={<Button onClick={() => set("new", "1")}>Book something in</Button>}
          />
        )
      )}

      {!closed && load.some((row) => row.working) && (
        <>
          <SectionTitle className="mt-7">Who is on</SectionTitle>
          <div className="space-y-2.5">
            {load
              .filter((row) => row.working)
              .map((row) => (
                <div
                  key={row.staff.id}
                  className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5"
                >
                  <Avatar name={row.staff.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[14px] font-semibold">{row.staff.name}</p>
                      <p className="tabular shrink-0 text-[13px] font-bold">
                        {row.utilisation.toFixed(0)}%
                      </p>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          row.utilisation > 100
                            ? "bg-danger"
                            : row.utilisation >= 60
                              ? "bg-brand"
                              : "bg-pending",
                        )}
                        style={{ width: `${Math.min(100, Math.max(row.utilisation, 2))}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[12px] text-text-secondary">
                      {row.staff.role} · {row.booked.toFixed(1)} of {row.available} hours ·{" "}
                      {row.jobs} {row.jobs === 1 ? "job" : "jobs"}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {open && <BookingSheet order={open} onClose={() => set("id", null)} />}
      <NewBookingSheet open={booking} day={day} onClose={() => set("new", null)} />
    </>
  );
}

function CapacityPanel({ capacity }: { capacity: ReturnType<typeof capacityOn> }) {
  const over = capacity.overbooked > 0;
  return (
    <div className="relative mb-5 overflow-hidden rounded-card bg-panel p-5 text-panel-text shadow-float ring-1 ring-white/5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-52 rounded-full opacity-30 blur-2xl"
        style={{ background: "radial-gradient(circle, var(--lime-500), transparent 70%)" }}
      />
      <div className="relative">
        <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-panel-muted">
          Hours booked
        </p>
        <p className="tabular mt-1 text-[32px] font-extrabold leading-none tracking-[-0.03em]">
          {capacity.booked.toFixed(1)}
          <span className="text-[18px] font-bold text-panel-muted">
            {" "}
            / {capacity.available.toFixed(0)}
          </span>
        </p>

        <div className="mt-3.5 h-2.5 overflow-hidden rounded-full bg-white/12">
          <div
            className={cn("h-full rounded-full", over ? "bg-danger" : "bg-brand")}
            style={{ width: `${Math.min(100, Math.max(capacity.utilisation, 2))}%` }}
          />
        </div>

        <p className="mt-2.5 text-[13px] leading-relaxed text-panel-muted">
          {over ? (
            <>
              You have promised {capacity.overbooked.toFixed(1)} hours more than the team is on for.
              Something runs late or somebody gets turned away.
            </>
          ) : (
            <>
              {capacity.utilisation.toFixed(0)}% of the day is spoken for. The{" "}
              {capacity.free.toFixed(1)} free hours would be worth about{" "}
              {money(capacity.idleValue)} at what your work usually clears — and an empty hour
              cannot be sold back later.
            </>
          )}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-panel-raised px-3 py-2.5">
            <p className="tabular text-[15px] font-bold leading-none">
              {money(capacity.booked_value, { compact: true })}
            </p>
            <p className="mt-1 text-[11px] text-panel-muted">The day is worth</p>
          </div>
          <div className="rounded-2xl bg-panel-raised px-3 py-2.5">
            <p className="tabular text-[15px] font-bold leading-none">
              {capacity.free.toFixed(1)}h
            </p>
            <p className="mt-1 text-[11px] text-panel-muted">Still to sell</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingRow({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const { db } = useStore();
  const booking = order.booking!;
  const service = db.services.find((s) => s.id === booking.serviceId);
  const staff = db.staff.find((p) => p.id === booking.staffId);
  const customer = db.customers.find((c) => c.id === order.customerId);
  const meta = stateMeta[booking.state];

  return (
    <button
      onClick={onOpen}
      className="flex w-full gap-3 rounded-card border border-border-subtle bg-surface p-3.5 text-left shadow-card transition-colors hover:bg-surface-hover"
    >
      {/* The time is the anchor here, the way a price is on an order. */}
      <div className="w-14 shrink-0 text-center">
        <p className="tabular text-[15px] font-extrabold leading-none">
          {clockTime(booking.startsAt)}
        </p>
        <p className="mt-1 text-[11px] text-text-muted">{booking.durationMinutes}m</p>
      </div>

      <div className="min-w-0 flex-1 border-l border-border-subtle pl-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[15px] font-semibold">{service?.name}</p>
          <p className="tabular shrink-0 text-[15px] font-bold">{money(goodsTotal(order))}</p>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-text-secondary">
          {customer?.name}
          {staff ? ` · ${staff.name}` : " · nobody assigned"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          {booking.place === "at_them" && (
            <Badge tone="delivery">
              <MapPin className="size-3" />
              At the customer
            </Badge>
          )}
          {booking.deposit && !booking.depositPaidAt && (
            <Badge tone="pending">Deposit unpaid</Badge>
          )}
        </div>
      </div>
    </button>
  );
}

function BookingSheet({ order, onClose }: { order: Order; onClose: () => void }) {
  const { db, setBookingState, payDeposit } = useStore();
  const toast = useToast();
  const booking = order.booking!;
  const service = db.services.find((s) => s.id === booking.serviceId);
  const staff = db.staff.find((p) => p.id === booking.staffId);
  const customer = db.customers.find((c) => c.id === order.customerId);
  const cost = service ? costService(service, db, booking.staffId) : null;

  const next: { label: string; state: BookingState; icon: typeof Play } | null =
    booking.state === "enquiry"
      ? { label: "Confirm the booking", state: "booked", icon: Check }
      : booking.state === "booked"
        ? { label: "Start the job", state: "in_progress", icon: Play }
        : booking.state === "in_progress"
          ? { label: "Mark it done", state: "done", icon: Check }
          : null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={service?.name ?? "Booking"}
      description={`${customer?.name} · ${clockTime(booking.startsAt)}`}
      size="lg"
      footer={
        next ? (
          <Button
            full
            size="lg"
            onClick={() => {
              setBookingState(order.id, next.state);
              onClose();
              toast(
                next.state === "done"
                  ? "Done. It is in your books and the materials came off the store."
                  : next.state === "in_progress"
                    ? "Started."
                    : "Booked in.",
              );
            }}
          >
            <next.icon className="size-4" strokeWidth={2.5} />
            {next.label}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4 pb-4">
        <Card>
          <div className="space-y-2.5 p-4 text-[14px]">
            <Row label="When" value={`${clockTime(booking.startsAt)} · ${booking.durationMinutes} minutes`} />
            <Row label="Who is doing it" value={staff?.name ?? "Nobody assigned yet"} />
            <Row
              label="Where"
              value={
                booking.place === "at_them"
                  ? "At the customer"
                  : booking.place === "remote"
                    ? "Remote"
                    : "At the shop"
              }
            />
            <Row label="Price" value={money(goodsTotal(order))} strong />
          </div>
        </Card>

        {booking.deposit ? (
          <div
            className={cn(
              "rounded-2xl p-4",
              booking.depositPaidAt ? "bg-success-soft" : "bg-pending-soft",
            )}
          >
            <div className="flex items-center gap-2.5">
              <Wallet
                className={cn(
                  "size-5 shrink-0",
                  booking.depositPaidAt ? "text-success-text" : "text-pending-text",
                )}
              />
              <p
                className={cn(
                  "text-[14px] font-bold",
                  booking.depositPaidAt ? "text-success-text" : "text-pending-text",
                )}
              >
                {booking.depositPaidAt
                  ? `${money(booking.deposit)} deposit held`
                  : `${money(booking.deposit)} deposit not paid`}
              </p>
            </div>
            <p
              className={cn(
                "mt-2 text-[12px] leading-relaxed",
                booking.depositPaidAt ? "text-success-text" : "text-pending-text",
              )}
            >
              {booking.depositPaidAt
                ? `It comes off the ${money(goodsTotal(order))} when the job is done. The balance is ${money(goodsTotal(order) - booking.deposit)}.`
                : "The slot is held on nothing. If they do not turn up, the hours are gone and there is nothing to show for them."}
            </p>
            {!booking.depositPaidAt && (
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  payDeposit(order.id);
                  toast(`${money(booking.deposit ?? 0)} deposit recorded.`);
                }}
              >
                Deposit received
              </Button>
            )}
          </div>
        ) : null}

        {cost && (
          <Card>
            <div className="p-4">
              <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">
                What this job costs you
              </p>
              <div className="space-y-2 text-[13px]">
                <Row
                  label={`Time — ${service?.durationMinutes}m${service?.bufferMinutes ? ` + ${service.bufferMinutes}m turnaround` : ""}`}
                  value={money(cost.labour)}
                />
                {cost.materialLines.map((line) => (
                  <Row key={line.name} label={`${line.name} — ${line.qty}`} value={money(line.cost)} />
                ))}
                <div className="flex items-baseline justify-between gap-3 border-t border-border-subtle pt-2.5">
                  <span className="text-[14px] font-semibold">Costs you</span>
                  <span className="tabular text-[15px] font-extrabold">{money(cost.total)}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-text-secondary">You keep</span>
                  <span
                    className={cn(
                      "tabular font-bold",
                      cost.margin >= 0 ? "text-success-text" : "text-danger",
                    )}
                  >
                    {money(cost.margin)} · {money(cost.profitPerHour)}/hr
                  </span>
                </div>
              </div>
              {cost.assumedRate && (
                <p className="mt-3 flex gap-2 rounded-xl bg-surface-sunken px-3 py-2 text-[11px] leading-relaxed text-text-muted">
                  <CircleAlert className="size-3.5 shrink-0" />
                  Nobody is assigned, so the time is priced at a standard rate. Assign someone for
                  the real figure.
                </p>
              )}
            </div>
          </Card>
        )}

        {booking.state === "booked" && (
          <button
            onClick={() => {
              setBookingState(order.id, "no_show");
              onClose();
              toast("Marked as a no-show. The hours stay on the record.");
            }}
            className="w-full py-2 text-center text-[13px] font-semibold text-text-secondary hover:text-danger"
          >
            They did not turn up
          </button>
        )}
      </div>
    </Sheet>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-text-secondary">{label}</span>
      <span className={cn("tabular text-right font-medium", strong && "text-[16px] font-bold")}>
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Booking something in
 * ------------------------------------------------------------------ */

function NewBookingSheet({
  open,
  day,
  onClose,
}: {
  open: boolean;
  day: Date;
  onClose: () => void;
}) {
  const { db, createBooking } = useStore();
  const toast = useToast();
  const { setMany } = useQuery();

  const [customerId, setCustomerId] = useState("");
  const [serviceId, setServiceId] = useState(db.services[0]?.id ?? "");
  const [staffId, setStaffId] = useState("");
  const [slot, setSlot] = useState("");
  const [note, setNote] = useState("");

  const service = db.services.find((s) => s.id === serviceId);
  // Only people who can actually do this job.
  const eligible = db.staff.filter(
    (person) =>
      person.active && (!service?.staffIds?.length || service.staffIds.includes(person.id)),
  );
  const chosen = db.staff.find((p) => p.id === staffId) ?? eligible[0];

  // Cheap enough to work out on every render, and the compiler would rather
  // do the memoising than trust a dependency list over a `find` result.
  const slots = chosen && service ? openSlots(db, chosen, day, service.durationMinutes) : [];

  const reset = () => {
    setCustomerId("");
    setStaffId("");
    setSlot("");
    setNote("");
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Book a job"
      description="Only slots the person is actually free for are offered."
      size="lg"
      footer={
        <Button
          full
          size="lg"
          disabled={!customerId || !serviceId || !slot}
          onClick={() => {
            const order = createBooking({
              customerId,
              serviceId,
              staffId: chosen?.id,
              startsAt: slot,
              place: service?.id === "svc_6" ? "at_them" : "at_us",
              note: note.trim() || undefined,
            });
            reset();
            // Close this sheet and open the new booking in one navigation, or
            // the second change would undo the first and leave both open.
            setMany({ new: null, id: order.id });
            toast(`Booked for ${clockTime(slot)}.`);
          }}
        >
          Book it in
        </Button>
      }
    >
      <div className="space-y-4 pb-4">
        <Field label="Customer">
          <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Choose a customer…</option>
            {db.customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} — {customer.location}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="What are they booking?">
          <Select
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              setStaffId("");
              setSlot("");
            }}
          >
            {db.services
              .filter((s) => s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {money(s.price)} · {s.durationMinutes}m
                </option>
              ))}
          </Select>
        </Field>

        <Field label="Who is doing it?">
          <Select
            value={chosen?.id ?? ""}
            onChange={(e) => {
              setStaffId(e.target.value);
              setSlot("");
            }}
          >
            {eligible.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name} — {person.role}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <p className="mb-2 text-[13px] font-semibold text-text-secondary">
            Free slots on {day.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "short" })}
          </p>
          {slots.length ? (
            <div className="flex flex-wrap gap-2">
              {slots.map((option) => (
                <button
                  key={option}
                  onClick={() => setSlot(option)}
                  className={cn(
                    "tabular h-10 rounded-full border px-4 text-[13px] font-semibold transition-colors",
                    slot === option
                      ? "border-transparent bg-brand text-brand-ink"
                      : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
                  )}
                >
                  {clockTime(option)}
                </button>
              ))}
            </div>
          ) : (
            <p className="flex gap-2 rounded-2xl bg-surface-sunken p-3.5 text-[13px] leading-relaxed text-text-secondary">
              <Clock className="size-4 shrink-0" />
              {chosen
                ? `${chosen.name} has nothing free that day — either they are not working or the day is full.`
                : "Nobody is set up to do this job yet."}
            </p>
          )}
        </div>

        {service && service.depositPercent ? (
          <p className="rounded-2xl bg-surface-sunken p-3.5 text-[12px] leading-relaxed text-text-secondary">
            This one normally takes a {service.depositPercent}% deposit —{" "}
            {money(Math.round((service.price * service.depositPercent) / 100 / 50) * 50)}. You can
            record it once the slot is booked.
          </p>
        ) : null}

        <Field label="Note" hint="What they want, measurements, anything you will forget.">
          <Textarea
            placeholder="Bringing her own fabric, wants it by Friday…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
    </Sheet>
  );
}
