import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center p-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <WifiOff className="h-5 w-5 text-info" />
            Нет соединения
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Приложение открыло offline-экран. Последние посещенные страницы могут быть доступны из кеша,
            а новые данные сохранятся после восстановления интернета.
          </p>
          <Button asChild>
            <Link href="/dashboard">Открыть дашборд</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
