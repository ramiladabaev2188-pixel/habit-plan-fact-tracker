"use client";

import { useEffect } from "react";
import type { UserPreference } from "@/types/domain";

type LocalRemindersProps = {
  preferences: UserPreference | null;
  forecastPercent: number;
  hasUnfilledYesterday: boolean;
  focusTaskTitle?: string | null;
};

export function LocalReminders({
  preferences,
  forecastPercent,
  hasUnfilledYesterday,
  focusTaskTitle
}: LocalRemindersProps) {
  useEffect(() => {
    if (!preferences || !("Notification" in window) || Notification.permission !== "granted") {
      return;
    }

    if (preferences.risk_alerts_enabled) {
      notifyOncePerDay(
        "risk",
        forecastPercent < 0.8,
        "Прогноз ниже 80%",
        focusTaskTitle
          ? `Главный фокус: ${focusTaskTitle}.`
          : "Проверьте задачи с большим весом и доберите факт."
      );
      notifyOncePerDay(
        "yesterday",
        hasUnfilledYesterday,
        "Вчера не заполнено",
        "Есть плановые задачи без факта за вчера."
      );
    }

    if (!preferences.daily_reminder_enabled) {
      return;
    }

    const timer = window.setTimeout(() => {
      notifyOncePerDay(
        "daily",
        true,
        "Пора внести факт",
        "Откройте дневной экран и закройте плановые задачи."
      );
    }, getDelayUntil(preferences.daily_reminder_time));

    return () => window.clearTimeout(timer);
  }, [focusTaskTitle, forecastPercent, hasUnfilledYesterday, preferences]);

  return null;
}

function notifyOncePerDay(key: string, shouldNotify: boolean, title: string, body: string) {
  if (!shouldNotify) {
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const storageKey = `habit-reminder:${key}:${today}`;

  if (window.localStorage.getItem(storageKey)) {
    return;
  }

  window.localStorage.setItem(storageKey, "1");
  new Notification(title, {
    body,
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg"
  });
}

function getDelayUntil(time: string) {
  const [hours = 21, minutes = 0] = time.split(":").map(Number);
  const now = new Date();
  const target = new Date();
  target.setHours(hours, minutes, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target.getTime() - now.getTime();
}
