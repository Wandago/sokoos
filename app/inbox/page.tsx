"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Package, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ListSkeleton } from "@/components/ui/state";
import { Sheet } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/avatar";
import { Badge, ChannelBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { useQuery } from "@/lib/use-query";
import { clockTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Channel } from "@/lib/types";

export default function InboxPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hydrated>
        <InboxScreen />
      </Hydrated>
    </Suspense>
  );
}

type Filter = "all" | "unread" | Channel;

function InboxScreen() {
  const { db, markConversationRead } = useStore();
  const { get, set } = useQuery();
  const [filter, setFilter] = useState<Filter>("all");

  const unread = db.conversations.reduce((sum, c) => sum + c.unread, 0);
  const open = db.conversations.find((c) => c.id === get("id"));

  const conversations = db.conversations.filter((c) => {
    if (filter === "all") return true;
    if (filter === "unread") return c.unread > 0;
    return c.channel === filter;
  });

  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle={
          unread
            ? `${unread} unread ${unread === 1 ? "message" : "messages"} across your channels`
            : "Every channel in one place. You're all caught up."
        }
      />

      <Segmented
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: "All", count: db.conversations.length },
          {
            value: "unread",
            label: "Unread",
            count: db.conversations.filter((c) => c.unread > 0).length,
          },
          { value: "whatsapp", label: "WhatsApp" },
          { value: "instagram", label: "Instagram" },
          { value: "tiktok", label: "TikTok" },
          { value: "facebook", label: "Facebook" },
        ]}
      />

      {conversations.length ? (
        <div className="space-y-2.5">
          {conversations.map((conversation) => {
            const last = conversation.messages[conversation.messages.length - 1];
            return (
              <button
                key={conversation.id}
                onClick={() => {
                  markConversationRead(conversation.id);
                  set("id", conversation.id);
                }}
                className="flex w-full items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5 text-left shadow-card transition-colors hover:bg-surface-hover"
              >
                <Avatar name={conversation.customerName} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={cn(
                        "truncate text-[15px]",
                        conversation.unread ? "font-bold" : "font-semibold",
                      )}
                    >
                      {conversation.customerName}
                    </p>
                    <span className="shrink-0 text-[11px] text-text-muted">
                      {relativeTime(last.at)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-0.5 truncate text-[13px]",
                      conversation.unread ? "font-medium text-text" : "text-text-secondary",
                    )}
                  >
                    {last.from === "business" ? "You: " : ""}
                    {last.text}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ChannelBadge channel={conversation.channel} />
                    {conversation.orderId && (
                      <Badge tone="success">Order created</Badge>
                    )}
                  </div>
                </div>
                {conversation.unread > 0 && (
                  <span className="tabular flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-brand-ink">
                    {conversation.unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<MessageCircle className="size-6" />}
          title="Nothing here"
          body="Messages from Instagram, TikTok, WhatsApp and Facebook land here."
        />
      )}

      {open && <Thread conversationId={open.id} onClose={() => set("id", null)} />}
    </>
  );
}

function Thread({ conversationId, onClose }: { conversationId: string; onClose: () => void }) {
  const { db, sendMessage } = useStore();
  const router = useRouter();
  const [draft, setDraft] = useState("");

  const conversation = db.conversations.find((c) => c.id === conversationId);
  if (!conversation) return null;
  const order = db.orders.find((o) => o.id === conversation.orderId);

  return (
    <Sheet
      open
      onClose={onClose}
      title={conversation.customerName}
      description={`${conversation.handle} · ${conversation.channel}`}
      size="lg"
      footer={
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.trim()) return;
            sendMessage(conversation.id, draft.trim());
            setDraft("");
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a reply…"
            className="h-12 flex-1 rounded-xl border border-border bg-surface px-3.5 text-[15px] placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/20"
          />
          <Button type="submit" aria-label="Send" className="size-12 px-0">
            <Send className="size-[18px]" />
          </Button>
        </form>
      }
    >
      <div className="space-y-3 pb-4">
        {order ? (
          <button
            onClick={() => {
              onClose();
              router.push(`/orders/?id=${order.id}`);
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-border-subtle bg-success-soft p-3 text-left"
          >
            <Package className="size-4 shrink-0 text-success-text" />
            <span className="text-[13px] font-semibold text-success-text">
              This chat became order {order.code}
            </span>
          </button>
        ) : (
          <Button
            variant="secondary"
            full
            onClick={() => {
              onClose();
              router.push("/orders/?new=1");
            }}
          >
            <Package className="size-4" />
            Create an order from this chat
          </Button>
        )}

        {conversation.messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex flex-col",
              message.from === "business" ? "items-end" : "items-start",
            )}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed",
                message.from === "business"
                  ? "rounded-br-md bg-panel text-panel-text"
                  : "rounded-bl-md bg-surface-sunken text-text",
              )}
            >
              {message.text}
            </div>
            <span className="mt-1 px-1 text-[10px] text-text-muted">{clockTime(message.at)}</span>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
