import { redirect } from "next/navigation";
import { addCarServiceLogAction, upsertCarAction, upsertCarServiceItemAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { getTodayKey } from "@/lib/dates/month";
import { carStatusLabels, carSystemLabels, formatMoney, getCarServiceState } from "@/lib/practical";
import { loadCarPage, loadTrackerData } from "@/lib/supabase/data";
import type { CarServiceStatus, CarSystem } from "@/types/domain";

const statusVariant: Record<CarServiceStatus, "success" | "warning" | "destructive" | "outline"> = {
  ok: "success",
  soon: "warning",
  overdue: "destructive",
  unknown: "outline"
};

const systemKeys = Object.keys(carSystemLabels) as CarSystem[];

export default async function CarPage() {
  const [trackerResult, carResult] = await Promise.all([loadTrackerData(undefined), loadCarPage()]);

  if (!trackerResult.configured) {
    return <SetupNotice />;
  }

  if (!trackerResult.user) {
    redirect("/login");
  }

  if (trackerResult.error || !trackerResult.data) {
    return <ErrorState message={trackerResult.error ?? "Неизвестная ошибка"} />;
  }

  if (carResult.error) {
    return <ErrorState message={carResult.error} />;
  }

  const today = getTodayKey();
  const firstCar = carResult.cars[0] ?? null;
  const itemsWithState = carResult.serviceItems.map((item) => {
    const car = carResult.cars.find((candidate) => candidate.id === item.car_id);
    return car ? { item, car, state: getCarServiceState(item, car) } : null;
  }).filter(Boolean);
  const risks = itemsWithState.filter((row) => row?.state.status === "overdue" || row?.state.status === "soon");

  return (
    <div className="app-page space-y-6">
      <div className="workspace-header">
        <div>
          <div className="page-kicker">Практический контур</div>
          <h1 className="workspace-title mt-1">Авто</h1>
          <p className="workspace-subtitle">
            Обслуживание по датам и пробегу: что нормально, что скоро менять, что уже просрочено.
          </p>
        </div>
        <Badge variant={risks.length ? "warning" : "success"}>
          {risks.length ? `Рисков: ${risks.length}` : "Без срочных рисков"}
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Автомобиль</CardTitle>
            <CardDescription>Добавьте машину и текущий пробег.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={upsertCarAction} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="car-name">Название</Label>
                <Input id="car-name" name="name" placeholder="Мой автомобиль" defaultValue={firstCar?.name ?? ""} required />
                {firstCar ? <input type="hidden" name="id" value={firstCar.id} /> : null}
              </div>
              <Field id="brand" name="brand" label="Марка" defaultValue={firstCar?.brand ?? ""} />
              <Field id="model" name="model" label="Модель" defaultValue={firstCar?.model ?? ""} />
              <NumberField id="year" name="year" label="Год" defaultValue={firstCar?.year ?? ""} />
              <NumberField id="currentMileage" name="currentMileage" label="Текущий пробег" defaultValue={firstCar?.current_mileage ?? 0} />
              <div className="sm:col-span-2">
                <Button type="submit">{firstCar ? "Обновить авто" : "Добавить авто"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Новый узел обслуживания</CardTitle>
            <CardDescription>Например масло двигателя, тормозная жидкость, фильтры.</CardDescription>
          </CardHeader>
          <CardContent>
            {carResult.cars.length ? (
              <form action={upsertCarServiceItemAction} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="service-car">Авто</Label>
                  <Select id="service-car" name="carId" required>
                    {carResult.cars.map((car) => (
                      <option key={car.id} value={car.id}>
                        {car.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="system">Система</Label>
                  <Select id="system" name="system" defaultValue="engine">
                    {systemKeys.map((system) => (
                      <option key={system} value={system}>
                        {carSystemLabels[system]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="service-name">Название узла</Label>
                  <Input id="service-name" name="name" placeholder="Масло двигателя" required />
                </div>
                <DateField id="lastServiceDate" name="lastServiceDate" label="Последняя дата" />
                <NumberField id="lastServiceMileage" name="lastServiceMileage" label="Последний пробег" />
                <NumberField id="intervalMonths" name="intervalMonths" label="Интервал, мес." />
                <NumberField id="intervalKm" name="intervalKm" label="Интервал, км" />
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="service-comment">Комментарий</Label>
                  <Textarea id="service-comment" name="comment" />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit">Добавить узел</Button>
                </div>
              </form>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Сначала добавьте автомобиль.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="section-panel">
        <CardHeader>
          <CardTitle>Карта обслуживания</CardTitle>
          <CardDescription>Статус считается по дате, пробегу или обоим условиям.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {itemsWithState.length ? (
            itemsWithState.map((row) => {
              if (!row) return null;
              return (
                <div key={row.item.id} className="rounded-lg border border-border/80 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{row.item.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {row.car.name} · {carSystemLabels[row.item.system]}
                      </div>
                    </div>
                    <Badge variant={statusVariant[row.state.status]}>{carStatusLabels[row.state.status]}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-4">
                    <span>Следующая дата: {row.state.nextDate ?? "—"}</span>
                    <span>До даты: {row.state.daysLeft === null ? "—" : `${row.state.daysLeft} дн.`}</span>
                    <span>След. пробег: {row.state.nextMileage ?? "—"}</span>
                    <span>Осталось км: {row.state.kmLeft ?? "—"}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Узлов обслуживания пока нет.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="section-panel">
          <CardHeader>
            <CardTitle>Запись обслуживания</CardTitle>
            <CardDescription>История обновит пробег авто и последний сервис выбранного узла.</CardDescription>
          </CardHeader>
          <CardContent>
            {carResult.cars.length ? (
              <form action={addCarServiceLogAction} className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="log-car">Авто</Label>
                  <Select id="log-car" name="carId">
                    {carResult.cars.map((car) => (
                      <option key={car.id} value={car.id}>
                        {car.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="log-item">Узел</Label>
                  <Select id="log-item" name="serviceItemId">
                    <option value="">Без узла</option>
                    {carResult.serviceItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <DateField id="serviceDate" name="serviceDate" label="Дата" defaultValue={today} />
                <NumberField id="mileage" name="mileage" label="Пробег" defaultValue={firstCar?.current_mileage ?? 0} />
                <NumberField id="cost" name="cost" label="Стоимость" defaultValue={0} />
                <div className="space-y-2">
                  <Label htmlFor="log-comment">Комментарий</Label>
                  <Textarea id="log-comment" name="comment" />
                </div>
                <Button type="submit">Сохранить работу</Button>
              </form>
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Сначала добавьте автомобиль.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="section-panel">
          <CardHeader>
            <CardTitle>История</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {carResult.serviceLogs.length ? (
              carResult.serviceLogs.map((log) => {
                const car = carResult.cars.find((item) => item.id === log.car_id);
                const serviceItem = carResult.serviceItems.find((item) => item.id === log.service_item_id);
                return (
                  <div key={log.id} className="rounded-lg border border-border/80 p-4 text-sm">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div className="font-semibold">{serviceItem?.name ?? "Работа без узла"}</div>
                      <div>{formatMoney(log.cost)}</div>
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {log.service_date} · {car?.name ?? "Авто"} · {log.mileage} км
                    </div>
                    {log.comment ? <p className="mt-2 text-muted-foreground">{log.comment}</p> : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Истории обслуживания пока нет.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ id, name, label, defaultValue }: { id: string; name: string; label: string; defaultValue?: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} defaultValue={defaultValue} />
    </div>
  );
}

function NumberField({
  id,
  name,
  label,
  defaultValue
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string | number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type="number" min={0} step={1} defaultValue={defaultValue} />
    </div>
  );
}

function DateField({
  id,
  name,
  label,
  defaultValue
}: {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type="date" defaultValue={defaultValue} />
    </div>
  );
}
