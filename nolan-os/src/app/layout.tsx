import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { all } from "@/lib/db";
import { attentionCounts, getAttention } from "@/lib/attention";

export const metadata: Metadata = {
  title: { default: "Nolan OS", template: "%s · Nolan OS" },
  description: "Private business operating system for Nolan On The Run.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Nolan OS", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F6F4EF" }, { media: "(prefers-color-scheme: dark)", color: "#0E0E0C" }], width: "device-width", initialScale: 1, viewportFit: "cover" };

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const counts = attentionCounts(getAttention());
  const deals = all<{ id: string; name: string }>("SELECT id, name FROM deals WHERE archived = 0 ORDER BY name");
  const themeScript = `try{var t=localStorage.getItem('nos-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`;
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <Shell attention={counts.urgent || counts.total} urgent={counts.urgent} deals={deals}>{children}</Shell>
      </body>
    </html>
  );
}
