import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppFrame } from "@/components/app-frame";
import { StoreProvider } from "@/lib/store";
import { ToastProvider } from "@/components/ui/toast";
import { ServiceWorker } from "@/components/service-worker";

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SokoOS — Every sale. One place.",
    template: "%s · SokoOS",
  },
  description:
    "The operating system for businesses that sell everywhere. Orders, payments, M-Pesa, delivery and your ledger — in one place.",
  applicationName: "SokoOS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SokoOS",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#071310" },
  ],
};

/* Applies the saved theme before first paint so the app never flashes white. */
const themeScript = `(function(){try{var t=localStorage.getItem("sokoos.theme");if(!t||t==="system"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${body.variable} ${display.variable} antialiased`}>
        <StoreProvider>
          <ToastProvider>
            <AppFrame>{children}</AppFrame>
          </ToastProvider>
        </StoreProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
