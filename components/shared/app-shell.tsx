"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  BriefcaseBusiness,
  CarFront,
  ClipboardList,
  FileText,
  Flag,
  FlaskConical,
  HeartPulse,
  History,
  LineChart,
  ListChecks,
  Menu,
  Milestone,
  NotebookText,
  Presentation,
  Rows3,
  Settings,
  ShieldCheck,
  Sprout,
  Users,
  WalletCards,
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
  { href: "/daily", label: "Сегодня", icon: ListChecks },
  { href: "/planner", label: "План", icon: ClipboardList },
  { href: "/growth", label: "Развитие", icon: Sprout },
  { href: "/goals", label: "Цели", icon: Flag },
  { href: "/tasks", label: "Задачи", icon: Rows3 },
  { href: "/calendar", label: "Календарь", icon: CalendarDays },
  { href: "/analytics", label: "Аналитика", icon: LineChart },
  { href: "/weekly", label: "Неделя", icon: FileText },
  { href: "/monthly-report", label: "Отчет", icon: Presentation },
  { href: "/history", label: "История", icon: History },
  { href: "/finance", label: "Финансы", icon: WalletCards },
  { href: "/health", label: "Здоровье", icon: HeartPulse },
  { href: "/car", label: "Авто", icon: CarFront },
  { href: "/work", label: "Работа", icon: BriefcaseBusiness },
  { href: "/experiments", label: "Эксперименты", icon: FlaskConical },
  { href: "/timeline", label: "Карта жизни", icon: Milestone },
  { href: "/team", label: "Команда", icon: Users },
  { href: "/notes", label: "Заметки", icon: NotebookText },
  { href: "/checks", label: "Чек-листы", icon: ShieldCheck },
  { href: "/settings", label: "Настройки", icon: Settings }
];

const navGroups = [
  {
    title: "Основное",
    items: ["/dashboard", "/daily", "/planner", "/goals", "/growth"]
  },
  {
    title: "Аналитика",
    items: ["/analytics", "/weekly", "/monthly-report", "/history", "/timeline", "/experiments"]
  },
  {
    title: "Практика жизни",
    items: ["/finance", "/health", "/work", "/car"]
  },
  {
    title: "Организация",
    items: ["/tasks", "/calendar", "/notes", "/checks"]
  },
  {
    title: "Прочее",
    items: ["/team", "/settings"]
  }
];

const navItemByHref = new Map(navItems.map((item) => [item.href, item]));
const primaryHrefs = new Set(["/daily", "/planner", "/goals", "/analytics"]);
const mobilePrimaryHrefs = new Set(["/daily", "/planner", "/goals", "/analytics"]);

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isLogin = pathname === "/login";
  const primaryItems = navItems.filter((item) => primaryHrefs.has(item.href));
  const mobilePrimaryItems = navItems.filter((item) => mobilePrimaryHrefs.has(item.href));
  const moreItems = navItems.filter((item) => !primaryHrefs.has(item.href));
  const mobileMoreItems = navItems.filter((item) => !mobilePrimaryHrefs.has(item.href));
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const isDesktopMoreActive = moreItems.some((item) => isActive(item.href));
  const isMobileMoreActive = mobileMoreItems.some((item) => isActive(item.href));

  useEffect(() => {
    if (!moreOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMoreOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [moreOpen]);

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[100dvh]">
      <header className="app-header">
        <div className="mx-auto flex min-h-[4.75rem] max-w-[1200px] items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-0">
          <Link href="/dashboard" className="group flex min-w-0 items-center gap-3" aria-label="На дашборд">
            <span className="app-logo-mark transition-transform duration-200 group-hover:-rotate-3">ПФ</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight sm:text-base">Трекер план/факт</span>
              <span className="block truncate text-xs text-muted-foreground">Личный аналитический центр жизни</span>
            </span>
          </Link>

          <nav className="app-nav-capsule" aria-label="Основная навигация">
            {primaryItems.map((item) => {
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("app-nav-link", active && "app-nav-link-active")}
                >
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={cn("app-nav-link", isDesktopMoreActive && "app-nav-link-active")}
            >
              Все разделы
            </button>
          </nav>

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

      <main className="mx-auto max-w-[1200px] px-4 pb-24 pt-6 sm:px-6 lg:px-0 lg:pb-10 lg:pt-8">{children}</main>

      <nav className="app-mobile-nav" aria-label="Быстрая навигация">
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {mobilePrimaryItems.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={cn("app-mobile-nav-link", active && "app-mobile-nav-link-active")}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            aria-label="Открыть остальные разделы"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen(true)}
            className={cn("app-mobile-nav-link", isMobileMoreActive && "app-mobile-nav-link-active")}
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.8} />
            <span>Еще</span>
          </button>
        </div>
      </nav>

      {moreOpen ? (
        <div
          className="app-all-nav-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="all-nav-title"
          onClick={() => setMoreOpen(false)}
        >
          <div className="app-all-nav-panel" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 mb-4 flex items-center justify-between gap-3 border-b border-border/75 bg-card pb-4">
              <div>
                <div className="text-xs text-muted-foreground">Навигация</div>
                <div id="all-nav-title" className="mt-1 text-2xl font-normal tracking-tight">Все разделы</div>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={() => setMoreOpen(false)} aria-label="Закрыть меню">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {navGroups.map((group) => (
                <section key={group.title} className="rounded-xl border border-border/75 bg-fog/75 p-3">
                  <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {group.title}
                  </h2>
                  <div className="grid gap-2">
                    {group.items.map((href) => {
                      const item = navItemByHref.get(href);
                      if (!item) {
                        return null;
                      }

                      const active = isActive(item.href);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMoreOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-card",
                            active && "bg-primary text-primary-foreground hover:bg-primary"
                          )}
                        >
                          <Icon className="h-4 w-4" strokeWidth={1.8} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
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
