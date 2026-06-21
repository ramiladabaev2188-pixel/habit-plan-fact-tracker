import { redirect } from "next/navigation";

/**
 * The daily screen is now the single responsive experience for both desktop
 * and phone. Keep this route as a compatibility redirect for old bookmarks.
 */
export default async function MobilePage({
  searchParams
}: {
  searchParams: Promise<{ month?: string; date?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  if (params.month) {
    query.set("month", params.month);
  }

  if (params.date) {
    query.set("date", params.date);
  }

  const suffix = query.size ? `?${query.toString()}` : "";
  redirect(`/daily${suffix}`);
}
