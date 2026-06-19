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
import { formatPercent, formatScore } from "@/lib/utils";

type CategoryPoint = {
  name: string;
  plan: number;
  fact: number;
  percent: number;
};

export function CategoryChart({ data }: { data: CategoryPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            type="category"
            dataKey="name"
            width={90}
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <Tooltip
            formatter={(value, name) =>
              name === "percent"
                ? formatPercent(Number(value))
                : formatScore(Number(value))
            }
          />
          <Bar dataKey="plan" name="План" fill="#6b7f88" radius={[0, 4, 4, 0]} />
          <Bar dataKey="fact" name="Факт" fill="#187658" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
