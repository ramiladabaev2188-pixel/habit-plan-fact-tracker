"use client";

import Link from "next/link";
import type * as React from "react";
import type { Month } from "@/types/domain";
import { Select } from "@/components/ui/select";

export function MonthSwitcher({
  months,
  selectedMonth,
  basePath
}: {
  months: Month[];
  selectedMonth: Month | null;
  basePath: string;
}) {
  return (
    <form className="w-full sm:w-64">
      <Select
        name="month"
        defaultValue={selectedMonth?.id ?? ""}
        onChange={(event) => {
          window.location.href = `${basePath}?month=${event.currentTarget.value}`;
        }}
      >
        {months.map((month) => (
          <option key={month.id} value={month.id}>
            {month.title}
          </option>
        ))}
      </Select>
    </form>
  );
}

export function MonthLink({
  month,
  basePath,
  children
}: {
  month: Month;
  basePath: string;
  children: React.ReactNode;
}) {
  return <Link href={`${basePath}?month=${month.id}`}>{children}</Link>;
}
