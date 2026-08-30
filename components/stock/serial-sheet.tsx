"use client";

import { useState } from "react";
import { CircleAlert, ScanBarcode, ShieldCheck, Undo2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { summariseSerials, unitsOf, warrantyStatus } from "@/lib/serials";
import { fullDate, money, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { SerialStatus, SerialUnit } from "@/lib/types";

const statusMeta: Record<SerialStatus, { label: string; tone: "success" | "neutral" | "pending" | "danger" }> = {
  in_stock: { label: "On the shelf", tone: "success" },
  sold: { label: "Sold", tone: "neutral" },
  returned: { label: "Returned", tone: "pending" },
  faulty: { label: "Faulty", tone: "danger" },
};

/**
 * Stock, unit by unit.
 *
 * A phone shop does not own "four power banks" — it owns four particular ones,
 * each bought at its own price with its own warranty running. Averaging them
 * into a cost field hides the batch you overpaid for and the unit that came
 * back broken, which are exactly the two things worth knowing.
 */
export function SerialSheet({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { db, addSerialUnit, setSerialStatus } = useStore();
  const toast = useToast();
  const [serial, setSerial] = useState("");
  const [cost, setCost] = useState("");

  const product = db.products.find((p) => p.id === productId);
  if (!product) return null;

  const units = unitsOf(db, productId);
  const summary = summariseSerials(units);

  return (
    <Sheet
      open
      onClose={onClose}
      title={product.name}
      description={`${summary.inStock.length} on the shelf, tracked by serial`}
      size="lg"
    >
      <div className="space-y-4 pb-4">
        <Card>
          <div className="grid grid-cols-3 divide-x divide-border-subtle">
            <Figure label="On the shelf" value={String(summary.inStock.length)} />
            <Figure label="Tied up" value={money(summary.stockValue)} />
            <Figure
              label="Dead stock"
              value={money(summary.deadStock)}
              tone={summary.deadStock > 0 ? "danger" : undefined}
            />
          </div>
        </Card>

        <div className="flex gap-3 rounded-2xl bg-surface-sunken p-3.5">
          <ScanBarcode className="size-5 shrink-0 text-text-secondary" />
          <p className="text-[12px] leading-relaxed text-text-secondary">
            Stock here is counted, never typed: it is however many units are marked on the shelf.
            {summary.averageCost !== null && (
              <>
                {" "}
                The {summary.inStock.length} you hold cost {money(summary.averageCost)} each on
                average.
              </>
            )}
          </p>
        </div>

        {/* Add a unit — the only way stock goes up. */}
        <Card>
          <div className="p-4">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">
              Book in a unit
            </p>
            <div className="space-y-3">
              <Field label="Serial or IMEI">
                <Input
                  placeholder="PB20K-4471073"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="What you paid for this one">
                <Input
                  prefix="KES"
                  inputMode="decimal"
                  placeholder={String(product.cost || 0)}
                  value={cost}
                  onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ""))}
                />
              </Field>
              <Button
                full
                disabled={!serial.trim() || units.some((u) => u.serial === serial.trim())}
                onClick={() => {
                  addSerialUnit({
                    productId,
                    serial: serial.trim(),
                    cost: Number(cost) || product.cost || 0,
                    status: "in_stock",
                    receivedAt: new Date().toISOString(),
                    warrantyMonths: product.warrantyMonths,
                  });
                  setSerial("");
                  setCost("");
                  toast("Booked in. Stock went up by one.");
                }}
              >
                Add to stock
              </Button>
              {serial.trim() && units.some((u) => u.serial === serial.trim()) && (
                <p className="text-[12px] font-medium text-danger">
                  That serial is already on the books.
                </p>
              )}
            </div>
          </div>
        </Card>

        <p className="px-1 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">
          Every unit
        </p>
        <div className="space-y-2.5">
          {units.map((unit) => (
            <UnitRow
              key={unit.id}
              unit={unit}
              onStatus={(status, note) => {
                setSerialStatus(unit.id, status, note);
                toast(
                  status === "faulty"
                    ? "Marked faulty and taken off the shelf."
                    : status === "in_stock"
                      ? "Back on the shelf."
                      : "Updated.",
                );
              }}
            />
          ))}
          {!units.length && (
            <p className="rounded-2xl bg-surface-sunken p-4 text-[13px] text-text-secondary">
              No units booked in yet. Add one above and stock will follow it.
            </p>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function UnitRow({
  unit,
  onStatus,
}: {
  unit: SerialUnit;
  onStatus: (status: SerialStatus, note?: string) => void;
}) {
  const meta = statusMeta[unit.status];
  const warranty = warrantyStatus(unit);

  return (
    <div className="rounded-card border border-border-subtle bg-surface p-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate font-mono text-[13px] font-semibold">{unit.serial}</p>
        <p className="tabular shrink-0 text-[14px] font-bold">{money(unit.cost)}</p>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone}>{meta.label}</Badge>
        {warranty && (
          <Badge tone={warranty.daysLeft < 30 ? "pending" : "neutral"}>
            <ShieldCheck className="size-3" />
            {warranty.daysLeft} days of warranty left
          </Badge>
        )}
      </div>

      <p className="mt-1.5 text-[11px] text-text-muted">
        Booked in {relativeTime(unit.receivedAt)}
        {unit.soldAt ? ` · sold ${fullDate(unit.soldAt)}` : ""}
        {warranty ? ` · covered until ${fullDate(warranty.expires)}` : ""}
      </p>

      {unit.note && (
        <p className="mt-2 flex gap-2 rounded-xl bg-surface-sunken px-3 py-2 text-[11px] leading-relaxed text-text-secondary">
          <CircleAlert className="size-3.5 shrink-0 text-text-muted" />
          {unit.note}
        </p>
      )}

      {unit.status !== "sold" && (
        <div className="mt-2.5 flex gap-2">
          {unit.status === "in_stock" ? (
            <button
              onClick={() => onStatus("faulty", "Taken off the shelf as faulty.")}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
            >
              <CircleAlert className="size-3.5" />
              Mark faulty
            </button>
          ) : (
            <button
              onClick={() => onStatus("in_stock")}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
            >
              <Undo2 className="size-3.5" />
              Back on the shelf
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "pending" | "danger";
}) {
  return (
    <div className="px-2 py-3.5 text-center">
      <p
        className={cn(
          "tabular text-[16px] font-extrabold",
          tone === "danger" && "text-danger",
          tone === "pending" && "text-pending-text",
          tone === "success" && "text-success-text",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-text-secondary">{label}</p>
    </div>
  );
}
