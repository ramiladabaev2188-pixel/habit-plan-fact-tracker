"use client";

import type * as React from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type ToastMessage = {
  id: number;
  title: string;
  description?: string;
};

export function Toaster() {
  const params = useSearchParams();
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<Omit<ToastMessage, "id">>).detail;
      pushToast(setMessages, detail.title, detail.description);
    };

    window.addEventListener("app-toast", onToast);
    return () => window.removeEventListener("app-toast", onToast);
  }, []);

  useEffect(() => {
    if (params.get("import") === "done") {
      pushToast(setMessages, "Импорт завершен", "Данные обновлены и доступны в приложении.");
    }
  }, [params]);

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-3 top-20 z-[70] grid max-w-sm gap-2">
      {messages.map((message) => (
        <div key={message.id} className="rounded-lg border bg-card p-3 shadow-lg">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">{message.title}</div>
              {message.description ? (
                <div className="mt-1 text-sm text-muted-foreground">{message.description}</div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Закрыть уведомление"
              className="h-7 w-7"
              onClick={() => setMessages((current) => current.filter((item) => item.id !== message.id))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function showToast(title: string, description?: string) {
  window.dispatchEvent(new CustomEvent("app-toast", { detail: { title, description } }));
}

function pushToast(
  setMessages: React.Dispatch<React.SetStateAction<ToastMessage[]>>,
  title: string,
  description?: string
) {
  const id = Date.now();
  setMessages((current) => [...current, { id, title, description }].slice(-3));
  window.setTimeout(() => {
    setMessages((current) => current.filter((message) => message.id !== id));
  }, 4200);
}
