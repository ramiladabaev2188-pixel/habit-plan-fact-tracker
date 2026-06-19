"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatPercent } from "@/lib/utils";

type MonthPoint = {
  title: string;
  completion: number;
  forecast: number;
};

export function MonthComparisonChart({ data }: { data: MonthPoint[] }) {
  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label={`График сравнения ${data.length} месяцев по выполнению и прогнозу.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="title" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
          />
          <Tooltip formatter={(value) => formatPercent(Number(value))} />
          <Bar dataKey="completion" name="Выполнение" fill="#187658" radius={[4, 4, 0, 0]} />
          <Bar dataKey="forecast" name="Прогноз" fill="#6b7f88" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
