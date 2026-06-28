import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/shared/app-shell";
import { ThemeProvider } from "@/components/shared/theme-provider";

export const metadata: Metadata = {
  title: "Центр развития",
  description: "Личный аналитический центр жизни: план, факт, цели, здоровье, финансы и командный ритм",
  manifest: "/manifest.json",
  applicationName: "Центр развития",
  appleWebApp: {
    capable: true,
    title: "Центр развития",
    statusBarStyle: "default"
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efefef" },
    { media: "(prefers-color-scheme: dark)", color: "#1c1c1c" }
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
