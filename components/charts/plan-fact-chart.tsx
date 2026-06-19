"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatScore } from "@/lib/utils";

type ChartPoint = {
  date: string;
  label: string;
  plan: number;
  fact: number;
};

export function PlanFactChart({ data }: { data: ChartPoint[] }) {
  const totalPlan = data.reduce((sum, item) => sum + item.plan, 0);
  const totalFact = data.reduce((sum, item) => sum + item.fact, 0);

  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label={`График план против факта по дням. План ${formatScore(totalPlan)}, факт ${formatScore(totalFact)}.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip formatter={(value) => formatScore(Number(value))} />
          <Legend />
          <Bar dataKey="plan" name="План" fill="#2563eb" radius={[4, 4, 0, 0]} />
          <Bar dataKey="fact" name="Факт" fill="#16a34a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CumulativePlanFactChart({ data }: { data: ChartPoint[] }) {
  let plan = 0;
  let fact = 0;
  const cumulative = data.map((point) => {
    plan += point.plan;
    fact += point.fact;
    return {
      ...point,
      plan: Number(plan.toFixed(2)),
      fact: Number(fact.toFixed(2))
    };
  });

  return (
    <div
      className="h-72 w-full"
      role="img"
      aria-label={`Накопительный график план против факта. Итоговый план ${formatScore(plan)}, итоговый факт ${formatScore(fact)}.`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={cumulative}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip formatter={(value) => formatScore(Number(value))} />
          <Legend />
          <Line
            type="monotone"
            dataKey="plan"
            name="План накопительно"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="fact"
            name="Факт накопительно"
            stroke="#16a34a"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
