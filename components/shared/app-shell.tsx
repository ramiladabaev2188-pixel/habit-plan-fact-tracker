"use client";

import { Suspense, useState } from "react";
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
  Menu,
  NotebookText,
  Presentation,
  Settings,
  ShieldCheck,
  Smartphone,
  Users,
  X
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

const mobilePrimaryHrefs = new Set(["/dashboard", "/daily", "/planner", "/team"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isLogin = pathname === "/login";
  const mobileItems = navItems.filter((item) => mobilePrimaryHrefs.has(item.href));
  const moreItems = navItems.filter((item) => !mobilePrimaryHrefs.has(item.href));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isMoreActive = moreItems.some((item) => isActive(item.href));

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[100dvh]">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="group flex min-w-0 items-center gap-3" aria-label="На дашборд">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold tracking-[0.08em] text-primary-foreground shadow-[0_12px_24px_-16px_hsl(var(--primary))] transition-transform duration-200 group-hover:-rotate-3">
              ПФ
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight sm:text-base">Трекер план/факт</span>
              <span className="block truncate text-xs text-muted-foreground">Личный ритм и командный прогресс</span>
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

      <aside className="fixed bottom-0 left-0 top-[4.5rem] z-30 hidden w-64 border-r border-border/80 bg-background/70 md:block">
        <nav className="flex h-full flex-col px-3 py-5" aria-label="Основная навигация">
          <div className="mb-5 px-3">
            <div className="page-kicker">Рабочее пространство</div>
            <div className="mt-1 text-sm font-semibold tracking-tight">План, факт, команда</div>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground transition-[background-color,color,transform] duration-200 hover:bg-primary/[0.055] hover:text-foreground hover:translate-x-px",
                    active && "bg-primary text-primary-foreground shadow-[0_12px_24px_-18px_hsl(var(--primary))] hover:bg-primary hover:text-primary-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
          <div className="mt-4 border-t border-border/80 px-3 pt-4 text-xs leading-5 text-muted-foreground">
            Быстрый факт, ясный план, видимый прогресс.
          </div>
        </nav>
      </aside>

      <main className="mx-auto max-w-[1600px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 md:pb-10">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-card/95 px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 backdrop-blur-xl md:hidden" aria-label="Быстрая навигация">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {mobileItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-semibold text-muted-foreground transition-colors",
                  active && "bg-primary text-primary-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            aria-label="Открыть остальные разделы"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-1 rounded-md text-[10px] font-semibold text-muted-foreground transition-colors",
              isMoreActive && "bg-primary text-primary-foreground"
            )}
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.9} />
            <span>Еще</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm md:hidden" role="dialog" aria-modal="true" aria-label="Все разделы">
          <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-lg border border-border/80 bg-card p-4 shadow-[0_-18px_42px_-24px_rgba(17,49,38,0.46)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="page-kicker">Навигация</div>
                <div className="text-lg font-semibold tracking-tight">Все разделы</div>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => setMoreOpen(false)} aria-label="Закрыть меню">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md border border-border/80 bg-background/55 px-3 py-3 text-sm font-medium transition-colors",
                      active ? "border-primary/30 bg-primary/[0.075] text-primary" : "hover:border-primary/25"
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <PwaInstallPrompt />
      <Suspense fallback={null}>
        <Toaster />
      </Suspense>
    </div>
  );
}
