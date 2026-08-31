"use client";

import { useMemo, useState } from "react";
import { Check, Clock, Package, Sparkles, Wrench } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { parseSpokenItem } from "@/lib/speech";
import { industryFor } from "@/lib/industries";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { VoiceListener } from "./voice-listener";
import type { StockMode } from "@/lib/types";

type Kind = "product" | "service";

/**
 * Adding one thing to sell.
 *
 * Almost every business here sells both — a salon sells hours in a chair and
 * hair food over the counter; a phone shop sells handsets and fixes screens.
 * So the first question is not what to call it but which of the two it is,
 * because everything after that differs: a thing has a cost and a count, work
 * has a duration and a diary.
 *
 * And the fastest way to answer all of it is to say it. Typing a product into
 * a form on a phone, standing in a shop, is the reason catalogues stay empty.
 */
export function AddThingSheet({
  open,
  onClose,
  initialKind,
}: {
  open: boolean;
  onClose: () => void;
  initialKind?: Kind;
}) {
  const { db, addProduct, saveService } = useStore();
  const toast = useToast();
  const industry = industryFor(db.business.type, db.business.industry);

  const [transcript, setTranscript] = useState("");
  const [kind, setKind] = useState<Kind | null>(initialKind ?? null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [duration, setDuration] = useState("");
  const [stockMode, setStockMode] = useState<StockMode>(industry.defaultStockMode);
  const [touched, setTouched] = useState(false);

  const heard = useMemo(
    () => (transcript.trim() ? parseSpokenItem(transcript) : null),
    [transcript],
  );

  // What was heard fills the form, until the seller edits it themselves.
  const effectiveKind = kind ?? heard?.kind ?? null;
  const effectiveName = touched ? name : (heard?.name ?? name);
  const effectivePrice = touched ? price : (heard?.price != null ? String(heard.price) : price);
  const effectiveCost = touched ? cost : (heard?.cost != null ? String(heard.cost) : cost);
  const effectiveDuration = touched
    ? duration
    : heard?.durationMinutes != null
      ? String(heard.durationMinutes)
      : duration;

  const take = () => {
    // Move what was heard into the form so it can be corrected by hand.
    setName(effectiveName);
    setPrice(effectivePrice);
    setCost(effectiveCost);
    setDuration(effectiveDuration);
    if (effectiveKind) setKind(effectiveKind);
    setTouched(true);
  };

  const reset = () => {
    setTranscript("");
    setKind(initialKind ?? null);
    setName("");
    setPrice("");
    setCost("");
    setDuration("");
    setTouched(false);
    setStockMode(industry.defaultStockMode);
  };

  const close = () => {
    reset();
    onClose();
  };

  const ready = Boolean(effectiveName.trim()) && Number(effectivePrice) > 0 && effectiveKind;

  const save = () => {
    const finalName = effectiveName.trim();
    const finalPrice = Number(effectivePrice) || 0;

    if (effectiveKind === "service") {
      saveService({
        id: `svc_${Math.random().toString(36).slice(2, 9)}`,
        name: finalName,
        durationMinutes: Number(effectiveDuration) || 60,
        price: finalPrice,
        priceMode: "fixed",
        category: industry.worksLabel,
        swatch: "#0f766e",
        emoji: "🛠️",
        active: true,
      });
      toast(`${finalName} added. Book it from the diary.`);
    } else {
      addProduct({
        name: finalName,
        sku: `SKU-${finalName.slice(0, 3).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
        price: finalPrice,
        cost: Number(effectiveCost) || 0,
        stock: 0,
        lowStockAt: 3,
        category: industry.sellsLabel,
        swatch: "#1d4ed8",
        emoji: "📦",
        active: true,
        stockMode,
      });
      toast(`${finalName} added. Count some in when you have it.`);
    }
    close();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Add something you sell"
      description="Say it or type it — whichever is quicker where you are standing."
      size="lg"
      footer={
        <Button full size="lg" disabled={!ready} onClick={save}>
          <Check className="size-4" strokeWidth={2.5} />
          {effectiveKind === "service" ? "Add this work" : "Add this product"}
        </Button>
      }
    >
      <div className="space-y-4 pb-4">
        <VoiceListener
          transcript={transcript}
          onTranscript={(text) => {
            setTranscript(text);
            setTouched(false);
          }}
          hint={`e.g. “Ongeza huduma, ${industry.services[0]?.name.toLowerCase() ?? "kushona nguo"}, elfu mbili, saa moja”`}
          placeholder={`Ongeza ${industry.worksLabel.toLowerCase()}, kushona nguo, elfu mbili, saa moja`}
        />

        {heard && (
          <div className="rounded-2xl bg-ai-soft p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 shrink-0 text-ai" />
              <p className="text-[13px] font-bold text-ai-text">What we understood</p>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ai-text">{heard.kindReason}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Understood label="Name" value={heard.name || "not heard"} missing={!heard.name} />
              <Understood
                label="Price"
                value={heard.price != null ? money(heard.price) : "not heard"}
                missing={heard.price == null}
              />
              {heard.durationMinutes != null && (
                <Understood label="Takes" value={`${heard.durationMinutes} min`} />
              )}
              {heard.cost != null && <Understood label="Costs you" value={money(heard.cost)} />}
            </div>
            {!touched && (
              <button
                onClick={take}
                className="mt-3 text-[12px] font-bold text-ai-text underline underline-offset-2"
              >
                Correct something
              </button>
            )}
          </div>
        )}

        {/* The one question everything else depends on. */}
        <div>
          <p className="mb-2 text-[13px] font-semibold text-text-secondary">Which is it?</p>
          <div className="grid grid-cols-2 gap-2.5">
            <KindTile
              icon={Package}
              title="Something you sell"
              body={industry.sellsLabel}
              active={effectiveKind === "product"}
              onClick={() => {
                setKind("product");
                setTouched(true);
              }}
            />
            <KindTile
              icon={Wrench}
              title="Work you do"
              body={industry.worksLabel}
              active={effectiveKind === "service"}
              onClick={() => {
                setKind("service");
                setTouched(true);
              }}
            />
          </div>
        </div>

        <Field label="What is it called?">
          <Input
            placeholder={
              effectiveKind === "service"
                ? (industry.services[0]?.name ?? "Alteration")
                : (industry.products[0]?.name ?? "Dress")
            }
            value={effectiveName}
            onChange={(e) => {
              setName(e.target.value);
              setTouched(true);
            }}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="You charge">
            <Input
              prefix="KES"
              inputMode="decimal"
              placeholder="0"
              value={effectivePrice}
              onChange={(e) => {
                setPrice(e.target.value.replace(/[^\d.]/g, ""));
                setTouched(true);
              }}
            />
          </Field>

          {effectiveKind === "service" ? (
            <Field label="How long">
              <Input
                inputMode="numeric"
                placeholder="60"
                value={effectiveDuration}
                onChange={(e) => {
                  setDuration(e.target.value.replace(/\D/g, ""));
                  setTouched(true);
                }}
              />
            </Field>
          ) : (
            <Field label="It costs you">
              <Input
                prefix="KES"
                inputMode="decimal"
                placeholder="0"
                value={effectiveCost}
                onChange={(e) => {
                  setCost(e.target.value.replace(/[^\d.]/g, ""));
                  setTouched(true);
                }}
              />
            </Field>
          )}
        </div>

        {effectiveKind === "service" ? (
          <p className="flex gap-2 rounded-2xl bg-surface-sunken p-3.5 text-[12px] leading-relaxed text-text-secondary">
            <Clock className="size-4 shrink-0" />
            Your own hours are not counted as a cost — they are what you have to sell. Once this is
            in, the diary will show what an hour of it actually leaves you.
          </p>
        ) : (
          industry.stockModes.filter((mode) => mode !== "service").length > 1 && (
            <Field
              label="How do you count it?"
              hint={stockModeHint[stockMode]}
            >
              <Select
                value={stockMode}
                onChange={(e) => setStockMode(e.target.value as StockMode)}
              >
                {industry.stockModes
                  .filter((mode) => mode !== "service")
                  .map((mode) => (
                    <option key={mode} value={mode}>
                      {stockModeLabel[mode]}
                    </option>
                  ))}
              </Select>
            </Field>
          )
        )}
      </div>
    </Sheet>
  );
}

const stockModeLabel: Record<StockMode, string> = {
  simple: "Just a count",
  recipe: "Made from ingredients",
  lot: "Bought as a bale or carton",
  serial: "Tracked unit by unit",
  service: "Work you do",
};

const stockModeHint: Record<StockMode, string> = {
  simple: "You buy them in and count them. The usual.",
  recipe: "Its cost comes from what goes into it, so changing an ingredient price reprices it.",
  lot: "Bought in one lump and split. The cost is a share of what the whole lot landed at.",
  serial: "Each one has its own serial, its own price and its own warranty.",
  service: "Sold by the hour rather than off a shelf.",
};

function KindTile({
  icon: Icon,
  title,
  body,
  active,
  onClick,
}: {
  icon: typeof Package;
  title: string;
  body: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col items-start gap-2 rounded-2xl border p-3.5 text-left transition-colors",
        active
          ? "border-brand bg-brand-soft"
          : "border-border bg-surface hover:bg-surface-hover",
      )}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl",
          active ? "bg-brand text-brand-ink" : "bg-surface-sunken text-text-secondary",
        )}
      >
        <Icon className="size-[18px]" strokeWidth={2.1} />
      </span>
      <span className="text-[13px] font-bold leading-snug">{title}</span>
      <span className="text-[11px] text-text-secondary">{body}</span>
    </button>
  );
}

function Understood({
  label,
  value,
  missing,
}: {
  label: string;
  value: string;
  missing?: boolean;
}) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-text-muted">{label}</p>
      <p className={cn("mt-0.5 truncate text-[13px] font-bold", missing && "font-medium text-text-muted")}>
        {value}
      </p>
    </div>
  );
}
