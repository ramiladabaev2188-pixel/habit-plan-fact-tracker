"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing, Check, ExternalLink, Loader2, X } from "lucide-react";
import {
  dismissNotificationAction,
  generateDueNotificationsAction,
  markNotificationReadAction
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/domain";

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const unreadCount = useMemo(
    () => notifications.filter((notification) => notification.status === "unread").length,
    [notifications]
  );

  const loadNotifications = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: loadError } = await supabase
        .from("notifications")
        .select("*")
        .neq("status", "dismissed")
        .order("created_at", { ascending: false })
        .limit(20);

      if (loadError) {
        throw loadError;
      }

      setNotifications((data ?? []) as AppNotification[]);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить уведомления");
    }
  }, []);

  useEffect(() => {
    setPermission("Notification" in window ? Notification.permission : "unsupported");
    void loadNotifications();
  }, [loadNotifications]);

  const refreshGenerated = () => {
    startTransition(async () => {
      try {
        await generateDueNotificationsAction();
        await loadNotifications();
      } catch (generationError) {
        setError(generationError instanceof Error ? generationError.message : "Не удалось обновить уведомления");
      }
    });
  };

  const markRead = (notificationId: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("notificationId", notificationId);
      await markNotificationReadAction(formData);
      await loadNotifications();
    });
  };

  const dismiss = (notificationId: string) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("notificationId", notificationId);
      await dismissNotificationAction(formData);
      await loadNotifications();
    });
  };

  const openNotification = (notification: AppNotification) => {
    markRead(notification.id);
    if (notification.action_url) {
      router.push(notification.action_url);
      setOpen(false);
    }
  };

  const requestPermission = async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
  };

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Открыть уведомления"
        aria-expanded={open}
        onClick={() => {
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) refreshGenerated();
        }}
        className="relative"
      >
        {unreadCount > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="notification-panel">
          <div className="flex items-start justify-between gap-3 border-b border-border/75 p-4">
            <div>
              <div className="text-sm font-semibold">Центр уведомлений</div>
              <p className="mt-1 text-xs text-muted-foreground">Сроки, факт дня, цели и системные сигналы.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" aria-label="Закрыть уведомления" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center justify-between gap-2 border-b border-border/75 px-4 py-3">
            <Button type="button" size="sm" variant="secondary" onClick={refreshGenerated} disabled={isPending}>
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Обновить
            </Button>
            {permission === "default" ? (
              <Button type="button" size="sm" variant="outline" onClick={requestPermission}>
                Разрешить в браузере
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                {permission === "granted" ? "Browser notifications включены" : "In-app уведомления"}
              </span>
            )}
          </div>

          <div className="max-h-[min(520px,70vh)] overflow-auto p-3">
            {error ? (
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                Уведомления не загрузились: {error}
              </div>
            ) : null}

            {notifications.length ? (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <article
                    key={notification.id}
                    className={cn(
                      "rounded-lg border border-border/75 bg-card p-3 shadow-sm",
                      notification.status === "unread" && "border-primary/45 bg-primary/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => openNotification(notification)}
                      >
                        <div className="text-sm font-semibold">{notification.title}</div>
                        {notification.body ? (
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{notification.body}</p>
                        ) : null}
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          {new Date(notification.created_at).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </div>
                      </button>
                      <div className="flex shrink-0 gap-1">
                        {notification.status === "unread" ? (
                          <Button type="button" size="icon" variant="ghost" aria-label="Отметить прочитанным" onClick={() => markRead(notification.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                        ) : null}
                        <Button type="button" size="icon" variant="ghost" aria-label="Скрыть" onClick={() => dismiss(notification.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {notification.action_url ? (
                      <Link
                        href={notification.action_url}
                        onClick={() => markRead(notification.id)}
                        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary"
                      >
                        Открыть <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <div className="text-sm font-semibold">Пока чисто</div>
                <p className="mt-1 text-xs text-muted-foreground">Когда появятся сроки, незакрытые дни или риски, они будут здесь.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
