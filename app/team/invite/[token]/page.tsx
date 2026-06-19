import { redirect } from "next/navigation";
import { acceptTeamInviteAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/shared/page-state";
import { SetupNotice } from "@/components/shared/setup-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function TeamInvitePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?message=${encodeURIComponent("Войдите, чтобы принять приглашение в команду")}`);
  }

  const { data: invites, error } = await supabase.rpc("get_team_invite_by_token", {
    invite_token: token
  });
  const invite = invites?.[0] ?? null;

  if (error || !invite) {
    return <ErrorState message={error?.message ?? "Приглашение не найдено или уже недоступно"} />;
  }

  const teamName = invite.team_name || "Команда";
  const { data: existingMember } = await supabase
    .from("team_members")
    .select("status")
    .eq("team_id", invite.team_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMember?.status === "active") {
    return (
      <div className="mx-auto max-w-xl space-y-5 pt-10 md:pl-64">
        <Card>
          <CardHeader>
            <CardTitle>Вы уже в команде</CardTitle>
            <CardDescription>
              Вы уже состоите в команде “{teamName}”. Приглашение не меняет вашу роль.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href={`/team?team=${invite.team_id}`}>Открыть команду</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invite.accepted_at) {
    return <ErrorState message="Это приглашение уже использовано" />;
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return <ErrorState message="Срок действия приглашения истек" />;
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 pt-10 md:pl-64">
      <Card>
        <CardHeader>
          <CardTitle>Приглашение в команду</CardTitle>
          <CardDescription>
            Вы присоединитесь к команде и сможете видеть общий командный прогресс.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-muted/60 p-4">
            <div className="text-sm text-muted-foreground">Команда</div>
            <div className="mt-1 text-lg font-semibold">{teamName}</div>
          </div>
          <form action={acceptTeamInviteAction}>
            <input type="hidden" name="token" value={token} />
            <Button type="submit" className="w-full">Принять приглашение</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
