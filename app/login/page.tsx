import { redirect } from "next/navigation";
import { signInAction, signUpAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SetupNotice } from "@/components/shared/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = getSafeNextPath(params.next);

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    redirect(next ?? "/dashboard");
  }

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-6 md:grid-cols-[1fr_440px]">
        <section className="space-y-5">
          <div className="inline-flex rounded-md bg-info/20 px-3 py-1 text-sm font-medium text-info">
            MVP трекера привычек
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-semibold tracking-normal sm:text-5xl">
              Планируй месяц и закрывай день за минуту
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Баллы, прогноз, риски и план/факт привычек в одном рабочем интерфейсе.
            </p>
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Вход</CardTitle>
            {params.message ? (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {params.message}
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-6">
            <form action={signInAction} className="space-y-4">
              {next ? <input type="hidden" name="next" value={next} /> : null}
              <div className="space-y-2">
                <Label htmlFor="email">Почта</Label>
                <Input id="email" name="email" type="email" required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full">
                Войти
              </Button>
            </form>

            <Separator />

            <form action={signUpAction} className="space-y-4">
              {next ? <input type="hidden" name="next" value={next} /> : null}
              <div className="space-y-2">
                <Label htmlFor="name">Имя</Label>
                <Input id="name" name="name" required autoComplete="name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Почта</Label>
                <Input id="signup-email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Пароль</Label>
                <Input id="signup-password" name="password" type="password" required minLength={12} />
              </div>
              <Button type="submit" variant="secondary" className="w-full">
                Создать аккаунт
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function getSafeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  return value.startsWith("/team/invite/") ? value : null;
}
