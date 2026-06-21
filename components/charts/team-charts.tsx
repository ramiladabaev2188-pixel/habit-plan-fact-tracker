"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { formatPercent, formatScore } from "@/lib/utils";

export type TeamTempoPoint = {
  name: string;
  forecastPercent: number;
  factScore: number;
};

export type TeamActivityPoint = {
  name: string;
  goalValue: number;
  challengeValue: number;
};

const tempoColors = {
  good: "#21835f",
  attention: "#d9822b",
  risk: "#cf3f35"
};

export function TeamTempoChart({ data }: { data: TeamTempoPoint[] }) {
  return (
    <div className="h-72 w-full" aria-label="График прогнозного темпа участников">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis
            domain={[0, 1.2]}
            tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
            tickLine={false}
            axisLine={false}
            fontSize={12}
          />
          <Tooltip
            formatter={(value) => formatPercent(Number(value))}
            labelFormatter={(label) => `Участник: ${label}`}
          />
          <ReferenceLine y={0.8} stroke="#d9822b" strokeDasharray="5 4" label={{ value: "цель 80%", fontSize: 11 }} />
          <Bar dataKey="forecastPercent" name="Прогнозный темп" radius={[5, 5, 0, 0]}>
            {data.map((point) => (
              <Cell
                key={point.name}
                fill={
                  point.forecastPercent >= 0.8
                    ? tempoColors.good
                    : point.forecastPercent >= 0.6
                      ? tempoColors.attention
                      : tempoColors.risk
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="sr-only">
        Прогнозный темп участников: {data.map((item) => `${item.name} ${formatPercent(item.forecastPercent)}`).join(", ")}.
      </p>
    </div>
  );
}

export function TeamInitiativeActivityChart({ data }: { data: TeamActivityPoint[] }) {
  const hasActivity = data.some((item) => item.goalValue > 0 || item.challengeValue > 0);

  if (!hasActivity) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-border bg-fog px-6 text-center text-sm text-muted-foreground">
        Когда участники начнут добавлять вклад в цели и челленджи, здесь появится карта активности.
      </div>
    );
  }

  return (
    <div className="h-72 w-full" aria-label="График вкладов в командные инициативы">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 4 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
          <YAxis tickLine={false} axisLine={false} fontSize={12} />
          <Tooltip formatter={(value) => formatScore(Number(value))} />
          <Bar dataKey="goalValue" name="Вклад в цели" stackId="activity" fill="#3478d4" radius={[0, 0, 0, 0]} />
          <Bar dataKey="challengeValue" name="Вклад в челленджи" stackId="activity" fill="#8f5bd2" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <p className="sr-only">
        Вклад в командные инициативы: {data.map((item) => `${item.name} ${formatScore(item.goalValue + item.challengeValue)}`).join(", ")}.
      </p>
    </div>
  );
}
