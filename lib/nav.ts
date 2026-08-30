import {
  BarChart3,
  Bike,
  BookOpen,
  Boxes,
  Brain,
  Warehouse,
  FileUp,
  Home,
  MessageCircle,
  Package,
  ScanLine,
  Settings,
  Store,
  Users,
  Wallet,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  /** Which store counter, if any, drives the badge on this item. */
  badge?: "inbox" | "review" | "openOrders";
}

export const primaryNav: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/orders", label: "Orders", icon: Package, badge: "openOrders" },
  { href: "/inbox", label: "Inbox", icon: MessageCircle, badge: "inbox" },
];

export const allNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/orders", label: "Orders", icon: Package, badge: "openOrders" },
  { href: "/inbox", label: "Inbox", icon: MessageCircle, badge: "inbox" },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/products", label: "Products", icon: Boxes },
  { href: "/storefront", label: "Mini site", icon: Store },
  { href: "/payments", label: "Payments", icon: Wallet, badge: "review" },
  { href: "/deliveries", label: "Deliveries", icon: Bike },
  { href: "/ledger", label: "Ledger", icon: BookOpen },
  { href: "/capture", label: "Smart Capture", icon: ScanLine, badge: "review" },
  { href: "/import", label: "Statement import", icon: FileUp },
  { href: "/cfo", label: "Your CFO", icon: Brain },
  { href: "/stock", label: "Stock", icon: Warehouse },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Everything the bottom bar can't fit, shown on the More screen. */
export const moreNav: NavItem[] = allNav.filter(
  (item) => !["/", "/orders", "/inbox"].includes(item.href),
);
