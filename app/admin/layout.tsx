import type { Metadata } from "next";
import { AdminStoreProvider } from "@/lib/admin/store";

export const metadata: Metadata = {
  title: { default: "Operator console · SokoOS", template: "%s · SokoOS Operator" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminStoreProvider>{children}</AdminStoreProvider>;
}
