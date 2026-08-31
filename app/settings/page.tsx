"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  LogOut,
  Moon,
  Play,
  RefreshCw,
  Smartphone,
  Store,
  Sun,
  SunMoon,
} from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import Link from "next/link";
import { Card, Divider } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { industries, industryFor } from "@/lib/industries";
import type { DeliverySettlement } from "@/lib/types";
import { cn } from "@/lib/cn";

export default function SettingsPage() {
  return (
    <Hydrated>
      <SettingsScreen />
    </Hydrated>
  );
}

type Theme = "light" | "dark" | "system";

function readTheme(): Theme {
  try {
    return (window.localStorage.getItem("sokoos.theme") as Theme) ?? "system";
  } catch {
    return "system";
  }
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches;
}

function SettingsScreen() {
  const { db, updateBusiness, resetDemoData, signOut } = useStore();
  const router = useRouter();
  const toast = useToast();
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [resetting, setResetting] = useState(false);
  const [installed] = useState(isStandalone);

  const [name, setName] = useState(db.business.name);
  const [owner, setOwner] = useState(db.business.owner);
  const [phone, setPhone] = useState(db.business.phone);
  const [till, setTill] = useState(db.business.tillNumber);
  const [fee, setFee] = useState(String(db.business.defaultDeliveryFee));
  const [industryId, setIndustryId] = useState(
    db.business.industry ?? industryFor(db.business.type).id,
  );
  const industry = industryFor(db.business.type, industryId);
  const [settlement, setSettlement] = useState<DeliverySettlement>(
    db.business.defaultSettlement ?? "customer_pays_rider",
  );

  const applyTheme = (next: Theme) => {
    setTheme(next);
    try {
      window.localStorage.setItem("sokoos.theme", next);
    } catch {
      // ignore
    }
    const resolved =
      next === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : next;
    document.documentElement.setAttribute("data-theme", resolved);
  };

  const dirty =
    name !== db.business.name ||
    owner !== db.business.owner ||
    phone !== db.business.phone ||
    till !== db.business.tillNumber ||
    fee !== String(db.business.defaultDeliveryFee) ||
    industryId !== (db.business.industry ?? industryFor(db.business.type).id) ||
    settlement !== (db.business.defaultSettlement ?? "customer_pays_rider");

  return (
    <>
      <PageHeader title="Settings" subtitle="Your business details and how the app behaves." />

      <SectionTitle>Account</SectionTitle>
      <Card className="mb-5">
        <div className="flex items-center gap-3 p-4">
          <Avatar name={db.account?.name ?? db.business.owner} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold">
              {db.account?.name ?? db.business.owner}
            </p>
            <p className="truncate text-[12px] text-text-secondary">
              {db.account?.email ?? "No account on this device"}
            </p>
          </div>
          <Badge tone={db.account ? "success" : "pending"} dot>
            {db.account ? "Signed in" : "Guest"}
          </Badge>
        </div>
        <Divider />
        <Link
          href="/storefront"
          className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-hover"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-ink">
            <Store className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">Your mini site</span>
            <span className="block truncate text-[12px] text-text-secondary">
              sokoos.app/store/{db.storefront.slug}
            </span>
          </span>
        </Link>
        <Divider />
        <button
          onClick={() => {
            signOut();
            router.push("/login");
          }}
          className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-surface-hover"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-text-secondary">
            <LogOut className="size-[18px]" />
          </span>
          <span className="text-[14px] font-semibold">Sign out</span>
        </button>
      </Card>

      <SectionTitle>Business</SectionTitle>
      <Card className="mb-5 p-4">
        <div className="space-y-4">
          <Field label="Business name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Owner">
            <Input value={owner} onChange={(e) => setOwner(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Till number">
              <Input
                inputMode="numeric"
                value={till}
                onChange={(e) => setTill(e.target.value.replace(/\D/g, ""))}
              />
            </Field>
          </div>
          <Field
            label="What trade is this?"
            hint={`${industry.blurb} You can still add anything — this only sets the starting point.`}
          >
            <Select value={industryId} onChange={(e) => setIndustryId(e.target.value)}>
              {industries.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.emoji} {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Default delivery fee">
            <Input
              prefix="KES"
              inputMode="numeric"
              value={fee}
              onChange={(e) => setFee(e.target.value.replace(/\D/g, ""))}
            />
          </Field>

          <Field
            label="Who usually pays the rider?"
            hint="The starting point on every new order. You can change it per order."
          >
            <Select
              value={settlement}
              onChange={(e) => setSettlement(e.target.value as DeliverySettlement)}
            >
              <option value="customer_pays_rider">The customer, at the door</option>
              <option value="business_pays_rider">You do, and you charge it on</option>
              <option value="rider_collects">The rider collects everything for you</option>
              <option value="free">Delivery is free</option>
            </Select>
          </Field>
          <Button
            full
            disabled={!dirty}
            onClick={() => {
              updateBusiness({
                name,
                owner,
                phone,
                tillNumber: till,
                defaultDeliveryFee: Number(fee) || 0,
                type: industry.type,
                industry: industry.id,
                defaultSettlement: settlement,
              });
              toast("Saved.");
            }}
          >
            Save changes
          </Button>
        </div>
      </Card>

      <SectionTitle>Appearance</SectionTitle>
      <Card className="mb-5 p-3">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "System", icon: SunMoon },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              onClick={() => applyTheme(option.value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-3 text-[13px] font-semibold transition-colors",
                theme === option.value
                  ? "border-brand bg-brand-soft text-brand-soft-text"
                  : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
              )}
            >
              <option.icon className="size-[18px]" />
              {option.label}
            </button>
          ))}
        </div>
      </Card>

      <SectionTitle>This app</SectionTitle>
      <Card className="mb-5">
        <div className="flex items-start gap-3 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-text">
            <Smartphone className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">
              Installed on this device {installed && <Badge tone="success">Yes</Badge>}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
              {installed
                ? "SokoOS is running from your home screen and works without a network."
                : "Open your browser menu and choose Add to Home Screen to install SokoOS and use it offline."}
            </p>
          </div>
        </div>
        <Divider />
        <div className="flex items-start gap-3 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-text-secondary">
            <Download className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">Your data stays on this device</p>
            <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
              Orders, payments and your ledger are stored in this browser. Nothing is sent anywhere.
            </p>
          </div>
        </div>
      </Card>

      <SectionTitle>Demo data</SectionTitle>
      <Card className="mb-8 p-4">
        <p className="text-[13px] leading-relaxed text-text-secondary">
          This build ships with a working Nairobi fashion business so every screen has something
          real in it. Reset to start again from the seeded data.
        </p>
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <Button variant="secondary" full onClick={() => setResetting(true)}>
            <RefreshCw className="size-4" />
            Reset demo data
          </Button>
          <Button variant="secondary" full onClick={() => router.push("/welcome")}>
            <Play className="size-4" />
            Replay the tour
          </Button>
        </div>
      </Card>

      <ConfirmSheet
        open={resetting}
        onClose={() => setResetting(false)}
        onConfirm={() => {
          resetDemoData();
          toast("Demo data restored.");
        }}
        title="Reset demo data?"
        body="Everything you've added — orders, payments, captures — will be replaced with the original seeded business. This cannot be undone."
        confirmLabel="Reset"
        tone="danger"
      />
    </>
  );
}
