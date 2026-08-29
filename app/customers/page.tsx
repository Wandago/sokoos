"use client";

import { Suspense, useMemo, useState } from "react";
import { Phone, Plus, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { SearchInput, Field, Input, Select } from "@/components/ui/field";
import { EmptyState, ListSkeleton } from "@/components/ui/state";
import { Sheet } from "@/components/ui/sheet";
import { Button, IconButton } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge, ChannelBadge } from "@/components/ui/badge";
import { OrderRow } from "@/components/order-row";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useQuery } from "@/lib/use-query";
import { customerStats } from "@/lib/selectors";
import { channelLabel, fullDate, money, relativeTime } from "@/lib/format";
import type { Channel } from "@/lib/types";

export default function CustomersPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hydrated>
        <CustomersScreen />
      </Hydrated>
    </Suspense>
  );
}

function CustomersScreen() {
  const { db } = useStore();
  const { get, set } = useQuery();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const open = db.customers.find((c) => c.id === get("id"));

  const customers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query
      ? db.customers.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            c.phone.includes(query) ||
            c.location.toLowerCase().includes(query),
        )
      : db.customers;
    return [...list].sort(
      (a, b) => customerStats(db, b.id).spent - customerStats(db, a.id).spent,
    );
  }, [db, search]);

  const totalSpend = db.customers.reduce((sum, c) => sum + customerStats(db, c.id).spent, 0);

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${db.customers.length} people · ${money(totalSpend)} lifetime`}
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" strokeWidth={2.5} />
            Add
          </Button>
        }
      />

      <SearchInput
        className="mb-4"
        placeholder="Search name, phone or area"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {customers.length ? (
        <div className="space-y-2.5">
          {customers.map((customer) => {
            const stats = customerStats(db, customer.id);
            return (
              <button
                key={customer.id}
                onClick={() => set("id", customer.id)}
                className="flex w-full items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5 text-left shadow-card transition-colors hover:bg-surface-hover"
              >
                <Avatar name={customer.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[15px] font-semibold">{customer.name}</p>
                    <p className="tabular shrink-0 text-[14px] font-bold">
                      {money(stats.spent, { compact: true })}
                    </p>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-[12px] text-text-secondary">
                    <ChannelBadge channel={customer.channel} />
                    <span aria-hidden>·</span>
                    <span className="truncate">{customer.location}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge>
                      {stats.orders} {stats.orders === 1 ? "order" : "orders"}
                    </Badge>
                    {stats.owed > 0 && <Badge tone="danger">{money(stats.owed)} owing</Badge>}
                    {customer.tags.map((tag) => (
                      <Badge key={tag} tone="brand">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Users className="size-6" />}
          title="No customers found"
          body="Add a customer, or create an order and one will be saved automatically."
        />
      )}

      {open && <CustomerDetail customerId={open.id} onClose={() => set("id", null)} />}
      <AddCustomerSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function CustomerDetail({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const { db } = useStore();
  const customer = db.customers.find((c) => c.id === customerId);
  if (!customer) return null;
  const stats = customerStats(db, customer.id);
  const orders = db.orders.filter((o) => o.customerId === customer.id);

  return (
    <Sheet open onClose={onClose} title={customer.name} description={customer.phone} size="lg">
      <div className="space-y-5 pb-6">
        <div className="flex items-center gap-3">
          <Avatar name={customer.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5">
              <ChannelBadge channel={customer.channel} />
            </div>
            <p className="mt-1 text-[13px] text-text-secondary">
              {customer.location} · customer since {fullDate(customer.joinedAt)}
            </p>
          </div>
          <IconButton label="Call">
            <Phone className="size-[18px]" />
          </IconButton>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <Stat label="Spent" value={money(stats.spent, { compact: true })} />
          <Stat label="Orders" value={String(stats.orders)} />
          <Stat
            label="Owing"
            value={money(stats.owed, { compact: true })}
            tone={stats.owed > 0 ? "danger" : undefined}
          />
        </div>

        {stats.lastOrderAt && (
          <div className="rounded-2xl bg-surface-sunken p-3.5 text-[13px] text-text-secondary">
            Last ordered {relativeTime(stats.lastOrderAt)} · average order{" "}
            <span className="tabular font-semibold text-text">{money(stats.averageOrder)}</span>
          </div>
        )}

        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">
            Order history
          </p>
          <div className="space-y-2.5">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} customer={customer} />
            ))}
            {!orders.length && (
              <p className="text-[13px] text-text-secondary">No orders yet.</p>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger";
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-3">
      <p className="text-[11px] font-semibold text-text-secondary">{label}</p>
      <p
        className={`tabular mt-1 text-[17px] font-bold ${tone === "danger" ? "text-danger" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function AddCustomerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addCustomer } = useStore();
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [channel, setChannel] = useState<Channel>("whatsapp");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add a customer"
      footer={
        <Button
          full
          size="lg"
          disabled={!name.trim() || !phone.trim()}
          onClick={() => {
            addCustomer({ name: name.trim(), phone: phone.trim(), location, channel });
            setName("");
            setPhone("");
            setLocation("");
            onClose();
            toast("Customer saved.");
          }}
        >
          Save customer
        </Button>
      }
    >
      <div className="space-y-4 pb-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Wanjiku" />
        </Field>
        <Field label="Phone">
          <Input
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0722 000 000"
          />
        </Field>
        <Field label="Area">
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Kilimani"
          />
        </Field>
        <Field label="How they found you">
          <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            {Object.entries(channelLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Sheet>
  );
}
