"use client";

import { Suspense, useMemo, useState } from "react";
import { Boxes, Plus } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { SearchInput, Field, Input, Select } from "@/components/ui/field";
import { EmptyState, ListSkeleton } from "@/components/ui/state";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useQuery } from "@/lib/use-query";
import { topProducts } from "@/lib/selectors";
import { money } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProductsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hydrated>
        <ProductsScreen />
      </Hydrated>
    </Suspense>
  );
}

function ProductsScreen() {
  const { db } = useStore();
  const { get, set } = useQuery();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  const open = db.products.find((p) => p.id === get("id"));
  const best = topProducts(db, 3);

  const products = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? db.products.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.sku.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query),
        )
      : db.products;
  }, [db.products, search]);

  const stockValue = db.products.reduce((sum, p) => sum + p.stock * p.cost, 0);
  const short = db.products.filter((p) => p.stock <= p.lowStockAt);

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${db.products.length} products · ${money(stockValue)} in stock at cost`}
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" strokeWidth={2.5} />
            Add
          </Button>
        }
      />

      {short.length > 0 && (
        <div className="mb-4 rounded-card border border-border-subtle bg-danger-soft p-3.5">
          <p className="text-[13px] font-bold text-danger-text">
            {short.length} {short.length === 1 ? "product needs" : "products need"} restocking
          </p>
          <p className="mt-0.5 text-[12px] text-danger-text/80">
            {short.map((p) => `${p.name} (${p.stock})`).join(" · ")}
          </p>
        </div>
      )}

      <SearchInput
        className="mb-4"
        placeholder="Search products"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {!search && best.length > 0 && (
        <>
          <SectionTitle>Best sellers</SectionTitle>
          <div className="mb-5 grid grid-cols-3 gap-2.5">
            {best.map(({ product, revenue }) => (
              <button
                key={product.id}
                onClick={() => set("id", product.id)}
                className="rounded-card border border-border-subtle bg-surface p-3 text-left shadow-card"
              >
                <span
                  className="mb-2 flex size-9 items-center justify-center rounded-xl text-base"
                  style={{ backgroundColor: `${product.swatch}1a` }}
                >
                  {product.emoji}
                </span>
                <p className="truncate text-[12px] font-semibold leading-tight">{product.name}</p>
                <p className="tabular mt-1 text-[12px] font-bold text-brand-text">
                  {money(revenue, { compact: true })}
                </p>
              </button>
            ))}
          </div>
        </>
      )}

      {products.length ? (
        <div className="space-y-2.5">
          {products.map((product) => (
            <button
              key={product.id}
              onClick={() => set("id", product.id)}
              className="flex w-full items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5 text-left shadow-card transition-colors hover:bg-surface-hover"
            >
              <span
                className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl"
                style={{ backgroundColor: `${product.swatch}1a` }}
              >
                {product.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[15px] font-semibold">{product.name}</p>
                  <p className="tabular shrink-0 text-[15px] font-bold">{money(product.price)}</p>
                </div>
                <p className="mt-0.5 truncate text-[12px] text-text-secondary">
                  {product.sku} · {product.category}
                </p>
                <div className="mt-1.5">
                  {product.stock === 0 ? (
                    <Badge tone="danger">Out of stock</Badge>
                  ) : product.stock <= product.lowStockAt ? (
                    <Badge tone="pending">{product.stock} left — restock</Badge>
                  ) : (
                    <Badge>{product.stock} in stock</Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Boxes className="size-6" />}
          title="No products found"
          body="Add what you sell so orders take one tap instead of typing."
        />
      )}

      {open && <ProductSheet product={open} onClose={() => set("id", null)} />}
      <AddProductSheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function ProductSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const { saveProduct } = useStore();
  const toast = useToast();
  const [price, setPrice] = useState(String(product.price));
  const [cost, setCost] = useState(String(product.cost));
  const [stock, setStock] = useState(String(product.stock));

  const margin = Number(price) - Number(cost);
  const marginPct = Number(price) > 0 ? (margin / Number(price)) * 100 : 0;

  return (
    <Sheet
      open
      onClose={onClose}
      title={product.name}
      description={`${product.sku} · ${product.category}`}
      footer={
        <Button
          full
          size="lg"
          onClick={() => {
            saveProduct({
              ...product,
              price: Number(price) || 0,
              cost: Number(cost) || 0,
              stock: Number(stock) || 0,
            });
            onClose();
            toast("Product updated.");
          }}
        >
          Save changes
        </Button>
      }
    >
      <div className="space-y-4 pb-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Selling price">
            <Input
              prefix="KES"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label="Cost price">
            <Input
              prefix="KES"
              inputMode="numeric"
              value={cost}
              onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
        </div>

        <div className="rounded-2xl bg-surface-sunken p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-text-secondary">Profit per item</span>
            <span
              className={`tabular text-[15px] font-bold ${margin >= 0 ? "text-success" : "text-danger"}`}
            >
              {money(margin)} · {marginPct.toFixed(0)}%
            </span>
          </div>
        </div>

        <Field label="Stock on hand" hint={`You get a warning at ${product.lowStockAt} or fewer.`}>
          <Input
            inputMode="numeric"
            value={stock}
            onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
      </div>
    </Sheet>
  );
}

const categories = ["Dresses", "Sets", "Outerwear", "Accessories", "Beauty", "Footwear", "Bags", "Jewellery"];

function AddProductSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addProduct } = useStore();
  const toast = useToast();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [cost, setCost] = useState("");
  const [stock, setStock] = useState("");
  const [category, setCategory] = useState(categories[0]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add a product"
      footer={
        <Button
          full
          size="lg"
          disabled={!name.trim() || !price}
          onClick={() => {
            addProduct({
              name: name.trim(),
              sku: `ZC-${name.slice(0, 2).toUpperCase()}-${Math.floor(Math.random() * 90 + 10)}`,
              price: Number(price) || 0,
              cost: Number(cost) || 0,
              stock: Number(stock) || 0,
              lowStockAt: 5,
              category,
              swatch: "#018059",
              emoji: "🛍️",
              active: true,
            });
            setName("");
            setPrice("");
            setCost("");
            setStock("");
            onClose();
            toast("Product added.");
          }}
        >
          Add product
        </Button>
      }
    >
      <div className="space-y-4 pb-4">
        <Field label="Name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ankara Wrap Dress"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Selling price">
            <Input
              prefix="KES"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label="Cost price">
            <Input
              prefix="KES"
              inputMode="numeric"
              value={cost}
              onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stock">
            <Input
              inputMode="numeric"
              value={stock}
              onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <Field label="Category">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Sheet>
  );
}
