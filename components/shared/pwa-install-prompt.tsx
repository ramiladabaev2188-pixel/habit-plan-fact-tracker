"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches || Boolean(navigator.standalone));

    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV !== "production") {
        void navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())));
        if ("caches" in window) {
          void caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key.startsWith("habit-plan-fact")).map((key) => caches.delete(key))));
        }
        return;
      }

      window.addEventListener("load", () => {
        void navigator.serviceWorker.register("/sw.js");
      });
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (dismissed || isStandalone || !installEvent) {
    return null;
  }

  return (
    <div className="fixed inset-x-3 bottom-20 z-[60] rounded-lg border bg-card p-3 shadow-xl md:left-auto md:right-6 md:bottom-6 md:max-w-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Установить приложение</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Откройте трекер как отдельное приложение на телефоне или рабочем столе.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Скрыть предложение установки"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <Button
        type="button"
        className="mt-3 w-full"
        onClick={async () => {
          await installEvent.prompt();
          await installEvent.userChoice;
          setInstallEvent(null);
        }}
      >
        <Download className="h-4 w-4" />
        Установить
      </Button>
    </div>
  );
}

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}
