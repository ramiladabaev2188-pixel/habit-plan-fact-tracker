import { Database, KeyRound } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center">
      <Card className="w-full">
        <CardHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-info/20 text-info">
            <Database className="h-6 w-6" />
          </div>
          <CardTitle>Нужны ключи Supabase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Создайте `.env.local` по примеру `.env.example`, примените SQL из
            `supabase/migrations`, затем перезапустите dev-сервер.
          </p>
          <div className="rounded-md border bg-muted/50 p-4 font-mono text-xs text-foreground">
            NEXT_PUBLIC_SUPABASE_URL=...
            <br />
            NEXT_PUBLIC_SUPABASE_ANON_KEY=...
          </div>
          <div className="flex items-center gap-2 text-foreground">
            <KeyRound className="h-4 w-4 text-info" />
            После входа можно загрузить демо-данные в настройках.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
