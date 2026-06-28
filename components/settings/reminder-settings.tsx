"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { useTheme } from "next-themes";
import { updatePreferencesAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { UserPreference } from "@/types/domain";

export function ReminderSettings({ preferences }: { preferences: UserPreference | null }) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const { setTheme } = useTheme();
  const theme = preferences?.theme ?? "system";

  useEffect(() => {
    setTheme(theme);
  }, [setTheme, theme]);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-info" />
          Напоминания и тема
        </CardTitle>
        <CardDescription>
          Уведомления локальные: без внешних worker, API и токенов. Они работают, когда браузер разрешил уведомления.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3 rounded-md border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-medium">Разрешение браузера</div>
            <div className="text-sm text-muted-foreground">
              {permission === "unsupported"
                ? "Этот браузер не поддерживает Notifications API"
                : permission === "granted"
                  ? "Уведомления разрешены"
                  : permission === "denied"
                    ? "Уведомления заблокированы в браузере"
                    : "Разрешение еще не запрошено"}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={permission === "unsupported" || permission === "granted"}
              onClick={async () => {
                if (!("Notification" in window)) {
                  setPermission("unsupported");
                  return;
                }

                setPermission(await Notification.requestPermission());
              }}
            >
              Разрешить
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={permission !== "granted"}
              onClick={() => {
                new Notification("Центр развития", {
                  body: "Тестовое локальное напоминание работает.",
                  icon: "/icons/icon.svg"
                });
              }}
            >
              <BellRing className="h-4 w-4" />
              Тест
            </Button>
          </div>
        </div>

        <form action={updatePreferencesAction} className="grid gap-4 lg:grid-cols-2">
          <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              name="dailyReminderEnabled"
              className="mt-1"
              defaultChecked={preferences?.daily_reminder_enabled ?? false}
            />
            <span>
              <span className="block font-medium">Напоминать внести факты</span>
              <span className="text-muted-foreground">Ежедневное локальное уведомление в выбранное время.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
            <input
              type="checkbox"
              name="riskAlertsEnabled"
              className="mt-1"
              defaultChecked={preferences?.risk_alerts_enabled ?? true}
            />
            <span>
              <span className="block font-medium">Предупреждать о рисках</span>
              <span className="text-muted-foreground">Если вчера не заполнен или прогноз ниже 80%.</span>
            </span>
          </label>
          <div className="space-y-2">
            <Label htmlFor="dailyReminderTime">Время напоминания</Label>
            <Input
              id="dailyReminderTime"
              name="dailyReminderTime"
              type="time"
              defaultValue={preferences?.daily_reminder_time ?? "21:00"}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultMonthTarget">Цель месяца по умолчанию</Label>
            <Input
              id="defaultMonthTarget"
              name="defaultMonthTarget"
              type="number"
              min="0.1"
              max="2"
              step="0.05"
              defaultValue={preferences?.default_month_target ?? 0.8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="theme">Тема</Label>
            <Select id="theme" name="theme" defaultValue={preferences?.theme ?? "system"}>
              <option value="system">Как в системе</option>
              <option value="light">Светлая</option>
              <option value="dark">Темная</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full sm:w-auto">Сохранить предпочтения</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
