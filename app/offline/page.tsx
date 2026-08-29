import { WifiOff } from "lucide-react";
import { SokoMark } from "@/components/soko-mark";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <SokoMark className="mb-6 size-14" />
      <span className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-surface-sunken text-text-muted">
        <WifiOff className="size-6" />
      </span>
      <h1 className="text-xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 max-w-xs text-[14px] leading-relaxed text-text-secondary">
        This screen hasn&apos;t been saved to your phone yet. Your orders, payments and ledger are
        still here — open a screen you&apos;ve visited before.
      </p>
    </div>
  );
}
