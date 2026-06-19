import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ErrorState({ message }: { message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          Не удалось загрузить данные
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{message}</CardContent>
    </Card>
  );
}

export function EmptyMonthState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Месяц ещё не создан</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Создайте первый месяц и план в разделе планирования.</p>
        <Button asChild>
          <Link href="/planner">Открыть план</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
