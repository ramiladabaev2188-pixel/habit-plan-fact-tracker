"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  Flag,
  History,
  LineChart,
  ListChecks,
  NotebookText,
  Presentation,
  Settings,
  ShieldCheck,
  Smartphone,
  Users
} from "lucide-react";
import { signOutAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { PwaInstallPrompt } from "@/components/shared/pwa-install-prompt";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Toaster } from "@/components/shared/toaster";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Дашборд", icon: BarChart3 },
  { href: "/daily", label: "День", icon: ListChecks },
  { href: "/mobile", label: "Телефон", icon: Smartphone },
  { href: "/calendar", label: "Календарь", icon: CalendarDays },
  { href: "/planner", label: "План", icon: ClipboardList },
  { href: "/analytics", label: "Аналитика", icon: LineChart },
  { href: "/weekly", label: "Неделя", icon: FileText },
  { href: "/monthly-report", label: "Отчет месяца", icon: Presentation },
  { href: "/history", label: "История", icon: History },
  { href: "/team", label: "Команда", icon: Users },
  { href: "/goals", label: "Цели", icon: Flag },
  { href: "/notes", label: "Заметки", icon: NotebookText },
  { href: "/checks", label: "Проверки", icon: ShieldCheck },
  { href: "/settings", label: "Настройки", icon: Settings }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/92 backdrop-blur">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link href="/dashboard" className="min-w-0">
            <span className="block text-base font-semibold tracking-normal">
              Трекер план/факт
            </span>
            <span className="block text-xs text-muted-foreground">Привычки месяца</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Выйти
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="container pb-28 pt-5 md:pb-8">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/96 shadow-lg backdrop-blur md:hidden">
        <div className="flex overflow-x-auto">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-16 min-w-20 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground",
                  active && "text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <aside className="fixed left-4 top-24 hidden w-56 md:block">
        <div className="rounded-lg border bg-card p-2 shadow-sm">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </aside>

      <div className="hidden md:block md:pl-64" aria-hidden />
      <PwaInstallPrompt />
      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
    </div>
  );
}
