import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import {
  changePasswordAction,
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
  updateSettingsAction
} from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImportJson } from "@/components/settings/import-json";
import { ReminderSettings } from "@/components/settings/reminder-settings";
import { ConfirmSubmitButton } from "@/components/shared/confirm-submit-button";
import { EmptyMonthState, ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { loadTrackerData } from "@/lib/supabase/data";

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const result = await loadTrackerData(params.month);

  if (!result.configured) {
    return <SetupNotice />;
  }

  if (!result.user) {
    redirect("/login");
  }

  if (result.error || !result.data) {
    return <ErrorState message={result.error ?? "Неизвестная ошибка"} />;
  }

  const { profile, selectedMonth, categories, preferences } = result.data;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal">Настройки</h1>
        <p className="text-sm text-muted-foreground">Профиль, цель месяца, категории и экспорт.</p>
      </div>

      {!selectedMonth ? <EmptyMonthState /> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Профиль</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateSettingsAction} className="space-y-4">
              <input type="hidden" name="monthId" value={selectedMonth?.id ?? ""} />
              <div className="space-y-2">
                <Label htmlFor="name">Имя</Label>
                <Input id="name" name="name" defaultValue={profile?.name ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Часовой пояс</Label>
                <Input id="timezone" name="timezone" defaultValue={profile?.timezone ?? "Asia/Yekaterinburg"} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="targetPercent">Целевой темп месяца</Label>
                <Input
                  id="targetPercent"
                  name="targetPercent"
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="2"
                  defaultValue={selectedMonth?.target_percent ?? 0.8}
                />
                <p className="text-xs text-muted-foreground">Введите 0.8 для 80%, 0.9 для 90%.</p>
              </div>
              <Button type="submit">Сохранить настройки</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Данные</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild variant="outline">
              <Link href="/settings/export">
                <Download className="h-4 w-4" />
                Экспорт всех данных
              </Link>
            </Button>
            {selectedMonth ? (
              <Button asChild variant="outline">
                <Link href={`/settings/export-month?month=${selectedMonth.id}`}>
                  <Download className="h-4 w-4" />
                  Экспорт выбранного месяца
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Смена пароля</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={changePasswordAction} className="grid gap-4 lg:grid-cols-3 lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Текущий пароль</Label>
              <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Новый пароль</Label>
              <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={12} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Повторите новый пароль</Label>
              <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required />
            </div>
            <div className="lg:col-span-3">
              <Button type="submit">Обновить пароль</Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Пароль меняется в Supabase Auth. В базе приложения он не хранится.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      <ReminderSettings preferences={preferences} />

      <ImportJson />

      <Card>
        <CardHeader>
          <CardTitle>Категории</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={createCategoryAction} className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="settings-category">Название</Label>
              <Input id="settings-category" name="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-color">Цвет</Label>
              <Input id="settings-color" name="color" type="color" defaultValue="#2563eb" />
            </div>
            <Button type="submit">Добавить</Button>
          </form>
          {categories.length ? (
            <div className="space-y-3">
              {categories.map((category) => (
                <div key={category.id} className="rounded-md border p-3">
                  <form action={updateCategoryAction} className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
                    <input type="hidden" name="id" value={category.id} />
                    <div className="space-y-2">
                      <Label htmlFor={`settings-category-name-${category.id}`}>Название</Label>
                      <Input
                        id={`settings-category-name-${category.id}`}
                        name="name"
                        defaultValue={category.name}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`settings-category-color-${category.id}`}>Цвет</Label>
                      <Input
                        id={`settings-category-color-${category.id}`}
                        name="color"
                        type="color"
                        defaultValue={category.color}
                      />
                    </div>
                    <Button type="submit" size="sm">
                      Сохранить
                    </Button>
                  </form>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <Badge variant="outline">
                      <span
                        className="mr-1.5 h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </Badge>
                    <form action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={category.id} />
                      <ConfirmSubmitButton
                        type="submit"
                        variant="destructive"
                        size="sm"
                        message={`Удалить категорию «${category.name}»? У задач эта категория будет очищена.`}
                      >
                        <Trash2 className="h-4 w-4" />
                        Удалить
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Категорий пока нет.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
