"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { importJsonAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const summaryKeys = [
  ["life_areas", "сфер жизни"],
  ["categories", "категорий"],
  ["tasks", "задач"],
  ["months", "месяцев"],
  ["daily_plans", "планов"],
  ["daily_facts", "фактов"],
  ["notes", "заметок"],
  ["goals", "целей"],
  ["daily_notes", "дневных заметок"],
  ["user_preferences", "настроек"]
] as const;

export function ImportJson() {
  const [payload, setPayload] = useState("");
  const preview = useMemo(() => {
    if (!payload.trim()) {
      return null;
    }

    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      return {
        error: null,
        rows: summaryKeys.map(([key, label]) => ({
          key,
          label,
          count: getImportCount(parsed, key)
        }))
      };
    } catch {
      return {
        error: "JSON пока не читается. Проверьте скобки и кавычки.",
        rows: []
      };
    }
  }, [payload]);

  const canImport = Boolean(preview && !preview.error && payload.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Импорт JSON</CardTitle>
        <CardDescription>Перед импортом покажем краткую проверку. Без подтверждения данные не меняются.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={importJsonAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-payload">JSON</Label>
            <Textarea
              id="import-payload"
              name="payload"
              className="min-h-56 font-mono text-xs"
              value={payload}
              onChange={(event) => setPayload(event.currentTarget.value)}
              placeholder='{"categories":[],"tasks":[],"months":[]}'
            />
          </div>

          {preview ? (
            <div className="rounded-md border bg-muted/50 p-3">
              {preview.error ? (
                <p className="text-sm text-destructive">{preview.error}</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {preview.rows.map((row) => (
                    <div key={row.key} className="rounded-md bg-card p-3">
                      <div className="text-2xl font-semibold">{row.count}</div>
                      <div className="text-sm text-muted-foreground">{row.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
            <input type="checkbox" name="confirmImport" className="mt-1" disabled={!canImport} />
            <span>
              Подтверждаю импорт. Существующие категории, задачи, месяцы, планы и факты могут быть обновлены по совпадающим ключам.
            </span>
          </label>

          <Button type="submit" disabled={!canImport}>
            <Upload className="h-4 w-4" />
            Импортировать
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function getImportCount(parsed: Record<string, unknown>, key: (typeof summaryKeys)[number][0]) {
  if (Array.isArray(parsed[key])) {
    return parsed[key].length;
  }

  if (key === "user_preferences" && parsed[key]) {
    return 1;
  }

  return 0;
}
