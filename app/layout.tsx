import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/shared/app-shell";
import { ThemeProvider } from "@/components/shared/theme-provider";

export const metadata: Metadata = {
  title: "Трекер план/факт",
  description: "Личный трекер привычек с планом и фактом по месяцам",
  manifest: "/manifest.json",
  applicationName: "План/факт",
  appleWebApp: {
    capable: true,
    title: "План/факт",
    statusBarStyle: "default"
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#2563eb" },
    { media: "(prefers-color-scheme: dark)", color: "#60a5fa" }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
