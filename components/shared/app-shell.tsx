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
  { href: "/monthly-report", label: "Отчет", icon: Presentation },
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
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/88 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link href="/dashboard" className="group flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-[0_16px_34px_-24px_hsl(var(--primary))]">
              ПФ
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold tracking-normal">
                Трекер план/факт
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                Привычки, планы и командный ритм
              </span>
            </span>
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

      <main className="container pb-28 pt-5 md:pb-10">{children}</main>

      <nav className="fixed inset-x-3 bottom-3 z-50 rounded-lg border bg-card/95 p-1 shadow-[0_24px_70px_-36px_rgba(15,23,42,0.85)] backdrop-blur-xl md:hidden">
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={cn(
                  "flex h-14 min-w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-semibold text-muted-foreground transition-colors",
                  active && "bg-primary text-primary-foreground shadow-[0_14px_30px_-22px_hsl(var(--primary))]"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <aside className="fixed left-5 top-24 hidden w-60 md:block">
        <div className="app-surface overflow-hidden rounded-lg">
          <div className="border-b p-4">
            <div className="page-kicker">Личный продукт</div>
            <div className="mt-1 text-sm font-semibold">План, факт, команда</div>
          </div>
          <div className="max-h-[calc(100vh-11rem)] space-y-1 overflow-y-auto p-2">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground",
                    active && "bg-primary text-primary-foreground shadow-[0_14px_30px_-22px_hsl(var(--primary))] hover:bg-primary hover:text-primary-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </aside>

      <PwaInstallPrompt />
      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
    </div>
  );
}
